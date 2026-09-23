import { describe, it, expect } from "vitest";
import { requestNotificationPermission } from "./messaging";

describe("requestNotificationPermission", () => {
  it("returns null as notification feature is disabled/removed", async () => {
    const token = await requestNotificationPermission("worker_123");
    expect(token).toBeNull();
  });
});
