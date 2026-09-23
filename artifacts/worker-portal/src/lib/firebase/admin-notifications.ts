import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface SendFCMNotificationOptions {
  workerId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FCMNotificationPayloadOptions {
  title: string;
  body: string;
  vibrate: number[];
  silent: boolean;
  data?: Record<string, string>;
}

/**
 * Helper function to retrieve fcmTokens from users/{workerId} document and send push notifications.
 * Handles cases where the user or fcmTokens don't exist gracefully and non-blockingly.
 */
export async function sendFCMNotification(
  options: SendFCMNotificationOptions
): Promise<{ success: boolean; tokensCount: number; error?: string }> {
  try {
    const { workerId, title, body, data } = options;

    if (!workerId) {
      console.warn("[FCM Admin] Missing workerId. Push notification skipped.");
      return { success: false, tokensCount: 0, error: "Worker ID missing." };
    }

    if (!db) {
      console.warn("[FCM Admin] Firestore DB instance not available. Push notification skipped.");
      return { success: false, tokensCount: 0, error: "Database not configured." };
    }

    // 1. Retrieve user document from Firestore
    const userRef = doc(db, "users", workerId);
    const userSnap = await getDoc(userRef).catch((err) => {
      console.warn(`[FCM Admin] Error fetching user document users/${workerId}:`, err);
      return null;
    });

    if (!userSnap || !userSnap.exists()) {
      console.warn(`[FCM Admin] User users/${workerId} does not exist. Push notification skipped.`);
      return { success: false, tokensCount: 0, error: "Worker user document not found." };
    }

    const userData = userSnap.data();
    const fcmTokens: string[] = Array.isArray(userData?.fcmTokens)
      ? userData.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    if (fcmTokens.length === 0) {
      console.log(`[FCM Admin] Worker users/${workerId} has no fcmTokens registered. Push notification skipped.`);
      return { success: true, tokensCount: 0 };
    }

    // 2. Construct FCM payload object maintaining `silent: true` and `vibrate: []`
    const payloadOptions: FCMNotificationPayloadOptions = {
      title,
      body,
      vibrate: [],
      silent: true,
      data: data ?? {},
    };

    console.log(`[FCM Admin] Prepared FCM payload for ${fcmTokens.length} token(s) (worker: ${workerId}):`, payloadOptions);

    // 3. Dispatch FCM notification payload to registered tokens via FCM API or server key endpoint
    const serverKey =
      (typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env.VITE_FCM_SERVER_KEY || import.meta.env.FIREBASE_FCM_SERVER_KEY
        : undefined) || (typeof process !== "undefined" ? process.env?.FCM_SERVER_KEY : undefined);

    if (serverKey) {
      const sendPromises = fcmTokens.map(async (token) => {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${serverKey}`,
            },
            body: JSON.stringify({
              to: token,
              notification: {
                title,
                body,
              },
              data: payloadOptions.data,
              silent: payloadOptions.silent,
              vibrate: payloadOptions.vibrate,
            }),
          });
          return res.ok;
        } catch (fetchErr) {
          console.warn(`[FCM Admin] Network error sending to token ${token.slice(0, 10)}...:`, fetchErr);
          return false;
        }
      });

      await Promise.all(sendPromises).catch((err) => {
        console.warn("[FCM Admin] FCM send dispatch error (gracefully handled):", err);
      });
    }

    return {
      success: true,
      tokensCount: fcmTokens.length,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn("[FCM Admin] Error sending push notification (gracefully handled):", errMsg);
    return { success: false, tokensCount: 0, error: errMsg };
  }
}
