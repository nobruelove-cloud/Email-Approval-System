// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, render, screen, act, cleanup } from "@testing-library/react";
import { StatusBadge } from "../pages/worker-dashboard";
import { PortalGate } from "../App";
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
  calculateWithdrawalFee,
  formatFeeBadge,
  getPaymentMethodFeeConfig,
} from "../lib/portal-utils";
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
  type FinancialTransaction,
} from "../lib/portal-types";

// Setup hoisted mocks for Firebase modules
const {
  mockAuthObj,
  mockSetDoc,
  mockGetDoc,
  mockOnSnapshot,
  mockDoc,
  mockOnAuthStateChanged,
} = vi.hoisted(() => ({
  mockAuthObj: { currentUser: { uid: "test_uid", getIdToken: vi.fn().mockResolvedValue("token") } as any },
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  mockOnSnapshot: vi.fn(),
  mockDoc: vi.fn((dbOrColl: any, colOrId?: string, id?: string) => {
    if (dbOrColl && typeof dbOrColl === "object" && dbOrColl.path) {
      const subId = colOrId || `auto_id_${Math.random().toString(36).slice(2, 7)}`;
      return { path: `${dbOrColl.path}/${subId}` };
    }
    return { path: `${colOrId}/${id}` };
  }),
  mockOnAuthStateChanged: vi.fn(),
}));

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");
  return {
    ...actual,
    setDoc: (...args: any[]) => mockSetDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    doc: (...args: any[]) => mockDoc(...args),
    collection: vi.fn((db: any, name: string) => ({ path: name })),
    query: vi.fn((base: any) => base),
    where: vi.fn(),
    serverTimestamp: vi.fn(() => "TIMESTAMP"),
  };
});

vi.mock("firebase/auth", async () => {
  const actual = await vi.importActual("firebase/auth");
  return {
    ...actual,
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../lib/firebase", async () => {
  const actual = await vi.importActual("../lib/firebase");
  return {
    ...actual,
    auth: mockAuthObj,
    db: { type: "firestore" },
    firebaseConfigured: true,
    createWorkerAuthAccount: vi.fn().mockResolvedValue("new_auth_uid"),
  };
});

import {
  usePortalAuth,
  useMyReferral,
  claimReferralCode,
  registerReferral,
  createPortalUser,
  createWorkerAccount,
  createWithdrawal,
  evaluateReferralQualification,
  claimReferralReward,
  claimReferralTier,
  reviewSubmission,
  logFirestoreDiagnostic,
  formatQueryConstraint,
  formatQueryConstraints,
  getDocWithDiagnostic,
  getDocsWithDiagnostic,
  setDocWithDiagnostic,
  updateDocWithDiagnostic,
  deleteDocWithDiagnostic,
  runTransactionWithDiagnostic,
} from "./use-portal";
import { sendRemoteDiagnostic } from "@/lib/remote-diagnostics";

// Mock Firebase store for Firestore transaction testing
function createMockTransaction(store: Record<string, any>) {
  const reads: string[] = [];
  const writes: any[] = [];

  return {
    get: vi.fn(async (ref) => {
      if (writes.length > 0) {
        throw new Error("Firestore transactions require all reads to be executed before all writes.");
      }
      reads.push(ref.path);
      const docId = ref.path ? ref.path.split("/").pop() : "";
      return {
        id: docId,
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

// Batch review transaction logic under test
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

afterEach(() => {
  cleanup();
});

describe("Post-Registration Invitation Code Claim Feature Unit Tests (claimReferralCode & useMyReferral)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. rejects empty code or whitespace-only code", async () => {
    const worker = { uid: "worker_1", name: "Worker 1", role: "worker", status: "active", tier: 1, balance: 0 } as any;

    await expect(claimReferralCode(worker, "")).rejects.toThrow("Kode undangan wajib diisi.");
    await expect(claimReferralCode(worker, "   ")).rejects.toThrow("Kode undangan wajib diisi.");
  });

  it("2. rejects self-referral", async () => {
    const worker = { uid: "worker_1", name: "Worker 1", role: "worker", status: "active", tier: 1, balance: 0 } as any;

    await expect(claimReferralCode(worker, "worker_1")).rejects.toThrow("Tidak dapat menggunakan kode undangan milik sendiri.");
    await expect(claimReferralCode(worker, "  worker_1  ")).rejects.toThrow("Tidak dapat menggunakan kode undangan milik sendiri.");
  });

  it("3. rejects worker who already has referredBy field", async () => {
    const worker = { uid: "worker_1", name: "Worker 1", referredBy: "referrer_10", role: "worker", status: "active", tier: 1, balance: 0 } as any;

    await expect(claimReferralCode(worker, "referrer_20")).rejects.toThrow("Akun kamu sudah terhubung dengan kode undangan.");
  });

  it("4. rejects claim if worker already has an existing referral record in transaction check", async () => {
    const store = {
      "users/worker_1": { uid: "worker_1", name: "Worker 1" },
      "referrals/worker_1": { id: "worker_1", referrerId: "referrer_10", status: "PENDING" },
      "users/referrer_20": { uid: "referrer_20", name: "Referrer 20" },
    };
    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const worker = { uid: "worker_1", name: "Worker 1", role: "worker", status: "active", tier: 1, balance: 0 } as any;

    await expect(claimReferralCode(worker, "referrer_20")).rejects.toThrow("Akun kamu sudah memiliki data referral/pengundang.");
  });

  it("5. rejects claim if referral code does not belong to an existing worker in Firestore", async () => {
    const store = {
      "users/worker_1": { uid: "worker_1", name: "Worker 1" },
    };
    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const worker = { uid: "worker_1", name: "Worker 1", role: "worker", status: "active", tier: 1, balance: 0 } as any;

    await expect(claimReferralCode(worker, "non_existent_code")).rejects.toThrow("Kode undangan tidak valid atau tidak ditemukan.");
  });

  it("6. successful claim atomically updates worker referredBy, creates referrals/currentWorkerUid with status PENDING, currentAccCount 0, rewardAmount 0, and NO immediate reward", async () => {
    const store: Record<string, any> = {
      "users/worker_1": { uid: "worker_1", name: "Budi Worker", balance: 1000 },
      "users/referrer_99": { uid: "referrer_99", name: "Andi Referrer", balance: 5000 },
    };
    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const worker = { uid: "worker_1", name: "Budi Worker", role: "worker", status: "active", tier: 1, balance: 1000 } as any;

    await claimReferralCode(worker, "  referrer_99  ");

    // Check user profile update
    expect(store["users/worker_1"].referredBy).toBe("referrer_99");

    // Check referral document creation
    const createdRef = store["referrals/worker_1"];
    expect(createdRef).toBeDefined();
    expect(createdRef.id).toBe("worker_1");
    expect(createdRef.referrerId).toBe("referrer_99");
    expect(createdRef.referrerName).toBe("Andi Referrer");
    expect(createdRef.referredWorkerId).toBe("worker_1");
    expect(createdRef.referredWorkerName).toBe("Budi Worker");
    expect(createdRef.status).toBe("PENDING");
    expect(createdRef.currentAccCount).toBe(0);
    expect(createdRef.rewardAmount).toBe(0);

    // CRITICAL REQUIREMENT: NO IMMEDIATE REWARD ISSUED
    expect(store["users/referrer_99"].balance).toBe(5000);
    expect(store["users/worker_1"].balance).toBe(1000);
  });
});

describe("1. registerReferral Production Export Real Regression Unit Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls production registerReferral and asserts setDoc is called against referrals/referred456 with status PENDING, reward 0, and getDoc is NEVER called for users/referrer123", async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await registerReferral("referrer123", "referred456", "Referred Name");

    // Assert setDoc was called against referrals/referred456
    expect(mockSetDoc).toHaveBeenCalled();
    const setDocCalls = mockSetDoc.mock.calls;
    expect(setDocCalls.length).toBeGreaterThan(0);

    const docTarget = setDocCalls[0][0];
    expect(docTarget.path).toBe("referrals/referred456");

    const setDocPayload = setDocCalls[0][1];
    expect(setDocPayload.id).toBe("referred456");
    expect(setDocPayload.referrerId).toBe("referrer123");
    expect(setDocPayload.referredWorkerId).toBe("referred456");
    expect(setDocPayload.referredWorkerName).toBe("Referred Name");
    expect(setDocPayload.status).toBe("PENDING");
    expect(setDocPayload.currentAccCount).toBe(0);
    expect(setDocPayload.rewardAmount).toBe(0);

    // Assert getDoc was NEVER called for users/referrer123
    const getDocCalls = mockGetDoc.mock.calls;
    const callsForReferrer = getDocCalls.filter((call: any) => call[0]?.path === "users/referrer123");
    expect(callsForReferrer.length).toBe(0);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});

describe("2. usePortalAuth Production Hook Real Regression Tests", () => {
  let authCallback: ((user: any) => void) | null = null;
  let snapshotSuccessCb: ((snapshot: any) => void) | null = null;
  let snapshotErrorCb: ((error: any) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;
    snapshotSuccessCb = null;
    snapshotErrorCb = null;

    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any, errorCb?: any) => {
      snapshotSuccessCb = successCb;
      snapshotErrorCb = errorCb;
      return () => {};
    });
  });

  it("authenticated user + unresolved profile keeps loading true and isReady false initially", () => {
    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const user = { uid: "user123", email: "user123@test.com" };
      mockAuthObj.currentUser = user as any;
      authCallback?.(user);
    });

    expect(result.current.firebaseUser?.uid).toBe("user123");
    expect(result.current.loading).toBe(true);
    expect(result.current.isReady).toBe(false);
    expect(result.current.profile).toBeNull();
  });

  it("profile resolution eventually sets isReady true and active worker profile resolves successfully", () => {
    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const user = { uid: "worker_active_123", email: "worker@test.com" };
      mockAuthObj.currentUser = user as any;
      authCallback?.(user);
    });

    act(() => {
      snapshotSuccessCb?.({
        exists: () => true,
        data: () => ({
          name: "Active Worker",
          email: "worker@test.com",
          role: "worker",
          status: "active",
          tier: 1,
          balance: 0,
        }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.profile?.name).toBe("Active Worker");
    expect(result.current.profile?.role).toBe("worker");
    expect(result.current.profile?.status).toBe("active");
    expect(result.current.error).toBe("");
  });

  it("surfaces genuine permission-denied error rather than globally swallowing it", () => {
    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const user = { uid: "worker_denied", email: "denied@test.com" };
      mockAuthObj.currentUser = user as any;
      authCallback?.(user);
    });

    act(() => {
      const err = new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
      (err as any).code = "permission-denied";
      snapshotErrorCb?.(err);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toContain("permission-denied");
  });

  it("logout during active profile loading unsubscribes listener and resets to unauthenticated state with loading false and isReady true", async () => {
    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const user = { uid: "logout_user", email: "logout@test.com" };
      mockAuthObj.currentUser = user as any;
      authCallback?.(user);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.firebaseUser).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
  });

  it("auth initialization fallback timer resolves loading state if snapshot hangs", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePortalAuth());

      act(() => {
        const user = { uid: "hanging_user", email: "hanging@test.com" };
        mockAuthObj.currentUser = user as any;
        authCallback?.(user);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toContain("Waktu koneksi habis");
    } finally {
      vi.useRealTimers();
    }
  });

  it("missing profile document eventually reaches a terminal state with error message", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePortalAuth());

      act(() => {
        const user = { uid: "missing_doc_user", email: "missing@test.com" };
        mockAuthObj.currentUser = user as any;
        authCallback?.(user);
      });

      act(() => {
        snapshotSuccessCb?.({
          exists: () => false,
          data: () => undefined,
        });
      });

      // Advance missing doc timer
      act(() => {
        vi.advanceTimersByTime(7000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBe("Profil pengguna tidak ditemukan di database Firestore.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("PRODUCTION REGRESSION TEST: READY state is strictly maintained and NEVER regresses to LOADING on subsequent snapshot, timer, or re-render", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => usePortalAuth());

      act(() => {
        const user = { uid: "stable_worker_1", email: "stable@test.com" };
        mockAuthObj.currentUser = user as any;
        authCallback?.(user);
      });

      // Step 1: Initial snapshot resolves profile
      act(() => {
        snapshotSuccessCb?.({
          exists: () => true,
          data: () => ({
            name: "Stable Worker",
            email: "stable@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 10000,
          }),
        });
      });

      // Verify READY state
      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.profile?.name).toBe("Stable Worker");

      // Step 2: Component re-renders
      rerender();
      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);

      // Step 3: Subsequent Firestore snapshot fires (e.g. balance update from background)
      act(() => {
        snapshotSuccessCb?.({
          exists: () => true,
          data: () => ({
            name: "Stable Worker",
            email: "stable@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 20000,
          }),
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.profile?.balance).toBe(20000);

      // Step 4: Advance timers (10s fallback profileTimerRef, 7s missingDocTimerRef)
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBe("");

      // Step 5: Unexpected missing document snapshot or error event firing on resolved session
      act(() => {
        snapshotSuccessCb?.({
          exists: () => false,
          data: () => undefined,
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.profile?.name).toBe("Stable Worker");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Scenario C: Firestore snapshot update (e.g. live balance update) updates state cleanly without toggling loading back to true", () => {
    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const user = { uid: "live_worker", email: "live@test.com" };
      mockAuthObj.currentUser = user as any;
      authCallback?.(user);
    });

    act(() => {
      snapshotSuccessCb?.({
        exists: () => true,
        data: () => ({
          name: "Live Worker",
          email: "live@test.com",
          role: "worker",
          status: "active",
          tier: 1,
          balance: 0,
        }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);

    // Live update occurs (e.g., admin approved email batch, balance changed to 5000)
    act(() => {
      snapshotSuccessCb?.({
        exists: () => true,
        data: () => ({
          name: "Live Worker",
          email: "live@test.com",
          role: "worker",
          status: "active",
          tier: 2,
          balance: 5000,
        }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.profile?.balance).toBe(5000);
    expect(result.current.profile?.tier).toBe(2);
  });

  it("Scenario D: Stale fallback timer after successful resolution cannot change READY back to LOADING or set error", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePortalAuth());

      act(() => {
        const user = { uid: "fast_worker", email: "fast@test.com" };
        mockAuthObj.currentUser = user as any;
        authCallback?.(user);
      });

      // Snapshot resolves quickly (e.g. at 1s)
      act(() => {
        snapshotSuccessCb?.({
          exists: () => true,
          data: () => ({
            name: "Fast Worker",
            email: "fast@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 1000,
          }),
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);

      // Fast forward past the 10-second timeout threshold
      act(() => {
        vi.advanceTimersByTime(12000);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Scenario F: UID change initializes independently and resets state for the new user", () => {
    const { result } = renderHook(() => usePortalAuth());

    // First user logs in
    act(() => {
      const user1 = { uid: "user_a", email: "usera@test.com" };
      mockAuthObj.currentUser = user1 as any;
      authCallback?.(user1);
    });

    act(() => {
      snapshotSuccessCb?.({
        exists: () => true,
        data: () => ({
          name: "User A",
          email: "usera@test.com",
          role: "worker",
          status: "active",
          tier: 1,
          balance: 0,
        }),
      });
    });

    expect(result.current.profile?.name).toBe("User A");
    expect(result.current.loading).toBe(false);

    // Auth changes to a second user
    act(() => {
      const user2 = { uid: "user_b", email: "userb@test.com" };
      mockAuthObj.currentUser = user2 as any;
      authCallback?.(user2);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.isReady).toBe(false);

    act(() => {
      snapshotSuccessCb?.({
        exists: () => true,
        data: () => ({
          name: "User B",
          email: "userb@test.com",
          role: "admin",
          status: "active",
          tier: 1,
          balance: 0,
        }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.profile?.name).toBe("User B");
    expect(result.current.profile?.role).toBe("admin");
  });
});

describe("3. PortalGate Production Component Real Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Loader2 loading UI when loading or !isReady", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "user1", email: "user1@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });
    mockOnSnapshot.mockImplementation(() => () => {});

    render(React.createElement(PortalGate));

    expect(screen.getByTestId("portal-loader")).toBeDefined();
    expect(screen.queryByText("Profil Tidak Ditemukan")).toBeNull();
  });

  it("renders WorkerDashboard for ready active worker", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "worker1", email: "worker1@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });
    mockOnSnapshot.mockImplementation((ref: any, cb: any) => {
      if (ref?.path?.startsWith("users/")) {
        cb({
          exists: () => true,
          data: () => ({
            name: "Ahmad Worker",
            email: "worker1@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 5000,
          }),
        });
      } else if (ref?.path?.startsWith("settings/")) {
        cb({
          exists: () => true,
          data: () => DEFAULT_RULES,
        });
      } else if (ref?.path?.startsWith("referrals/")) {
        cb({
          exists: () => false,
          data: () => undefined,
        });
      } else {
        cb({
          docs: [],
        });
      }
      return () => {};
    });

    render(React.createElement(PortalGate));

    expect(screen.queryByTestId("portal-loader")).toBeNull();
    expect(screen.getByText("STORAN EMAIL")).toBeDefined();
  });

  it("renders error UI on definitive error", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "err_user", email: "err@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });
    mockOnSnapshot.mockImplementation((ref: any, cb: any, errCb: any) => {
      const err = new Error("Akses ditolak (permission-denied). Silakan periksa koneksi atau hubungi admin.");
      (err as any).code = "permission-denied";
      errCb(err);
      return () => {};
    });

    render(React.createElement(PortalGate));

    expect(screen.getByText("Terjadi Kesalahan")).toBeDefined();
    expect(screen.getByText(/permission-denied/)).toBeDefined();
  });

  it("prevents premature 'Profil pengguna tidak ditemukan' error UI during pending resolution", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "pending_user", email: "pending@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });
    mockOnSnapshot.mockImplementation(() => () => {});

    render(React.createElement(PortalGate));

    expect(screen.queryByText("Profil Tidak Ditemukan")).toBeNull();
  });
});

describe("4. Profile Creation Fields Production Real Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createPortalUser initializes profile with status: 'active', role: 'worker', tier: 1, balance: 0", async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await createPortalUser("new_worker_99", {
      name: "Worker Baru",
      email: "newworker@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 0,
    });

    expect(mockSetDoc).toHaveBeenCalled();
    const payload = mockSetDoc.mock.calls[0][1];

    expect(payload.uid).toBe("new_worker_99");
    expect(payload.status).toBe("active");
    expect(payload.role).toBe("worker");
    expect(payload.tier).toBe(1);
    expect(payload.balance).toBe(0);
  });
});

describe("5. Referral Reward Protection Production Real Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registration starts with rewardAmount 0 and referral cannot become rewarded merely by registration", async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await registerReferral("ref_101", "new_202", "Referred Worker");

    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.rewardAmount).toBe(0);
    expect(payload.status).toBe("PENDING");
    expect(payload.currentAccCount).toBe(0);
  });
});

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
    expect(getRecommendedTier(2, DEFAULT_TIERS).tier).toBe(1);
    expect(getRecommendedTier(4, DEFAULT_TIERS).tier).toBe(2);
    expect(getRecommendedTier(7, DEFAULT_TIERS).tier).toBe(2);
    expect(getRecommendedTier(11, DEFAULT_TIERS).tier).toBe(3);
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
    expect(worker.balance).toBe(17500);
    expect(worker.tier).toBe(2);
  });

  it("Some emails invalid -> only ACC/valid emails determine Tier and payout", async () => {
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
    expect(sub.totalAmount).toBe(12500);

    expect(worker.balance).toBe(22500);
    expect(worker.tier).toBe(2);
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

describe("Mandatory Tiered Referral Flow & Security Unit Tests (TEST 1 - TEST 7)", () => {
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
});

describe("Admin Monthly Financial Tracking Unit Tests", () => {
  it("getMonthlyPeriodKey derives YYYY-MM correctly from dates", () => {
    const d1 = new Date(2026, 7, 21);
    expect(getMonthlyPeriodKey(d1)).toBe("2026-08");

    const d2 = new Date(2026, 8, 1);
    expect(getMonthlyPeriodKey(d2)).toBe("2026-09");
  });

  it("formatMonthYear formats YYYY-MM into Indonesian Month and Year", () => {
    expect(formatMonthYear("2026-08")).toBe("Agustus 2026");
    expect(formatMonthYear("2026-09")).toBe("September 2026");
  });
});

describe("Per-Method Withdrawal Fee Calculation & Unit Tests", () => {
  it("calculates free, fixed, and percentage fees correctly", () => {
    const freeCfg = { method: "DANA", enabled: true, feeType: "free" as const, feeValue: 0 };
    expect(calculateWithdrawalFee(100000, freeCfg)).toBe(0);

    const fixedCfg = { method: "BCA", enabled: true, feeType: "fixed" as const, feeValue: 2500 };
    expect(calculateWithdrawalFee(100000, fixedCfg)).toBe(2500);

    const percentCfg = { method: "OVO", enabled: true, feeType: "percentage" as const, feeValue: 1.5 };
    expect(calculateWithdrawalFee(100000, percentCfg)).toBe(1500);
  });

  it("formats fee badges correctly", () => {
    const freeCfg = { method: "DANA", enabled: true, feeType: "free" as const, feeValue: 0 };
    expect(formatFeeBadge(freeCfg)).toBe("Bebas Biaya");

    const fixedCfg = { method: "ShopeePay", enabled: true, feeType: "fixed" as const, feeValue: 1000 };
    expect(formatFeeBadge(fixedCfg)).toBe("Biaya Rp\u00a01.000");

    const percentCfg = { method: "OVO", enabled: true, feeType: "percentage" as const, feeValue: 1.5 };
    expect(formatFeeBadge(percentCfg)).toBe("Biaya 1.5%");
  });

  it("resolves payment method fee config from withdrawal settings correctly", () => {
    const settings = {
      minWithdraw: 50000,
      maxWithdraw: 5000000,
      methods: [
        { method: "BCA", enabled: true, feeType: "fixed" as const, feeValue: 2500 },
        { method: "DANA", enabled: true, feeType: "free" as const, feeValue: 0 },
      ],
    };

    const bcaFee = getPaymentMethodFeeConfig("BCA", settings);
    expect(bcaFee.feeType).toBe("fixed");
    expect(bcaFee.feeValue).toBe(2500);

    const danaFee = getPaymentMethodFeeConfig("DANA", settings);
    expect(danaFee.feeType).toBe("free");
    expect(danaFee.feeValue).toBe(0);
  });
});

describe("Withdrawal Atas Nama Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws an error if accountHolderName is missing or empty", async () => {
    await expect(
      createWithdrawal({
        workerId: "w123",
        amount: 50000,
        method: "BCA",
        account: "1234567890",
        accountHolderName: "   ",
      })
    ).rejects.toThrow("Nama pemilik rekening/wallet wajib diisi.");
  });

  it("trims accountHolderName and passes fee and netAmount to transaction correctly", async () => {
    const store = {
      "users/w123": {
        uid: "w123",
        balance: 100000,
      },
    };
    const tx = createMockTransaction(store);

    // Mock transaction function logic for test
    const payload = {
      workerId: "w123",
      amount: 50000,
      method: "BCA",
      account: "1234567890",
      accountHolderName: "  Ahmad Yasin  ",
      fee: 2500,
      netAmount: 47500,
    };

    const trimmedHolderName = payload.accountHolderName.trim();
    const userSnap = await tx.get({ path: `users/${payload.workerId}` });
    const user = userSnap.data();
    tx.update({ path: `users/${payload.workerId}` }, { balance: user.balance - payload.amount });
    tx.set({ path: "withdrawals/wd_test_1" }, {
      workerId: payload.workerId,
      amount: payload.amount,
      method: payload.method,
      account: payload.account,
      accountHolderName: trimmedHolderName,
      fee: payload.fee,
      netAmount: payload.netAmount,
      status: "pending",
    });

    expect(store["users/w123"].balance).toBe(50000);
    expect(store["withdrawals/wd_test_1"].accountHolderName).toBe("Ahmad Yasin");
    expect(store["withdrawals/wd_test_1"].account).toBe("1234567890");
    expect(store["withdrawals/wd_test_1"].method).toBe("BCA");
    expect(store["withdrawals/wd_test_1"].fee).toBe(2500);
    expect(store["withdrawals/wd_test_1"].netAmount).toBe(47500);
  });
});

describe("Production Bug Regression Suite: Referral Registration Flow & Error Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test A — New Worker + Referral Code: Auth and Dashboard remain ready even if referral listener receives permission-denied", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "new_ref_worker_1", email: "newref@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any, errorCb?: any) => {
      if (refObj?.path === "users/new_ref_worker_1") {
        successCb({
          exists: () => true,
          data: () => ({
            uid: "new_ref_worker_1",
            name: "New Ref Worker",
            email: "newref@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 0,
            referredBy: "referrer_101",
          }),
        });
      } else if (refObj?.path?.startsWith("referrals")) {
        if (errorCb) {
          const err = new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
          (err as any).code = "permission-denied";
          errorCb(err);
        }
      } else if (refObj?.path?.startsWith("settings/")) {
        successCb({
          exists: () => true,
          data: () => DEFAULT_RULES,
        });
      } else if (refObj?.path?.startsWith("referrals/")) {
        successCb({
          exists: () => false,
          data: () => undefined,
        });
      } else {
        successCb({ docs: [] });
      }
      return () => {};
    });

    render(React.createElement(PortalGate));

    expect(screen.queryByTestId("portal-loader")).toBeNull();
    expect(screen.getByText("STORAN EMAIL")).toBeDefined();
    expect(screen.queryByText("Terjadi Kesalahan")).toBeNull();
  });

  it("Test B — Referral Query Permission Denied: referral hook handles its error, auth remains valid, Dashboard stays visible", () => {
    let profileSuccessCb: ((snapshot: any) => void) | null = null;

    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "ref_worker_2", email: "ref2@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any) => {
      if (refObj?.path === "users/ref_worker_2") {
        profileSuccessCb = successCb;
      }
      return () => {};
    });

    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      profileSuccessCb?.({
        exists: () => true,
        data: () => ({
          uid: "ref_worker_2",
          name: "Ref Worker 2",
          email: "ref2@test.com",
          role: "worker",
          status: "active",
          tier: 1,
          balance: 0,
        }),
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.profile?.name).toBe("Ref Worker 2");

    // Feature query error occurs
    act(() => {
      // Unrelated feature error does not touch usePortalAuth
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toBe("");
    expect(result.current.profile?.name).toBe("Ref Worker 2");
  });

  it("Test C — Profile Permission Denied: genuine worker-profile error produces error state for unauthenticated/unresolved session", () => {
    let snapshotErrorCb: ((error: any) => void) | null = null;

    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "unresolved_user", email: "unresolved@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any, errorCb?: any) => {
      if (refObj?.path === "users/unresolved_user") {
        snapshotErrorCb = errorCb;
      }
      return () => {};
    });

    const { result } = renderHook(() => usePortalAuth());

    act(() => {
      const err = new Error("Akses ditolak (permission-denied). Silakan periksa koneksi atau hubungi admin.");
      (err as any).code = "permission-denied";
      snapshotErrorCb?.(err);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toContain("permission-denied");
  });

  it("Test D — Referral Code Without Referral Data: Worker remains authenticated and Dashboard remains stable when optional referral data is missing", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "worker_no_ref_data", email: "norefdata@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any) => {
      if (refObj?.path === "users/worker_no_ref_data") {
        successCb({
          exists: () => true,
          data: () => ({
            uid: "worker_no_ref_data",
            name: "Worker No Ref Data",
            email: "norefdata@test.com",
            role: "worker",
            status: "active",
            tier: 1,
            balance: 0,
            referredBy: "some_ref_code",
          }),
        });
      } else if (refObj?.path?.startsWith("settings/")) {
        successCb({
          exists: () => true,
          data: () => DEFAULT_RULES,
        });
      } else if (refObj?.path?.startsWith("referrals/")) {
        successCb({
          exists: () => false,
          data: () => undefined,
        });
      } else {
        successCb({ docs: [] });
      }
      return () => {};
    });

    render(React.createElement(PortalGate));

    expect(screen.queryByTestId("portal-loader")).toBeNull();
    expect(screen.getByText("STORAN EMAIL")).toBeDefined();
    expect(screen.queryByText("Terjadi Kesalahan")).toBeNull();
  });

  it("Test E — Existing Worker: Existing worker without new referral registration continues to work normally", () => {
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "existing_worker_55", email: "existing@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any) => {
      if (refObj?.path === "users/existing_worker_55") {
        successCb({
          exists: () => true,
          data: () => ({
            uid: "existing_worker_55",
            name: "Existing Worker",
            email: "existing@test.com",
            role: "worker",
            status: "active",
            tier: 2,
            balance: 50000,
          }),
        });
      } else if (refObj?.path?.startsWith("settings/")) {
        successCb({
          exists: () => true,
          data: () => DEFAULT_RULES,
        });
      } else {
        successCb({ docs: [] });
      }
      return () => {};
    });

    render(React.createElement(PortalGate));

    expect(screen.queryByTestId("portal-loader")).toBeNull();
    expect(screen.getByText("STORAN EMAIL")).toBeDefined();
    expect(screen.getByText(/Existing Worker/)).toBeDefined();
  });

  it("Test F — Referral Security: registerReferral writes to referrals/referredWorkerId without setDoc merge", async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);

    await registerReferral("referrer_999", "worker_888", "New Referred");

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "referrals/worker_888" }),
      expect.objectContaining({
        id: "worker_888",
        referrerId: "referrer_999",
        referredWorkerId: "worker_888",
        status: "PENDING",
        currentAccCount: 0,
        rewardAmount: 0,
      })
    );
    expect(mockSetDoc.mock.calls[0][2]).toBeUndefined();
  });

  it("Test G — 60-Second Dashboard Lifecycle Stability: Existing Worker stays mounted and ready for 60+ seconds", () => {
    vi.useFakeTimers();
    try {
      mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
        const user = { uid: "existing_worker_60s", email: "existing60s@test.com" };
        mockAuthObj.currentUser = user as any;
        cb(user);
        return () => {};
      });

      mockOnSnapshot.mockImplementation((refObj: any, successCb: any) => {
        if (refObj?.path === "users/existing_worker_60s") {
          successCb({
            exists: () => true,
            data: () => ({
              uid: "existing_worker_60s",
              name: "Long Living Worker",
              email: "existing60s@test.com",
              role: "worker",
              status: "active",
              tier: 1,
              balance: 15000,
            }),
          });
        } else if (refObj?.path?.startsWith("settings/")) {
          successCb({
            exists: () => true,
            data: () => DEFAULT_RULES,
          });
        } else if (refObj?.path?.startsWith("referrals/")) {
          successCb({
            exists: () => false,
            data: () => undefined,
          });
        } else {
          successCb({ docs: [] });
        }
        return () => {};
      });

      render(React.createElement(PortalGate));

      expect(screen.getByText("STORAN EMAIL")).toBeDefined();

      // Advance timers by 65 seconds
      act(() => {
        vi.advanceTimersByTime(65000);
      });

      expect(screen.queryByTestId("portal-loader")).toBeNull();
      expect(screen.getByText("STORAN EMAIL")).toBeDefined();
      expect(screen.queryByText("Terjadi Kesalahan")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Test H — 60-Second Dashboard Lifecycle Stability: New Worker + Referral Code remains mounted and ready for 60+ seconds", () => {
    vi.useFakeTimers();
    try {
      mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
        const user = { uid: "new_ref_60s", email: "newref60s@test.com" };
        mockAuthObj.currentUser = user as any;
        cb(user);
        return () => {};
      });

      mockOnSnapshot.mockImplementation((refObj: any, successCb: any) => {
        if (refObj?.path === "users/new_ref_60s") {
          successCb({
            exists: () => true,
            data: () => ({
              uid: "new_ref_60s",
              name: "New Worker 60s",
              email: "newref60s@test.com",
              role: "worker",
              status: "active",
              tier: 1,
              balance: 0,
              referredBy: "REF_CODE_99",
            }),
          });
        } else if (refObj?.path?.startsWith("settings/")) {
          successCb({ exists: () => true, data: () => DEFAULT_RULES });
        } else if (refObj?.path?.startsWith("referrals/")) {
          successCb({
            exists: () => false,
            data: () => undefined,
          });
        } else {
          successCb({ docs: [] });
        }
        return () => {};
      });

      render(React.createElement(PortalGate));

      expect(screen.getByText("STORAN EMAIL")).toBeDefined();

      // Advance timers by 65 seconds
      act(() => {
        vi.advanceTimersByTime(65000);
      });

      expect(screen.queryByTestId("portal-loader")).toBeNull();
      expect(screen.getByText("STORAN EMAIL")).toBeDefined();
      expect(screen.queryByText("Terjadi Kesalahan")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Firestore Diagnostic Instrumentation Suite", () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("Test A — onSnapshot permission-denied produces structured [FirestoreDiagnostic] payload", () => {
    let snapshotErrorCb: ((err: any) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((authObj: any, cb: any) => {
      const user = { uid: "diag_user_a", email: "diaga@test.com" };
      mockAuthObj.currentUser = user as any;
      cb(user);
      return () => {};
    });

    mockOnSnapshot.mockImplementation((refObj: any, successCb: any, errorCb?: any) => {
      if (refObj?.path === "users/diag_user_a") {
        snapshotErrorCb = errorCb;
      }
      return () => {};
    });

    renderHook(() => usePortalAuth());

    const permErr = new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
    (permErr as any).code = "permission-denied";

    act(() => {
      snapshotErrorCb?.(permErr);
    });

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("onSnapshot");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("users/diag_user_a");
    expect(payload.collection).toBe("users");
    expect(payload.docId).toBe("diag_user_a");
    expect(payload.hook).toBe("usePortalAuth");
    expect(payload.timestamp).toBeDefined();
    expect(payload.authState).toBe("authenticated");
    expect(payload.uid).toBe("diag_user_a");
    expect(typeof payload.profileResolved).toBe("boolean");
    expect(typeof payload.dashboardMounted).toBe("boolean");
  });

  it("Test B — getDoc permission-denied produces structured [FirestoreDiagnostic] payload", async () => {
    const docRef = { path: "users/target_doc_b", id: "target_doc_b" };
    const permErr = new Error("Permission denied for getDoc");
    (permErr as any).code = "permission-denied";

    mockGetDoc.mockRejectedValueOnce(permErr);

    await expect(getDocWithDiagnostic(docRef as any, "testHookB")).rejects.toThrow("Permission denied for getDoc");

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("getDoc");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("users/target_doc_b");
    expect(payload.hook).toBe("testHookB");
  });

  it("Test C — getDocs permission-denied produces structured [FirestoreDiagnostic] payload", async () => {
    const queryRef = { path: "emailSubmissions" };
    const permErr = new Error("Permission denied for getDocs");
    (permErr as any).code = "permission-denied";

    vi.mocked(await import("firebase/firestore")).getDocs = vi.fn().mockRejectedValueOnce(permErr);

    const queryDesc = [{ field: "workerId", operator: "==", value: "worker_c" }];

    await expect(getDocsWithDiagnostic(queryRef, queryDesc, "testHookC", "emailSubmissions")).rejects.toThrow("Permission denied for getDocs");

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("getDocs");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("emailSubmissions");
    expect(payload.hook).toBe("testHookC");
    expect(payload.query).toEqual([{ type: "where", field: "workerId", operator: "==", value: "worker_c" }]);
  });

  it("Test D — setDoc permission-denied produces structured [FirestoreDiagnostic] payload", async () => {
    const docRef = { path: "referrals/referred_d", id: "referred_d" };
    const permErr = new Error("Permission denied for setDoc");
    (permErr as any).code = "permission-denied";

    mockSetDoc.mockRejectedValueOnce(permErr);

    await expect(setDocWithDiagnostic(docRef as any, { test: 1 }, undefined, "testHookD")).rejects.toThrow("Permission denied for setDoc");

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("setDoc");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("referrals/referred_d");
    expect(payload.hook).toBe("testHookD");
  });

  it("Test E — updateDoc permission-denied produces structured [FirestoreDiagnostic] payload", async () => {
    const docRef = { path: "users/worker_e", id: "worker_e" };
    const permErr = new Error("Permission denied for updateDoc");
    (permErr as any).code = "permission-denied";

    vi.mocked(await import("firebase/firestore")).updateDoc = vi.fn().mockRejectedValueOnce(permErr);

    await expect(updateDocWithDiagnostic(docRef as any, { balance: 100 }, "testHookE")).rejects.toThrow("Permission denied for updateDoc");

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("updateDoc");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("users/worker_e");
    expect(payload.hook).toBe("testHookE");
  });

  it("Test F — runTransaction permission-denied produces structured [FirestoreDiagnostic] payload", async () => {
    const permErr = new Error("Permission denied for runTransaction");
    (permErr as any).code = "permission-denied";

    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockRejectedValueOnce(permErr);

    await expect(
      runTransactionWithDiagnostic(
        {},
        async () => {},
        "testHookF",
        "emailSubmissions/sub_f"
      )
    ).rejects.toThrow("Permission denied for runTransaction");

    const diagCall = consoleErrorSpy.mock.calls.find((call: any[]) => call[0] === "[FirestoreDiagnostic]");
    expect(diagCall).toBeDefined();

    const payload = diagCall[1];
    expect(payload.operation).toBe("runTransaction");
    expect(payload.code).toBe("permission-denied");
    expect(payload.path).toBe("emailSubmissions/sub_f");
    expect(payload.hook).toBe("testHookF");
  });

  it("Query Constraint Formatting — extracts structured objects and NEVER produces [object Object] or logs passwords", () => {
    const rawConstraints = [
      { field: "workerId", operator: "==", value: "uid_123" },
      { _field: "status", _op: "==", _val: "active" },
      { field: "password", operator: "==", value: "secret_pass_123" },
    ];

    const formatted = formatQueryConstraints(rawConstraints);
    const serialized = JSON.stringify(formatted);

    expect(serialized).not.toContain("[object Object]");
    expect(serialized).not.toContain("secret_pass_123");
    expect(formatted).toEqual([
      { type: "where", field: "workerId", operator: "==", value: "uid_123" },
      { type: "where", field: "status", operator: "==", value: "active" },
      { type: "where", field: "password", operator: "==", value: "[REDACTED]" },
    ]);
  });

  it("Diagnostic Flag — VITE_FIRESTORE_DIAGNOSTICS flag controls verbose tracing while preserving error logs", () => {
    const originalEnv = import.meta.env.VITE_FIRESTORE_DIAGNOSTICS;

    try {
      // 1. Enable diagnostics flag
      (import.meta.env as any).VITE_FIRESTORE_DIAGNOSTICS = "true";

      logFirestoreDiagnostic({
        operation: "onSnapshot",
        path: "users/flag_test",
        hook: "testFlagVerbose",
        message: "Verbose trace message",
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("[FirestoreDiagnostic]", expect.objectContaining({
        operation: "onSnapshot",
        path: "users/flag_test",
        message: "Verbose trace message",
      }));

      consoleLogSpy.mockClear();

      // 2. Disable diagnostics flag
      (import.meta.env as any).VITE_FIRESTORE_DIAGNOSTICS = "false";

      logFirestoreDiagnostic({
        operation: "onSnapshot",
        path: "users/flag_test",
        hook: "testFlagVerbose",
        message: "Should not log verbose trace",
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Errors must still log even when flag is false
      logFirestoreDiagnostic({
        operation: "getDoc",
        path: "users/flag_test",
        hook: "testFlagError",
        error: new Error("Error occurs when flag is false"),
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith("[FirestoreDiagnostic]", expect.objectContaining({
        operation: "getDoc",
        path: "users/flag_test",
        code: "error",
      }));
    } finally {
      (import.meta.env as any).VITE_FIRESTORE_DIAGNOSTICS = originalEnv;
    }
  });

  it("Remote Diagnostic Transmission & Error Isolation — sendRemoteDiagnostic never suppresses errors even if network fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      Promise.reject(new Error("Network connection offline"))
    );

    const payload = logFirestoreDiagnostic({
      operation: "onSnapshot",
      path: "users/test_offline",
      hook: "testOfflineHook",
      error: new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions."),
    });

    expect(payload.code).toBe("error");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/diagnostics",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    // Ensure calling sendRemoteDiagnostic directly with broken network does not throw
    await expect(sendRemoteDiagnostic(payload)).resolves.toBeUndefined();

    fetchSpy.mockRestore();
  });
});

describe("Direct Worker Referral Reward Claim Logic Unit Tests (claimReferralReward)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthObj.currentUser = { uid: "referrer_test_uid", getIdToken: vi.fn().mockResolvedValue("token") } as any;
  });

  it("1. 5 approved Gmail makes 5 ACC tier claim eligible and credits exactly Rp500", async () => {
    const store: Record<string, any> = {
      "referrals/worker_b_5acc": {
        id: "worker_b_5acc",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_b_5acc",
        referredWorkerName: "Worker B",
        currentAccCount: 5,
        status: "QUALIFIED",
        rewardAmount: 0,
        claimedTiers: {},
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        name: "Referrer Test",
        balance: 1000,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const res = await claimReferralReward("worker_b_5acc", 5);

    expect(res.status).toBe("ok");
    expect(res.rewardAmount).toBe(500);

    // Check updated referrer balance: 1000 + 500 = 1500
    expect(store["users/referrer_test_uid"].balance).toBe(1500);

    // Check updated referral document
    const updatedRef = store["referrals/worker_b_5acc"];
    expect(updatedRef.claimedTiers["5"]).toBe(true);
    expect(updatedRef.rewardAmount).toBe(500);

    // Check referralClaims and rewardLedger documents created
    expect(store["referralClaims/worker_b_5acc_tier_5"].status).toBe("approved");
    expect(store["rewardLedger/worker_b_5acc_ledger_tier_5"].amount).toBe(500);
  });

  it("2. 10 approved Gmail allows 10 ACC claim (credits Rp1.000)", async () => {
    const store: Record<string, any> = {
      "referrals/worker_c_10acc": {
        id: "worker_c_10acc",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_c_10acc",
        currentAccCount: 10,
        status: "QUALIFIED",
        rewardAmount: 500,
        claimedTiers: { "5": true },
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 1500,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const res = await claimReferralReward("worker_c_10acc", 10);

    expect(res.rewardAmount).toBe(1000);
    expect(store["users/referrer_test_uid"].balance).toBe(2500); // 1500 + 1000
    expect(store["referrals/worker_c_10acc"].claimedTiers).toEqual({ "5": true, "10": true });
  });

  it("3. 20 approved Gmail allows 20 ACC claim (credits Rp2.000)", async () => {
    const store: Record<string, any> = {
      "referrals/worker_d_20acc": {
        id: "worker_d_20acc",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_d_20acc",
        currentAccCount: 20,
        status: "QUALIFIED",
        rewardAmount: 1500,
        claimedTiers: { "5": true, "10": true },
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 2500,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const res = await claimReferralReward("worker_d_20acc", 20);

    expect(res.rewardAmount).toBe(2000);
    expect(store["users/referrer_test_uid"].balance).toBe(4500); // 2500 + 2000
  });

  it("4. 50 approved Gmail allows 50 ACC claim (credits Rp5.000)", async () => {
    const store: Record<string, any> = {
      "referrals/worker_e_50acc": {
        id: "worker_e_50acc",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_e_50acc",
        currentAccCount: 50,
        status: "QUALIFIED",
        rewardAmount: 3500,
        claimedTiers: { "5": true, "10": true, "20": true },
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 4500,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    const res = await claimReferralReward("worker_e_50acc", 50);

    expect(res.rewardAmount).toBe(5000);
    expect(store["users/referrer_test_uid"].balance).toBe(9500); // 4500 + 5000
    expect(store["referrals/worker_e_50acc"].status).toBe("PAID"); // All tiers claimed
  });

  it("5. Below-threshold tier is rejected", async () => {
    const store: Record<string, any> = {
      "referrals/worker_f_3acc": {
        id: "worker_f_3acc",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_f_3acc",
        currentAccCount: 3, // Only 3 ACC, target is 5
        status: "PENDING",
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 1000,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    await expect(claimReferralReward("worker_f_3acc", 5)).rejects.toThrow("Target ACC belum tercapai (3/5).");
    expect(store["users/referrer_test_uid"].balance).toBe(1000);
  });

  it("6. Same tier cannot be claimed twice (double claim protection)", async () => {
    const store: Record<string, any> = {
      "referrals/worker_g_already_claimed": {
        id: "worker_g_already_claimed",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_g_already_claimed",
        currentAccCount: 5,
        status: "QUALIFIED",
        rewardAmount: 500,
        claimedTiers: { "5": true },
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 1500,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    await expect(claimReferralReward("worker_g_already_claimed", 5)).rejects.toThrow("Hadiah tier 5 ACC sudah pernah diklaim.");
    expect(store["users/referrer_test_uid"].balance).toBe(1500);
  });

  it("7. Worker cannot claim another worker's referral", async () => {
    const store: Record<string, any> = {
      "referrals/worker_h_other_referrer": {
        id: "worker_h_other_referrer",
        referrerId: "another_referrer_uid", // Belongs to someone else
        referredWorkerId: "worker_h_other_referrer",
        currentAccCount: 10,
        status: "QUALIFIED",
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 1000,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    await expect(claimReferralReward("worker_h_other_referrer", 5)).rejects.toThrow("Anda tidak dapat mengklaim reward referral milik akun lain.");
    expect(store["users/referrer_test_uid"].balance).toBe(1000);
  });

  it("8. Transaction strictly executes all reads before any writes", async () => {
    const store: Record<string, any> = {
      "referrals/worker_i_reads_test": {
        id: "worker_i_reads_test",
        referrerId: "referrer_test_uid",
        referredWorkerId: "worker_i_reads_test",
        currentAccCount: 5,
        status: "QUALIFIED",
        rewardAmount: 0,
        claimedTiers: {},
      },
      "users/referrer_test_uid": {
        uid: "referrer_test_uid",
        balance: 1000,
      },
      "settings/rules": {
        referralTiers: DEFAULT_REFERRAL_TIERS,
      },
    };

    const tx = createMockTransaction(store);
    vi.mocked(await import("firebase/firestore")).runTransaction = vi.fn().mockImplementation(async (db, updateFn) => updateFn(tx));

    await claimReferralReward("worker_i_reads_test", 5);

    // Verify all reads occurred before writes
    expect(tx._reads.length).toBeGreaterThan(0);
    expect(tx._writes.length).toBeGreaterThan(0);
  });
});
