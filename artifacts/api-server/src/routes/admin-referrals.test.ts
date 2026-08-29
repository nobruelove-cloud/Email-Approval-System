import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { adminAuth, adminDb } from "../lib/firebase-admin";

vi.mock("../lib/firebase-admin", () => {
  const mockVerifyIdToken = vi.fn();
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();
  const mockRunTransaction = vi.fn();

  return {
    adminAuth: {
      verifyIdToken: mockVerifyIdToken,
    },
    adminDb: {
      doc: mockDoc,
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    },
    FieldValue: {
      serverTimestamp: () => "MOCK_TIMESTAMP",
    },
  };
});

describe("API Integration: POST /api/admin/referrals/:referralId/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing or malformed", async () => {
    const res1 = await request(app).post("/api/admin/referrals/ref123/approve");
    expect(res1.status).toBe(401);
    expect(res1.body.error).toContain("Sesi tidak ditemukan");

    const res2 = await request(app)
      .post("/api/admin/referrals/ref123/approve")
      .set("Authorization", "Basic invalidtoken");
    expect(res2.status).toBe(401);
  });

  it("returns 401 when Firebase ID token verification fails", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValueOnce(new Error("Token expired"));

    const res = await request(app)
      .post("/api/admin/referrals/ref123/approve")
      .set("Authorization", "Bearer invalid_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Otentikasi gagal");
  });

  it("returns 403 when caller is not an active admin", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: "worker_uid" } as any);
    vi.mocked(adminDb.doc).mockReturnValueOnce({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ role: "worker", status: "active" }),
      }),
    } as any);

    const res = await request(app)
      .post("/api/admin/referrals/ref123/approve")
      .set("Authorization", "Bearer valid_worker_token");

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Akses ditolak");
  });

  // 1. VALID ADMIN APPROVAL (HTTP 200)
  it("returns 200 and approves referral when valid admin calls endpoint", async () => {
    const adminUid = "vQfEbhhVyXMXVlhYmu4AgOvmony1";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: adminUid } as any);

    vi.mocked(adminDb.doc).mockImplementation((path: string) => {
      return {
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: adminUid, role: "admin", status: "active" }),
        }),
      } as any;
    });

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          const path = typeof ref === "string" ? ref : ref?.path || String(ref);
          if (path.includes("referrals/ref_valid")) {
            return {
              id: "ref_valid",
              ref: { path: "referrals/ref_valid" },
              exists: true,
              data: () => ({
                id: "ref_valid",
                referrerId: "referrer_1",
                referredWorkerId: "referred_1",
                currentAccCount: 10,
                status: "QUALIFIED",
                claimedTiers: {},
                rewardAmount: 0,
              }),
            };
          }
          if (path.includes("settings/rules")) {
            return {
              exists: true,
              data: () => ({
                referralTiers: [
                  { minAcc: 5, reward: 5000 },
                  { minAcc: 10, reward: 15000 },
                ],
              }),
            };
          }
          if (path.includes("users/referrer_1")) {
            return {
              exists: true,
              data: () => ({ name: "Referrer One", balance: 1000 }),
            };
          }
          if (path.includes("referralClaims") || path.includes("rewardLedger")) {
            return { exists: false, data: () => ({}) };
          }
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/ref_valid/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.data.approvedTiers).toEqual([5, 10]);
    expect(res.body.data.totalClaimReward).toBe(20000);
  });

  // 2. NONEXISTENT REFERRAL (HTTP 404)
  it("returns 404 when referral document does not exist and fallback queries yield nothing", async () => {
    const adminUid = "vQfEbhhVyXMXVlhYmu4AgOvmony1";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: adminUid } as any);

    vi.mocked(adminDb.doc).mockImplementation((path: string) => {
      return {
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: adminUid, role: "admin", status: "active" }),
        }),
      } as any;
    });

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnValue({ isQuery: true }),
    } as any);

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          if (ref && ref.isQuery) {
            return { empty: true, docs: [] };
          }
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/nonexistent_ref/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Data referral tidak ditemukan");
  });

  it("approves referral via fallback lookup when direct ID mismatch occurs", async () => {
    const adminUid = "vQfEbhhVyXMXVlhYmu4AgOvmony1";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: adminUid } as any);

    vi.mocked(adminDb.doc).mockImplementation((path: string) => {
      return {
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: adminUid, role: "admin", status: "active" }),
        }),
      } as any;
    });

    const mockReferralDoc = {
      id: "actual_doc_123",
      ref: { path: "referrals/actual_doc_123" },
      exists: true,
      data: () => ({
        id: "worker_referred_999",
        referrerId: "referrer_1",
        referredWorkerId: "worker_referred_999",
        currentAccCount: 5,
        status: "QUALIFIED",
        claimedTiers: {},
        rewardAmount: 0,
      }),
    };

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnValue({ isQuery: true }),
    } as any);

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          if (ref && ref.isQuery) {
            return { empty: false, docs: [mockReferralDoc] };
          }
          const path = typeof ref === "string" ? ref : ref?.path || String(ref);
          if (path.includes("referrals/worker_referred_999")) {
            return { exists: false, data: () => ({}) };
          }
          if (path.includes("settings/rules")) {
            return {
              exists: true,
              data: () => ({
                referralTiers: [{ minAcc: 5, reward: 5000 }],
              }),
            };
          }
          if (path.includes("users/referrer_1")) {
            return {
              exists: true,
              data: () => ({ name: "Referrer One", balance: 1000 }),
            };
          }
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/worker_referred_999/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.data.referralId).toBe("actual_doc_123");
    expect(res.body.data.approvedTiers).toEqual([5]);
  });


  it("approves legacy referral document with missing optional fields", async () => {
    const adminUid = "vQfEbhhVyXMXVlhYmu4AgOvmony1";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: adminUid } as any);

    vi.mocked(adminDb.doc).mockImplementation((path: string) => {
      return {
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: adminUid, role: "admin", status: "active" }),
        }),
      } as any;
    });

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          const path = typeof ref === "string" ? ref : ref?.path || String(ref);
          if (path.includes("referrals/legacy_ref_doc")) {
            return {
              id: "legacy_ref_doc",
              ref: { path: "referrals/legacy_ref_doc" },
              exists: true,
              data: () => ({
                id: "legacy_ref_doc",
                currentAccCount: 5,
                status: "PENDING",
              }),
            };
          }
          if (path.includes("settings/rules")) {
            return {
              exists: true,
              data: () => ({
                referralTiers: [{ minAcc: 5, reward: 5000 }],
              }),
            };
          }
          if (path.includes("users/legacy_ref_doc")) {
            return {
              exists: true,
              data: () => ({ name: "Legacy Referrer", balance: 500 }),
            };
          }
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/legacy_ref_doc/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.data.approvedTiers).toEqual([5]);
  });

  // 3. DUPLICATE APPROVAL (HTTP 409)
  it("returns 409 when referral has already been paid/claimed", async () => {
    const adminUid = "vQfEbhhVyXMXVlhYmu4AgOvmony1";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({ uid: adminUid } as any);

    vi.mocked(adminDb.doc).mockImplementation((path: string) => {
      return {
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: adminUid, role: "admin", status: "active" }),
        }),
      } as any;
    });

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          const path = typeof ref === "string" ? ref : ref?.path || String(ref);
          if (path.includes("referrals/ref_paid")) {
            return {
              id: "ref_paid",
              ref: { path: "referrals/ref_paid" },
              exists: true,
              data: () => ({
                id: "ref_paid",
                referrerId: "referrer_1",
                referredWorkerId: "referred_1",
                currentAccCount: 10,
                status: "PAID",
                claimedTiers: { "5": true, "10": true },
                rewardAmount: 20000,
              }),
            };
          }
          if (path.includes("settings/rules")) {
            return {
              exists: true,
              data: () => ({
                referralTiers: [
                  { minAcc: 5, reward: 5000 },
                  { minAcc: 10, reward: 15000 },
                ],
              }),
            };
          }
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/ref_paid/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_PAID");
  });
});
