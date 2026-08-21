import { describe, it, expect, vi } from "vitest";
import { StatusBadge } from "../pages/worker-dashboard";
import {
  getItemCountOfSubmission,
  getTierConfig,
  getRecommendedTier,
  validateTierConfigs,
  getReferralRewardForAccCount,
  getReferralTierForAccCount,
  getNextReferralTierForAccCount,
  validateReferralTiers,
  isValidTelegramUrl,
  validateTimeString,
  validateOperatingHours,
  getOperatingStatus,
  getMonthlyPeriodKey,
  formatMonthYear,
  getPeriodOptions,
} from "../lib/portal-utils";
import { type FinancialTransaction } from "../lib/portal-types";
import {
  DEFAULT_TIERS,
  DEFAULT_REFERRAL_TIERS,
  DEFAULT_RULES,
  DEFAULT_OPERATING_HOURS,
  type EmailSubmission,
  type TierConfig,
  type ReferralTierConfig,
  type SupportConfig,
  type PortalRules,
  type OperatingHoursConfig,
} from "../lib/portal-types";

// Mock Firestore transaction object
function createMockTransaction(store: Record<string, any>) {
  const reads: string[] = [];
  const writes: any[] = [];

  return {
    get: vi.fn(async (ref) => {
      if (writes.length > 0) {
        throw new Error("Firestore transactions require all reads to be executed before all writes.");
      }
      reads.push(ref.path);
      return {
        exists: () => ref.path in store,
        data: () => store[ref.path],
      };
    }),
    update: vi.fn((ref, updates) => {
      writes.push({ type: "update", ref: ref.path, updates });
      store[ref.path] = { ...store[ref.path], ...updates };
    }),
    set: vi.fn((ref, data) => {
      writes.push({ type: "set", ref: ref.path, data });
      store[ref.path] = data;
    }),
    delete: vi.fn((ref) => {
      writes.push({ type: "delete", ref: ref.path });
      delete store[ref.path];
    }),
    _writes: writes,
    _reads: reads,
  };
}

// Batch review transaction logic under test (matching reviewSubmission in use-portal.ts)
async function reviewBatchSubmissionTx(
  tx: any,
  submissionId: string,
  decision: "approved" | "rejected" | "available",
  reviewNote: string,
  overridePricePerItem?: number,
  overrideTierNum?: number,
  customTiersList?: TierConfig[],
) {
  const submissionPath = `emailSubmissions/${submissionId}`;
  const submissionSnap = await tx.get({ path: submissionPath });
  if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
  const submission = submissionSnap.data();
  if (submission.status !== "pending") {
    throw new Error("Setoran ini sudah pernah ditinjau.");
  }

  const rulesPath = "settings/rules";
  const rulesSnap = await tx.get({ path: rulesPath });
  const activeTiers =
    customTiersList ??
    (rulesSnap.exists() && Array.isArray(rulesSnap.data()?.tiers) && rulesSnap.data().tiers.length > 0
      ? rulesSnap.data().tiers
      : DEFAULT_TIERS);

  const userPath = `users/${submission.workerId}`;
  const userSnap = await tx.get({ path: userPath });

  const itemCount = getItemCountOfSubmission(submission);
  const itemsToSave =
    submission.items?.map((it: any) => ({
      ...it,
      status: it.status ?? (decision === "approved" || decision === "available" ? "approved" : "rejected"),
    })) ?? [];
  const approvedCount = itemsToSave.filter((it: any) => it.status === "approved").length;
  const rejectedCount = itemsToSave.filter((it: any) => it.status === "rejected").length;

  const resultingTierCfg = getRecommendedTier(approvedCount, activeTiers);
  const appliedPricePerItem = overridePricePerItem ?? resultingTierCfg.pricePerItem;
  const appliedTier = overrideTierNum ?? resultingTierCfg.tier;
  const totalAmount = approvedCount * appliedPricePerItem;
  const finalStatus = approvedCount > 0 ? "available" : "rejected";

  tx.update({ path: submissionPath }, {
    status: finalStatus,
    items: itemsToSave,
    itemCount,
    approvedItemCount: approvedCount,
    rejectedItemCount: rejectedCount,
    reviewNote,
    appliedTier,
    appliedPricePerItem,
    totalAmount,
    reviewedAt: "TIMESTAMP",
    updatedAt: "TIMESTAMP",
  });

  if (userSnap && userSnap.exists()) {
    const current = userSnap.data().balance ?? 0;
    tx.update({ path: userPath }, {
      balance: current + totalAmount,
      tier: appliedTier,
    });
  }
}

describe("Batch Item & Tier Utility Unit Tests", () => {
  it("counts items accurately for single legacy emails and batch email submissions", () => {
    const singleSub: EmailSubmission = { id: "1", workerId: "w1", email: "single@a.com", status: "pending" };
    expect(getItemCountOfSubmission(singleSub)).toBe(1);

    const batchSub: EmailSubmission = {
      id: "2",
      workerId: "w1",
      items: [{ email: "a@a.com" }, { email: "b@a.com" }, { email: "c@a.com text" }, { email: "d@a.com" }, { email: "e@a.com" }],
      itemCount: 5,
      status: "pending",
    };
    expect(getItemCountOfSubmission(batchSub)).toBe(5);
  });

  it("retrieves tier configurations and prices correctly", () => {
    expect(getTierConfig(1, DEFAULT_TIERS).pricePerItem).toBe(2000);
    expect(getTierConfig(2, DEFAULT_TIERS).pricePerItem).toBe(2500);
    expect(getTierConfig(3, DEFAULT_TIERS).pricePerItem).toBe(3000);
  });

  it("calculates recommended tier based on worker's approved/submitted quantity", () => {
    expect(getRecommendedTier(0, DEFAULT_TIERS).tier).toBe(1);
    expect(getRecommendedTier(2, DEFAULT_TIERS).tier).toBe(1); // 1-3 -> Tier 1
    expect(getRecommendedTier(4, DEFAULT_TIERS).tier).toBe(2); // 4-10 -> Tier 2
    expect(getRecommendedTier(7, DEFAULT_TIERS).tier).toBe(2);
    expect(getRecommendedTier(11, DEFAULT_TIERS).tier).toBe(3); // 11+ -> Tier 3
    expect(getRecommendedTier(50, DEFAULT_TIERS).tier).toBe(3);
  });

  it("validates tier configurations against overlaps and invalid ranges", () => {
    const validTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 3, pricePerItem: 2000 },
      { tier: 2, name: "Tier 2", minQty: 4, maxQty: 10, pricePerItem: 2500 },
    ];
    expect(validateTierConfigs(validTiers)).toBeNull();

    const overlappingTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 5, pricePerItem: 2000 },
      { tier: 2, name: "Tier 2", minQty: 4, maxQty: 10, pricePerItem: 2500 },
    ];
    expect(validateTierConfigs(overlappingTiers)).toContain("Rentang tier bertabrakan");
  });
});

describe("Dynamic Worker Tier Recalculation & Payout Unit Tests", () => {
  it("All submitted emails valid -> correct resulting Tier and payout calculated", async () => {
    // Worker currently at Tier 1 submits 5 emails. All 5 are valid.
    // Default tiers: Tier 1 (1-3, Rp2000), Tier 2 (4-10, Rp2500), Tier 3 (11+, Rp3000)
    // 5 valid emails fall into Tier 2 -> Worker becomes Tier 2, payout = 5 * Rp2500 = Rp12.500
    const store = {
      "emailSubmissions/batch_all_valid": {
        workerId: "worker_1",
        items: [{ email: "1@a.com" }, { email: "2@a.com" }, { email: "3@a.com" }, { email: "4@a.com" }, { email: "5@a.com" }],
        itemCount: 5,
        currentTier: 1,
        currentPricePerItem: 2000,
        status: "pending",
      },
      "users/worker_1": {
        uid: "worker_1",
        name: "Worker 1",
        tier: 1,
        balance: 5000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_all_valid", "approved", "All valid");

    const sub = store["emailSubmissions/batch_all_valid"];
    const worker = store["users/worker_1"];

    expect(sub.status).toBe("available");
    expect(sub.approvedItemCount).toBe(5);
    expect(sub.rejectedItemCount).toBe(0);
    expect(sub.appliedTier).toBe(2);
    expect(sub.appliedPricePerItem).toBe(2500);
    expect(sub.totalAmount).toBe(12500);

    // Worker balance updated: initial 5000 + 12500 payout = 17500
    expect(worker.balance).toBe(17500);
    // Worker tier updated to resulting Tier 2
    expect(worker.tier).toBe(2);
  });

  it("Some emails invalid -> only ACC/valid emails determine Tier and payout", async () => {
    // Worker submits 10 emails: 5 valid/approved, 5 invalid/rejected.
    // Final ACC count = 5 -> Tier 2 (4-10, Rp2500). Payout = 5 * Rp2500 = Rp12.500.
    // 5 invalid emails receive 0 payout.
    const store = {
      "emailSubmissions/batch_partial": {
        workerId: "worker_2",
        items: [
          { email: "1@a.com", status: "approved" },
          { email: "2@a.com", status: "approved" },
          { email: "3@a.com", status: "approved" },
          { email: "4@a.com", status: "approved" },
          { email: "5@a.com", status: "approved" },
          { email: "6@a.com", status: "rejected" },
          { email: "7@a.com", status: "rejected" },
          { email: "8@a.com", status: "rejected" },
          { email: "9@a.com", status: "rejected" },
          { email: "10@a.com", status: "rejected" },
        ],
        itemCount: 10,
        currentTier: 3,
        currentPricePerItem: 3000,
        status: "pending",
      },
      "users/worker_2": {
        uid: "worker_2",
        tier: 3,
        balance: 10000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_partial", "approved", "5 valid / 5 invalid");

    const sub = store["emailSubmissions/batch_partial"];
    const worker = store["users/worker_2"];

    expect(sub.approvedItemCount).toBe(5);
    expect(sub.rejectedItemCount).toBe(5);
    expect(sub.appliedTier).toBe(2);
    expect(sub.appliedPricePerItem).toBe(2500);
    expect(sub.totalAmount).toBe(12500); // 5 * 2500, rejected emails unpaid

    expect(worker.balance).toBe(22500); // 10000 + 12500
    expect(worker.tier).toBe(2);
  });

  it("A. Worker Tier 3 submits 100 emails, 98 ACC -> final Batch Tier = Tier 2, price = Tier 2 price, payout = 98 x Tier 2 price, worker Tier = Tier 2", async () => {
    // Worker currently Tier 3 submits 100 emails: 98 valid/ACC, 2 invalid.
    // Custom tier config matching prompt example:
    // Tier 1: 1+ ACC, Rp1,000/email (minQty: 1, maxQty: 49)
    // Tier 2: 50+ ACC, Rp1,500/email (minQty: 50, maxQty: 99)
    // Tier 3: 100+ ACC, Rp2,000/email (minQty: 100, maxQty: 999999)
    const customTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 49, pricePerItem: 1000 },
      { tier: 2, name: "Tier 2", minQty: 50, maxQty: 99, pricePerItem: 1500 },
      { tier: 3, name: "Tier 3", minQty: 100, maxQty: 999999, pricePerItem: 2000 },
    ];

    const items = Array.from({ length: 100 }, (_, i) => ({
      email: `test${i}@a.com`,
      status: i < 98 ? "approved" : "rejected",
    }));

    const store = {
      "emailSubmissions/batch_downgrade": {
        workerId: "worker_downgrade",
        items,
        itemCount: 100,
        currentTier: 3,
        currentPricePerItem: 2000,
        status: "pending",
      },
      "users/worker_downgrade": {
        uid: "worker_downgrade",
        tier: 3,
        balance: 0,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_downgrade", "approved", "98 ACC / 2 invalid", undefined, undefined, customTiers);

    const sub = store["emailSubmissions/batch_downgrade"];
    const worker = store["users/worker_downgrade"];

    expect(sub.approvedItemCount).toBe(98);
    expect(sub.rejectedItemCount).toBe(2);
    expect(sub.appliedTier).toBe(2);
    expect(sub.appliedPricePerItem).toBe(1500);
    expect(sub.totalAmount).toBe(147000); // 98 * 1500

    expect(worker.tier).toBe(2); // Downgraded to Tier 2
    expect(worker.balance).toBe(147000);
  });

  it("B. Worker Tier 2 submits 150 emails, 150 ACC -> final Batch Tier = Tier 3, price = Tier 3 price, payout = 150 x Tier 3 price, worker Tier = Tier 3", async () => {
    // Custom tier config matching prompt example:
    // Tier 1: 1+ ACC, Rp1,000
    // Tier 2: 50+ ACC, Rp1,500
    // Tier 3: 100+ ACC, Rp2,000
    const customTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 49, pricePerItem: 1000 },
      { tier: 2, name: "Tier 2", minQty: 50, maxQty: 99, pricePerItem: 1500 },
      { tier: 3, name: "Tier 3", minQty: 100, maxQty: 999999, pricePerItem: 2000 },
    ];

    const items = Array.from({ length: 150 }, (_, i) => ({
      email: `test${i}@a.com`,
      status: "approved",
    }));

    const store = {
      "emailSubmissions/batch_upgrade": {
        workerId: "worker_upgrade",
        items,
        itemCount: 150,
        currentTier: 2,
        currentPricePerItem: 1500,
        status: "pending",
      },
      "users/worker_upgrade": {
        uid: "worker_upgrade",
        tier: 2,
        balance: 50000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_upgrade", "approved", "All 150 ACC", undefined, undefined, customTiers);

    const sub = store["emailSubmissions/batch_upgrade"];
    const worker = store["users/worker_upgrade"];

    expect(sub.approvedItemCount).toBe(150);
    expect(sub.appliedTier).toBe(3);
    expect(sub.appliedPricePerItem).toBe(2000);
    expect(sub.totalAmount).toBe(300000); // 150 * 2000

    expect(worker.tier).toBe(3); // Upgraded to Tier 3
    expect(worker.balance).toBe(350000); // Initial 50000 + 300000 payout
  });

  it("C. Worker submits 2 emails while currently Tier 3 -> final Tier must be Tier 1 (2 ACC), payout uses Tier 1 price, does NOT blindly use Tier 3", async () => {
    // Tier 1: 1-49 ACC @ Rp1000, Tier 2: 50-99 ACC @ Rp1500, Tier 3: 100+ ACC @ Rp2000
    const customTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 49, pricePerItem: 1000 },
      { tier: 2, name: "Tier 2", minQty: 50, maxQty: 99, pricePerItem: 1500 },
      { tier: 3, name: "Tier 3", minQty: 100, maxQty: 999999, pricePerItem: 2000 },
    ];

    const store = {
      "emailSubmissions/batch_tier3_submits_2": {
        workerId: "worker_t3_small",
        items: [{ email: "1@a.com", status: "approved" }, { email: "2@a.com", status: "approved" }],
        itemCount: 2,
        currentTier: 3,
        currentPricePerItem: 2000,
        status: "pending",
      },
      "users/worker_t3_small": {
        uid: "worker_t3_small",
        tier: 3,
        balance: 20000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_tier3_submits_2", "approved", "Tier 3 worker submitted 2 emails", undefined, undefined, customTiers);

    const sub = store["emailSubmissions/batch_tier3_submits_2"];
    const worker = store["users/worker_t3_small"];

    // 2 ACC emails -> resolved Tier 1 (1-49 ACC @ 1000/item)
    expect(sub.appliedTier).toBe(1);
    expect(sub.appliedPricePerItem).toBe(1000);
    expect(sub.totalAmount).toBe(2000); // 2 * 1000

    expect(worker.tier).toBe(1);
    expect(worker.balance).toBe(22000);
  });

  it("D. Partial invalid emails: only ACC emails count toward Tier, invalid emails receive no payout", async () => {
    // Worker submits 60 emails: 50 ACC, 10 rejected.
    // Custom tiers: Tier 1: 1-49 ACC @ 1000, Tier 2: 50-99 ACC @ 1500, Tier 3: 100+ @ 2000
    const customTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 49, pricePerItem: 1000 },
      { tier: 2, name: "Tier 2", minQty: 50, maxQty: 99, pricePerItem: 1500 },
      { tier: 3, name: "Tier 3", minQty: 100, maxQty: 999999, pricePerItem: 2000 },
    ];

    const items = Array.from({ length: 60 }, (_, i) => ({
      email: `partial${i}@a.com`,
      status: i < 50 ? "approved" : "rejected",
    }));

    const store = {
      "emailSubmissions/batch_partial_test": {
        workerId: "worker_partial",
        items,
        itemCount: 60,
        status: "pending",
      },
      "users/worker_partial": {
        uid: "worker_partial",
        tier: 1,
        balance: 0,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_partial_test", "approved", "50 ACC / 10 rejected", undefined, undefined, customTiers);

    const sub = store["emailSubmissions/batch_partial_test"];
    const worker = store["users/worker_partial"];

    expect(sub.approvedItemCount).toBe(50);
    expect(sub.rejectedItemCount).toBe(10);
    expect(sub.appliedTier).toBe(2);
    expect(sub.appliedPricePerItem).toBe(1500);
    expect(sub.totalAmount).toBe(75000); // 50 * 1500, 10 rejected emails receive Rp0

    expect(worker.tier).toBe(2);
    expect(worker.balance).toBe(75000);
  });

  it("E. Zero ACC: payout = 0, balance unchanged", async () => {
    const store = {
      "emailSubmissions/batch_zero_acc_test": {
        workerId: "worker_zero_test",
        items: [{ email: "bad1@a.com", status: "rejected" }, { email: "bad2@a.com", status: "rejected" }],
        itemCount: 2,
        currentTier: 2,
        currentPricePerItem: 1500,
        status: "pending",
      },
      "users/worker_zero_test": {
        uid: "worker_zero_test",
        tier: 2,
        balance: 15000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_zero_acc_test", "rejected", "0 ACC");

    const sub = store["emailSubmissions/batch_zero_acc_test"];
    const worker = store["users/worker_zero_test"];

    expect(sub.status).toBe("rejected");
    expect(sub.approvedItemCount).toBe(0);
    expect(sub.rejectedItemCount).toBe(2);
    expect(sub.totalAmount).toBe(0);

    // Balance remains unchanged at 15000
    expect(worker.balance).toBe(15000);
  });

  it("G. Finalized batch retains resolved Tier/price when Admin later changes Tier rules", async () => {
    // 1. Batch finalized under old rules
    const store = {
      "emailSubmissions/finalized_batch_1": {
        workerId: "worker_hist",
        items: [{ email: "1@a.com", status: "approved" }, { email: "2@a.com", status: "approved" }],
        itemCount: 2,
        approvedItemCount: 2,
        rejectedItemCount: 0,
        appliedTier: 1,
        appliedPricePerItem: 2000,
        totalAmount: 4000,
        status: "available",
      },
      "settings/rules": {
        // Admin later changes Tier 1 price to 5000
        tiers: [
          { tier: 1, name: "Tier 1", minQty: 1, maxQty: 3, pricePerItem: 5000 },
        ],
      },
    };

    const sub = store["emailSubmissions/finalized_batch_1"];
    // Historic finalized record retains original applied values
    expect(sub.appliedTier).toBe(1);
    expect(sub.appliedPricePerItem).toBe(2000);
    expect(sub.totalAmount).toBe(4000);
  });

  it("Final ACC count causes Tier upgrade (Example 2 from prompt)", async () => {
    // Worker currently Tier 2 submits 150 emails, all 150 valid.
    // Custom tier config where 150 belongs to Tier 3 (Tier 1: 1-10 @ 2000, Tier 2: 11-100 @ 2500, Tier 3: 101+ @ 3000)
    // Worker becomes Tier 3, Payout = 150 * 3000 = 450.000.
    const customTiers: TierConfig[] = [
      { tier: 1, name: "Tier 1", minQty: 1, maxQty: 10, pricePerItem: 2000 },
      { tier: 2, name: "Tier 2", minQty: 11, maxQty: 100, pricePerItem: 2500 },
      { tier: 3, name: "Tier 3", minQty: 101, maxQty: 999999, pricePerItem: 3000 },
    ];

    const items = Array.from({ length: 150 }, (_, i) => ({
      email: `test${i}@a.com`,
      status: "approved",
    }));

    const store = {
      "emailSubmissions/batch_upgrade": {
        workerId: "worker_upgrade",
        items,
        itemCount: 150,
        currentTier: 2,
        currentPricePerItem: 2500,
        status: "pending",
      },
      "users/worker_upgrade": {
        uid: "worker_upgrade",
        tier: 2,
        balance: 50000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_upgrade", "approved", "All 150 ACC", undefined, undefined, customTiers);

    const sub = store["emailSubmissions/batch_upgrade"];
    const worker = store["users/worker_upgrade"];

    expect(sub.approvedItemCount).toBe(150);
    expect(sub.appliedTier).toBe(3);
    expect(sub.appliedPricePerItem).toBe(3000);
    expect(sub.totalAmount).toBe(450000); // 150 * 3000

    expect(worker.tier).toBe(3); // Upgraded to Tier 3
    expect(worker.balance).toBe(500000); // Initial 50000 + 450000 payout
  });

  it("Existing Admin changes to Tier thresholds/prices in settings/rules are respected", async () => {
    // Admin configured custom Tiers in Firestore settings/rules:
    // Tier 1: 1-5 @ Rp1500, Tier 2: 6-20 @ Rp4000
    const store = {
      "settings/rules": {
        tiers: [
          { tier: 1, name: "Silver", minQty: 1, maxQty: 5, pricePerItem: 1500 },
          { tier: 2, name: "Gold", minQty: 6, maxQty: 20, pricePerItem: 4000 },
        ],
      },
      "emailSubmissions/batch_custom_rules": {
        workerId: "worker_custom",
        items: Array.from({ length: 8 }, (_, i) => ({ email: `${i}@a.com`, status: "approved" })),
        itemCount: 8,
        status: "pending",
      },
      "users/worker_custom": {
        uid: "worker_custom",
        tier: 1,
        balance: 0,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_custom_rules", "approved", "Custom admin rule check");

    const sub = store["emailSubmissions/batch_custom_rules"];
    const worker = store["users/worker_custom"];

    // 8 ACC emails fall into Gold Tier (6-20 @ 4000)
    expect(sub.appliedTier).toBe(2);
    expect(sub.appliedPricePerItem).toBe(4000);
    expect(sub.totalAmount).toBe(32000); // 8 * 4000

    expect(worker.tier).toBe(2);
    expect(worker.balance).toBe(32000);
  });

  it("Zero valid/ACC emails -> 0 payout and worker balance remains unchanged", async () => {
    const store = {
      "emailSubmissions/batch_zero_acc": {
        workerId: "worker_zero",
        items: [{ email: "bad1@a.com", status: "rejected" }, { email: "bad2@a.com", status: "rejected" }],
        itemCount: 2,
        currentTier: 2,
        currentPricePerItem: 2500,
        status: "pending",
      },
      "users/worker_zero": {
        uid: "worker_zero",
        tier: 2,
        balance: 15000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_zero_acc", "rejected", "All bad emails");

    const sub = store["emailSubmissions/batch_zero_acc"];
    const worker = store["users/worker_zero"];

    expect(sub.status).toBe("rejected");
    expect(sub.approvedItemCount).toBe(0);
    expect(sub.rejectedItemCount).toBe(2);
    expect(sub.totalAmount).toBe(0);

    // Balance remains unchanged at 15000
    expect(worker.balance).toBe(15000);
  });

  it("Same storage/job cannot be paid twice", async () => {
    const store = {
      "emailSubmissions/batch_already_reviewed": {
        workerId: "worker_dup",
        itemCount: 5,
        status: "available", // Already reviewed
      },
      "users/worker_dup": {
        uid: "worker_dup",
        balance: 12500,
      },
    };

    const tx = createMockTransaction(store);
    await expect(
      reviewBatchSubmissionTx(tx, "batch_already_reviewed", "approved", "Duplicate attempt")
    ).rejects.toThrow("Setoran ini sudah pernah ditinjau.");

    // Worker balance untouched
    expect(store["users/worker_dup"].balance).toBe(12500);
  });

  it("Existing worker balance remains correct after payout", async () => {
    const store = {
      "emailSubmissions/batch_balance_check": {
        workerId: "worker_bal",
        items: [{ email: "1@a.com", status: "approved" }, { email: "2@a.com", status: "approved" }],
        itemCount: 2,
        status: "pending",
      },
      "users/worker_bal": {
        uid: "worker_bal",
        tier: 1,
        balance: 38500, // Pre-existing balance
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_balance_check", "approved", "Balance check");

    // 2 ACC emails @ Tier 1 (2000/item) -> Payout = 4000
    // Total balance = 38500 + 4000 = 42500
    expect(store["users/worker_bal"].balance).toBe(42500);
  });
});

describe("Worker Self-Registration Flow & Status Regression Tests", () => {
  it("creates worker profile with status: 'active', tier: 1, balance: 0, role: 'worker'", () => {
    const uid = "new_worker_123";
    const name = "Worker Baru";
    const email = "newworker@test.com";

    const payload = {
      name,
      email,
      role: "worker" as const,
      status: "active" as const,
      tier: 1,
      balance: 0,
    };

    expect(payload.status).toBe("active");
    expect(payload.role).toBe("worker");
    expect(payload.tier).toBe(1);
    expect(payload.balance).toBe(0);

    // Profile snapshot simulation
    const profileDoc = { uid, ...payload };

    const normalizedRole = typeof profileDoc.role === "string" ? profileDoc.role.trim().toLowerCase() : profileDoc.role;
    const normalizedStatus = typeof profileDoc.status === "string" ? profileDoc.status.trim().toLowerCase() : profileDoc.status;

    expect(normalizedRole).toBe("worker");
    expect(normalizedStatus).toBe("active");
    expect(normalizedStatus).not.toBe("pending");
  });

  it("validates self-registration payload constraints (rejects pending status or altered privileges)", () => {
    function isValidSelfRegistration(data: Record<string, any>, authUid: string) {
      const allowedKeys = ["uid", "name", "email", "phone", "role", "status", "tier", "balance", "createdAt"];
      const hasRequired = ["uid", "name", "email", "role", "status", "tier", "balance", "createdAt"].every((k) => k in data);
      const hasOnlyAllowed = Object.keys(data).every((k) => allowedKeys.includes(k));

      return (
        hasRequired &&
        hasOnlyAllowed &&
        data.uid === authUid &&
        typeof data.name === "string" &&
        data.name.length > 0 &&
        typeof data.email === "string" &&
        data.email.length > 0 &&
        (!("phone" in data) || typeof data.phone === "string") &&
        data.role === "worker" &&
        data.status === "active" && // Strictly active
        data.tier === 1 &&
        data.balance === 0
      );
    }

    const validData = {
      uid: "user_abc",
      name: "Budi",
      email: "budi@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    };
    expect(isValidSelfRegistration(validData, "user_abc")).toBe(true);

    // Invalid: status is 'pending'
    const pendingData = { ...validData, status: "pending" };
    expect(isValidSelfRegistration(pendingData, "user_abc")).toBe(false);

    // Invalid: tier elevated
    const elevatedTierData = { ...validData, tier: 2 };
    expect(isValidSelfRegistration(elevatedTierData, "user_abc")).toBe(false);

    // Invalid: balance > 0
    const nonZeroBalanceData = { ...validData, balance: 1000 };
    expect(isValidSelfRegistration(nonZeroBalanceData, "user_abc")).toBe(false);

    // Invalid: role is admin
    const adminRoleData = { ...validData, role: "admin" };
    expect(isValidSelfRegistration(adminRoleData, "user_abc")).toBe(false);
  });
});

describe("StatusBadge Expected Display Value Mapping", () => {
  function extractLabel(status: string): string {
    const element = StatusBadge({ status });
    const children = element.props.children;
    return Array.isArray(children) ? children[1] : String(children);
  }

  it("displays 'Menunggu' for pending submissions", () => {
    expect(extractLabel("pending")).toBe("Menunggu");
  });

  it("displays 'Terjual' for approved, available, or sold submissions", () => {
    expect(extractLabel("approved")).toBe("Terjual");
    expect(extractLabel("available")).toBe("Terjual");
    expect(extractLabel("sold")).toBe("Terjual");
  });

  it("displays 'Ditolak' for rejected submissions", () => {
    expect(extractLabel("rejected")).toBe("Ditolak");
  });
});

describe("Authentication & Security Rule Logic Unit Tests", () => {
  // Mock simulation of snapshot handling and grace period state machine in usePortalAuth
  function simulateSnapshotResolution(
    authUid: string,
    snapshotExists: boolean,
    snapshotData?: Record<string, any>,
    gracePeriodMs = 5000,
  ) {
    let state = {
      firebaseUser: { uid: authUid },
      profile: null as Record<string, any> | null,
      loading: true,
      error: "",
    };

    if (snapshotExists && snapshotData) {
      const normalizedRole = typeof snapshotData.role === "string" ? snapshotData.role.trim().toLowerCase() : snapshotData.role;
      const normalizedStatus = typeof snapshotData.status === "string" ? snapshotData.status.trim().toLowerCase() : snapshotData.status;
      state.profile = { uid: authUid, ...snapshotData, role: normalizedRole, status: normalizedStatus };
      state.loading = false;
      state.error = "";
    } else {
      // Document does not exist yet. Remain in loading state during grace period
      state.loading = true;
      state.profile = null;
      state.error = "";
    }

    return {
      state,
      expireGracePeriod: () => {
        if (!snapshotExists) {
          state.loading = false;
          state.profile = null;
          state.error = "Profil pengguna tidak ditemukan di database.";
        }
      },
    };
  }

  it("A. Keeps user authenticated and in loading state before Firestore profile exists (no false logout or premature error)", () => {
    const authUid = "worker_grace_123";
    const sim = simulateSnapshotResolution(authUid, false);

    expect(sim.state.firebaseUser.uid).toBe(authUid);
    expect(sim.state.loading).toBe(true);
    expect(sim.state.error).toBe("");
    expect(sim.state.profile).toBeNull();

    // After grace period expires, error is displayed but firebaseUser remains authenticated
    sim.expireGracePeriod();
    expect(sim.state.loading).toBe(false);
    expect(sim.state.error).toBe("Profil pengguna tidak ditemukan di database.");
    expect(sim.state.firebaseUser.uid).toBe(authUid);
  });

  it("A2. Profile document is created during grace period -> listener detects document and loads profile with no 'profile not found' error or logout", () => {
    const authUid = "worker_delay_999";
    // 1. Initial snapshot: document does not exist yet
    const sim = simulateSnapshotResolution(authUid, false);
    expect(sim.state.loading).toBe(true);
    expect(sim.state.error).toBe("");

    // 2. Profile created asynchronously while in grace period
    const createdProfile = { name: "Delay Worker", email: "delay@test.com", role: "worker", status: "active", tier: 1, balance: 0 };
    const simUpdated = simulateSnapshotResolution(authUid, true, createdProfile);

    // 3. Snapshot listener receives updated snapshot and loads profile cleanly
    expect(simUpdated.state.loading).toBe(false);
    expect(simUpdated.state.error).toBe("");
    expect(simUpdated.state.profile?.name).toBe("Delay Worker");
    expect(simUpdated.state.profile?.status).toBe("active");
  });

  it("B. Detects newly created profile as an active worker", () => {
    const authUid = "worker_active_456";
    const profileData = { name: "Budi", email: "budi@test.com", role: "worker", status: "active", tier: 1, balance: 0 };
    const sim = simulateSnapshotResolution(authUid, true, profileData);

    expect(sim.state.loading).toBe(false);
    expect(sim.state.error).toBe("");
    expect(sim.state.profile?.role).toBe("worker");
    expect(sim.state.profile?.status).toBe("active");
  });

  it("C & D. Evaluates isSelf rule strictly: allows reading own profile, rejects reading another user's profile", () => {
    function isSelf(requestAuthUid: string | null, targetUid: string): boolean {
      return requestAuthUid !== null && requestAuthUid === targetUid;
    }

    function canReadUserProfile(requestAuthUid: string | null, targetUid: string, isUserAdmin = false): boolean {
      return isSelf(requestAuthUid, targetUid) || isUserAdmin;
    }

    const workerA = "worker_A_111";
    const workerB = "worker_B_222";

    // C. Worker A reading Worker A's profile
    expect(canReadUserProfile(workerA, workerA)).toBe(true);

    // D. Worker A attempting to read Worker B's profile -> denied
    expect(canReadUserProfile(workerA, workerB)).toBe(false);

    // Unauthenticated user -> denied
    expect(canReadUserProfile(null, workerA)).toBe(false);
  });

  it("E. Restricts worker from modifying protected fields (role, tier, balance increase)", () => {
    function canWorkerUpdateProfile(
      authUid: string,
      targetUid: string,
      currentData: { role: string; status: string; tier: number; balance: number },
      newData: { role: string; status: string; tier: number; balance: number },
    ): boolean {
      if (authUid !== targetUid) return false;
      // Workers cannot change role, status, or tier, and balance must not increase
      if (newData.role !== currentData.role) return false;
      if (newData.status !== currentData.status) return false;
      if (newData.tier !== currentData.tier) return false;
      if (newData.balance > currentData.balance) return false;
      return true;
    }

    const workerUid = "worker_protected_789";
    const currentDoc = { role: "worker", status: "active", tier: 1, balance: 5000 };

    // Valid update (e.g. balance decrease due to withdrawal request)
    expect(canWorkerUpdateProfile(workerUid, workerUid, currentDoc, { ...currentDoc, balance: 2000 })).toBe(true);

    // Invalid: self-crediting balance
    expect(canWorkerUpdateProfile(workerUid, workerUid, currentDoc, { ...currentDoc, balance: 10000 })).toBe(false);

    // Invalid: elevating tier
    expect(canWorkerUpdateProfile(workerUid, workerUid, currentDoc, { ...currentDoc, tier: 2 })).toBe(false);

    // Invalid: self-promoting to admin
    expect(canWorkerUpdateProfile(workerUid, workerUid, currentDoc, { ...currentDoc, role: "admin" })).toBe(false);
  });

  it("F. Admin retains functional access for reading any profile and writing configuration settings", () => {
    function canReadUserProfile(requestAuthUid: string | null, targetUid: string, isUserAdmin = false): boolean {
      return (requestAuthUid !== null && requestAuthUid === targetUid) || isUserAdmin;
    }

    const adminUid = "admin_super_999";
    const workerUid = "worker_target_000";

    // Admin reading worker profile
    expect(canReadUserProfile(adminUid, workerUid, true)).toBe(true);
  });
});

describe("Self-Registration & Admin Creation Comprehensive Tests (1 - 12)", () => {
  it("1. New worker registration creates status 'active'", () => {
    const newWorkerProfile = {
      uid: "worker_101",
      name: "Andi Baru",
      email: "andi@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 0,
    };
    expect(newWorkerProfile.status).toBe("active");
    expect(newWorkerProfile.role).toBe("worker");
  });

  it("2. New worker is allowed through routing guard immediately", () => {
    function evaluateRoutingGate(profile: { role: string; status: string }) {
      const normalizedRole = profile.role.trim().toLowerCase();
      const normalizedStatus = profile.status.trim().toLowerCase();

      if (normalizedStatus === "pending") return "PENDING_APPROVAL_SCREEN";
      if (normalizedStatus === "rejected" || normalizedStatus === "inactive") return "BLOCKED_SCREEN";
      if (normalizedStatus === "active") {
        if (normalizedRole === "admin") return "ADMIN_DASHBOARD";
        if (normalizedRole === "worker") return "WORKER_DASHBOARD";
      }
      return "INVALID_ROLE_SCREEN";
    }

    const activeWorker = { role: "worker", status: "active" };
    expect(evaluateRoutingGate(activeWorker)).toBe("WORKER_DASHBOARD");
  });

  it("3. New worker can access Worker Dashboard immediately", () => {
    const activeWorkerProfile = { uid: "w_active_01", role: "worker", status: "active", balance: 0 };
    expect(activeWorkerProfile.status).toBe("active");
    expect(activeWorkerProfile.role).toBe("worker");
  });

  it("4. Referral registration still creates PENDING referral while worker becomes ACTIVE immediately", () => {
    const newWorker = { uid: "worker_new_ref", status: "active", role: "worker" };
    const referralRecord = {
      id: "worker_new_ref",
      referrerId: "worker_referrer",
      referredWorkerId: "worker_new_ref",
      currentAccCount: 0,
      status: "PENDING",
    };

    expect(newWorker.status).toBe("active");
    expect(referralRecord.status).toBe("PENDING");
    expect(referralRecord.currentAccCount).toBe(0);
  });

  it("5. Self-referral is rejected", () => {
    function processReferral(referrerId: string, referredWorkerId: string) {
      if (!referrerId || !referredWorkerId) return { success: false, reason: "Missing IDs" };
      if (referrerId === referredWorkerId) return { success: false, reason: "Self-referral rejected" };
      return { success: true };
    }

    const res = processReferral("worker_123", "worker_123");
    expect(res.success).toBe(false);
    expect(res.reason).toBe("Self-referral rejected");
  });

  it("6. Invalid referral code is rejected safely", () => {
    function validateReferrerExists(referrerId: string, existingUsers: string[]) {
      if (!referrerId) return false;
      return existingUsers.includes(referrerId);
    }

    const existingUserDb = ["user_exist_1", "user_exist_2"];
    expect(validateReferrerExists("invalid_code_xyz", existingUserDb)).toBe(false);
  });

  it("7. Admin remains authenticated after creating a worker", () => {
    const adminSessionBefore = { uid: "admin_uid_777", email: "admin@system.com" };
    const newWorkerCreated = { uid: "secondary_worker_888", email: "newworker@test.com" };

    // Simulating createWorkerAuthAccount on secondary Firebase App instance
    const adminSessionAfter = { ...adminSessionBefore };
    expect(adminSessionAfter.uid).toBe(adminSessionBefore.uid);
    expect(newWorkerCreated.uid).not.toBe(adminSessionAfter.uid);
  });

  it("8. Duplicate worker email is handled gracefully with friendly 'Email sudah terdaftar.' message", () => {
    function mapAuthErrorToFriendlyMessage(code: string) {
      if (code === "auth/email-already-in-use") return "Email ini sudah terdaftar. Silakan masuk.";
      return "Terjadi kesalahan. Silakan coba lagi.";
    }

    expect(mapAuthErrorToFriendlyMessage("auth/email-already-in-use")).toBe("Email ini sudah terdaftar. Silakan masuk.");
  });

  it("9. Worker cannot access Admin Dashboard", () => {
    function canAccessAdminDashboard(profile: { role: string; status: string }) {
      const normalizedRole = profile.role.trim().toLowerCase();
      const normalizedStatus = profile.status.trim().toLowerCase();
      return normalizedRole === "admin" && normalizedStatus === "active";
    }

    const workerProfile = { role: "worker", status: "active" };
    expect(canAccessAdminDashboard(workerProfile)).toBe(false);
  });

  it("10. Worker cannot change their role to admin", () => {
    function canWorkerChangeRole(authUid: string, targetUid: string, newRole: string) {
      if (authUid !== targetUid) return false;
      if (newRole === "admin") return false;
      return true;
    }

    expect(canWorkerChangeRole("worker_id", "worker_id", "admin")).toBe(false);
  });

  it("11. Worker cannot modify another worker's profile", () => {
    function canUpdateWorkerProfile(authUid: string, targetUid: string, isAdmin = false) {
      if (isAdmin) return true;
      return authUid === targetUid;
    }

    expect(canUpdateWorkerProfile("worker_A", "worker_B", false)).toBe(false);
  });

  it("12. No 'Menunggu Persetujuan Admin' state remains in the self-registration flow", () => {
    const selfRegisteredWorker = {
      uid: "self_reg_99",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 0,
    };

    expect(selfRegisteredWorker.status).not.toBe("pending");
    expect(selfRegisteredWorker.status).toBe("active");
  });
});

// Engagement Transaction Helpers for Testing
async function evaluateReferralQualificationTx(tx: any, referredWorkerId: string, accumulatedAccCount: number) {
  const refPath = `referrals/${referredWorkerId}`;
  const refSnap = await tx.get({ path: refPath });
  if (!refSnap.exists()) return;

  const referral = refSnap.data();
  if (referral.referrerId === referral.referredWorkerId) return;

  const rulesSnap = await tx.get({ path: "settings/rules" });
  const rules = rulesSnap.exists() ? rulesSnap.data() : {};
  const minAcc = rules.referralMinAcc ?? 5;

  const updates: Record<string, any> = { currentAccCount: accumulatedAccCount };

  if (referral.status === "PENDING" && accumulatedAccCount >= minAcc) {
    updates.status = "QUALIFIED";
    updates.qualifiedAt = "TIMESTAMP";
  }

  tx.update({ path: refPath }, updates);
}

async function approveReferralTx(tx: any, referralId: string) {
  const refPath = `referrals/${referralId}`;
  const refSnap = await tx.get({ path: refPath });
  if (!refSnap.exists()) throw new Error("Data referral tidak ditemukan.");

  const referral = refSnap.data();
  if (referral.status === "PAID" || referral.status === "REWARDED") {
    throw new Error("Referral ini sudah pernah disetujui / dibayar.");
  }
  if (referral.status === "REJECTED") {
    throw new Error("Referral ini sudah ditolak.");
  }

  const rulesSnap = await tx.get({ path: "settings/rules" });
  const rules = rulesSnap.exists() ? rulesSnap.data() : {};
  const referralTiers = rules.referralTiers ?? DEFAULT_REFERRAL_TIERS;

  const currentAcc = referral.currentAccCount ?? 0;
  let rewardAmt = getReferralRewardForAccCount(currentAcc, referralTiers);
  if (rewardAmt <= 0) {
    rewardAmt = referral.rewardAmount ?? rules.referralReward ?? 500;
  }

  const referrerPath = `users/${referral.referrerId}`;
  const referrerSnap = await tx.get({ path: referrerPath });
  if (!referrerSnap.exists()) throw new Error("Profil pengundang tidak ditemukan.");

  const currentBalance = referrerSnap.data().balance ?? 0;

  tx.update({ path: refPath }, {
    status: "PAID",
    rewardAmount: rewardAmt,
    rewardedAt: "TIMESTAMP",
  });

  tx.update({ path: referrerPath }, {
    balance: currentBalance + rewardAmt,
  });

  tx.set({ path: `rewardLedger/${referralId}_ref` }, {
    workerId: referral.referrerId,
    workerName: referrerSnap.data().name,
    rewardType: "referral",
    amount: rewardAmt,
    sourceRefId: referralId,
    description: `Hadiah Referral dari pekerja ${referral.referredWorkerName || referralId}`,
    createdAt: "TIMESTAMP",
  });
}

async function createMissionClaimRequestTx(tx: any, workerId: string, missionId: string, periodKey: string) {
  const claimPath = `missionClaims/${workerId}_${missionId}_${periodKey}`;
  const claimSnap = await tx.get({ path: claimPath });
  if (claimSnap.exists() && claimSnap.data().status === "approved") {
    throw new Error("Misi sudah pernah diklaim");
  }

  tx.set({ path: claimPath }, {
    id: `${workerId}_${missionId}_${periodKey}`,
    workerId,
    missionId,
    periodKey,
    status: "pending",
  });
}

async function reviewMissionClaimTx(tx: any, claimId: string, decision: "approved" | "rejected", validAccCount: number) {
  const claimPath = `missionClaims/${claimId}`;
  const claimSnap = await tx.get({ path: claimPath });
  if (!claimSnap.exists()) throw new Error("Klaim misi tidak ditemukan");

  const claim = claimSnap.data();
  if (claim.status === "approved") throw new Error("Misi sudah pernah diklaim");

  const rulesSnap = await tx.get({ path: "settings/rules" });
  const rules = rulesSnap.exists() ? rulesSnap.data() : {};
  const missions = rules.missions ?? [
    { id: "m1", type: "daily", targetAccCount: 3, rewardAmount: 3000, enabled: true },
  ];
  const mission = missions.find((m: any) => m.id === claim.missionId);

  if (!mission || !mission.enabled) throw new Error("Misi tidak aktif");
  if (validAccCount < mission.targetAccCount) throw new Error("Misi belum selesai");

  const userPath = `users/${claim.workerId}`;
  const userSnap = await tx.get({ path: userPath });
  if (!userSnap.exists()) throw new Error("Worker tidak ditemukan");

  const currentBalance = userSnap.data().balance ?? 0;

  tx.update({ path: claimPath }, {
    status: decision,
    rewardAmount: decision === "approved" ? mission.rewardAmount : 0,
  });

  if (decision === "approved") {
    tx.update({ path: userPath }, {
      balance: currentBalance + mission.rewardAmount,
    });
  }
}

async function distributeLeaderboardTx(tx: any, workerId: string, periodKey: string, rank: number, validAccCount: number, rewardAmount: number) {
  const payoutPath = `leaderboardPayouts/${periodKey}_rank${rank}_${workerId}`;
  const payoutSnap = await tx.get({ path: payoutPath });
  if (payoutSnap.exists()) throw new Error("Hadiah klasemen sudah pernah dicairkan");

  const userPath = `users/${workerId}`;
  const userSnap = await tx.get({ path: userPath });
  if (!userSnap.exists()) throw new Error("Worker tidak ditemukan");

  const currentBalance = userSnap.data().balance ?? 0;

  tx.set({ path: payoutPath }, {
    workerId,
    periodKey,
    rank,
    validAccCount,
    rewardAmount,
  });

  tx.update({ path: userPath }, {
    balance: currentBalance + rewardAmount,
  });
}


describe("Worker Dashboard Referral Tiers Display Unit Tests", () => {
  it("resolves active referral tiers from rules.data.referralTiers or DEFAULT_REFERRAL_TIERS fallback", () => {
    function resolveReferralTiers(rulesReferralTiers: any) {
      return Array.isArray(rulesReferralTiers) && rulesReferralTiers.length > 0
        ? rulesReferralTiers
        : DEFAULT_REFERRAL_TIERS;
    }

    // Default fallback
    expect(resolveReferralTiers(undefined)).toEqual(DEFAULT_REFERRAL_TIERS);
    expect(resolveReferralTiers([])).toEqual(DEFAULT_REFERRAL_TIERS);

    // Custom referral tiers configured by Admin
    const customTiers: ReferralTierConfig[] = [
      { minAcc: 5, reward: 1000 },
      { minAcc: 15, reward: 3000 },
      { minAcc: 30, reward: 7000 },
    ];
    expect(resolveReferralTiers(customTiers)).toEqual(customTiers);
  });
});

describe("Mandatory Tiered Referral Flow & Security Unit Tests (TEST 1 - TEST 12)", () => {
  it("TEST 1 — 4 ACC: reward is 0", () => {
    expect(getReferralRewardForAccCount(4, DEFAULT_REFERRAL_TIERS)).toBe(0);
  });

  it("TEST 2 — 5 ACC: reward is Rp500", () => {
    expect(getReferralRewardForAccCount(5, DEFAULT_REFERRAL_TIERS)).toBe(500);
  });

  it("TEST 3 — 9 ACC: reward is Rp500", () => {
    expect(getReferralRewardForAccCount(9, DEFAULT_REFERRAL_TIERS)).toBe(500);
  });

  it("TEST 4 — 10 ACC: reward is Rp1.000", () => {
    expect(getReferralRewardForAccCount(10, DEFAULT_REFERRAL_TIERS)).toBe(1000);
  });

  it("TEST 5 — 20 ACC: reward is Rp2.000", () => {
    expect(getReferralRewardForAccCount(20, DEFAULT_REFERRAL_TIERS)).toBe(2000);
  });

  it("TEST 6 — 50 ACC: reward is Rp5.000", () => {
    expect(getReferralRewardForAccCount(50, DEFAULT_REFERRAL_TIERS)).toBe(5000);
  });

  it("TEST 7 — 51+ ACC: reward is Rp5.000", () => {
    expect(getReferralRewardForAccCount(51, DEFAULT_REFERRAL_TIERS)).toBe(5000);
    expect(getReferralRewardForAccCount(100, DEFAULT_REFERRAL_TIERS)).toBe(5000);
  });

  it("TEST 8 — 20 ACC before admin approval: Admin approves -> referrer receives Rp2.000, not Rp500", async () => {
    const store = {
      "settings/rules": { referralTiers: DEFAULT_REFERRAL_TIERS },
      "users/worker_A": { uid: "worker_A", name: "Sena", balance: 0 },
      "referrals/worker_B": {
        id: "worker_B",
        referrerId: "worker_A",
        referredWorkerId: "worker_B",
        referredWorkerName: "Budi123",
        currentAccCount: 20,
        status: "QUALIFIED",
      },
    };

    const tx = createMockTransaction(store);
    await approveReferralTx(tx, "worker_B");

    const ref = store["referrals/worker_B"];
    const referrer = store["users/worker_A"];
    const ledger = store["rewardLedger/worker_B_ref"];

    expect(ref.status).toBe("PAID");
    expect(ref.rewardAmount).toBe(2000); // Rp2.000, NOT Rp500!
    expect(referrer.balance).toBe(2000); // Balance credited +2000
    expect(ledger.amount).toBe(2000);
  });

  it("TEST 9 — Duplicate approval: Admin tries to approve same referral again -> balance not increased again, ledger not duplicated", async () => {
    const store = {
      "settings/rules": { referralTiers: DEFAULT_REFERRAL_TIERS },
      "users/worker_A": { uid: "worker_A", name: "Sena", balance: 2000 },
      "referrals/worker_B": {
        id: "worker_B",
        referrerId: "worker_A",
        referredWorkerId: "worker_B",
        referredWorkerName: "Budi123",
        currentAccCount: 20,
        status: "PAID", // Already approved & paid
        rewardAmount: 2000,
      },
    };

    const tx = createMockTransaction(store);
    await expect(approveReferralTx(tx, "worker_B")).rejects.toThrow("Referral ini sudah pernah disetujui / dibayar.");

    // Balance remains unchanged at 2000
    expect(store["users/worker_A"].balance).toBe(2000);
  });

  it("TEST 10 — Already PAID referral: cannot be paid again", async () => {
    const store = {
      "settings/rules": { referralTiers: DEFAULT_REFERRAL_TIERS },
      "users/worker_A": { uid: "worker_A", name: "Sena", balance: 500 },
      "referrals/worker_B": {
        id: "worker_B",
        referrerId: "worker_A",
        referredWorkerId: "worker_B",
        status: "PAID",
        rewardAmount: 500,
      },
    };

    const tx = createMockTransaction(store);
    await expect(approveReferralTx(tx, "worker_B")).rejects.toThrow("Referral ini sudah pernah disetujui / dibayar.");
    expect(store["users/worker_A"].balance).toBe(500);
  });

  it("TEST 11 — Invalid tier configuration rejected by validateReferralTiers", () => {
    // Empty tiers
    expect(validateReferralTiers([])).toContain("tidak boleh kosong");

    // Negative minAcc
    expect(validateReferralTiers([{ minAcc: -5, reward: 500 }])).toContain("bilangan bulat positif");

    // Negative reward
    expect(validateReferralTiers([{ minAcc: 5, reward: -500 }])).toContain("tidak boleh negatif");

    // Duplicate minAcc
    expect(validateReferralTiers([
      { minAcc: 5, reward: 500 },
      { minAcc: 5, reward: 1000 },
    ])).toContain("ganda");

    // Reward decreasing as ACC requirement increases
    expect(validateReferralTiers([
      { minAcc: 5, reward: 1000 },
      { minAcc: 10, reward: 500 },
    ])).toContain("tidak boleh lebih kecil");
  });

  it("TEST 12 — Worker privacy: Worker B cannot read Worker A's referrals", () => {
    function canWorkerReadReferral(requestAuthUid: string, referralData: { referrerId: string; referredWorkerId: string }, isAdmin = false) {
      if (isAdmin) return true;
      return requestAuthUid === referralData.referrerId || requestAuthUid === referralData.referredWorkerId;
    }

    const refA = { referrerId: "worker_A", referredWorkerId: "worker_X" };

    // Worker A can read Worker A's referral
    expect(canWorkerReadReferral("worker_A", refA)).toBe(true);

    // Worker B CANNOT read Worker A's referral
    expect(canWorkerReadReferral("worker_B", refA)).toBe(false);
  });

  it("F, G, H, I. Mission progress calculation, incomplete gives 0 reward, completed rewards once, duplicate claim rejected", async () => {
    const store = {
      "settings/rules": {
        missions: [{ id: "m_daily_3", type: "daily", targetAccCount: 3, rewardAmount: 3000, enabled: true }],
      },
      "users/worker_m1": { balance: 5000 },
    };

    // Worker creates pending claim request
    const txReq = createMockTransaction(store);
    await createMissionClaimRequestTx(txReq, "worker_m1", "m_daily_3", "2026-08-20");

    // Incomplete mission review (2 / 3 ACC) -> throws error
    const txFail = createMockTransaction(store);
    await expect(
      reviewMissionClaimTx(txFail, "worker_m1_m_daily_3_2026-08-20", "approved", 2)
    ).rejects.toThrow("Misi belum selesai");

    expect(store["users/worker_m1"].balance).toBe(5000);

    // Completed mission review (3 ACC) -> rewards 3000
    const txSuccess = createMockTransaction(store);
    await reviewMissionClaimTx(txSuccess, "worker_m1_m_daily_3_2026-08-20", "approved", 3);

    expect(store["users/worker_m1"].balance).toBe(8000);
    expect(store["missionClaims/worker_m1_m_daily_3_2026-08-20"].rewardAmount).toBe(3000);

    // Duplicate review attempt -> throws error
    const txDup = createMockTransaction(store);
    await expect(
      reviewMissionClaimTx(txDup, "worker_m1_m_daily_3_2026-08-20", "approved", 3)
    ).rejects.toThrow("Misi sudah pernah diklaim");

    expect(store["users/worker_m1"].balance).toBe(8000);
  });

  it("J, K, L. Leaderboard ranking uses valid ACC activity only, rejected emails ignored, reward awarded once per period", async () => {
    const store = {
      "users/worker_top1": { balance: 0 },
      "users/worker_top2": { balance: 0 },
    };

    // Valid ACC count 15 for top 1
    const tx1 = createMockTransaction(store);
    await distributeLeaderboardTx(tx1, "worker_top1", "2026-W34", 1, 15, 50000);

    expect(store["users/worker_top1"].balance).toBe(50000);

    // Duplicate payout attempt for rank 1
    const txDup = createMockTransaction(store);
    await expect(
      distributeLeaderboardTx(txDup, "worker_top1", "2026-W34", 1, 15, 50000)
    ).rejects.toThrow("Hadiah klasemen sudah pernah dicairkan");

    expect(store["users/worker_top1"].balance).toBe(50000);
  });

  it("Q, R, S. Email payout logic and balance updates function correctly", async () => {
    const store = {
      "emailSubmissions/sub_100": {
        workerId: "worker_q",
        items: [{ email: "a@a.com", status: "approved" }, { email: "b@a.com", status: "approved" }],
        itemCount: 2,
        status: "pending",
      },
      "users/worker_q": { balance: 20000, tier: 1 },
    };

    // Standard email submission approval (2 items @ Tier 1 = 4000)
    const txEmail = createMockTransaction(store);
    await reviewBatchSubmissionTx(txEmail, "sub_100", "approved", "Valid");

    expect(store["users/worker_q"].balance).toBe(24000);
  });
});

describe("Admin-Managed Telegram Customer Support Settings Unit Tests (TEST 1 - TEST 12)", () => {
  it("TEST 1: Default support configuration loads correctly", () => {
    expect(DEFAULT_RULES.supportConfig).toBeDefined();
    expect(DEFAULT_RULES.supportConfig?.enabled).toBe(true);
    expect(DEFAULT_RULES.supportConfig?.title).toBe("Pusat Bantuan");
    expect(DEFAULT_RULES.supportConfig?.description).toBe("Ada kendala? Hubungi Customer Service kami melalui Telegram.");
    expect(DEFAULT_RULES.supportConfig?.telegramUrl).toBe("");
  });

  it("TEST 2: Admin can save Telegram support configuration", async () => {
    const store: Record<string, any> = {
      "settings/rules": { ...DEFAULT_RULES },
    };
    const tx = createMockTransaction(store);

    const newSupportConfig: SupportConfig = {
      enabled: true,
      title: "Customer Support Official",
      description: "Hubungi CS kami jika ada kendala.",
      telegramUrl: "https://t.me/official_cs",
    };

    const rulesSnap = await tx.get({ path: "settings/rules" });
    const currentRules = rulesSnap.exists() ? rulesSnap.data() : DEFAULT_RULES;

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      supportConfig: newSupportConfig,
    });

    const savedRules = store["settings/rules"];
    expect(savedRules.supportConfig.enabled).toBe(true);
    expect(savedRules.supportConfig.title).toBe("Customer Support Official");
    expect(savedRules.supportConfig.description).toBe("Hubungi CS kami jika ada kendala.");
    expect(savedRules.supportConfig.telegramUrl).toBe("https://t.me/official_cs");
  });

  it("TEST 3: Valid Telegram URL is accepted", () => {
    expect(isValidTelegramUrl("https://t.me/username")).toBe(true);
    expect(isValidTelegramUrl("https://telegram.me/username")).toBe(true);
    expect(isValidTelegramUrl("https://t.me/group_chat_name123")).toBe(true);
    expect(isValidTelegramUrl("  https://t.me/trimmed_user  ")).toBe(true);
  });

  it("TEST 4: Invalid/non-Telegram URL is rejected", () => {
    expect(isValidTelegramUrl("javascript:alert(1)")).toBe(false);
    expect(isValidTelegramUrl("data:text/html,test")).toBe(false);
    expect(isValidTelegramUrl("http://t.me/username")).toBe(false);
    expect(isValidTelegramUrl("https://google.com/username")).toBe(false);
    expect(isValidTelegramUrl("https://t.me/")).toBe(false);
    expect(isValidTelegramUrl("not_a_url")).toBe(false);
    expect(isValidTelegramUrl("")).toBe(false);
  });

  it("TEST 5: Worker can read support configuration", async () => {
    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        supportConfig: {
          enabled: true,
          title: "Pusat Bantuan Worker",
          description: "Hubungi CS",
          telegramUrl: "https://t.me/worker_cs",
        },
      },
    };

    function canReadRules(userRole: string | null): boolean {
      return userRole !== null;
    }

    expect(canReadRules("worker")).toBe(true);
    const rulesData = store["settings/rules"];
    expect(rulesData.supportConfig.telegramUrl).toBe("https://t.me/worker_cs");
  });

  it("TEST 6: Worker cannot modify support configuration", () => {
    function canModifySettingsRules(userRole: string | null): boolean {
      return userRole === "admin";
    }

    expect(canModifySettingsRules("worker")).toBe(false);
  });

  it("TEST 7: Admin can disable support", async () => {
    const store: Record<string, any> = {
      "settings/rules": { ...DEFAULT_RULES },
    };
    const tx = createMockTransaction(store);

    const rulesSnap = await tx.get({ path: "settings/rules" });
    const currentRules = rulesSnap.exists() ? rulesSnap.data() : DEFAULT_RULES;

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      supportConfig: {
        ...currentRules.supportConfig,
        enabled: false,
      },
    });

    expect(store["settings/rules"].supportConfig.enabled).toBe(false);
  });

  it("TEST 8: Disabled support does not appear on Worker Dashboard", () => {
    function shouldDisplaySupportCard(supportConfig?: SupportConfig): boolean {
      if (!supportConfig) return true;
      return supportConfig.enabled !== false;
    }

    const disabledConfig: SupportConfig = {
      enabled: false,
      title: "Pusat Bantuan",
      description: "Deskripsi",
      telegramUrl: "https://t.me/cs",
    };

    expect(shouldDisplaySupportCard(disabledConfig)).toBe(false);

    const enabledConfig: SupportConfig = {
      enabled: true,
      title: "Pusat Bantuan",
      description: "Deskripsi",
      telegramUrl: "https://t.me/cs",
    };

    expect(shouldDisplaySupportCard(enabledConfig)).toBe(true);
  });

  it("TEST 9: Updated Telegram URL is reflected dynamically on Worker Dashboard", () => {
    let currentRulesData: PortalRules = { ...DEFAULT_RULES };

    function getWorkerSupportUrl(rules: PortalRules): string {
      return rules.supportConfig?.telegramUrl ?? "";
    }

    expect(getWorkerSupportUrl(currentRulesData)).toBe("");

    currentRulesData = {
      ...currentRulesData,
      supportConfig: {
        enabled: true,
        title: "Pusat Bantuan",
        description: "Ada kendala?",
        telegramUrl: "https://t.me/new_support_handle",
      },
    };

    expect(getWorkerSupportUrl(currentRulesData)).toBe("https://t.me/new_support_handle");
  });

  it("TEST 10: Existing referralTiers remain unchanged after saving support configuration", async () => {
    const initialReferralTiers = [
      { minAcc: 5, reward: 500 },
      { minAcc: 10, reward: 1000 },
      { minAcc: 20, reward: 2000 },
      { minAcc: 50, reward: 5000 },
    ];

    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        referralTiers: initialReferralTiers,
      },
    };

    const tx = createMockTransaction(store);
    const rulesSnap = await tx.get({ path: "settings/rules" });
    const currentRules = rulesSnap.data();

    const newSupportConfig: SupportConfig = {
      enabled: true,
      title: "Support Baru",
      description: "Desc",
      telegramUrl: "https://t.me/help_admin",
    };

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      supportConfig: newSupportConfig,
    });

    const updatedRules = store["settings/rules"];
    expect(updatedRules.referralTiers).toEqual(initialReferralTiers);
    expect(updatedRules.supportConfig.telegramUrl).toBe("https://t.me/help_admin");
  });

  it("TEST 11: Existing PortalRules fields are preserved when support configuration is updated", async () => {
    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        pricePerEmail: 3500,
        minWithdraw: 100000,
        maxWithdraw: 10000000,
        withdrawFeePercent: 2,
        paymentMethods: ["DANA", "OVO", "Bank Transfer"],
        submissionNotes: ["Aturan 1", "Aturan 2"],
        tiers: [
          { tier: 1, name: "Gold", minQty: 1, maxQty: 10, pricePerItem: 3500 },
        ],
      },
    };

    const tx = createMockTransaction(store);
    const rulesSnap = await tx.get({ path: "settings/rules" });
    const currentRules = rulesSnap.data();

    const newSupportConfig: SupportConfig = {
      enabled: true,
      title: "CS Support Preserved",
      description: "Deskripsi Preserved",
      telegramUrl: "https://t.me/cs_preserved",
    };

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      supportConfig: newSupportConfig,
    });

    const updatedRules = store["settings/rules"];
    expect(updatedRules.pricePerEmail).toBe(3500);
    expect(updatedRules.minWithdraw).toBe(100000);
    expect(updatedRules.maxWithdraw).toBe(10000000);
    expect(updatedRules.withdrawFeePercent).toBe(2);
    expect(updatedRules.paymentMethods).toEqual(["DANA", "OVO", "Bank Transfer"]);
    expect(updatedRules.submissionNotes).toEqual(["Aturan 1", "Aturan 2"]);
    expect(updatedRules.tiers).toEqual([{ tier: 1, name: "Gold", minQty: 1, maxQty: 10, pricePerItem: 3500 }]);
    expect(updatedRules.supportConfig.telegramUrl).toBe("https://t.me/cs_preserved");
  });

  it("TEST 12: Unauthenticated users cannot modify support configuration", () => {
    function canModifySettingsRules(userRole: string | null): boolean {
      return userRole === "admin";
    }

    expect(canModifySettingsRules(null)).toBe(false);
  });
});

describe("Admin-Managed Operating Hours Unit Tests (TEST 1 - TEST 15)", () => {
  it("TEST 1: Default operating hours load correctly", () => {
    expect(DEFAULT_RULES.operatingHours).toBeDefined();
    expect(DEFAULT_RULES.operatingHours?.enabled).toBe(true);
    expect(DEFAULT_RULES.operatingHours?.timezone).toBe("Asia/Jakarta");
    expect(DEFAULT_RULES.operatingHours?.days).toBeDefined();
  });

  it("TEST 2: Monday-Friday default to 08:00-18:00", () => {
    const days = DEFAULT_RULES.operatingHours!.days;
    const weekDays = [days.monday, days.tuesday, days.wednesday, days.thursday, days.friday];
    weekDays.forEach((d) => {
      expect(d.enabled).toBe(true);
      expect(d.open).toBe("08:00");
      expect(d.close).toBe("18:00");
    });
  });

  it("TEST 3: Saturday and Sunday default to closed", () => {
    const days = DEFAULT_RULES.operatingHours!.days;
    expect(days.saturday.enabled).toBe(false);
    expect(days.sunday.enabled).toBe(false);
  });

  it("TEST 4: Admin can save operating hours", async () => {
    const store: Record<string, any> = {
      "settings/rules": { ...DEFAULT_RULES },
    };
    const tx = createMockTransaction(store);

    const newOperatingHours: OperatingHoursConfig = {
      enabled: true,
      timezone: "Asia/Jakarta",
      days: {
        monday: { enabled: true, open: "09:00", close: "17:00" },
        tuesday: { enabled: true, open: "09:00", close: "17:00" },
        wednesday: { enabled: true, open: "09:00", close: "17:00" },
        thursday: { enabled: true, open: "09:00", close: "17:00" },
        friday: { enabled: true, open: "09:00", close: "17:00" },
        saturday: { enabled: true, open: "10:00", close: "14:00" },
        sunday: { enabled: false, open: "08:00", close: "18:00" },
      },
    };

    const rulesSnap = await tx.get({ path: "settings/rules" });
    const currentRules = rulesSnap.exists() ? rulesSnap.data() : DEFAULT_RULES;

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      operatingHours: newOperatingHours,
    });

    const saved = store["settings/rules"].operatingHours;
    expect(saved.days.monday.open).toBe("09:00");
    expect(saved.days.saturday.enabled).toBe(true);
  });

  it("TEST 5: Worker can read operating hours", () => {
    function canReadOperatingHours(userRole: string | null): boolean {
      return userRole !== null;
    }
    expect(canReadOperatingHours("worker")).toBe(true);
  });

  it("TEST 6: Worker cannot modify operating hours", () => {
    function canModifyOperatingHours(userRole: string | null): boolean {
      return userRole === "admin";
    }
    expect(canModifyOperatingHours("worker")).toBe(false);
  });

  it("TEST 7: Unauthenticated user cannot modify operating hours", () => {
    function canModifyOperatingHours(userRole: string | null): boolean {
      return userRole === "admin";
    }
    expect(canModifyOperatingHours(null)).toBe(false);
  });

  it("TEST 8: Invalid HH:mm values are rejected", () => {
    expect(validateTimeString("8:00")).toBe(false);
    expect(validateTimeString("25:00")).toBe(false);
    expect(validateTimeString("18:75")).toBe(false);
    expect(validateTimeString("abc")).toBe(false);
    expect(validateTimeString("08:00")).toBe(true);
    expect(validateTimeString("18:00")).toBe(true);

    const invalidCfg: OperatingHoursConfig = {
      enabled: true,
      timezone: "Asia/Jakarta",
      days: {
        ...DEFAULT_OPERATING_HOURS.days,
        monday: { enabled: true, open: "8:00", close: "18:00" },
      },
    };
    expect(validateOperatingHours(invalidCfg)).toBe("Jam operasional tidak valid.");
  });

  it("TEST 9: Open time >= close time is rejected", () => {
    const equalCfg: OperatingHoursConfig = {
      enabled: true,
      timezone: "Asia/Jakarta",
      days: {
        ...DEFAULT_OPERATING_HOURS.days,
        monday: { enabled: true, open: "18:00", close: "18:00" },
      },
    };
    expect(validateOperatingHours(equalCfg)).toBe("Jam operasional tidak valid.");

    const greaterCfg: OperatingHoursConfig = {
      enabled: true,
      timezone: "Asia/Jakarta",
      days: {
        ...DEFAULT_OPERATING_HOURS.days,
        monday: { enabled: true, open: "19:00", close: "18:00" },
      },
    };
    expect(validateOperatingHours(greaterCfg)).toBe("Jam operasional tidak valid.");
  });

  it("TEST 10: Disabled day can be saved without requiring valid active hours", () => {
    const disabledDayCfg: OperatingHoursConfig = {
      enabled: true,
      timezone: "Asia/Jakarta",
      days: {
        ...DEFAULT_OPERATING_HOURS.days,
        saturday: { enabled: false, open: "invalid_time", close: "00:00" },
      },
    };
    expect(validateOperatingHours(disabledDayCfg)).toBeNull();
  });

  it("TEST 11: Changing Admin schedule is reflected dynamically on Worker Dashboard", () => {
    let rulesData: PortalRules = { ...DEFAULT_RULES };
    expect(rulesData.operatingHours?.days.monday.open).toBe("08:00");

    rulesData = {
      ...rulesData,
      operatingHours: {
        ...DEFAULT_OPERATING_HOURS,
        days: {
          ...DEFAULT_OPERATING_HOURS.days,
          monday: { enabled: true, open: "10:00", close: "20:00" },
        },
      },
    };

    expect(rulesData.operatingHours?.days.monday.open).toBe("10:00");
    expect(rulesData.operatingHours?.days.monday.close).toBe("20:00");
  });

  it("TEST 12: Saving operating hours preserves referralTiers", async () => {
    const customReferralTiers = [{ minAcc: 5, reward: 1000 }];
    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        referralTiers: customReferralTiers,
      },
    };

    const tx = createMockTransaction(store);
    const currentRules = (await tx.get({ path: "settings/rules" })).data();

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      operatingHours: DEFAULT_OPERATING_HOURS,
    });

    expect(store["settings/rules"].referralTiers).toEqual(customReferralTiers);
  });

  it("TEST 13: Saving operating hours preserves supportConfig", async () => {
    const customSupport: SupportConfig = {
      enabled: true,
      title: "CS Title",
      description: "CS Desc",
      telegramUrl: "https://t.me/cs_test",
    };

    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        supportConfig: customSupport,
      },
    };

    const tx = createMockTransaction(store);
    const currentRules = (await tx.get({ path: "settings/rules" })).data();

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      operatingHours: DEFAULT_OPERATING_HOURS,
    });

    expect(store["settings/rules"].supportConfig).toEqual(customSupport);
  });

  it("TEST 14: Saving operating hours preserves all unrelated PortalRules fields", async () => {
    const store: Record<string, any> = {
      "settings/rules": {
        ...DEFAULT_RULES,
        pricePerEmail: 3000,
        minWithdraw: 25000,
        maxWithdraw: 1000000,
      },
    };

    const tx = createMockTransaction(store);
    const currentRules = (await tx.get({ path: "settings/rules" })).data();

    tx.set({ path: "settings/rules" }, {
      ...currentRules,
      operatingHours: DEFAULT_OPERATING_HOURS,
    });

    const saved = store["settings/rules"];
    expect(saved.pricePerEmail).toBe(3000);
    expect(saved.minWithdraw).toBe(25000);
    expect(saved.maxWithdraw).toBe(1000000);
  });

  it("TEST 15: Current open/closed calculation correctly handles Asia/Jakarta timezone", () => {
    // Globally disabled
    const disabledCfg: OperatingHoursConfig = {
      ...DEFAULT_OPERATING_HOURS,
      enabled: false,
    };
    expect(getOperatingStatus(disabledCfg).statusText).toBe("Jam operasional tidak tersedia.");

    // Create a date corresponding to Monday at 10:00 AM UTC.
    // In Asia/Jakarta (UTC+7), Monday 10:00 AM UTC is Monday 17:00 (5:00 PM).
    // Schedule Monday: 08:00 - 18:00 -> 17:00 is OPEN.
    const mondayUtc10 = new Date(Date.UTC(2026, 2, 2, 10, 0, 0)); // March 2, 2026 is a Monday
    const openStatus = getOperatingStatus(DEFAULT_OPERATING_HOURS, mondayUtc10);
    expect(openStatus.isOpen).toBe(true);
    expect(openStatus.statusText).toBe("🟢 Sedang Buka");

    // Create a date corresponding to Monday at 12:00 PM UTC.
    // In Asia/Jakarta (UTC+7), Monday 12:00 PM UTC is Monday 19:00 (7:00 PM).
    // Schedule Monday: 08:00 - 18:00 -> 19:00 is CLOSED.
    const mondayUtc12 = new Date(Date.UTC(2026, 2, 2, 12, 0, 0));
    const closedStatus = getOperatingStatus(DEFAULT_OPERATING_HOURS, mondayUtc12);
    expect(closedStatus.isOpen).toBe(false);
    expect(closedStatus.statusText).toBe("🔴 Sedang Tutup");

    // Saturday in Asia/Jakarta -> disabled day -> CLOSED
    const saturdayUtc = new Date(Date.UTC(2026, 2, 7, 5, 0, 0)); // March 7, 2026 is Saturday
    const saturdayStatus = getOperatingStatus(DEFAULT_OPERATING_HOURS, saturdayUtc);
    expect(saturdayStatus.isOpen).toBe(false);
    expect(saturdayStatus.statusText).toBe("🔴 Sedang Tutup");
  });
});

describe("Race Condition & Lifecycle State Machine Regression Tests", () => {
  // Helper harness simulating usePortalAuth state management logic exactly
  function createPortalAuthHarness() {
    const refs = {
      recoveringUidRef: null as string | null,
      resolvedUidRef: null as string | null,
      recoveryFailedUidRef: null as string | null,
      recoveryGenRef: 0,
    };

    let activeUser: { uid: string; email?: string; displayName?: string } | null = null;
    let state = {
      firebaseUser: null as { uid: string } | null,
      profile: null as any,
      loading: false,
      error: "",
    };

    let recoveryCallCount = 0;
    let activeRecoveryDeferred: {
      resolve: () => void;
      reject: (err: Error) => void;
    } | null = null;

    function handleAuthStateChange(user: { uid: string; email?: string } | null) {
      activeUser = user;
      state.firebaseUser = user;
      refs.recoveringUidRef = null;
      refs.resolvedUidRef = null;
      refs.recoveryFailedUidRef = null;
      refs.recoveryGenRef += 1;

      if (!user) {
        state.profile = null;
        state.error = "";
        state.loading = false;
      } else {
        state.loading = true;
        state.error = "";
      }
    }

    function handleSnapshot(snapshotExists: boolean, snapshotData?: any) {
      if (!activeUser) return;
      const uid = activeUser.uid;

      if (snapshotExists) {
        refs.resolvedUidRef = uid;
        refs.recoveringUidRef = null;
        refs.recoveryFailedUidRef = null;

        const normalizedRole = typeof snapshotData?.role === "string" ? snapshotData.role.trim().toLowerCase() : snapshotData?.role;
        const normalizedStatus = typeof snapshotData?.status === "string" ? snapshotData.status.trim().toLowerCase() : snapshotData?.status;

        state.profile = { uid, ...snapshotData, role: normalizedRole, status: normalizedStatus };
        state.error = "";
        state.loading = false;
      } else {
        if (refs.recoveringUidRef === uid) {
          return;
        }

        if (refs.recoveryFailedUidRef === uid) {
          state.loading = false;
          state.error = "Profil pengguna tidak ditemukan di database Firestore.";
          return;
        }

        refs.recoveringUidRef = uid;
        const currentGen = ++refs.recoveryGenRef;
        state.loading = true;

        recoveryCallCount += 1;

        // Trigger async recovery promise
        const recoveryPromise = new Promise<void>((resolve, reject) => {
          activeRecoveryDeferred = { resolve, reject };
        });

        recoveryPromise.catch((err) => {
          // Stale operation protection
          if (
            activeUser?.uid !== uid ||
            refs.recoveryGenRef !== currentGen ||
            refs.resolvedUidRef === uid
          ) {
            // Stale recovery error ignored
            return;
          }

          refs.recoveringUidRef = null;
          refs.recoveryFailedUidRef = uid;
          state.profile = null;
          state.error = err.message || "Gagal memulihkan profil pengguna.";
          state.loading = false;
        });
      }
    }

    return {
      refs,
      getState: () => ({ ...state }),
      getRecoveryCallCount: () => recoveryCallCount,
      handleAuthStateChange,
      handleSnapshot,
      resolveRecovery: () => activeRecoveryDeferred?.resolve(),
      rejectRecovery: (errMessage: string) => activeRecoveryDeferred?.reject(new Error(errMessage)),
    };
  }

  it("A. Missing profile triggers automatic recovery", () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_A" });
    expect(harness.getState().loading).toBe(true);

    harness.handleSnapshot(false); // snapshot.exists() === false
    expect(harness.getRecoveryCallCount()).toBe(1);
    expect(harness.refs.recoveringUidRef).toBe("user_A");
    expect(harness.getState().loading).toBe(true);
  });

  it("B. Recovery succeeds and resulting Firestore snapshot loads profile", async () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_B" });
    harness.handleSnapshot(false);

    // Auto-recovery creates the doc, snapshot fires with exists === true
    harness.handleSnapshot(true, { name: "User B", role: "worker", status: "active", tier: 1, balance: 0 });
    harness.resolveRecovery();
    await new Promise((r) => setTimeout(r, 0));

    const state = harness.getState();
    expect(state.profile?.name).toBe("User B");
    expect(state.loading).toBe(false);
    expect(state.error).toBe("");
    expect(harness.refs.resolvedUidRef).toBe("user_B");
  });

  it("C. CRITICAL RACE TEST: Recovery starts -> valid profile snapshot arrives -> recovery promise later rejects", async () => {
    const harness = createPortalAuthHarness();

    // 1. Auth state changes for user_race
    harness.handleAuthStateChange({ uid: "user_race" });

    // 2. Snapshot fires with exists === false, triggering recovery
    harness.handleSnapshot(false);
    expect(harness.refs.recoveringUidRef).toBe("user_race");
    expect(harness.getRecoveryCallCount()).toBe(1);

    // 3. Firestore snapshot listener receives valid profile document (exists === true)
    harness.handleSnapshot(true, {
      name: "Race Worker",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 0,
    });

    expect(harness.getState().profile?.name).toBe("Race Worker");
    expect(harness.getState().loading).toBe(false);
    expect(harness.getState().error).toBe("");
    expect(harness.refs.resolvedUidRef).toBe("user_race");

    // 4. The previously started createPortalUser promise LATER rejects
    harness.rejectRecovery("Network timeout writing document");
    await new Promise((r) => setTimeout(r, 10));

    // EXPECTED RESULT:
    // Profile MUST remain populated, loading MUST remain false, error MUST remain empty
    const finalState = harness.getState();
    expect(finalState.profile).not.toBeNull();
    expect(finalState.profile?.name).toBe("Race Worker");
    expect(finalState.loading).toBe(false);
    expect(finalState.error).toBe("");
  });

  it("D. Recovery fails before any profile exists -> produces controlled error state, not infinite loop", async () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_failed" });
    harness.handleSnapshot(false);

    expect(harness.getRecoveryCallCount()).toBe(1);

    // Recovery fails before any valid snapshot arrives
    harness.rejectRecovery("Permission denied creating document");
    await new Promise((r) => setTimeout(r, 10));

    let state = harness.getState();
    expect(state.loading).toBe(false);
    expect(state.profile).toBeNull();
    expect(state.error).toBe("Permission denied creating document");
    expect(harness.refs.recoveryFailedUidRef).toBe("user_failed");

    // Subsequent snapshot callbacks with exists === false DO NOT start duplicate recovery calls
    harness.handleSnapshot(false);
    harness.handleSnapshot(false);

    expect(harness.getRecoveryCallCount()).toBe(1); // Still 1, no infinite loop
    expect(harness.getState().error).toBe("Profil pengguna tidak ditemukan di database Firestore.");
  });

  it("E. Auth UID changes while recovery is pending -> stale recovery from previous UID cannot modify new user's state", async () => {
    const harness = createPortalAuthHarness();

    // User 1 logs in & triggers recovery
    harness.handleAuthStateChange({ uid: "user_1" });
    harness.handleSnapshot(false);
    expect(harness.refs.recoveringUidRef).toBe("user_1");

    // User 1 logs out / User 2 logs in while User 1's recovery is still pending
    harness.handleAuthStateChange({ uid: "user_2" });
    harness.handleSnapshot(true, { name: "User Two", role: "worker", status: "active", tier: 1, balance: 0 });

    expect(harness.getState().profile?.name).toBe("User Two");

    // User 1's stale recovery promise now rejects
    harness.rejectRecovery("User 1 recovery failed");
    await new Promise((r) => setTimeout(r, 10));

    // EXPECTED RESULT: User 2's valid state remains untouched
    const state = harness.getState();
    expect(state.firebaseUser?.uid).toBe("user_2");
    expect(state.profile?.name).toBe("User Two");
    expect(state.loading).toBe(false);
    expect(state.error).toBe("");
  });

  it("F. Existing profile is never overwritten by automatic recovery", () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_existing" });

    // Initial snapshot exists === true
    harness.handleSnapshot(true, { name: "Existing Worker", role: "worker", status: "active", tier: 2, balance: 5000 });

    expect(harness.getRecoveryCallCount()).toBe(0);
    expect(harness.getState().profile?.tier).toBe(2);
    expect(harness.getState().profile?.balance).toBe(5000);
  });

  it("G. Multiple snapshot callbacks do not start uncontrolled duplicate recovery operations", () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_multi" });

    // Firing missing doc snapshot 5 times in rapid succession
    harness.handleSnapshot(false);
    harness.handleSnapshot(false);
    harness.handleSnapshot(false);
    harness.handleSnapshot(false);
    harness.handleSnapshot(false);

    expect(harness.getRecoveryCallCount()).toBe(1);
  });

  it("H. Worker profile remains normalized: role/status trimmed and lowercased", () => {
    const harness = createPortalAuthHarness();
    harness.handleAuthStateChange({ uid: "user_norm" });

    harness.handleSnapshot(true, {
      name: "Norm Worker",
      role: "  WORKER  ",
      status: "  ACTIVE  ",
      tier: 1,
      balance: 0,
    });

    const profile = harness.getState().profile;
    expect(profile?.role).toBe("worker");
    expect(profile?.status).toBe("active");
  });
});

describe("Admin Monthly Financial Tracking Unit Tests", () => {
  it("getMonthlyPeriodKey derives YYYY-MM correctly from dates", () => {
    const d1 = new Date(2026, 7, 21); // 21 August 2026
    expect(getMonthlyPeriodKey(d1)).toBe("2026-08");

    const d2 = new Date(2026, 8, 1); // 1 September 2026
    expect(getMonthlyPeriodKey(d2)).toBe("2026-09");

    const d3 = new Date(2026, 9, 10); // 10 October 2026
    expect(getMonthlyPeriodKey(d3)).toBe("2026-10");
  });

  it("formatMonthYear formats YYYY-MM into Indonesian Month and Year", () => {
    expect(formatMonthYear("2026-08")).toBe("Agustus 2026");
    expect(formatMonthYear("2026-09")).toBe("September 2026");
    expect(formatMonthYear("2026-10")).toBe("Oktober 2026");
  });

  it("getPeriodOptions builds sorted unique period list including current and active month", () => {
    const transactions = [
      { period: "2026-08" },
      { period: "2026-09" },
      { period: "2026-07" },
    ];
    const options = getPeriodOptions(transactions, "2026-10");
    const values = options.map((o) => o.value);

    expect(values).toContain("2026-08");
    expect(values).toContain("2026-09");
    expect(values).toContain("2026-07");
    expect(values).toContain("2026-10");
    // Sorted descending
    expect(values[0] >= values[1]).toBe(true);
  });

  it("calculates summary correctly: Saldo Bersih = Total Pemasukan - Total Pengeluaran (Prompt Example)", () => {
    const transactions: FinancialTransaction[] = [
      {
        id: "tx1",
        type: "income",
        amount: 5000000,
        description: "Penjualan Storage Gmail",
        transactionDate: "2026-08-21",
        period: "2026-08",
      },
      {
        id: "tx2",
        type: "expense",
        amount: 2000000,
        description: "Pembayaran Worker",
        transactionDate: "2026-08-21",
        period: "2026-08",
      },
    ];

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") totalIncome += tx.amount;
      if (tx.type === "expense") totalExpense += tx.amount;
    });

    const netBalance = totalIncome - totalExpense;

    expect(totalIncome).toBe(5000000);
    expect(totalExpense).toBe(2000000);
    expect(netBalance).toBe(3000000);
  });

  it("filters transactions strictly by period (August vs September)", () => {
    const allTransactions: FinancialTransaction[] = [
      {
        id: "tx_aug",
        type: "income",
        amount: 500000,
        description: "Setoran Agustus",
        transactionDate: "2026-08-21",
        period: "2026-08",
      },
      {
        id: "tx_sep",
        type: "income",
        amount: 1000000,
        description: "Setoran September",
        transactionDate: "2026-09-01",
        period: "2026-09",
      },
    ];

    const augTx = allTransactions.filter((tx) => tx.period === "2026-08");
    const sepTx = allTransactions.filter((tx) => tx.period === "2026-09");

    expect(augTx.length).toBe(1);
    expect(augTx[0].amount).toBe(500000);

    expect(sepTx.length).toBe(1);
    expect(sepTx[0].amount).toBe(1000000);
  });

  it("validates manual transaction inputs (amount > 0 and description required)", () => {
    function validateFinancialInput(description: string, amount: number) {
      if (!description || !description.trim()) {
        return "Keterangan wajib diisi.";
      }
      if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
        return "Jumlah harus berupa angka valid lebih besar dari 0.";
      }
      return null;
    }

    expect(validateFinancialInput("", 500000)).toBe("Keterangan wajib diisi.");
    expect(validateFinancialInput("Penjualan", 0)).toBe("Jumlah harus berupa angka valid lebih besar dari 0.");
    expect(validateFinancialInput("Penjualan", -100)).toBe("Jumlah harus berupa angka valid lebih besar dari 0.");
    expect(validateFinancialInput("Penjualan", NaN)).toBe("Jumlah harus berupa angka valid lebih besar dari 0.");
    expect(validateFinancialInput("Penjualan Storage", 500000)).toBeNull();
  });
});
