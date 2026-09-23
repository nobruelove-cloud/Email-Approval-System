// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns false if workerId is empty or invalid", async () => {
    const result = await sendFCMNotification({
      workerId: "",
      title: "Test Title",
      body: "Test Body",
    });
    expect(result).toBe(false);
    expect(getDoc).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns false if user document does not exist in Firestore", async () => {
    (getDoc as any).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    });

    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "Test Title",
      body: "Test Body",
    });

    expect(result).toBe(false);
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns false if fcmTokens array is missing or empty", async () => {
    (getDoc as any).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ fcmTokens: [] }),
    });

    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "Test Title",
      body: "Test Body",
    });

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dispatches HTTP POST fetch request to FCM endpoint with silent: true and vibrate: [] for valid tokens", async () => {
    (getDoc as any).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ fcmTokens: ["token_abc_123", "token_xyz_789"] }),
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: 1 }),
    });

    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch setoran Anda telah selesai diverifikasi.",
      data: { type: "batch_review", submissionId: "sub_1" },
    });

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstCallArgs = (global.fetch as any).mock.calls[0];
    expect(firstCallArgs[0]).toBe("https://fcm.googleapis.com/fcm/send");
    expect(firstCallArgs[1].method).toBe("POST");

    const payload = JSON.parse(firstCallArgs[1].body);
    expect(payload.to).toBe("token_abc_123");
    expect(payload.notification).toEqual({
      title: "GMAIL JOB ID - Status Tugas",
      body: "Batch setoran Anda telah selesai diverifikasi.",
      silent: true,
      vibrate: [],
    });
    expect(payload.data).toEqual({ type: "batch_review", submissionId: "sub_1" });
    expect(payload.webpush.notification.silent).toBe(true);
    expect(payload.webpush.notification.vibrate).toEqual([]);
  });

  it("handles fetch network errors gracefully without throwing", async () => {
    (getDoc as any).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ fcmTokens: ["token_error"] }),
    });

    (global.fetch as any).mockRejectedValueOnce(new Error("Network connection failed"));

    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "Test Title",
      body: "Test Body",
    });

    expect(result).toBe(false);
  });

  it("handles Firestore error gracefully without throwing", async () => {
    (getDoc as any).mockRejectedValueOnce(new Error("Firestore permission denied"));

    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "Test Title",
      body: "Test Body",
    });

    expect(result).toBe(false);
  });
});
