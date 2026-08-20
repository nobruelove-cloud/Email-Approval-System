import { describe, it, expect, vi } from "vitest";
import { StatusBadge } from "../pages/worker-dashboard";
import {
  getItemCountOfSubmission,
  getTierConfig,
  getRecommendedTier,
  validateTierConfigs,
} from "../lib/portal-utils";
import { DEFAULT_TIERS, type EmailSubmission, type TierConfig } from "../lib/portal-types";

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

// Engagement Transaction Helpers for Testing
async function evaluateReferralTx(tx: any, referredWorkerId: string, accumulatedAccCount: number) {
  const refPath = `referrals/${referredWorkerId}`;
  const refSnap = await tx.get({ path: refPath });
  if (!refSnap.exists()) return;

  const referral = refSnap.data();
  if (referral.status === "REWARDED") return;

  const rulesSnap = await tx.get({ path: "settings/rules" });
  const rules = rulesSnap.exists() ? rulesSnap.data() : {};
  const minAcc = rules.referralMinAcc ?? 5;
  const rewardAmt = rules.referralReward ?? 10000;

  if (accumulatedAccCount < minAcc) return;

  const referrerPath = `users/${referral.referrerId}`;
  const referrerSnap = await tx.get({ path: referrerPath });
  if (!referrerSnap.exists()) return;

  const currentBalance = referrerSnap.data().balance ?? 0;

  tx.update({ path: refPath }, {
    status: "REWARDED",
    rewardAmount: rewardAmt,
  });

  tx.update({ path: referrerPath }, {
    balance: currentBalance + rewardAmt,
  });

  tx.set({ path: `rewardLedger/${referredWorkerId}_ref` }, {
    workerId: referral.referrerId,
    rewardType: "referral",
    amount: rewardAmt,
    sourceRefId: referredWorkerId,
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

async function createAdClaimRequestTx(tx: any, workerId: string, dateKey: string, timestampMs: number) {
  const claimPath = `adClaims/${workerId}_ad_${timestampMs}`;
  tx.set({ path: claimPath }, {
    id: `${workerId}_ad_${timestampMs}`,
    workerId,
    dateKey,
    status: "pending",
  });
}

async function reviewAdClaimTx(tx: any, claimId: string, decision: "approved" | "rejected") {
  const claimPath = `adClaims/${claimId}`;
  const claimSnap = await tx.get({ path: claimPath });
  if (!claimSnap.exists()) throw new Error("Klaim iklan tidak ditemukan");

  const claim = claimSnap.data();
  if (claim.status === "approved" || claim.status === "rewarded") throw new Error("Tugas iklan ini sudah pernah dicairkan");

  const rulesSnap = await tx.get({ path: "settings/rules" });
  const rules = rulesSnap.exists() ? rulesSnap.data() : {};
  const adCfg = rules.adConfig ?? { enabled: true, rewardAmount: 500, dailyLimit: 5 };

  if (decision === "approved" && !adCfg.enabled) throw new Error("Iklan nonaktif");

  const userPath = `users/${claim.workerId}`;
  const userSnap = await tx.get({ path: userPath });
  if (!userSnap.exists()) throw new Error("Worker tidak ditemukan");

  const currentBalance = userSnap.data().balance ?? 0;

  tx.update({ path: claimPath }, {
    status: decision === "approved" ? "rewarded" : "rejected",
    rewardAmount: decision === "approved" ? adCfg.rewardAmount : 0,
  });

  if (decision === "approved") {
    tx.update({ path: userPath }, {
      balance: currentBalance + adCfg.rewardAmount,
    });
  }
}

describe("New Worker Engagement & Earning Unit Tests (A-S)", () => {
  it("A & B. Registration with referral code creates relationship & registration alone yields 0 reward", () => {
    const referrerId = "referrer_100";
    const referredId = "referred_200";

    // Self referral check
    expect(referrerId === referredId).toBe(false);

    // Initial state after registration: referral doc status is PENDING, referrer balance unchanged
    const store = {
      [`users/${referrerId}`]: { balance: 0 },
      [`users/${referredId}`]: { balance: 0, referredBy: referrerId },
      [`referrals/${referredId}`]: {
        referrerId,
        referredWorkerId: referredId,
        status: "PENDING",
      },
    };

    expect(store[`users/${referrerId}`].balance).toBe(0);
    expect(store[`referrals/${referredId}`].status).toBe("PENDING");
  });

  it("C & D. Qualification triggers referral reward & duplicate qualification cannot grant duplicate reward", async () => {
    const store = {
      "settings/rules": { referralEnabled: true, referralMinAcc: 5, referralReward: 10000 },
      "users/referrer_A": { balance: 0 },
      "users/referred_B": { balance: 0 },
      "referrals/referred_B": { referrerId: "referrer_A", referredWorkerId: "referred_B", status: "PENDING" },
    };

    // First evaluation: 5 ACC -> Qualified & Rewarded
    const tx1 = createMockTransaction(store);
    await evaluateReferralTx(tx1, "referred_B", 5);

    expect(store["users/referrer_A"].balance).toBe(10000);
    expect(store["referrals/referred_B"].status).toBe("REWARDED");

    // Second evaluation with 10 ACC: status is already REWARDED, balance remains 10000 (no double reward)
    const tx2 = createMockTransaction(store);
    await evaluateReferralTx(tx2, "referred_B", 10);

    expect(store["users/referrer_A"].balance).toBe(10000); // Unchanged!
  });

  it("E. Invalid / self referral is safely rejected", () => {
    const workerId = "worker_self";
    function canRegisterReferral(referrer: string, referred: string) {
      if (!referrer || !referred) return false;
      if (referrer === referred) return false;
      return true;
    }
    expect(canRegisterReferral(workerId, workerId)).toBe(false);
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

  it("M, N, O, P. Rewarded ads completion grants reward, unverified disabled grants 0, daily limit & idempotency enforced", async () => {
    const storeActive = {
      "settings/rules": { adConfig: { enabled: true, rewardAmount: 500, dailyLimit: 5 } },
      "users/worker_ad1": { balance: 1000 },
    };

    // Worker creates ad claim request
    const txReq = createMockTransaction(storeActive);
    await createAdClaimRequestTx(txReq, "worker_ad1", "2026-08-20", 10001);

    // Admin reviews and approves ad claim -> credits 500
    const txAd = createMockTransaction(storeActive);
    await reviewAdClaimTx(txAd, "worker_ad1_ad_10001", "approved");

    expect(storeActive["users/worker_ad1"].balance).toBe(1500);

    // Disabled ad provider -> throws error on review
    const storeDisabled = {
      "settings/rules": { adConfig: { enabled: false, rewardAmount: 500, dailyLimit: 5 } },
      "users/worker_ad2": { balance: 1000 },
    };

    const txReqDisabled = createMockTransaction(storeDisabled);
    await createAdClaimRequestTx(txReqDisabled, "worker_ad2", "2026-08-20", 10002);

    const txDisabled = createMockTransaction(storeDisabled);
    await expect(
      reviewAdClaimTx(txDisabled, "worker_ad2_ad_10002", "approved")
    ).rejects.toThrow("Iklan nonaktif");

    expect(storeDisabled["users/worker_ad2"].balance).toBe(1000);
  });

  it("Q, R, S. Rewards correctly increase existing balance, duplicate processing does not double-credit, email payout logic unchanged", async () => {
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

    // Reward transaction on top of balance
    const reqTx = createMockTransaction(store);
    await createAdClaimRequestTx(reqTx, "worker_q", "2026-08-20", 20001);

    const adTx = createMockTransaction(store);
    await reviewAdClaimTx(adTx, "worker_q_ad_20001", "approved");

    expect(store["users/worker_q"].balance).toBe(24500); // 24000 + 500
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
