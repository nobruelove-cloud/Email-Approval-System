import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface SendFCMNotificationParams {
  workerId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends FCM push notification to a worker's registered device tokens.
 * Reads `fcmTokens` array from `users/{workerId}` in Firestore and dispatches an
 * HTTP POST request for each token to the Firebase Cloud Messaging (FCM) API endpoint.
 *
 * Configures payload with `silent: true` and `vibrate: []`.
 * Errors are handled gracefully (non-blocking) so failures do not interrupt caller execution.
 */
export async function sendFCMNotification(params: SendFCMNotificationParams): Promise<boolean> {
  const { workerId, title, body, data } = params;

  if (!workerId || typeof workerId !== "string" || !workerId.trim()) {
    console.warn("[FCM Admin] Invalid or empty workerId provided.");
    return false;
  }

  if (!db) {
    console.warn("[FCM Admin] Firestore db instance is not available.");
    return false;
  }

  try {
    const userRef = doc(db, "users", workerId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn(`[FCM Admin] User document for workerId '${workerId}' not found.`);
      return false;
    }

    const userData = userSnap.data();
    const rawTokens: unknown = userData?.fcmTokens;

    if (!Array.isArray(rawTokens) || rawTokens.length === 0) {
      console.log(`[FCM Admin] No FCM tokens found for workerId '${workerId}'.`);
      return false;
    }

    const validTokens = rawTokens.filter(
      (token): token is string => typeof token === "string" && token.trim().length > 0
    );

    if (validTokens.length === 0) {
      console.log(`[FCM Admin] No valid string FCM tokens found for workerId '${workerId}'.`);
      return false;
    }

    const serverKey =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_SERVER_KEY) ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_API_KEY) ||
      "";

    const fcmEndpoint = "https://fcm.googleapis.com/fcm/send";

    let successCount = 0;

    for (const token of validTokens) {
      const payload = {
        to: token,
        notification: {
          title,
          body,
          silent: true,
          vibrate: [],
        },
        data: data || {},
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            title,
            body,
            silent: true,
            vibrate: [],
          },
        },
      };

      try {
        const response = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(serverKey ? { Authorization: `key=${serverKey}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          successCount++;
          console.log(`[FCM Admin] Notification successfully sent to token for worker ${workerId}.`);
        } else {
          console.warn(
            `[FCM Admin] FCM API request returned status ${response.status} for worker ${workerId}.`
          );
        }
      } catch (fetchErr) {
        console.warn(`[FCM Admin] Network error sending FCM notification to token:`, fetchErr);
      }
    }

    return successCount > 0;
  } catch (err) {
    console.warn(`[FCM Admin] Failed to process FCM notification for worker ${workerId}:`, err);
    return false;
  }
}
