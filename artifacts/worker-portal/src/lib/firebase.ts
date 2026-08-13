import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (import.meta.env.FIREBASE_API_KEY as string | undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.FIREBASE_AUTH_DOMAIN as string | undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (import.meta.env.FIREBASE_PROJECT_ID as string | undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.FIREBASE_STORAGE_BUCKET as string | undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (import.meta.env.FIREBASE_MESSAGING_SENDER_ID as string | undefined),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (import.meta.env.FIREBASE_APP_ID as string | undefined),
};

// Defensive validation to ensure placeholder/dummy values are treated as unconfigured
function isValidConfigValue(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return (
    lower.length > 0 &&
    !lower.startsWith("nilai") &&
    !lower.includes("placeholder") &&
    !lower.includes("your-") &&
    !lower.includes("your_")
  );
}

// The app only works once real Firebase project credentials are supplied via
// env vars (see vite.config.ts). Without them we still want the UI to render
// instead of crashing, so we track whether Firebase is usable.
export const firebaseConfigured = Boolean(
  isValidConfigValue(firebaseConfig.apiKey) &&
    isValidConfigValue(firebaseConfig.authDomain) &&
    isValidConfigValue(firebaseConfig.projectId) &&
    isValidConfigValue(firebaseConfig.storageBucket) &&
    isValidConfigValue(firebaseConfig.messagingSenderId) &&
    isValidConfigValue(firebaseConfig.appId),
);

let app: FirebaseApp | undefined;
export let auth: Auth | undefined;
export let db: Firestore | undefined;

if (firebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/**
 * Creates a Firebase Auth account for a new worker from the admin dashboard.
 *
 * `createUserWithEmailAndPassword` on the default `auth` instance would sign
 * the admin OUT and sign the new worker IN instead — that's the classic bug
 * with admin-created accounts. To avoid it, we spin up a short-lived
 * secondary Firebase App + Auth instance, create the user there, then tear
 * it down. The admin's own session is never touched.
 */
export async function createWorkerAuthAccount(email: string, password: string): Promise<string> {
  if (!firebaseConfigured) throw new Error("Firebase is not configured.");
  const secondaryApp = initializeApp(firebaseConfig, `worker-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}
