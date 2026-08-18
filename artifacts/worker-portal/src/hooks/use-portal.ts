import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  addDoc,
  deleteDoc,
  runTransaction,
  type QueryConstraint,
} from "firebase/firestore";
import { auth, createWorkerAuthAccount, db, firebaseConfigured } from "@/lib/firebase";
import type {
  EmailSubmission,
  PortalUser,
  Withdrawal,
  SubmissionStatus,
  WithdrawalStatus,
  UserStatus,
} from "@/lib/portal-types";
import { getItemCountOfSubmission } from "@/lib/portal-utils";

import { useRef } from "react";

export function usePortalAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState("");

  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missingDocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      return;
    }
    const firestore = db;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log("[PortalAuth] Auth state changed:", user ? `UID: ${user.uid} (${user.email})` : "Null user");
      console.log(`[PortalAuth] Diagnostic 1: Authenticated Firebase UID = ${user?.uid ?? "null"}`);

      clearAllTimers();

      if (activeUnsubscribeProfile.current) {
        console.log("[PortalAuth] Cleaning up previous profile listener.");
        activeUnsubscribeProfile.current();
        activeUnsubscribeProfile.current = null;
      }

      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const firestorePath = `users/${user.uid}`;
      console.log(`[PortalAuth] Diagnostic 2: Firestore path being read = ${firestorePath}`);

      // Set a 10-second safety fallback timeout in case Firestore listener hangs
      profileTimerRef.current = setTimeout(() => {
        console.warn(`[PortalAuth] Profile listener timeout reached (10s) for ${firestorePath}.`);
        setLoading((prevLoading) => {
          if (prevLoading) {
            setError("Gagal memuat profil: Waktu koneksi habis. Silakan coba lagi.");
            return false;
          }
          return prevLoading;
        });
      }, 10000);

      const unsubscribe = onSnapshot(
        doc(firestore, "users", user.uid),
        (snapshot) => {
          if (profileTimerRef.current) {
            clearTimeout(profileTimerRef.current);
            profileTimerRef.current = null;
          }

          console.log(`[PortalAuth] Diagnostic 3: snapshot.exists() = ${snapshot.exists()} for path = ${firestorePath}`);
          console.log(
            `[PortalAuth] Profile snapshot details: exists=${snapshot.exists()}, path=${firestorePath}, authUID=${auth?.currentUser?.uid}`,
          );

          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            console.warn("[PortalAuth] Snapshot fired but user is no longer active.");
            clearAllTimers();
            setProfile(null);
            setError("");
            setLoading(false);
            return;
          }

          if (snapshot.exists()) {
            if (missingDocTimerRef.current) {
              clearTimeout(missingDocTimerRef.current);
              missingDocTimerRef.current = null;
            }
            const data = snapshot.data();
            console.log(`[PortalAuth] User profile retrieved successfully for ${firestorePath}:`, {
              uid: user.uid,
              dataUid: data?.uid,
              role: data?.role,
              status: data?.status,
            });
            const normalizedRole = typeof data?.role === "string" ? data.role.trim().toLowerCase() : data?.role;
            const normalizedStatus = typeof data?.status === "string" ? data.status.trim().toLowerCase() : data?.status;
            setProfile({ uid: user.uid, ...data, role: normalizedRole, status: normalizedStatus } as PortalUser);
            setError("");
            setLoading(false);
          } else {
            console.warn(`[PortalAuth] Document ${firestorePath} does NOT exist in Firestore. Attempting profile auto-initialization...`);
            setLoading(true);

            // Attempt auto-recovery profile creation for authenticated worker if doc missing
            if (auth?.currentUser && auth.currentUser.uid === user.uid) {
              const defaultName = user.displayName?.trim() || user.email?.split("@")[0] || "Worker";
              const defaultEmail = user.email || "";
              if (defaultEmail) {
                createPortalUser(user.uid, {
                  name: defaultName,
                  email: defaultEmail,
                  role: "worker",
                  status: "active",
                  tier: 1,
                  balance: 0,
                }).catch((createErr) => {
                  console.warn(`[PortalAuth] Auto-recovery profile creation warning for ${firestorePath}:`, createErr);
                });
              }
            }

            if (!missingDocTimerRef.current) {
              missingDocTimerRef.current = setTimeout(() => {
                console.warn(`[PortalAuth] Document ${firestorePath} still does NOT exist after 5s grace period.`);
                console.log(`[PortalAuth] Diagnostic 5: Firebase Auth state when profile missing error set: isAuthenticated=${!!auth?.currentUser}, authUID=${auth?.currentUser?.uid}`);
                missingDocTimerRef.current = null;
                setProfile(null);
                setError("Profil pengguna tidak ditemukan di database.");
                setLoading(false);
              }, 5000);
            }
          }
        },
        (reason) => {
          clearAllTimers();

          const code = (reason as { code?: string })?.code ?? "";
          console.error(`[PortalAuth] Diagnostic 4: Profile snapshot error code = '${code}' for path = ${firestorePath}:`, reason);

          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            setProfile(null);
            setError("");
            setLoading(false);
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
      setError("");
      setLoading(false);
    }
  };

  return {
    firebaseUser,
    profile,
    loading,
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
  const constraintsKey = JSON.stringify(constraints.map((constraint) => String(constraint)));

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
        let rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
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
    !!uid,
    { field: "submittedAt", direction: "desc" },
  );
  const withdrawals = useCollection<Withdrawal>(
    "withdrawals",
    uid ? [where("workerId", "==", uid)] : [],
    !!uid,
    { field: "requestedAt", direction: "desc" },
  );
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
  return { users, submissions, withdrawals };
}

export async function createSubmission(payload: Omit<EmailSubmission, "id" | "status">) {
  if (!db) throw new Error("Firebase is not configured.");
  return addDoc(collection(db, "emailSubmissions"), {
    ...payload,
    submittedAt: serverTimestamp(),
    status: "pending" as SubmissionStatus,
  });
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

  await runTransaction(firestore, async (tx) => {
    // 1. ALL READS FIRST
    const submissionRef = doc(firestore, "emailSubmissions", submissionId);
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
    const submission = submissionSnap.data() as EmailSubmission;
    if (submission.status !== "pending") {
      throw new Error("Setoran ini sudah pernah ditinjau.");
    }

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

    const appliedPricePerItem = submission.currentPricePerItem ?? overridePricePerItem ?? 2000;
    const appliedTier = submission.currentTier ?? overrideTierNum ?? 1;
    const creditAmount = approvedCount * appliedPricePerItem;

    const finalStatus: SubmissionStatus = approvedCount > 0 ? "available" : "rejected";

    const userRef = creditAmount > 0 ? doc(firestore, "users", submission.workerId) : null;
    const userSnap = userRef ? await tx.get(userRef) : null;

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

    if (userRef && userSnap && userSnap.exists()) {
      const currentBalance = (userSnap.data() as PortalUser).balance ?? 0;
      tx.update(userRef, { balance: currentBalance + creditAmount });
    }
  });
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
  await runTransaction(firestore, async (tx) => {
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
  });
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
}) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await runTransaction(firestore, async (tx) => {
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
      status: "pending" as WithdrawalStatus,
      requestedAt: serverTimestamp(),
    });
  });
}

/**
 * Admin resolves a withdrawal. Rejecting refunds the balance atomically;
 * approving to "processing"/"success" just updates status (the balance was
 * already deducted when the request was made).
 */
export async function reviewWithdrawal(withdrawalId: string, status: WithdrawalStatus, note: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await runTransaction(firestore, async (tx) => {
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
  });
}

export async function updatePortalUser(uid: string, data: Partial<PortalUser>) {
  if (!db) throw new Error("Firebase is not configured.");
  return updateDoc(doc(db, "users", uid), data);
}

export async function createPortalUser(uid: string, data: Omit<PortalUser, "uid">) {
  if (!db) throw new Error("Firebase is not configured.");
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  console.log(`[createPortalUser] Initiating profile creation for path: users/${uid}`);

  if (auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      console.log(`[createPortalUser] Forcing token refresh for user UID: ${uid}`);
      await auth.currentUser.getIdToken(true);
    } catch (tokenErr) {
      console.warn("[createPortalUser] Token refresh warning prior to document creation:", tokenErr);
    }
  }

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[createPortalUser] Attempt ${attempt}/${maxAttempts} writing document users/${uid}`);
      await setDoc(doc(db, "users", uid), { uid, ...cleanData, createdAt: serverTimestamp() });
      console.log(`[createPortalUser] Document users/${uid} created successfully on attempt ${attempt}`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[createPortalUser] Attempt ${attempt}/${maxAttempts} failed for users/${uid}:`, err);
      if (attempt < maxAttempts) {
        const delay = attempt * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (auth?.currentUser && auth.currentUser.uid === uid) {
          try {
            await auth.currentUser.getIdToken(true);
          } catch {
            // ignore token refresh error on retry
          }
        }
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
  return deleteDoc(doc(db, "users", uid));
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

  return setDoc(doc(db, "settings", name), { ...data, updatedAt: serverTimestamp() }, { merge: true });
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
