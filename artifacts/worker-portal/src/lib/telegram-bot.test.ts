import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendTelegramNotification } from "./telegram-bot";

describe("sendTelegramNotification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error message when botToken and adminChatId are missing", async () => {
    const res = await sendTelegramNotification("Test message", {
      botToken: "",
      adminChatId: "",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Token / Chat ID Telegram belum dikonfigurasi.");
  });

  it("sends notification successfully when fetch returns ok", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    } as Response);

    const res = await sendTelegramNotification("Test message", {
      botToken: "123:ABC",
      adminChatId: "999",
    });

    expect(res.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:ABC/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: "999", text: "Test message" }),
      }),
    );
  });

  it("handles fetch errors gracefully without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network disconnect"));

    const res = await sendTelegramNotification("Test message", {
      botToken: "123:ABC",
      adminChatId: "999",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Network disconnect");
  });
});
