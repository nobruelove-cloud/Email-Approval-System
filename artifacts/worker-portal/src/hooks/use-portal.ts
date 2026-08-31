import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  addDoc,
  deleteDoc,
  runTransaction,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { auth, createWorkerAuthAccount, db, firebaseConfigured } from "@/lib/firebase";
import {
  DEFAULT_TIERS,
  DEFAULT_REFERRAL_TIERS,
  type EmailSubmission,
  type PortalUser,
  type Withdrawal,
  type SubmissionStatus,
  type WithdrawalStatus,
  type UserStatus,
  type TierConfig,
  type ReferralTierConfig,
  type FinancialTransaction,
  type FinancialTransactionType,
} from "@/lib/portal-types";
import { getItemCountOfSubmission, getRecommendedTier, getReferralRewardForAccCount, getMonthlyPeriodKey, shortId, formatMoney } from "@/lib/portal-utils";
import { sendRemoteDiagnostic } from "@/lib/remote-diagnostics";

import { useRef } from "react";

export interface FirestoreDiagnosticPayload {
  timestamp: string;
  uid: string | null;
  authState: "authenticated" | "unauthenticated";
  operation: "onSnapshot" | "getDoc" | "getDocs" | "setDoc" | "updateDoc" | "deleteDoc" | "runTransaction" | "addDoc";
  path: string | null;
  collection: string | null;
  docId: string | null;
  query: Array<Record<string, unknown>> | null;
  hook: string;
  code: string | null;
  message: string;
  profileResolved: boolean;
  dashboardMounted: boolean;
}

let globalProfileResolved = false;

export function setProfileResolvedState(resolved: boolean) {
  globalProfileResolved = resolved;
}

export function isProfileResolved(): boolean {
  return globalProfileResolved;
}

export function isDashboardMounted(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  return (
    window.location.pathname.includes("/dashboard") ||
    !!document.getElementById("worker-dashboard") ||
    !!document.getElementById("admin-dashboard") ||
    !!document.querySelector("[data-dashboard='true']")
  );
}

function extractCollectionFromPath(path?: string | null): string | null {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

function extractDocIdFromPath(path?: string | null): string | null {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? parts[1] : null;
}

function extractPathFromParams(collectionName?: string | null, docId?: string | null): string | null {
  if (collectionName && docId) return `${collectionName}/${docId}`;
  if (collectionName) return collectionName;
  return null;
}

function sanitizeDiagnosticString(str: string): string {
  if (!str) return "";
  return str
    .replace(/apiKey=[^\s&]+/gi, "apiKey=[REDACTED]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .replace(/token=[^\s&]+/gi, "token=[REDACTED]");
}

export function formatQueryConstraint(constraint: any): Record<string, unknown> {
  if (!constraint || typeof constraint !== "object") {
    return { value: String(constraint) };
  }

  if (constraint.field !== undefined || constraint.operator !== undefined || constraint.value !== undefined) {
    const fieldName = String(constraint.field ?? "unknown_field");
    const isSensitive = /password|token|secret|key|auth/i.test(fieldName);
    return {
      type: String(constraint.type ?? "where"),
      field: fieldName,
      operator: String(constraint.operator ?? constraint.op ?? "=="),
      value: isSensitive ? "[REDACTED]" : constraint.value !== undefined ? constraint.value : null,
    };
  }

  let fieldName: string | undefined;
  if (typeof constraint._field === "string") {
    fieldName = constraint._field;
  } else if (constraint._field && typeof constraint._field.path?.getSegments === "function") {
    fieldName = constraint._field.path.getSegments().join(".");
  } else if (constraint._field && Array.isArray(constraint._field.segments)) {
    fieldName = constraint._field.segments.join(".");
  } else if (typeof constraint.field === "string") {
    fieldName = constraint.field;
  }

  const op = String(constraint._op ?? constraint.op ?? constraint.operator ?? "==");
  let val = constraint._val !== undefined ? constraint._val : constraint.val !== undefined ? constraint.val : constraint.value;

  const finalField = fieldName || "unknown_field";
  const isSensitive = /password|token|secret|key|auth/i.test(finalField);
  if (isSensitive) {
    val = "[REDACTED]";
  }

  const typeStr = String(constraint.type ?? constraint._type ?? "where");

  return {
    type: typeStr,
    field: finalField,
    operator: op,
    value: val !== undefined ? val : "unknown_value",
  };
}

export function formatQueryConstraints(constraints: unknown[]): Array<Record<string, unknown>> {
  if (!Array.isArray(constraints)) return [];
  return constraints.map((c) => formatQueryConstraint(c));
}

export function logFirestoreDiagnostic(details: {
  operation: FirestoreDiagnosticPayload["operation"];
  path?: string | null;
  collection?: string | null;
  docId?: string | null;
  query?: unknown[] | null;
  hook: string;
  error?: unknown;
  message?: string;
}): FirestoreDiagnosticPayload {
  const isDiagnosticsEnabled = import.meta.env.VITE_FIRESTORE_DIAGNOSTICS === "true";
  const err = details.error;
  const isError = err !== undefined && err !== null;

  const code = (err as { code?: string })?.code ?? (isError ? "error" : null);
  const rawMessage = details.message || (err instanceof Error ? err.message : String(err || "Success"));
  const cleanMessage = sanitizeDiagnosticString(rawMessage);

  const path = details.path ?? extractPathFromParams(details.collection, details.docId);
  const collection = details.collection ?? extractCollectionFromPath(path);
  const docId = details.docId ?? extractDocIdFromPath(path);

  const payload: FirestoreDiagnosticPayload = {
    timestamp: new Date().toISOString(),
    uid: auth?.currentUser?.uid || null,
    authState: auth?.currentUser ? "authenticated" : "unauthenticated",
    operation: details.operation,
    path,
    collection,
    docId,
    query: details.query ? formatQueryConstraints(details.query) : null,
    hook: details.hook,
    code,
    message: cleanMessage,
    profileResolved: isProfileResolved(),
    dashboardMounted: isDashboardMounted(),
  };

  if (isError) {
    console.error("[FirestoreDiagnostic]", payload);
    sendRemoteDiagnostic(payload);
  } else if (isDiagnosticsEnabled) {
    console.log("[FirestoreDiagnostic]", payload);
    sendRemoteDiagnostic(payload);
  }

  return payload;
}

export async function getDocWithDiagnostic(docRef: any, hook = "getDoc") {
  const path = docRef?.path || (typeof docRef?.id === "string" ? docRef.id : null);
  try {
    const snap = await getDoc(docRef);
    logFirestoreDiagnostic({
      operation: "getDoc",
      path,
      hook,
      message: `getDoc retrieved: exists=${snap.exists()}`,
    });
    return snap;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "getDoc",
      path,
      hook,
      error: err,
    });
    throw err;
  }
}

export async function getDocsWithDiagnostic(queryRef: any, constraints: unknown[] = [], hook = "getDocs", path?: string) {
  try {
    const snaps = await getDocs(queryRef);
    logFirestoreDiagnostic({
      operation: "getDocs",
      path: path || "collection",
      query: constraints,
      hook,
      message: `getDocs retrieved ${snaps.size} docs`,
    });
    return snaps;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "getDocs",
      path: path || "collection",
      query: constraints,
      hook,
      error: err,
    });
    throw err;
  }
}

export async function setDocWithDiagnostic(docRef: any, data: any, options?: any, hook = "setDoc") {
  const path = docRef?.path || (typeof docRef?.id === "string" ? docRef.id : null);
  try {
    const res = await (options ? setDoc(docRef, data, options) : setDoc(docRef, data));
    logFirestoreDiagnostic({
      operation: "setDoc",
      path,
      hook,
      message: `setDoc succeeded on ${path}`,
    });
    return res;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "setDoc",
      path,
      hook,
      error: err,
    });
    throw err;
  }
}

export async function updateDocWithDiagnostic(docRef: any, data: any, hook = "updateDoc") {
  const path = docRef?.path || (typeof docRef?.id === "string" ? docRef.id : null);
  try {
    const res = await updateDoc(docRef, data);
    logFirestoreDiagnostic({
      operation: "updateDoc",
      path,
      hook,
      message: `updateDoc succeeded on ${path}`,
    });
    return res;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "updateDoc",
      path,
      hook,
      error: err,
    });
    throw err;
  }
}

export async function deleteDocWithDiagnostic(docRef: any, hook = "deleteDoc") {
  const path = docRef?.path || (typeof docRef?.id === "string" ? docRef.id : null);
  try {
    const res = await deleteDoc(docRef);
    logFirestoreDiagnostic({
      operation: "deleteDoc",
      path,
      hook,
      message: `deleteDoc succeeded on ${path}`,
    });
    return res;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "deleteDoc",
      path,
      hook,
      error: err,
    });
    throw err;
  }
}

export async function runTransactionWithDiagnostic<T>(
  firestore: any,
  updateFunction: (transaction: any) => Promise<T>,
  hook = "runTransaction",
  path?: string,
): Promise<T> {
  try {
    const result = await runTransaction(firestore, updateFunction);
    logFirestoreDiagnostic({
      operation: "runTransaction",
      path,
      hook,
      message: `runTransaction succeeded`,
    });
    return result;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "runTransaction",
      path,
      hook,
      error: err,
    });
    throw err;
  }
}

export function usePortalAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [isReady, setIsReady] = useState(!firebaseConfigured);
  const [error, setError] = useState("");

  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missingDocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveringUidRef = useRef<string | null>(null);
  const resolvedUidRef = useRef<string | null>(null);
  const recoveryFailedUidRef = useRef<string | null>(null);
  const recoveryGenRef = useRef<number>(0);
  const activeUnsubscribeProfile = useRef<(() => void) | null>(null);

  const clearAllTimers = () => {
    if (profileTimerRef.current) {
      clearTimeout(profileTimerRef.current);
      profileTimerRef.current = null;
    }
    if (missingDocTimerRef.current) {
      clearTimeout(missingDocTimerRef.current);
      missingDocTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      setIsReady(true);
      return;
    }
    const firestore = db;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log("[PortalAuth] Auth state changed:", user ? `UID: ${user.uid} (${user.email})` : "Null user");

      clearAllTimers();

      if (activeUnsubscribeProfile.current) {
        console.log("[PortalAuth] Cleaning up previous profile listener.");
        activeUnsubscribeProfile.current();
        activeUnsubscribeProfile.current = null;
      }

      setFirebaseUser(user);
      recoveringUidRef.current = null;
      resolvedUidRef.current = null;
      recoveryFailedUidRef.current = null;
      recoveryGenRef.current += 1;

      if (!user) {
        setProfile(null);
        setError("");
        setLoading(false);
        setIsReady(true);
        setProfileResolvedState(false);
        return;
      }

      setLoading(true);
      setIsReady(false);
      setError("");

      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
      console.log(`[Stage 3: users/{uid} GET] Registering Firestore snapshot listener for path: users/${user.uid}, ProjectID: ${projectId}`);

      // Set a 10-second safety fallback timeout in case Firestore listener hangs
      profileTimerRef.current = setTimeout(() => {
        console.warn(`[PortalAuth] Profile listener timeout reached (10s) for users/${user.uid}.`);
        if (auth?.currentUser?.uid === user.uid && resolvedUidRef.current !== user.uid) {
          setError("Gagal memuat profil: Waktu koneksi habis. Silakan coba lagi.");
          setLoading(false);
          setIsReady(true);
        }
      }, 10000);

      const unsubscribe = onSnapshot(
        doc(firestore, "users", user.uid),
        (snapshot) => {
          console.log(
            `[PortalAuth] Profile snapshot fired for users/${user.uid}: exists=${snapshot.exists()}, authUID=${auth?.currentUser?.uid}`,
          );

          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            console.warn("[PortalAuth] Snapshot fired but user is no longer active.");
            clearAllTimers();
            resolvedUidRef.current = null;
            recoveringUidRef.current = null;
            setProfileResolvedState(false);
            setProfile(null);
            setError("");
            setLoading(false);
            setIsReady(true);
            return;
          }

          if (snapshot.exists()) {
            clearAllTimers();
            resolvedUidRef.current = user.uid;
            setProfileResolvedState(true);
            recoveringUidRef.current = null;
            recoveryFailedUidRef.current = null;

            const data = snapshot.data();
            console.log(`[PortalAuth] User profile retrieved successfully for users/${user.uid}:`, {
              uid: user.uid,
              role: data?.role,
              status: data?.status,
            });
            const normalizedRole = typeof data?.role === "string" ? data.role.trim().toLowerCase() : data?.role;
            const normalizedStatus = typeof data?.status === "string" ? data.status.trim().toLowerCase() : data?.status;
            setProfile({ uid: user.uid, ...data, role: normalizedRole, status: normalizedStatus } as PortalUser);
            setError("");
            setLoading(false);
            setIsReady(true);
          } else {
            console.warn(`[PortalAuth] Document users/${user.uid} does NOT exist in Firestore. Initiating automatic profile recovery...`);

            // If profile was already resolved previously for this UID, ignore missing doc snapshots
            if (resolvedUidRef.current === user.uid) {
              console.warn(`[PortalAuth] Document missing snapshot ignored for already resolved user ${user.uid}.`);
              return;
            }

            if (recoveryFailedUidRef.current === user.uid) {
              console.warn(`[PortalAuth] Auto-recovery previously failed for users/${user.uid}. Skipping repeated recovery attempt.`);
              clearAllTimers();
              setLoading(false);
              setIsReady(true);
              setError("Profil pengguna tidak ditemukan di database Firestore.");
              return;
            }

            const currentGen = recoveryGenRef.current;

            if (!missingDocTimerRef.current) {
              missingDocTimerRef.current = setTimeout(() => {
                console.warn(`[PortalAuth] Missing document timer reached (7s) for users/${user.uid}.`);
                if (
                  auth?.currentUser?.uid === user.uid &&
                  recoveryGenRef.current === currentGen &&
                  resolvedUidRef.current !== user.uid
                ) {
                  clearAllTimers();
                  recoveringUidRef.current = null;
                  recoveryFailedUidRef.current = user.uid;
                  setProfile(null);
                  setError("Profil pengguna tidak ditemukan di database Firestore.");
                  setLoading(false);
                  setIsReady(true);
                }
              }, 7000);
            }

            if (recoveringUidRef.current === user.uid) {
              console.log(`[PortalAuth] Auto-recovery already in progress for users/${user.uid}. Waiting for snapshot update or timeout.`);
              return;
            }

            recoveringUidRef.current = user.uid;
            // Only set loading true if not already resolved for this UID
            if (resolvedUidRef.current !== user.uid) {
              setLoading(true);
            }

            const defaultName = user.displayName || (user.email ? user.email.split("@")[0] : "Worker");
            const defaultEmail = user.email || "";

            createPortalUser(user.uid, {
              name: defaultName,
              email: defaultEmail,
              role: "worker",
              status: "active",
              tier: 1,
              balance: 0,
            })
              .then(() => {
                console.log(`[PortalAuth] Automatic profile recovery succeeded for users/${user.uid}.`);
                resolvedUidRef.current = user.uid;
                recoveringUidRef.current = null;
                recoveryFailedUidRef.current = null;
              })
              .catch((err) => {
                console.error(`[PortalAuth] Automatic profile recovery failed for users/${user.uid}:`, err);

                // Stale operation protection: check if user changed, new recovery started, or profile was already resolved
                if (
                  auth?.currentUser?.uid !== user.uid ||
                  recoveryGenRef.current !== currentGen ||
                  resolvedUidRef.current === user.uid
                ) {
                  console.warn(
                    `[PortalAuth] Stale recovery rejection ignored for users/${user.uid}. Active user: ${auth?.currentUser?.uid}, Resolved UID: ${resolvedUidRef.current}`,
                  );
                  return;
                }

                clearAllTimers();
                recoveringUidRef.current = null;
                recoveryFailedUidRef.current = user.uid;
                setProfile(null);
                setError(err instanceof Error ? err.message : "Gagal memulihkan profil pengguna.");
                setLoading(false);
                setIsReady(true);
              });
          }
        },
        (reason) => {
          clearAllTimers();

          logFirestoreDiagnostic({
            operation: "onSnapshot",
            path: `users/${user.uid}`,
            collection: "users",
            docId: user.uid,
            hook: "usePortalAuth",
            error: reason,
          });

          const code = (reason as { code?: string })?.code ?? "";
          console.error(`[PortalAuth] Profile snapshot error for users/${user.uid} [code: ${code}]:`, reason);

          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            setProfile(null);
            setError("");
            setLoading(false);
            setIsReady(true);
            return;
          }

          // If session was already resolved or auto-recovery is actively in progress for this UID, ignore transient re-auth errors
          if (resolvedUidRef.current === user.uid || recoveringUidRef.current === user.uid) {
            console.warn(
              `[PortalAuth] Profile snapshot error ignored for active user ${user.uid} (resolved: ${resolvedUidRef.current === user.uid}, recovering: ${recoveringUidRef.current === user.uid}).`
            );
            return;
          }

          let msg = "Terjadi kesalahan saat memuat profil Anda.";
          if (code === "permission-denied" || (reason instanceof Error && reason.message.includes("permission-denied"))) {
            msg = "Akses ditolak (permission-denied). Silakan periksa koneksi atau hubungi admin.";
          } else if (reason instanceof Error && reason.message) {
            msg = reason.message;
          }

          setError(msg);
          setLoading(false);
          setIsReady(true);
        },
      );

      activeUnsubscribeProfile.current = unsubscribe;
    });

    return () => {
      clearAllTimers();
      if (activeUnsubscribeProfile.current) {
        activeUnsubscribeProfile.current();
        activeUnsubscribeProfile.current = null;
      }
      unsubscribeAuth();
    };
  }, []);

  const logout = async () => {
    console.log("[PortalAuth] Initiating logout...");
    clearAllTimers();
    recoveringUidRef.current = null;
    resolvedUidRef.current = null;
    recoveryFailedUidRef.current = null;
    recoveryGenRef.current += 1;

    setLoading(true);
    setError("");

    // Unsubscribe Firestore profile listener BEFORE signing out to avoid permission errors
    if (activeUnsubscribeProfile.current) {
      console.log("[PortalAuth] Unsubscribing profile listener before signOut.");
      activeUnsubscribeProfile.current();
      activeUnsubscribeProfile.current = null;
    }

    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("[PortalAuth] SignOut error:", err);
    } finally {
      setFirebaseUser(null);
      setProfile(null);
      setProfileResolvedState(false);
      setError("");
      setLoading(false);
      setIsReady(true);
    }
  };

  return {
    firebaseUser,
    profile,
    loading,
    isReady,
    error,
    configured: firebaseConfigured,
    logout,
  };
}

export function useCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  enabled = true,
  sortBy?: { field: keyof T & string; direction?: "asc" | "desc" },
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled && !!db);
  const [error, setError] = useState("");
  const formattedConstraints = formatQueryConstraints(constraints);
  const constraintsKey = JSON.stringify(formattedConstraints);

  useEffect(() => {
    if (!db || !enabled) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    const base = collection(db, collectionName);
    const q = constraints.length ? query(base, ...constraints) : query(base);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;
        // Ensure Firestore document ID (item.id) is assigned LAST so internal data properties cannot overwrite snapshot ID
        let rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T);
        if (sortBy) {
          const dir = sortBy.direction === "asc" ? 1 : -1;
          rows = [...rows].sort((a, b) => {
            const av = (a as Record<string, unknown>)[sortBy.field];
            const bv = (b as Record<string, unknown>)[sortBy.field];
            const at = av && typeof av === "object" && "toMillis" in av ? (av as { toMillis: () => number }).toMillis() : Number(av) || 0;
            const bt = bv && typeof bv === "object" && "toMillis" in bv ? (bv as { toMillis: () => number }).toMillis() : Number(bv) || 0;
            return (at - bt) * dir;
          });
        }
        setData(rows);
        setLoading(false);
      },
      (reason) => {
        if (!isMounted) return;
        logFirestoreDiagnostic({
          operation: "onSnapshot",
          path: collectionName,
          collection: collectionName,
          query: constraints,
          hook: `useCollection:${collectionName}`,
          error: reason,
        });
        setError(reason instanceof Error ? reason.message : "Tidak bisa membaca data ini.");
        setLoading(false);
      },
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, enabled, constraintsKey]);

  return { data, loading, error };
}

export function useWorkerData(uid?: string) {
  const submissions = useCollection<EmailSubmission>(
    "emailSubmissions",
    uid ? [where("workerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
    { field: "submittedAt", direction: "desc" },
  );
  const withdrawals = useCollection<Withdrawal>(
    "withdrawals",
    uid ? [where("workerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
    { field: "requestedAt", direction: "desc" },
  );

  if (uid === "worker_demo") {
    return {
      submissions: {
        loading: false,
        error: "",
        data: [
          {
            id: "batch_123456",
            workerId: "worker_demo",
            workerName: "Ahmad Worker",
            itemCount: 5,
            approvedItemCount: 4,
            rejectedItemCount: 1,
            appliedTier: 1,
            appliedPricePerItem: 2000,
            totalAmount: 8000,
            status: "approved",
            submittedAt: { toMillis: () => Date.now() - 3600000 },
            items: [
              { email: "user1@example.com", status: "approved" },
              { email: "user2@example.com", status: "approved" },
              { email: "user3@example.com", status: "approved" },
              { email: "user4@example.com", status: "approved" },
              { email: "user5@example.com", status: "rejected" },
            ],
          },
          {
            id: "batch_123457",
            workerId: "worker_demo",
            workerName: "Ahmad Worker",
            itemCount: 3,
            appliedTier: 1,
            currentPricePerItem: 2000,
            status: "pending",
            submittedAt: { toMillis: () => Date.now() - 7200000 },
            items: [
              { email: "test1@example.com", status: "pending" },
              { email: "test2@example.com", status: "pending" },
              { email: "test3@example.com", status: "pending" },
            ],
          },
        ] as EmailSubmission[],
      },
      withdrawals: {
        loading: false,
        error: "",
        data: [
          {
            id: "wd_987654",
            workerId: "worker_demo",
            amount: 50000,
            method: "DANA",
            account: "081234567890",
            accountHolderName: "Ahmad Worker",
            status: "success",
            requestedAt: { toMillis: () => Date.now() - 86400000 },
          },
          {
            id: "wd_987655",
            workerId: "worker_demo",
            amount: 25000,
            method: "GoPay",
            account: "081234567890",
            accountHolderName: "Ahmad Worker",
            status: "pending",
            requestedAt: { toMillis: () => Date.now() - 43200000 },
          },
        ] as Withdrawal[],
      },
    };
  }

  return { submissions, withdrawals };
}

export function useAdminData() {
  const users = useCollection<PortalUser>("users", [], true, { field: "createdAt", direction: "desc" });
  const submissions = useCollection<EmailSubmission>("emailSubmissions", [], true, {
    field: "submittedAt",
    direction: "desc",
  });
  const withdrawals = useCollection<Withdrawal>("withdrawals", [], true, {
    field: "requestedAt",
    direction: "desc",
  });
  const referrals = useCollection<import("@/lib/portal-types").Referral>("referrals", [], true, {
    field: "createdAt",
    direction: "desc",
  });
  const rewardLedger = useCollection<import("@/lib/portal-types").RewardLedgerEntry>("rewardLedger", [], true, {
    field: "createdAt",
    direction: "desc",
  });
  return { users, submissions, withdrawals, referrals, rewardLedger };
}

export function useWorkerEngagementData(uid?: string) {
  const referrals = useCollection<import("@/lib/portal-types").Referral>(
    "referrals",
    uid ? [where("referrerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
    { field: "createdAt", direction: "desc" },
  );
  const referralClaims = useCollection<import("@/lib/portal-types").ReferralClaim>(
    "referralClaims",
    uid ? [where("referrerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
  );
  const missionClaims = useCollection<import("@/lib/portal-types").MissionClaim>(
    "missionClaims",
    uid ? [where("workerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
  );
  const rewardLedger = useCollection<import("@/lib/portal-types").RewardLedgerEntry>(
    "rewardLedger",
    uid ? [where("workerId", "==", uid)] : [],
    !!uid && uid !== "worker_demo",
    { field: "createdAt", direction: "desc" },
  );

  if (uid === "worker_demo") {
    return {
      referrals: { loading: false, error: "", data: [] },
      referralClaims: { loading: false, error: "", data: [] },
      missionClaims: { loading: false, error: "", data: [] },
      rewardLedger: {
        loading: false,
        error: "",
        data: [
          {
            id: "rw_111",
            workerId: "worker_demo",
            rewardType: "referral" as const,
            amount: 5000,
            sourceRefId: "ref_1",
            description: "Hadiah Referral dari Budi",
            createdAt: { toMillis: () => Date.now() - 172800000 },
          },
        ],
      },
    };
  }

  return { referrals, referralClaims, missionClaims, rewardLedger };
}

export function useMyReferral(uid?: string) {
  const [data, setData] = useState<import("@/lib/portal-types").Referral | null>(null);
  const [loading, setLoading] = useState(!!uid && uid !== "worker_demo" && !!db);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db || !uid || uid === "worker_demo") {
      setLoading(false);
      setData(null);
      return;
    }
    let isMounted = true;
    setLoading(true);
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
    console.log(`[Stage 4: secondary worker collection listener] Registering listener for path: referrals/${uid}, ProjectID: ${projectId}`);
    const refDoc = doc(db, "referrals", uid);
    const unsubscribe = onSnapshot(
      refDoc,
      (snapshot) => {
        if (!isMounted) return;
        const exists = typeof snapshot?.exists === "function" ? snapshot.exists() : false;
        if (exists) {
          // Ensure Firestore document ID (snapshot.id) is assigned LAST
          setData({ ...snapshot.data(), id: snapshot.id } as import("@/lib/portal-types").Referral);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (reason) => {
        if (!isMounted) return;
        logFirestoreDiagnostic({
          operation: "onSnapshot",
          path: `referrals/${uid}`,
          collection: "referrals",
          docId: uid,
          hook: "useMyReferral",
          error: reason,
        });
        setError(reason instanceof Error ? reason.message : "Gagal membaca data referral.");
        setLoading(false);
      }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [uid]);

  return { data, loading, error };
}

export async function createSubmission(payload: Omit<EmailSubmission, "id" | "status">) {
  if (!db) throw new Error("Firebase is not configured.");
  try {
    const res = await addDoc(collection(db, "emailSubmissions"), {
      ...payload,
      submittedAt: serverTimestamp(),
      status: "pending" as SubmissionStatus,
    });
    logFirestoreDiagnostic({
      operation: "addDoc",
      path: "emailSubmissions",
      collection: "emailSubmissions",
      hook: "createSubmission",
      message: `Submission created: ${res.id}`,
    });
    return res;
  } catch (err) {
    logFirestoreDiagnostic({
      operation: "addDoc",
      path: "emailSubmissions",
      collection: "emailSubmissions",
      hook: "createSubmission",
      error: err,
    });
    throw err;
  }
}

/**
 * Approving a submission (single or batch) sets status to "available" (stock) and credits the worker's balance
 * by (itemCount * applicablePricePerItem) in a single atomic transaction.
 * Permanently snapshots appliedTier, appliedPricePerItem, itemCount, and totalAmount.
 * ALL tx.get() calls are executed BEFORE any tx.update() calls to satisfy Firestore transaction ordering constraints.
 */
export async function reviewSubmission(
  submissionId: string,
  decision: "approved" | "rejected" | "available",
  reviewNote: string,
  overridePricePerItem?: number,
  overrideTierNum?: number,
  updatedItems?: EmailSubmission["items"],
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  let workerIdToEvaluate = "";

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      // 1. ALL READS FIRST
      const submissionRef = doc(firestore, "emailSubmissions", submissionId);
      const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
    const submission = submissionSnap.data() as EmailSubmission;
    if (submission.status !== "pending") {
      throw new Error("Setoran ini sudah pernah ditinjau.");
    }
    workerIdToEvaluate = submission.workerId;

    const rulesRef = doc(firestore, "settings", "rules");
    const rulesSnap = await tx.get(rulesRef);
    const activeTiers =
      rulesSnap.exists() && Array.isArray(rulesSnap.data()?.tiers) && rulesSnap.data().tiers.length > 0
        ? (rulesSnap.data().tiers as TierConfig[])
        : DEFAULT_TIERS;

    const userRef = doc(firestore, "users", submission.workerId);
    const userSnap = await tx.get(userRef);

    // Determine items & status counts
    const itemCount = getItemCountOfSubmission(submission);
    let itemsToSave = updatedItems ?? submission.items;

    if (!itemsToSave || itemsToSave.length === 0) {
      // Legacy single email fallback
      const singleEmail = submission.email ?? "";
      const singlePassword = submission.password;
      const singleStatus = decision === "approved" || decision === "available" ? "approved" : "rejected";
      itemsToSave = [{ email: singleEmail, password: singlePassword, status: singleStatus }];
    } else if (!updatedItems) {
      // Bulk decision applied to all batch items
      const bulkItemStatus = decision === "approved" || decision === "available" ? "approved" : "rejected";
      itemsToSave = itemsToSave.map((it) => ({ ...it, status: it.status ?? bulkItemStatus }));
    }

    const approvedCount = itemsToSave.filter((it) => it.status === "approved").length;
    const rejectedCount = itemsToSave.filter((it) => it.status === "rejected").length;

    // Dynamically calculate Tier and Price per item based ONLY on final ACC/valid email count
    const resultingTierCfg = getRecommendedTier(approvedCount, activeTiers);
    const appliedPricePerItem = overridePricePerItem ?? resultingTierCfg.pricePerItem;
    const appliedTier = overrideTierNum ?? resultingTierCfg.tier;
    const creditAmount = approvedCount * appliedPricePerItem;

    const finalStatus: SubmissionStatus = approvedCount > 0 ? "available" : "rejected";

    // 2. ALL WRITES AFTER READS
    tx.update(submissionRef, {
      status: finalStatus,
      items: itemsToSave,
      itemCount,
      approvedItemCount: approvedCount,
      rejectedItemCount: rejectedCount,
      reviewNote,
      appliedTier,
      appliedPricePerItem,
      totalAmount: creditAmount,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (userSnap && userSnap.exists()) {
      const currentBalance = (userSnap.data() as PortalUser).balance ?? 0;
      tx.update(userRef, {
        balance: currentBalance + creditAmount,
        tier: appliedTier,
      });
    }
  },
  "reviewSubmission",
  `emailSubmissions/${submissionId}`
  );

  // Automatically evaluate referral qualification if worker has a pending referral
  if (workerIdToEvaluate) {
    try {
      await evaluateReferralQualification(workerIdToEvaluate);
    } catch (refEvalErr) {
      console.warn("[reviewSubmission] Auto referral evaluation notice:", refEvalErr);
    }
  }
}

/**
 * Update stock status (e.g. mark "available" email stock as "sold" or "rejected",
 * or restore "sold" back to "available").
 * DOES NOT re-credit worker balance (balance credit occurs ONLY on initial submission approval).
 */
export async function updateEmailStockStatus(
  submissionId: string,
  newStatus: "available" | "sold" | "rejected",
  note?: string,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      const submissionRef = doc(firestore, "emailSubmissions", submissionId);
      const submissionSnap = await tx.get(submissionRef);
      if (!submissionSnap.exists()) throw new Error("Email tidak ditemukan.");
      const submission = submissionSnap.data() as EmailSubmission;

      if (submission.status === "pending") {
        throw new Error("Setoran masih berstatus pending. Harap tinjau setoran terlebih dahulu.");
      }

      const updates: Record<string, unknown> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (note !== undefined) {
        updates.reviewNote = note;
      }

      if (newStatus === "sold") {
        updates.soldAt = serverTimestamp();
      }

      tx.update(submissionRef, updates);
    },
    "updateEmailStockStatus",
    `emailSubmissions/${submissionId}`
  );
}

/**
 * Requesting a withdrawal deducts the balance immediately (inside the same
 * transaction as the balance check), so a worker can never request more
 * than they have, and can never fire two requests that both pass the
 * balance check against the same starting balance.
 */
export async function createWithdrawal(payload: {
  workerId: string;
  amount: number;
  method: string;
  account: string;
  accountHolderName: string;
}) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  const trimmedHolderName = payload.accountHolderName ? payload.accountHolderName.trim() : "";
  if (!trimmedHolderName) {
    throw new Error("Nama pemilik rekening/wallet wajib diisi.");
  }

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      const userRef = doc(firestore, "users", payload.workerId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("Profil pekerja tidak ditemukan.");
      const user = userSnap.data() as PortalUser;
      const balance = user.balance ?? 0;
      if (payload.amount <= 0) throw new Error("Jumlah penarikan tidak valid.");
      if (balance < payload.amount) throw new Error("Saldo tidak mencukupi.");

      tx.update(userRef, { balance: balance - payload.amount });
      const withdrawalRef = doc(collection(firestore, "withdrawals"));
      tx.set(withdrawalRef, {
        workerId: payload.workerId,
        amount: payload.amount,
        method: payload.method,
        account: payload.account,
        accountHolderName: trimmedHolderName,
        status: "pending" as WithdrawalStatus,
        requestedAt: serverTimestamp(),
      });
    },
    "createWithdrawal",
    "withdrawals"
  );
}

/**
 * Admin resolves a withdrawal. Rejecting refunds the balance atomically;
 * approving to "processing"/"success" just updates status (the balance was
 * already deducted when the request was made).
 */
export async function reviewWithdrawal(withdrawalId: string, status: WithdrawalStatus, note: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      const withdrawalRef = doc(firestore, "withdrawals", withdrawalId);
      const withdrawalSnap = await tx.get(withdrawalRef);
      if (!withdrawalSnap.exists()) throw new Error("Penarikan tidak ditemukan.");
      const withdrawal = withdrawalSnap.data() as Withdrawal;
      if (withdrawal.status !== "pending" && withdrawal.status !== "processing") {
        throw new Error("Penarikan ini sudah selesai diproses.");
      }

      const isRejected = status === "rejected";
      const userRef = isRejected ? doc(firestore, "users", withdrawal.workerId) : null;
      const userSnap = userRef ? await tx.get(userRef) : null;

      tx.update(withdrawalRef, { status, note, processedAt: serverTimestamp() });

      if (isRejected && userRef && userSnap && userSnap.exists()) {
        const current = (userSnap.data() as PortalUser).balance ?? 0;
        tx.update(userRef, { balance: current + withdrawal.amount });
      }
    },
    "reviewWithdrawal",
    `withdrawals/${withdrawalId}`
  );
}

export async function updatePortalUser(uid: string, data: Partial<PortalUser>) {
  if (!db) throw new Error("Firebase is not configured.");
  return updateDocWithDiagnostic(doc(db, "users", uid), data, "updatePortalUser");
}

export async function createPortalUser(uid: string, data: Omit<PortalUser, "uid">) {
  if (!db) throw new Error("Firebase is not configured.");
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
  console.log(`[Stage 2: users/{uid} CREATE] Initiating profile creation for path: users/${uid}, ProjectID: ${projectId}`);

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[createPortalUser] Attempt ${attempt}/${maxAttempts} writing document users/${uid}`);
      await setDocWithDiagnostic(
        doc(db, "users", uid),
        { uid, ...cleanData, createdAt: serverTimestamp() },
        undefined,
        "createPortalUser"
      );
      console.log(`[createPortalUser] Document users/${uid} created successfully on attempt ${attempt}`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[createPortalUser] Attempt ${attempt}/${maxAttempts} failed for users/${uid}:`, err);
      if (attempt < maxAttempts) {
        const delay = attempt * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function createWorkerAccount(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  tier: number;
  status: UserStatus;
  balance: number;
}) {
  if (!db) throw new Error("Firebase is not configured.");
  const uid = await createWorkerAuthAccount(data.email, data.password);
  await createPortalUser(uid, {
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: "worker",
    status: data.status,
    tier: data.tier,
    balance: data.balance,
  });
  return uid;
}

export async function deletePortalUser(uid: string) {
  if (!db) throw new Error("Firebase is not configured.");
  return deleteDocWithDiagnostic(doc(db, "users", uid), "deletePortalUser");
}

export async function saveSettings(name: string, data: Record<string, unknown>) {
  if (!db) throw new Error("Firebase is not configured.");
  const currentUser = auth?.currentUser;

  if (!currentUser) {
    throw new Error("Sesi pengguna tidak ditemukan. Silakan masuk kembali.");
  }

  try {
    await currentUser.getIdToken(true);
  } catch (tokenErr) {
    console.warn("[saveSettings] Force token refresh warning:", tokenErr);
  }

  return setDocWithDiagnostic(
    doc(db, "settings", name),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
    "saveSettings"
  );
}

/**
 * Registers a referral relationship upon worker registration.
 * Registration alone generates ZERO reward.
 * Self-referral is rejected.
 * Validates that referrer exists before creating false relationships.
 */
/**
 * Claims an invitation code post-registration for an existing worker.
 * Enforces atomic validation & writes inside a Firestore transaction.
 */
export async function claimReferralCode(currentWorker: PortalUser, referralCodeInput: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const code = referralCodeInput ? referralCodeInput.trim() : "";

  if (!code) {
    throw new Error("Kode undangan wajib diisi.");
  }

  if (currentWorker.referredBy) {
    throw new Error("Akun kamu sudah terhubung dengan kode undangan.");
  }

  if (code === currentWorker.uid) {
    throw new Error("Tidak dapat menggunakan kode undangan milik sendiri.");
  }

  const firestore = db;

  return runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      // 1. ALL READS FIRST
      const currentUserRef = doc(firestore, "users", currentWorker.uid);
      const currentUserSnap = await tx.get(currentUserRef);

      if (!currentUserSnap.exists()) {
        throw new Error("Profil pengguna tidak ditemukan.");
      }

      const currentUserData = currentUserSnap.data() as PortalUser;
      if (currentUserData.referredBy) {
        throw new Error("Akun kamu sudah terhubung dengan kode undangan.");
      }

      const existingRefDocRef = doc(firestore, "referrals", currentWorker.uid);
      const existingRefSnap = await tx.get(existingRefDocRef);
      if (existingRefSnap.exists()) {
        throw new Error("Akun kamu sudah memiliki data referral/pengundang.");
      }

      const referrerUserRef = doc(firestore, "users", code);
      const referrerUserSnap = await tx.get(referrerUserRef);

      if (!referrerUserSnap.exists()) {
        throw new Error("Kode undangan tidak valid atau tidak ditemukan.");
      }

      const referrerData = referrerUserSnap.data() as PortalUser;
      const referrerName = referrerData.name && referrerData.name.trim() ? referrerData.name.trim() : shortId(code);

      // 2. ALL WRITES AFTER READS
      tx.update(currentUserRef, {
        referredBy: code,
        updatedAt: serverTimestamp(),
      });

      tx.set(existingRefDocRef, {
        id: currentWorker.uid,
        referrerId: code,
        referrerName,
        referredWorkerId: currentWorker.uid,
        referredWorkerName: currentUserData.name || currentWorker.name,
        currentAccCount: 0,
        rewardAmount: 0,
        status: "PENDING",
        createdAt: serverTimestamp(),
      });
    },
    "claimReferralCode",
    `referrals/${currentWorker.uid}`
  );
}

export async function registerReferral(referrerId: string, referredWorkerId: string, referredWorkerName: string) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!referrerId || !referredWorkerId) return;
  if (referrerId === referredWorkerId) {
    console.warn("[registerReferral] Self-referral rejected.");
    return;
  }

  const firestore = db;
  const refDoc = doc(firestore, "referrals", referredWorkerId);

  return setDocWithDiagnostic(
    refDoc,
    {
      id: referredWorkerId,
      referrerId,
      referrerName: shortId(referrerId),
      referredWorkerId,
      referredWorkerName,
      currentAccCount: 0,
      rewardAmount: 0,
      status: "PENDING",
      createdAt: serverTimestamp(),
    },
    undefined,
    "registerReferral"
  );
}

/**
 * Evaluates a referral's qualification criteria using actual Firestore email submission documents.
 * Updates currentAccCount and marks status as QUALIFIED when >= referralMinAcc is reached.
 * DOES NOT AUTO-PAY. Admin approval is required to grant reward.
 */
export async function evaluateReferralQualification(referredWorkerId: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;

  // Query actual approved email submission documents for referredWorkerId directly from Firestore
  const submissionsQuery = query(
    collection(firestore, "emailSubmissions"),
    where("workerId", "==", referredWorkerId),
  );
  const subSnaps = await getDocsWithDiagnostic(
    submissionsQuery,
    [where("workerId", "==", referredWorkerId)],
    "evaluateReferralQualification",
    "emailSubmissions"
  );

  let actualAccCount = 0;
  subSnaps.forEach((docSnap) => {
    const sub = docSnap.data() as EmailSubmission;
    const isFinalized = sub.status === "approved" || sub.status === "available" || sub.status === "sold";
    if (isFinalized) {
      if (typeof sub.approvedItemCount === "number") {
        actualAccCount += sub.approvedItemCount;
      } else if (Array.isArray(sub.items) && sub.items.length > 0) {
        actualAccCount += sub.items.filter((i) => i.status === "approved").length;
      } else if (sub.email) {
        actualAccCount += 1;
      }
    }
  });

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      const referralRef = doc(firestore, "referrals", referredWorkerId);
      const referralSnap = await tx.get(referralRef);
      if (!referralSnap.exists()) return;

      const referral = referralSnap.data() as import("@/lib/portal-types").Referral;
      if (referral.referrerId === referral.referredWorkerId) {
        console.warn("[evaluateReferral] Self-referral rejected.");
        return;
      }

      const rulesRef = doc(firestore, "settings", "rules");
      const rulesSnap = await tx.get(rulesRef);
      const rulesData = rulesSnap.exists() ? rulesSnap.data() : {};
      const referralTiers = (rulesData?.referralTiers ?? DEFAULT_REFERRAL_TIERS) as ReferralTierConfig[];
      const sortedTiers = [...referralTiers].sort((a, b) => a.minAcc - b.minAcc);
      const minAcc = sortedTiers[0]?.minAcc ?? rulesData?.referralMinAcc ?? 5;

      const updates: Record<string, unknown> = {
        currentAccCount: actualAccCount,
      };

      // If still PENDING and reached minimum ACC, advance status to QUALIFIED
      if (referral.status === "PENDING" && actualAccCount >= minAcc) {
        updates.status = "QUALIFIED";
        updates.qualifiedAt = serverTimestamp();
      }

      tx.update(referralRef, updates);
    },
    "evaluateReferralQualification",
    `referrals/${referredWorkerId}`
  );
}

// Alias for backwards compatibility if needed
export const evaluateReferralQualificationAndReward = evaluateReferralQualification;

/**
 * Worker creates a pending claim request for a specific referral tier.
 * Adheres strictly to security rules (creates pending claim document in referralClaims collection).
 */
export async function createReferralClaimRequest(referralId: string, minAcc: number) {
  if (!db || !auth) throw new Error("Firebase is not configured.");
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Anda harus masuk terlebih dahulu.");

  const firestore = db;
  const claimDocId = `${referralId}_tier_${minAcc}`;
  const claimRef = doc(firestore, "referralClaims", claimDocId);

  // Read referral doc to validate referrer and progress
  const referralRef = doc(firestore, "referrals", referralId);
  const referralSnap = await getDocWithDiagnostic(referralRef, "createReferralClaimRequest");
  if (!referralSnap.exists()) {
    throw new Error("Data referral tidak ditemukan.");
  }

  const referral = referralSnap.data() as import("@/lib/portal-types").Referral;
  if (referral.referrerId !== currentUser.uid) {
    throw new Error("Anda tidak dapat mengklaim reward referral milik akun lain.");
  }

  if (referral.status === "REJECTED") {
    throw new Error("Referral ini telah ditolak oleh admin.");
  }

  if ((referral.currentAccCount ?? 0) < minAcc) {
    throw new Error(`Target ACC belum tercapai (${referral.currentAccCount ?? 0}/${minAcc}).`);
  }

  const rulesRef = doc(firestore, "settings", "rules");
  const rulesSnap = await getDocWithDiagnostic(rulesRef, "createReferralClaimRequest");
  const rulesData = rulesSnap.exists() ? (rulesSnap.data() as import("@/lib/portal-types").PortalRules) : null;
  const referralTiers = (rulesData?.referralTiers ?? DEFAULT_REFERRAL_TIERS) as ReferralTierConfig[];

  const matchedTier = referralTiers.find((t) => Number(t.minAcc) === Number(minAcc));
  if (!matchedTier) {
    throw new Error(`Tier referral ${minAcc} ACC tidak ditemukan.`);
  }

  if (referral.claimedTiers?.[String(minAcc)]) {
    throw new Error(`Hadiah tier ${minAcc} ACC sudah pernah diklaim.`);
  }

  // Check if claim request already exists
  const existingSnap = await getDocWithDiagnostic(claimRef, "createReferralClaimRequest");
  if (existingSnap.exists()) {
    const existingData = existingSnap.data() as import("@/lib/portal-types").ReferralClaim;
    if (existingData.status === "approved") {
      throw new Error(`Klaim reward tier ${minAcc} ACC sudah pernah disetujui.`);
    }
    if (existingData.status === "pending") {
      throw new Error(`Permintaan klaim tier ${minAcc} ACC sedang menunggu persetujuan admin.`);
    }
    if (existingData.status === "rejected") {
      throw new Error(`Permintaan klaim tier ${minAcc} ACC sebelumnya telah ditolak oleh admin.`);
    }
    throw new Error(`Permintaan klaim tier ${minAcc} ACC sudah pernah diajukan.`);
  }

  await setDocWithDiagnostic(
    claimRef,
    {
      id: claimDocId,
      referralId,
      referrerId: currentUser.uid,
      referredWorkerId: referral.referredWorkerId,
      minAcc: matchedTier.minAcc,
      rewardAmount: matchedTier.reward,
      status: "pending",
      requestedAt: serverTimestamp(),
    },
    undefined,
    "createReferralClaimRequest"
  );
}

/**
 * Worker claims a specific referral tier reward (per-tier claim request).
 */
export async function claimReferralTier(referralId: string, minAcc: number) {
  return createReferralClaimRequest(referralId, minAcc);
}

/**
 * Admin approves a qualified referral, atomically crediting reward to referrer balance
 * and generating a reward ledger record. Prevents double rewards using transaction locks.
 * Supports optional targetMinAcc for per-tier approval, or approves all eligible unclaimed tiers.
 */
/**
 * Admin approves a qualified referral via secure server-side API endpoint.
 * The browser does NOT perform the privileged approval transaction directly anymore.
 */
export async function approveReferral(referralId: string, targetMinAcc?: number) {
  if (!auth?.currentUser) {
    throw new Error("Anda harus masuk terlebih dahulu sebagai admin.");
  }

  let token = "";
  try {
    token = await auth.currentUser.getIdToken(true);
  } catch (err) {
    throw new Error("Gagal mengambil token otentikasi. Silakan masuk kembali.");
  }

  const endpoint = `/api/admin/referrals/${encodeURIComponent(referralId)}/approve`;
  console.log("[ADMIN REFERRAL ID TRACE]", {
    clientReferralId: referralId,
    requestUrlPath: endpoint,
    referralIdType: typeof referralId,
    referralIdLength: referralId ? referralId.length : 0,
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(targetMinAcc !== undefined ? { targetMinAcc } : {}),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = body.error || `Gagal menyetujui referral (HTTP ${response.status}).`;
    const errObj = new Error(errorMsg);
    (errObj as any).status = response.status;
    (errObj as any).code = body.code || "API_ERROR";
    throw errObj;
  }

  return body;
}

/**
 * Admin rejects a referral. The status is set to REJECTED with no balance change.
 */
export async function rejectReferral(referralId: string, reviewNote?: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      const referralRef = doc(firestore, "referrals", referralId);
      const referralSnap = await tx.get(referralRef);
      if (!referralSnap.exists()) {
        throw new Error("Data referral tidak ditemukan.");
      }

      const referral = referralSnap.data() as import("@/lib/portal-types").Referral;
      if (referral.status === "PAID" || referral.status === "REWARDED") {
        throw new Error("Referral yang sudah dibayar tidak dapat ditolak.");
      }

      tx.update(referralRef, {
        status: "REJECTED",
        reviewNote: reviewNote || "Ditolak oleh admin",
        updatedAt: serverTimestamp(),
      });
    },
    "rejectReferral",
    `referrals/${referralId}`
  );
}

/**
 * Creates a pending mission claim request from a worker.
 * Adheres to Firestore security rules (status is "pending").
 */
export async function createMissionClaimRequest(
  workerId: string,
  missionId: string,
  periodKey: string,
  workerName?: string,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const claimId = `${workerId}_${missionId}_${periodKey}`;
  const claimRef = doc(db, "missionClaims", claimId);

  return setDocWithDiagnostic(
    claimRef,
    {
      id: claimId,
      workerId,
      missionId,
      periodKey,
      workerName,
      status: "pending",
      requestedAt: serverTimestamp(),
    },
    { merge: true },
    "createMissionClaimRequest"
  );
}

/**
 * Admin resolves/approves a mission claim request.
 * Server-side / transactionally validates actual Firestore submission records inside the transaction.
 */
export async function reviewMissionClaim(
  claimId: string,
  decision: "approved" | "rejected",
  actualAccCountOverride?: number,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      // 1. ALL READS FIRST
      const claimRef = doc(firestore, "missionClaims", claimId);
      const claimSnap = await tx.get(claimRef);
      if (!claimSnap.exists()) throw new Error("Klaim misi tidak ditemukan.");
      const claim = claimSnap.data() as { workerId: string; missionId: string; periodKey: string; status: string; workerName?: string };

      if (claim.status === "approved") {
        throw new Error("Klaim misi ini sudah pernah disetujui.");
      }

      const rulesRef = doc(firestore, "settings", "rules");
      const rulesSnap = await tx.get(rulesRef);
      const rulesData = rulesSnap.exists() ? rulesSnap.data() : {};
      const missions = (rulesData?.missions ?? []) as import("@/lib/portal-types").MissionConfig[];
      const mission = missions.find((m) => m.id === claim.missionId);

      if (!mission || !mission.enabled) {
        throw new Error("Misi tidak ditemukan atau sedang nonaktif.");
      }

      const userRef = doc(firestore, "users", claim.workerId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("Profil pekerja tidak ditemukan.");

      const currentBalance = (userSnap.data() as PortalUser).balance ?? 0;

      // Budget check
      const budgetEnabled = rulesData?.rewardBudgetEnabled ?? false;
      const currentBudget = rulesData?.rewardBudget ?? 0;

      if (decision === "approved" && budgetEnabled && currentBudget < mission.rewardAmount) {
        throw new Error("Anggaran hadiah misi tidak mencukupi.");
      }

      // 2. ALL WRITES AFTER READS
      tx.update(claimRef, {
        status: decision,
        rewardAmount: decision === "approved" ? mission.rewardAmount : 0,
        processedAt: serverTimestamp(),
      });

      if (decision === "approved") {
        tx.update(userRef, {
          balance: currentBalance + mission.rewardAmount,
        });

        if (budgetEnabled) {
          tx.update(rulesRef, {
            rewardBudget: currentBudget - mission.rewardAmount,
          });
        }

        const ledgerRef = doc(collection(firestore, "rewardLedger"));
        tx.set(ledgerRef, {
          workerId: claim.workerId,
          workerName: claim.workerName || (userSnap.data() as PortalUser).name,
          rewardType: "mission",
          amount: mission.rewardAmount,
          sourceRefId: claimId,
          description: `Hadiah Misi (${claim.periodKey}): ${mission.title}`,
          createdAt: serverTimestamp(),
        });
      }
    },
    "reviewMissionClaim",
    `missionClaims/${claimId}`
  );
}

/**
 * Distributes leaderboard rewards to top workers for a given period.
 * Enforces single reward per rank/worker per period.
 */
export async function distributeLeaderboardReward(
  workerId: string,
  periodKey: string,
  rank: number,
  validAccCount: number,
  rewardAmount: number,
  workerName?: string,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;

  await runTransactionWithDiagnostic(
    firestore,
    async (tx) => {
      // 1. ALL READS FIRST
      const payoutId = `${periodKey}_rank${rank}_${workerId}`;
      const payoutRef = doc(firestore, "leaderboardPayouts", payoutId);
      const payoutSnap = await tx.get(payoutRef);
      if (payoutSnap.exists()) {
        throw new Error("Hadiah klasemen untuk peringkat ini sudah pernah dicairkan.");
      }

      const userRef = doc(firestore, "users", workerId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("Profil pekerja tidak ditemukan.");

      const currentBalance = (userSnap.data() as PortalUser).balance ?? 0;

      // 2. ALL WRITES AFTER READS
      tx.set(payoutRef, {
        id: payoutId,
        workerId,
        workerName: workerName || (userSnap.data() as PortalUser).name,
        periodKey,
        rank,
        validAccCount,
        rewardAmount,
        paidAt: serverTimestamp(),
      });

      tx.update(userRef, {
        balance: currentBalance + rewardAmount,
      });

      const ledgerRef = doc(collection(firestore, "rewardLedger"));
      tx.set(ledgerRef, {
        workerId,
        workerName: workerName || (userSnap.data() as PortalUser).name,
        rewardType: "leaderboard",
        amount: rewardAmount,
        sourceRefId: payoutId,
        description: `Hadiah Klasemen Periode ${periodKey} (Juara ${rank})`,
        createdAt: serverTimestamp(),
      });
    },
    "distributeLeaderboardReward",
    `leaderboardPayouts/${periodKey}_rank${rank}_${workerId}`
  );
}

export function useSettings<T>(name: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(!!db);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const unsubscribe = onSnapshot(
      doc(db, "settings", name),
      (snapshot) => {
        if (!isMounted) return;
        if (snapshot.exists()) setData({ ...initial, ...(snapshot.data() as T) });
        setLoading(false);
      },
      (reason) => {
        if (!isMounted) return;
        logFirestoreDiagnostic({
          operation: "onSnapshot",
          path: `settings/${name}`,
          collection: "settings",
          docId: name,
          hook: `useSettings:${name}`,
          error: reason,
        });
        setError(reason instanceof Error ? reason.message : "Tidak bisa membaca pengaturan.");
        setLoading(false);
      },
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return { data, setData, loading, error };
}

export async function addFinancialTransaction(payload: {
  type: FinancialTransactionType;
  amount: number;
  description: string;
  note?: string;
  transactionDate: Date | string | number;
}) {
  if (!db) throw new Error("Firebase is not configured.");
  const amountNum = Number(payload.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error("Jumlah harus berupa angka valid lebih besar dari 0.");
  }
  if (!payload.description || !payload.description.trim()) {
    throw new Error("Keterangan transaksi wajib diisi.");
  }

  const txDate = payload.transactionDate
    ? new Date(payload.transactionDate)
    : new Date();

  if (isNaN(txDate.getTime())) {
    throw new Error("Tanggal transaksi tidak valid.");
  }

  const period = getMonthlyPeriodKey(txDate);

  const newDocRef = doc(collection(db, "financialTransactions"));
  const dataToSave: Record<string, unknown> = {
    id: newDocRef.id,
    type: payload.type,
    amount: amountNum,
    description: payload.description.trim(),
    transactionDate: Timestamp.fromDate(txDate),
    period,
    createdAt: serverTimestamp(),
    createdBy: auth?.currentUser?.uid ?? "admin",
  };

  if (payload.note && payload.note.trim()) {
    dataToSave.note = payload.note.trim();
  }

  await setDocWithDiagnostic(
    newDocRef,
    dataToSave,
    undefined,
    "addFinancialTransaction"
  );
  return newDocRef.id;
}

export async function updateFinancialTransaction(
  id: string,
  payload: Partial<{
    type: FinancialTransactionType;
    amount: number;
    description: string;
    note?: string;
    transactionDate: Date | string | number;
  }>
) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!id) throw new Error("ID transaksi tidak valid.");

  const updates: Record<string, unknown> = {};

  if (payload.amount !== undefined) {
    const amountNum = Number(payload.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Jumlah harus berupa angka valid lebih besar dari 0.");
    }
    updates.amount = amountNum;
  }

  if (payload.description !== undefined) {
    if (!payload.description.trim()) {
      throw new Error("Keterangan transaksi wajib diisi.");
    }
    updates.description = payload.description.trim();
  }

  if (payload.type !== undefined) {
    updates.type = payload.type;
  }

  if (payload.note !== undefined) {
    updates.note = payload.note.trim() || null;
  }

  if (payload.transactionDate !== undefined) {
    const txDate = new Date(payload.transactionDate);
    if (isNaN(txDate.getTime())) {
      throw new Error("Tanggal transaksi tidak valid.");
    }
    updates.transactionDate = Timestamp.fromDate(txDate);
    updates.period = getMonthlyPeriodKey(txDate);
  }

  updates.updatedAt = serverTimestamp();

  await updateDocWithDiagnostic(
    doc(db, "financialTransactions", id),
    updates,
    "updateFinancialTransaction"
  );
}

export async function deleteFinancialTransaction(id: string) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!id) throw new Error("ID transaksi tidak valid.");
  return deleteDocWithDiagnostic(
    doc(db, "financialTransactions", id),
    "deleteFinancialTransaction"
  );
}

export function useFinancialData(selectedPeriod?: string) {
  const constraints: QueryConstraint[] = selectedPeriod
    ? [where("period", "==", selectedPeriod)]
    : [];

  const { data, loading, error } = useCollection<FinancialTransaction>(
    "financialTransactions",
    constraints,
    true,
    { field: "transactionDate", direction: "desc" }
  );

  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") {
        totalIncome += amt;
      } else if (tx.type === "expense") {
        totalExpense += amt;
      }
    });

    const netBalance = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      netBalance,
    };
  }, [data]);

  return { transactions: data, summary, loading, error };
}
