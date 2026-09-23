import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db, firebaseConfigured } from "../firebase";

/**
 * Prompts the user for push notification permission, retrieves the FCM registration token,
 * and uploads the token to the Firestore document `users/{userId}` under the `fcmTokens` array field using `arrayUnion`.
 *
 * Handles error non-blockingly so failures (e.g. permission denied or unsupported browser) do not interrupt worker operations.
 */
export async function requestNotificationPermission(userId: string): Promise<string | null> {
  if (!userId || typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  if (!firebaseConfigured || !app || !db) {
    console.warn("[FCM] Firebase is not configured, skipping push notification setup.");
    return null;
  }

  try {
    const messagingSupported = await isSupported().catch(() => false);
    if (!messagingSupported) {
      console.warn("[FCM] Firebase Messaging is not supported in this environment.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Notification permission not granted:", permission);
      return null;
    }

    let swRegistration: ServiceWorkerRegistration | undefined;
    try {
      swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    } catch (swErr) {
      console.warn("[FCM] Service worker registration error:", swErr);
    }

    const messaging = getMessaging(app);
    const vapidKey =
      import.meta.env.VITE_FIREBASE_VAPID_KEY ||
      (import.meta.env.FIREBASE_VAPID_KEY as string | undefined);

    const tokenOptions: { serviceWorkerRegistration?: ServiceWorkerRegistration; vapidKey?: string } = {};
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }
    if (vapidKey) {
      tokenOptions.vapidKey = vapidKey;
    }

    const token = await getToken(messaging, tokenOptions);

    if (token) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
      });
      console.log("[FCM] FCM Token updated in Firestore users/" + userId);
      return token;
    } else {
      console.warn("[FCM] No FCM token received.");
      return null;
    }
  } catch (error) {
    console.warn("[FCM] Failed to request notification permission or store token:", error);
    return null;
  }
}
