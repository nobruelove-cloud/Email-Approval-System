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
  console.log("[DIAGNOSTIC LOGGING] initializing usePortalAuth hook...");
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState("");

  // Keep a reference to the active profile snapshot unsubscribe function
  const activeUnsubscribeProfile = useMemo(() => ({ current: null as (() => void) | null }), []);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    const firestore = db;
    let profileTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      console.log("[PortalAuth] Auth state changed:", user ? `UID: ${user.uid} (${user.email})` : "Null user");

      if (profileTimer) {
        clearTimeout(profileTimer);
        profileTimer = null;
      }

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

      console.log(`[PortalAuth] Registering Firestore snapshot listener for users/${user.uid}`);

      // Set a 10-second safety fallback timeout in case Firestore listener hangs
      profileTimer = setTimeout(() => {
        console.warn("[PortalAuth] Profile listener timeout reached (10s).");
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
          if (profileTimer) {
            clearTimeout(profileTimer);
            profileTimer = null;
          }

          console.log(
            `[PortalAuth] Profile snapshot fired for users/${user.uid}: exists=${snapshot.exists()}`,
          );

          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            console.warn("[PortalAuth] Snapshot fired but user is no longer active.");
            setProfile(null);
            setError("");
            setLoading(false);
            return;
          }

          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log("[PortalAuth] User profile retrieved successfully:", data);
            const normalizedRole = typeof data?.role === "string" ? data.role.trim().toLowerCase() : data?.role;
            setProfile({ uid: user.uid, ...data, role: normalizedRole } as PortalUser);
            setError("");
          } else {
            console.warn(`[PortalAuth] Document users/${user.uid} does NOT exist in Firestore.`);
            setProfile(null);
            setError("Profil pengguna tidak ditemukan di database.");
          }
          setLoading(false);
        },
        (reason) => {
          if (profileTimer) {
            clearTimeout(profileTimer);
            profileTimer = null;
          }

          console.error("[PortalAuth] Profile snapshot error:", reason);
          if (!auth?.currentUser || auth.currentUser.uid !== user.uid) {
            setProfile(null);
            setError("");
            setLoading(false);
            return;
          }

          const msg = reason instanceof Error ? reason.message : "Tidak bisa memuat profil Anda.";
          setError(msg);
          setLoading(false);
        },
      );

      activeUnsubscribeProfile.current = unsubscribe;
    });

    return () => {
      if (profileTimer) clearTimeout(profileTimer);
      if (activeUnsubscribeProfile.current) {
        activeUnsubscribeProfile.current();
        activeUnsubscribeProfile.current = null;
      }
      unsubscribeAuth();
    };
  }, [activeUnsubscribeProfile]);

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
 * Approving a submission sets status to "available" (stock) and credits the worker's balance
 * by `pricePerEmail` (from dynamic rules) in a single atomic transaction.
 * Rejecting sets status to "rejected" without crediting balance.
 * Prevents double crediting if status is not "pending".
 */
export async function reviewSubmission(
  submissionId: string,
  decision: "approved" | "rejected" | "available",
  reviewNote: string,
  pricePerEmail: number,
) {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  const newStatus: SubmissionStatus = decision === "approved" ? "available" : decision;

  await runTransaction(firestore, async (tx) => {
    const submissionRef = doc(firestore, "emailSubmissions", submissionId);
    const submissionSnap = await tx.get(submissionRef);
    if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
    const submission = submissionSnap.data() as EmailSubmission;
    if (submission.status !== "pending") {
      throw new Error("Setoran ini sudah pernah ditinjau.");
    }

    tx.update(submissionRef, {
      status: newStatus,
      reviewNote,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (newStatus === "available" || decision === "approved") {
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

export interface DiagnosticInfo {
  currentUserExists: boolean;
  uid: string | null;
  email: string | null;
  projectId: string | null;
  appId: string | null;
  authDomain: string | null;
  databaseId: string | null;
  documentPath: string;
  tokenRefreshSuccess: boolean | null;
  expirationTime: string | null;
  authTime: string | null;
  claims: Record<string, unknown> | null;
  setDocReached: boolean;
  errorCode: string | null;
  errorName: string | null;
  errorMessage: string | null;
  lastUpdated: string | null;
}

function getDatabaseId(): string {
  if (!db) return "N/A";
  const firestoreObj = db as unknown as Record<string, unknown>;
  if (firestoreObj._databaseId && typeof firestoreObj._databaseId === "object") {
    const dbIdObj = firestoreObj._databaseId as Record<string, unknown>;
    if (typeof dbIdObj.database === "string") return dbIdObj.database;
  }
  if (typeof firestoreObj.databaseId === "string") return firestoreObj.databaseId;
  return "(default)";
}

export function createInitialDiagnosticInfo(): DiagnosticInfo {
  const user = auth?.currentUser;
  return {
    currentUserExists: !!user,
    uid: user?.uid || null,
    email: user?.email || null,
    projectId: db?.app?.options?.projectId || null,
    appId: db?.app?.options?.appId || null,
    authDomain: db?.app?.options?.authDomain || null,
    databaseId: getDatabaseId(),
    documentPath: "settings/rules",
    tokenRefreshSuccess: null,
    expirationTime: null,
    authTime: null,
    claims: null,
    setDocReached: false,
    errorCode: null,
    errorName: null,
    errorMessage: null,
    lastUpdated: new Date().toISOString(),
  };
}

let currentDiagnosticInfo: DiagnosticInfo = createInitialDiagnosticInfo();
const diagnosticListeners = new Set<() => void>();

export function updateDiagnosticInfo(updates: Partial<DiagnosticInfo>) {
  currentDiagnosticInfo = {
    ...currentDiagnosticInfo,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  diagnosticListeners.forEach((listener) => listener());
}

export function useDiagnosticInfo(): DiagnosticInfo {
  const [info, setInfo] = useState<DiagnosticInfo>(() => {
    const user = auth?.currentUser;
    return {
      ...currentDiagnosticInfo,
      currentUserExists: !!user,
      uid: user?.uid || currentDiagnosticInfo.uid,
      email: user?.email || currentDiagnosticInfo.email,
      projectId: db?.app?.options?.projectId || currentDiagnosticInfo.projectId,
      appId: db?.app?.options?.appId || currentDiagnosticInfo.appId,
      authDomain: db?.app?.options?.authDomain || currentDiagnosticInfo.authDomain,
      databaseId: getDatabaseId(),
    };
  });

  useEffect(() => {
    const listener = () => setInfo({ ...currentDiagnosticInfo });
    diagnosticListeners.add(listener);
    return () => {
      diagnosticListeners.delete(listener);
    };
  }, []);

  return info;
}

export async function saveSettings(name: string, data: Record<string, unknown>) {
  const docPath = `settings/${name}`;
  const currentUser = auth?.currentUser;

  const baseDiagnostic: Partial<DiagnosticInfo> = {
    currentUserExists: !!currentUser,
    uid: currentUser?.uid || null,
    email: currentUser?.email || null,
    projectId: db?.app?.options?.projectId || null,
    appId: db?.app?.options?.appId || null,
    authDomain: db?.app?.options?.authDomain || null,
    databaseId: getDatabaseId(),
    documentPath: docPath,
  };

  updateDiagnosticInfo({
    ...baseDiagnostic,
    errorCode: null,
    errorName: null,
    errorMessage: null,
  });

  if (!db) {
    const errorMsg = "Firebase is not configured.";
    updateDiagnosticInfo({
      errorCode: "app/not-configured",
      errorName: "Error",
      errorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  if (!currentUser) {
    const errorMsg = "Sesi pengguna tidak ditemukan. Silakan masuk kembali.";
    console.error("[saveSettings] Cannot save settings: auth.currentUser is null.");
    updateDiagnosticInfo({
      errorCode: "auth/no-current-user",
      errorName: "Error",
      errorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  let tokenRefreshSuccess = false;
  let expirationTime: string | null = null;
  let authTime: string | null = null;
  let claims: Record<string, unknown> | null = null;

  try {
    const tokenResult = await currentUser.getIdTokenResult(true);
    tokenRefreshSuccess = true;
    expirationTime = tokenResult.expirationTime || null;
    authTime = tokenResult.authTime || null;
    if (tokenResult.claims) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...cleanClaims } = tokenResult.claims as Record<string, unknown>;
      claims = cleanClaims;
    }
  } catch (tokenErr) {
    tokenRefreshSuccess = false;
    console.warn("[saveSettings] Token refresh warning before setDoc:", tokenErr);
  }

  // Update diagnostic state immediately before setDoc()
  updateDiagnosticInfo({
    ...baseDiagnostic,
    tokenRefreshSuccess,
    expirationTime,
    authTime,
    claims,
    setDocReached: true,
  });

  try {
    const res = await setDoc(doc(db, "settings", name), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    updateDiagnosticInfo({
      errorCode: "NONE (SUCCESS)",
      errorName: "NONE",
      errorMessage: "NONE",
    });
    return res;
  } catch (err) {
    const errorCode = (err as { code?: string })?.code || "unknown";
    const errorName = err instanceof Error ? err.name : "Error";
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[saveSettings] Failed to save settings/${name}: Code=${errorCode}, Message=${errorMsg}`, err);

    updateDiagnosticInfo({
      errorCode,
      errorName,
      errorMessage: errorMsg,
    });

    throw err;
  }
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
