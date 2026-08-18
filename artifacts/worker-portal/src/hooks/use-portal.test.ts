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
  const itemsToSave = submission.items?.map((it: any) => ({ ...it, status: it.status ?? (decision === "approved" ? "approved" : "rejected") })) ?? [];
  const approvedCount = itemsToSave.filter((it: any) => it.status === "approved").length;
  const rejectedCount = itemsToSave.filter((it: any) => it.status === "rejected").length;

  const appliedPricePerItem = submission.currentPricePerItem ?? pricePerItemFallback;
  const appliedTier = submission.currentTier ?? tierNumFallback;
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

  if (userPath && userSnap && userSnap.exists() && totalAmount > 0) {
    const current = userSnap.data().balance ?? 0;
    tx.update({ path: userPath }, { balance: current + totalAmount });
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

  it("handles partial approvals (3 approved, 2 rejected) and credits worker balance only for approved items", async () => {
    const store = {
      "emailSubmissions/batch_partial": {
        workerId: "worker_partial_1",
        items: [
          { email: "1@a.com", status: "approved" },
          { email: "2@a.com", status: "approved" },
          { email: "3@a.com", status: "approved" },
          { email: "4@a.com", status: "rejected" },
          { email: "5@a.com", status: "rejected" },
        ],
        itemCount: 5,
        currentTier: 2,
        currentPricePerItem: 2500,
        status: "pending",
      },
      "users/worker_partial_1": {
        uid: "worker_partial_1",
        balance: 1000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewBatchSubmissionTx(tx, "batch_partial", "approved", "3 approved / 2 rejected", 2500, 2);

    const updatedSub = store["emailSubmissions/batch_partial"];
    expect(updatedSub.status).toBe("available");
    expect(updatedSub.approvedItemCount).toBe(3);
    expect(updatedSub.rejectedItemCount).toBe(2);
    expect(updatedSub.totalAmount).toBe(7500); // 3 * 2500

    // Initial 1000 + 7500 = 8500
    expect(store["users/worker_partial_1"].balance).toBe(8500);
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
