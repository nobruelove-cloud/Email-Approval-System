import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { adminAuth, adminDb } from "../lib/firebase-admin";

vi.mock("../lib/firebase-admin", () => {
  const mockVerifyIdToken = vi.fn();
  const mockDoc = vi.fn();
  const mockRunTransaction = vi.fn();

  return {
    adminAuth: {
      verifyIdToken: mockVerifyIdToken,
    },
    adminDb: {
      doc: mockDoc,
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
