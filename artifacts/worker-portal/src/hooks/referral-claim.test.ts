import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isReferralTierClaimed,
  isReferralTierClaimable,
  DEFAULT_REFERRAL_TIERS,
} from "@/lib/portal-utils";
import type { Referral, PortalUser } from "@/lib/portal-types";

// Mock Firebase modules for unit testing
vi.mock("@/lib/firebase", () => {
  return {
    auth: {
      currentUser: { uid: "referrer_worker_1", email: "referrer@test.com" },
    },
    db: {},
    firebaseConfigured: true,
  };
});

// Mock Firestore functions
const mockTransactionTx = {
  get: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn((db: any, path: string, ...rest: string[]) => ({
      path: rest.length ? `${path}/${rest.join("/")}` : path,
    })),
    collection: vi.fn((db: any, path: string) => ({ path })),
    query: vi.fn(),
    where: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn().mockResolvedValue([]),
    setDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn(() => "MOCK_TIMESTAMP"),
    runTransaction: vi.fn(async (db: any, updateFunction: any) => {
      return updateFunction(mockTransactionTx);
    }),
  };
});

import {
  claimReferralTier,
  createReferralClaimRequest,
  approveReferral,
  evaluateReferralQualification,
  registerReferral,
} from "@/hooks/use-portal";

describe("Per-Tier Referral Claim & Qualification Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Worker creates claim request when target 5 ACC reached", async () => {
    const firestoreModule = await import("firebase/firestore");
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 5,
      status: "QUALIFIED",
      claimedTiers: {},
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (docRef: any) => {
      if (docRef.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc } as any;
      }
      if (docRef.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) } as any;
      }
      if (docRef.path === "referralClaims/ref_worker_2_tier_5") {
        return { exists: () => false, data: () => null } as any;
      }
      return { exists: () => false, data: () => null } as any;
    });

    await claimReferralTier("ref_worker_2", 5);

    expect(firestoreModule.setDoc).toHaveBeenCalledWith(
      { path: "referralClaims/ref_worker_2_tier_5" },
      expect.objectContaining({
        id: "ref_worker_2_tier_5",
        referralId: "ref_worker_2",
        referrerId: "referrer_worker_1",
        minAcc: 5,
        rewardAmount: 500,
        status: "pending",
      })
    );
  });

  it("2. Worker under 5 ACC -> Rp500 claim request fails", async () => {
    const firestoreModule = await import("firebase/firestore");
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 3,
      status: "PENDING",
      claimedTiers: {},
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (docRef: any) => {
      if (docRef.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc } as any;
      }
      return { exists: () => false } as any;
    });

    await expect(claimReferralTier("ref_worker_2", 5)).rejects.toThrow("Target ACC belum tercapai");
  });

  it("3. Admin approves 10 ACC claim request and credits referrer balance", async () => {
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 10,
      status: "QUALIFIED",
      claimedTiers: { "5": true },
      rewardAmount: 500,
    };

    const referrerUserDoc: PortalUser = {
      uid: "referrer_worker_1",
      name: "Worker 1",
      email: "referrer@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 10500,
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => referrerUserDoc };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_worker_2", 10);

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "referrals/ref_worker_2" },
      expect.objectContaining({
        claimedTiers: { "5": true, "10": true },
        rewardAmount: 1500,
      })
    );

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "users/referrer_worker_1" },
      { balance: 11500 }
    );
  });

  it("4. Admin approves 20 ACC claim request and credits referrer balance", async () => {
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 20,
      status: "QUALIFIED",
      claimedTiers: { "5": true, "10": true },
      rewardAmount: 1500,
    };

    const referrerUserDoc: PortalUser = {
      uid: "referrer_worker_1",
      name: "Worker 1",
      email: "referrer@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 11500,
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => referrerUserDoc };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_worker_2", 20);

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "referrals/ref_worker_2" },
      expect.objectContaining({
        claimedTiers: { "5": true, "10": true, "20": true },
        rewardAmount: 3500,
      })
    );

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "users/referrer_worker_1" },
      { balance: 13500 }
    );
  });

  it("5. Admin approves 50 ACC claim request and marks status PAID when all tiers claimed", async () => {
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 50,
      status: "QUALIFIED",
      claimedTiers: { "5": true, "10": true, "20": true },
      rewardAmount: 3500,
    };

    const referrerUserDoc: PortalUser = {
      uid: "referrer_worker_1",
      name: "Worker 1",
      email: "referrer@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 13500,
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => referrerUserDoc };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_worker_2", 50);

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "referrals/ref_worker_2" },
      expect.objectContaining({
        claimedTiers: { "5": true, "10": true, "20": true, "50": true },
        rewardAmount: 8500,
        status: "PAID",
      })
    );

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "users/referrer_worker_1" },
      { balance: 18500 }
    );
  });

  it("6. Tier already claimed cannot be approved again", async () => {
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 5,
      status: "QUALIFIED",
      claimedTiers: { "5": true },
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_2") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      return { exists: () => false };
    });

    await expect(approveReferral("ref_worker_2", 5)).rejects.toThrow("sudah pernah diklaim");
  });

  it("7. Claiming Rp500 maintains eligibility for Rp1.000", () => {
    const referralDoc: Referral = {
      id: "ref_worker_2",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_2",
      currentAccCount: 10,
      status: "QUALIFIED",
      claimedTiers: { "5": true },
    };

    expect(isReferralTierClaimed(referralDoc, 5, DEFAULT_REFERRAL_TIERS)).toBe(true);
    expect(isReferralTierClaimed(referralDoc, 10, DEFAULT_REFERRAL_TIERS)).toBe(false);
    expect(isReferralTierClaimable(referralDoc, 10, DEFAULT_REFERRAL_TIERS)).toBe(true);
  });

  it("8. Worker cannot claim referral reward of another worker", async () => {
    const firestoreModule = await import("firebase/firestore");
    const referralDoc: Referral = {
      id: "ref_other_worker",
      referrerId: "different_worker_uid",
      referredWorkerId: "referred_worker_x",
      currentAccCount: 5,
      status: "QUALIFIED",
      claimedTiers: {},
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (docRef: any) => {
      if (docRef.path === "referrals/ref_other_worker") {
        return { exists: () => true, data: () => referralDoc } as any;
      }
      return { exists: () => false } as any;
    });

    await expect(claimReferralTier("ref_other_worker", 5)).rejects.toThrow("milik akun lain");
  });

  it("9. Reward amount is fetched dynamically from rules settings", async () => {
    const customTiers = [
      { minAcc: 5, reward: 750 },
      { minAcc: 10, reward: 1500 },
    ];

    const referralDoc: Referral = {
      id: "ref_worker_custom",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_custom",
      currentAccCount: 5,
      status: "QUALIFIED",
      claimedTiers: {},
    };

    const referrerUserDoc: PortalUser = {
      uid: "referrer_worker_1",
      name: "Worker 1",
      email: "referrer@test.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 1000,
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_custom") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: customTiers }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => referrerUserDoc };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_worker_custom", 5);

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "users/referrer_worker_1" },
      { balance: 1750 }
    );
  });

  it("10. Concurrent / double claim fails due to atomic transaction state", async () => {
    const referralDocState: Referral = {
      id: "ref_worker_concurrent",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_c",
      currentAccCount: 5,
      status: "QUALIFIED",
      claimedTiers: {},
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_worker_concurrent") {
        return { exists: () => true, data: () => referralDocState };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => ({ balance: 0, uid: "referrer_worker_1" }) };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_worker_concurrent", 5);
    referralDocState.claimedTiers = { "5": true };

    await expect(approveReferral("ref_worker_concurrent", 5)).rejects.toThrow("sudah pernah diklaim");
  });

  it("11. Existing referral registration works", async () => {
    await expect(registerReferral("referrer_1", "referred_1", "Referred Worker 1")).resolves.toBeUndefined();
  });

  it("12. Existing referral qualification evaluation works", async () => {
    const firestoreModule = await import("firebase/firestore");
    vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce([
      {
        data: () => ({
          status: "approved",
          approvedItemCount: 5,
        }),
      },
    ] as any);

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/referred_eval") {
        return {
          exists: () => true,
          data: () => ({
            id: "referred_eval",
            referrerId: "referrer_1",
            referredWorkerId: "referred_eval",
            status: "PENDING",
          }),
        };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      return { exists: () => false };
    });

    await evaluateReferralQualification("referred_eval");

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "referrals/referred_eval" },
      expect.objectContaining({
        currentAccCount: 5,
        status: "QUALIFIED",
      })
    );
  });

  it("13. Existing admin approval flow works", async () => {
    const referralDoc: Referral = {
      id: "ref_admin_test",
      referrerId: "referrer_worker_1",
      referredWorkerId: "referred_worker_admin",
      currentAccCount: 10,
      status: "QUALIFIED",
      claimedTiers: {},
    };

    mockTransactionTx.get.mockImplementation(async (refObj: any) => {
      if (refObj.path === "referrals/ref_admin_test") {
        return { exists: () => true, data: () => referralDoc };
      }
      if (refObj.path === "settings/rules") {
        return { exists: () => true, data: () => ({ referralTiers: DEFAULT_REFERRAL_TIERS }) };
      }
      if (refObj.path === "users/referrer_worker_1") {
        return { exists: () => true, data: () => ({ balance: 5000, uid: "referrer_worker_1" }) };
      }
      return { exists: () => false };
    });

    await approveReferral("ref_admin_test", 10);

    expect(mockTransactionTx.update).toHaveBeenCalledWith(
      { path: "referrals/ref_admin_test" },
      expect.objectContaining({
        claimedTiers: { "10": true },
        rewardAmount: 1000,
      })
    );
  });
});
