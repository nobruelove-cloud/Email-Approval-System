// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase modules
vi.mock("firebase/messaging", () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn(() => Promise.resolve("mock-fcm-token-123")),
  isSupported: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((db, col, id) => ({ path: `${col}/${id}` })),
  updateDoc: vi.fn(() => Promise.resolve()),
  arrayUnion: vi.fn((val) => ({ _type: "arrayUnion", value: val })),
}));

vi.mock("../firebase", () => ({
  app: {},
  db: {},
  firebaseConfigured: true,
}));

import { requestNotificationPermission } from "./messaging";
import { updateDoc, arrayUnion } from "firebase/firestore";

describe("requestNotificationPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if userId is empty", async () => {
    const token = await requestNotificationPermission("");
    expect(token).toBeNull();
  });

  it("requests permission and saves FCM token when granted", async () => {
    const originalNotification = window.Notification;

    // @ts-ignore
    window.Notification = {
      requestPermission: vi.fn(() => Promise.resolve("granted")),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn(() => Promise.resolve({})),
      },
      writable: true,
      configurable: true,
    });

    const token = await requestNotificationPermission("worker_123");
    expect(token).toBe("mock-fcm-token-123");
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(arrayUnion).toHaveBeenCalledWith("mock-fcm-token-123");

    window.Notification = originalNotification;
  });

  it("returns null if notification permission is denied", async () => {
    // @ts-ignore
    window.Notification = {
      requestPermission: vi.fn(() => Promise.resolve("denied")),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn(() => Promise.resolve({})),
      },
      writable: true,
      configurable: true,
    });

    const token = await requestNotificationPermission("worker_123");
    expect(token).toBeNull();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
