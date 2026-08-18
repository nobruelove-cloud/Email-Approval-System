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
  pricePerItemFallback: number,
  tierNumFallback: number,
) {
  const submissionPath = `emailSubmissions/${submissionId}`;
  const submissionSnap = await tx.get({ path: submissionPath });
  if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
  const submission = submissionSnap.data();
  if (submission.status !== "pending") {
    throw new Error("Setoran ini sudah pernah ditinjau.");
  }

  const newStatus = decision === "approved" ? "available" : decision;
  const isApproval = newStatus === "available" || decision === "approved";
  const userPath = isApproval ? `users/${submission.workerId}` : null;
  const userSnap = userPath ? await tx.get({ path: userPath }) : null;

  const itemCount = getItemCountOfSubmission(submission);
  const appliedPricePerItem = submission.currentPricePerItem ?? pricePerItemFallback;
  const appliedTier = submission.currentTier ?? tierNumFallback;
  const totalAmount = itemCount * appliedPricePerItem;

  if (isApproval) {
    tx.update({ path: submissionPath }, {
      status: newStatus,
      reviewNote,
      appliedTier,
      appliedPricePerItem,
      itemCount,
      totalAmount,
      reviewedAt: "TIMESTAMP",
      updatedAt: "TIMESTAMP",
    });

    if (userPath && userSnap && userSnap.exists()) {
      const current = userSnap.data().balance ?? 0;
      tx.update({ path: userPath }, { balance: current + totalAmount });
    }
  } else {
    tx.update({ path: submissionPath }, {
      status: "rejected",
      reviewNote,
      reviewedAt: "TIMESTAMP",
      updatedAt: "TIMESTAMP",
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

describe("Batch Approval, Credit Calculation, and Price Snapshot Tests", () => {
  it("approves 5-item batch at Tier 2 (Rp2.500/item), credits Rp12.500 balance, and saves historical snapshot", async () => {
    const store = {
      "emailSubmissions/batch_1": {
        workerId: "seno_123",
        items: [{ email: "1@a.com" }, { email: "2@a.com" }, { email: "3@a.com" }, { email: "4@a.com" }, { email: "5@a.com" }],
        itemCount: 5,
        currentTier: 2,
        currentPricePerItem: 2500,
        status: "pending",
      },
      "users/seno_123": {
        uid: "seno_123",
        name: "Seno",
        tier: 2,
        balance: 0,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_1", "approved", "Approved batch", 2500, 2);

    // Verify submission status updated to available
    const updatedSub = store["emailSubmissions/batch_1"];
    expect(updatedSub.status).toBe("available");
    expect(updatedSub.appliedTier).toBe(2);
    expect(updatedSub.appliedPricePerItem).toBe(2500);
    expect(updatedSub.totalAmount).toBe(12500);

    // Verify worker balance credited by 5 * 2500 = 12500
    expect(store["users/seno_123"].balance).toBe(12500);

    // Verify reads happened before writes
    expect(tx._reads).toEqual(["emailSubmissions/batch_1", "users/seno_123"]);
  });

  it("historical financial amount remains unchanged even if worker tier changes later", async () => {
    const store = {
      "emailSubmissions/batch_historic": {
        workerId: "seno_123",
        items: [{ email: "1@a.com" }, { email: "2@a.com" }, { email: "3@a.com" }, { email: "4@a.com" }, { email: "5@a.com" }],
        itemCount: 5,
        currentTier: 1,
        currentPricePerItem: 2000,
        status: "pending",
      },
      "users/seno_123": {
        uid: "seno_123",
        name: "Seno",
        tier: 1,
        balance: 0,
      },
    };

    // Approve at Tier 1 (Rp2.000 / item -> Total Rp10.000)
    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_historic", "approved", "OK", 2000, 1);

    expect(store["emailSubmissions/batch_historic"].totalAmount).toBe(10000);
    expect(store["users/seno_123"].balance).toBe(10000);

    // Admin later changes worker Seno to Tier 3
    store["users/seno_123"].tier = 3;

    // Historic submission record snapshot MUST remain Rp10.000
    expect(store["emailSubmissions/batch_historic"].totalAmount).toBe(10000);
    expect(store["emailSubmissions/batch_historic"].appliedPricePerItem).toBe(2000);
  });

  it("prevents double crediting on batch submissions", async () => {
    const store = {
      "emailSubmissions/batch_2": {
        workerId: "worker_777",
        itemCount: 3,
        currentTier: 1,
        currentPricePerItem: 2000,
        status: "available",
      },
      "users/worker_777": {
        uid: "worker_777",
        balance: 6000,
      },
    };

    const tx = createMockTransaction(store);
    await expect(
      reviewBatchSubmissionTx(tx, "batch_2", "approved", "Second try", 2000, 1)
    ).rejects.toThrow("Setoran ini sudah pernah ditinjau.");

    expect(store["users/worker_777"].balance).toBe(6000);
  });

  it("rejected batch does not credit worker balance", async () => {
    const store = {
      "emailSubmissions/batch_bad": {
        workerId: "worker_888",
        itemCount: 10,
        currentTier: 2,
        currentPricePerItem: 2500,
        status: "pending",
      },
      "users/worker_888": {
        uid: "worker_888",
        balance: 5000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_bad", "rejected", "Invalid emails", 2500, 2);

    expect(store["emailSubmissions/batch_bad"].status).toBe("rejected");
    expect(store["users/worker_888"].balance).toBe(5000);
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
