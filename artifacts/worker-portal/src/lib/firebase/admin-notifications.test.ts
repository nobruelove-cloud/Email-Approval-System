// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((db, col, id) => ({ path: `${col}/${id}` })),
  getDoc: vi.fn(),
}));

vi.mock("../firebase", () => ({
  db: {},
}));

import { sendFCMNotification } from "./admin-notifications";
import { getDoc } from "firebase/firestore";

describe("sendFCMNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error gracefully if workerId is empty", async () => {
    const res = await sendFCMNotification({
      workerId: "",
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch akun kamu telah disetujui!",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Worker ID missing.");
  });

  it("returns success with tokensCount 0 when worker user document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    } as any);

    const res = await sendFCMNotification({
      workerId: "non_existent_worker",
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch akun kamu telah disetujui!",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Worker user document not found.");
  });

  it("returns success with tokensCount 0 when user has no fcmTokens array or tokens are empty", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "Worker A", fcmTokens: [] }),
    } as any);

    const res = await sendFCMNotification({
      workerId: "worker_no_tokens",
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch akun kamu telah disetujui!",
    });

    expect(res.success).toBe(true);
    expect(res.tokensCount).toBe(0);
  });

  it("fetches fcmTokens and returns success when tokens exist", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "Worker B", fcmTokens: ["fcm-token-1", "fcm-token-2"] }),
    } as any);

    const res = await sendFCMNotification({
      workerId: "worker_with_tokens",
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch akun kamu telah disetujui! Saldo ditambahkan.",
    });

    expect(res.success).toBe(true);
    expect(res.tokensCount).toBe(2);
  });

  it("handles Firestore error gracefully without throwing exception", async () => {
    vi.mocked(getDoc).mockRejectedValueOnce(new Error("Firestore connection error"));

    const res = await sendFCMNotification({
      workerId: "worker_err",
      title: "GMAIL JOB ID - Pencairan Saldo",
      body: "Pengajuan penarikan saldo sebesar Rp 50.000 telah disetujui!",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Worker user document not found.");
  });
});
