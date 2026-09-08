import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface TelegramNotificationOptions {
  botToken?: string;
  adminChatId?: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

/**
 * Sends a notification message to the configured Telegram Admin Chat/Group ID.
 * Features safe fallback handling so errors never crash or abort calling operations.
 */
export async function sendTelegramNotification(
  message: string,
  options?: TelegramNotificationOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    let token = options?.botToken?.trim();
    let chatId = options?.adminChatId?.trim();

    // 1. Fallback to env vars if options are not explicitly provided
    if (!token) {
      token =
        (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined)?.trim() ||
        (import.meta.env.TELEGRAM_BOT_TOKEN as string | undefined)?.trim();
    }

    if (!chatId) {
      chatId =
        (import.meta.env.VITE_TELEGRAM_ADMIN_CHAT_ID as string | undefined)?.trim() ||
        (import.meta.env.TELEGRAM_ADMIN_CHAT_ID as string | undefined)?.trim();
    }

    // 2. Fallback to Firestore settings/rules or settings/telegram if still missing
    if ((!token || !chatId) && db) {
      try {
        const rulesSnap = await getDoc(doc(db, "settings", "rules"));
        if (rulesSnap.exists()) {
          const rulesData = rulesSnap.data();
          const tgConfig = rulesData?.telegramConfig || rulesData?.telegram;
          if (!token && tgConfig?.botToken) {
            token = String(tgConfig.botToken).trim();
          }
          if (!chatId && tgConfig?.adminChatId) {
            chatId = String(tgConfig.adminChatId).trim();
          }
        }

        if (!token || !chatId) {
          const telegramSnap = await getDoc(doc(db, "settings", "telegram"));
          if (telegramSnap.exists()) {
            const tgData = telegramSnap.data();
            if (!token && tgData?.botToken) {
              token = String(tgData.botToken).trim();
            }
            if (!chatId && tgData?.adminChatId) {
              chatId = String(tgData.adminChatId).trim();
            }
          }
        }
      } catch (fsErr) {
        console.warn("[TelegramBot] Notice when fetching settings from Firestore:", fsErr);
      }
    }

    if (!token || !chatId) {
      console.warn("[TelegramBot] Telegram Bot Token or Admin Chat ID is missing. Notification skipped.");
      return { success: false, error: "Token / Chat ID Telegram belum dikonfigurasi." };
    }

    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
    };

    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resData = await response.json().catch(() => ({}));

    if (!response.ok || !resData?.ok) {
      const errMsg = resData?.description || `HTTP ${response.status} ${response.statusText}`;
      console.warn("[TelegramBot] Telegram API error:", errMsg);
      return { success: false, error: errMsg };
    }

    console.log("[TelegramBot] Telegram notification delivered successfully.");
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[TelegramBot] Safe fallback caught error while sending notification:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
