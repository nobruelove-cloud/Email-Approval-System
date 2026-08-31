import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

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
      app: {
        options: {
          projectId: "test-runtime-project-id",
        },
      },
      doc: mockDoc,
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    },
    FieldValue: {
      serverTimestamp: () => "MOCK_TIMESTAMP",
    },
  };
});

describe("API Integration: POST /api/admin/referrals/:referralId/approve (Server Endpoint Verification)", () => {
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

  // 1. VALID DIRECT ADMIN APPROVAL (HTTP 200)
  it("proves direct existing referral continues normally and returns 200", async () => {
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

  // 2. NONEXISTENT REFERRAL RETURNS 404 IMMEDIATELY WITH DIAGNOSTIC
  it("proves nonexistent referral returns HTTP 404 immediately and logs diagnostic", async () => {
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

    const consoleLogSpy = vi.spyOn(console, "log");
    const loggerWarnSpy = vi.spyOn(logger, "warn");

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
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

    // Verify diagnostic log was emitted with exact properties
    const diagnosticCalls = consoleLogSpy.mock.calls.filter(
      (call) => call[0] === "[ADMIN REFERRAL NOT FOUND DIAGNOSTIC]"
    );
    expect(diagnosticCalls.length).toBeGreaterThan(0);
    const diagnosticPayload = diagnosticCalls[0][1];
    expect(diagnosticPayload).toEqual({
      receivedReferralId: "nonexistent_ref",
      searchedPath: "referrals/nonexistent_ref",
      projectId: "test-runtime-project-id",
      authUid: adminUid,
      reason: "DIRECT_REFERRAL_DOCUMENT_NOT_FOUND",
    });

    const warnCalls = loggerWarnSpy.mock.calls.filter(
      (call) => call[1] === "[ADMIN REFERRAL NOT FOUND DIAGNOSTIC]"
    );
    expect(warnCalls.length).toBeGreaterThan(0);
    expect(warnCalls[0][0]).toEqual(diagnosticPayload);
  });

  // 3. FALLBACK QUERIES ARE NOT EXECUTED WHEN DIRECT DOCUMENT IS MISSING
  it("proves fallback queries are NOT executed when direct document is missing", async () => {
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
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    const res = await request(app)
      .post("/api/admin/referrals/missing_ref_123/approve")
      .set("Authorization", "Bearer valid_admin_token");

    expect(res.status).toBe(404);
    // Explicitly assert adminDb.collection was NEVER called during the request
    expect(adminDb.collection).not.toHaveBeenCalled();
  });

  // 4. DIAGNOSTIC PROJECT ID COMES FROM adminDb.app.options.projectId
  it("proves diagnostic project ID comes from adminDb.app.options.projectId", async () => {
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

    const consoleLogSpy = vi.spyOn(console, "log");

    vi.mocked(adminDb.runTransaction).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          return { exists: false, data: () => ({}) };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      return txCallback(mockTx);
    });

    await request(app)
      .post("/api/admin/referrals/test_proj_id_ref/approve")
      .set("Authorization", "Bearer valid_admin_token");

    // Verify projectId reported in diagnostic matches adminDb.app.options.projectId
    expect((adminDb as any).app.options.projectId).toBe("test-runtime-project-id");

    const diagnosticCalls = consoleLogSpy.mock.calls.filter(
      (call) => call[0] === "[ADMIN REFERRAL NOT FOUND DIAGNOSTIC]"
    );
    expect(diagnosticCalls[0][1].projectId).toBe("test-runtime-project-id");
    expect(diagnosticCalls[0][1].projectId).toBe((adminDb as any).app.options.projectId);
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

  // 5. DUPLICATE APPROVAL (HTTP 409)
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
