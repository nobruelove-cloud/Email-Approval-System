import { describe, it, expect } from "vitest";
import { sendFCMNotification } from "./admin-notifications";

describe("sendFCMNotification", () => {
  it("returns false as push notifications are removed", async () => {
    const result = await sendFCMNotification({
      workerId: "worker_123",
      title: "Test Title",
      body: "Test Body",
    });
    expect(result).toBe(false);
  });
});
