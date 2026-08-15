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
} from "@/lib/portal-types";

export function usePortalAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    const firestore = db;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
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

      unsubscribeProfile = onSnapshot(
        doc(firestore, "users", user.uid),
        (snapshot) => {
          if (!auth?.currentUser) {
            setProfile(null);
            setError("");
            setLoading(false);
            return;
          }
          setProfile(snapshot.exists() ? ({ uid: user.uid, ...snapshot.data() } as PortalUser) : null);
          setError("");
          setLoading(false);
        },
        (reason) => {
          if (!auth?.currentUser) {
            setProfile(null);
            setError("");
            setLoading(false);
            return;
          }
          setError(reason instanceof Error ? reason.message : "Tidak bisa memuat profil Anda.");
          setLoading(false);
        },
      );
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      unsubscribeAuth();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    setError("");
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("SignOut error:", err);
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
 * Approving a submission credits the worker's balance by `pricePerEmail`
 * (from the dynamic settings/rules doc) in a single atomic transaction, so a
 * submission can never be approved twice or credited without actually being
 * approved.
 */
export async function reviewSubmission(
  submissionId: string,
  decision: "approved" | "rejected",
  reviewNote: string,
  pricePerEmail: number,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await runTransaction(firestore, async (tx) => {
    const submissionRef = doc(firestore, "emailSubmissions", submissionId);
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
    const submission = submissionSnap.data() as EmailSubmission;
    if (submission.status !== "pending") {
      throw new Error("Setoran ini sudah pernah ditinjau.");
    }

    tx.update(submissionRef, {
      status: decision,
      reviewNote,
      reviewedAt: serverTimestamp(),
    });

    if (decision === "approved") {
      const userRef = doc(firestore, "users", submission.workerId);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists()) {
        const current = (userSnap.data() as PortalUser).balance ?? 0;
        tx.update(userRef, { balance: current + pricePerEmail });
      }
    }
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

    tx.update(withdrawalRef, { status, note, processedAt: serverTimestamp() });

    if (status === "rejected") {
      const userRef = doc(firestore, "users", withdrawal.workerId);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists()) {
        const current = (userSnap.data() as PortalUser).balance ?? 0;
        tx.update(userRef, { balance: current + withdrawal.amount });
      }
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
  return setDoc(doc(db, "users", uid), { uid, ...cleanData, createdAt: serverTimestamp() });
}

export async function createWorkerAccount(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  tier: 1 | 2 | 3;
  status: "pending" | "approved" | "rejected" | "inactive";
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
