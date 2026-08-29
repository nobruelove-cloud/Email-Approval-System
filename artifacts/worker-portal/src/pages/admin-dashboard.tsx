import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import {
  LogOut,
  Users,
  Wallet,
  FileText,
  Settings as SettingsIcon,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  UserPlus,
  Clock,
  Eye,
  Award,
  Sparkles,
  Plus,
  Gift,
  Target,
  Trophy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  Edit3,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  useAdminData,
  useCollection,
  useSettings,
  useFinancialData,
  addFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction,
  reviewSubmission,
  updateEmailStockStatus,
  reviewWithdrawal,
  updatePortalUser,
  deletePortalUser,
  createWorkerAccount,
  saveSettings,
  evaluateReferralQualification,
  approveReferral,
  rejectReferral,
  distributeLeaderboardReward,
  reviewMissionClaim,
} from "@/hooks/use-portal";
import { DEFAULT_RULES, DEFAULT_TIERS, DEFAULT_REFERRAL_TIERS, DEFAULT_OPERATING_HOURS, type EmailSubmission, type PortalUser, type TierConfig, type ReferralTierConfig, type UserStatus, type UserTier, type SupportConfig, type OperatingHoursConfig, type FinancialTransaction, type FinancialTransactionType } from "@/lib/portal-types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getItemCountOfSubmission,
  getRecommendedTier,
  getTierConfig,
  shortId,
  validateTierConfigs,
  getReferralRewardForAccCount,
  getReferralTierForAccCount,
  validateReferralTiers,
  isValidTelegramUrl,
  validateOperatingHours,
  getStartAndEndOfWeek,
  getWeeklyPeriodKey,
  getMonthlyPeriodKey,
  getDailyPeriodKey,
  formatMonthYear,
  getPeriodOptions,
} from "@/lib/portal-utils";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    processing: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    available: "bg-green-100 text-green-800",
    sold: "bg-green-100 text-green-800",
    success: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    pending: "Menunggu",
    processing: "Diproses",
    approved: "Terjual",
    available: "Terjual",
    sold: "Terjual",
    success: "Berhasil",
    rejected: "Ditolak",
    inactive: "Nonaktif",
  };
  return <Badge className={variants[status] ?? variants.pending}>{labels[status] ?? status}</Badge>;
}

export default function AdminDashboard({ profile, onLogout }: { profile: PortalUser; onLogout: () => void }) {
  const { users, submissions, withdrawals, referrals, rewardLedger } = useAdminData();

  useEffect(() => {
    const currentUser = auth?.currentUser;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
    const actualUid = currentUser?.uid || profile.uid;
    console.log("[REAL AUTH IDENTITY DIAGNOSTIC]", {
      authUid: actualUid,
      email: currentUser?.email || profile.email,
      projectId,
      profilePath: `users/${actualUid}`,
      profileExists: true,
      role: profile.role,
      status: profile.status,
      tier: profile.tier,
      balance: profile.balance,
      isAdmin: profile.role === "admin",
    });
  }, [profile]);
  const missionClaims = useCollection<{ id: string; workerId: string; missionId: string; periodKey: string; status: string; workerName?: string }>("missionClaims");
  const rules = useSettings("rules", DEFAULT_RULES);
  const [evaluatingRefs, setEvaluatingRefs] = useState(false);

  // --- Keuangan / Financial Tracking state ---
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => getMonthlyPeriodKey(new Date()));
  const { transactions: finTransactions, summary: finSummary, loading: finLoading, error: finError } = useFinancialData(selectedPeriod);

  const periodOptions = useMemo(() => {
    return getPeriodOptions(finTransactions, selectedPeriod);
  }, [finTransactions, selectedPeriod]);

  const [finModalOpen, setFinModalOpen] = useState(false);
  const [editingFinTx, setEditingFinTx] = useState<FinancialTransaction | null>(null);
  const [finType, setFinType] = useState<FinancialTransactionType>("income");
  const [finDescription, setFinDescription] = useState("");
  const [finAmount, setFinAmount] = useState<number>(0);
  const [finDate, setFinDate] = useState<string>(() => getDailyPeriodKey(new Date()));
  const [finNote, setFinNote] = useState("");
  const [finSaving, setFinSaving] = useState(false);
  const [deletingFinTxId, setDeletingFinTxId] = useState<string | null>(null);

  function openAddFinModal(type: FinancialTransactionType) {
    setEditingFinTx(null);
    setFinType(type);
    setFinDescription("");
    setFinAmount(0);
    setFinDate(getDailyPeriodKey(new Date()));
    setFinNote("");
    setFinModalOpen(true);
  }

  function openEditFinModal(tx: FinancialTransaction) {
    setEditingFinTx(tx);
    setFinType(tx.type);
    setFinDescription(tx.description);
    setFinAmount(tx.amount);
    setFinDate(getDailyPeriodKey(tx.transactionDate));
    setFinNote(tx.note ?? "");
    setFinModalOpen(true);
  }

  async function handleSaveFinTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!finDescription.trim()) {
      toast.error("Jenis/Keterangan transaksi wajib diisi.");
      return;
    }
    if (isNaN(finAmount) || finAmount <= 0) {
      toast.error("Jumlah transaksi harus berupa angka valid lebih besar dari 0.");
      return;
    }
    if (!finDate || isNaN(new Date(finDate).getTime())) {
      toast.error("Tanggal transaksi tidak valid.");
      return;
    }

    setFinSaving(true);
    try {
      if (editingFinTx) {
        await updateFinancialTransaction(editingFinTx.id, {
          type: finType,
          amount: finAmount,
          description: finDescription,
          note: finNote,
          transactionDate: finDate,
        });
        toast.success("Transaksi keuangan berhasil diperbarui.");
      } else {
        await addFinancialTransaction({
          type: finType,
          amount: finAmount,
          description: finDescription,
          note: finNote,
          transactionDate: finDate,
        });
        toast.success(`${finType === "income" ? "Pemasukan" : "Pengeluaran"} berhasil dicatat!`);
      }

      const targetPeriod = getMonthlyPeriodKey(finDate);
      if (targetPeriod !== selectedPeriod) {
        setSelectedPeriod(targetPeriod);
      }

      setFinModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan transaksi keuangan.");
    } finally {
      setFinSaving(false);
    }
  }

  async function handleDeleteFinTransaction(id: string) {
    setBusyId(id);
    try {
      await deleteFinancialTransaction(id);
      toast.success("Transaksi keuangan berhasil dihapus.");
      setDeletingFinTxId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus transaksi.");
    } finally {
      setBusyId(null);
    }
  }

  const pendingMissionClaims = useMemo(
    () => missionClaims.data.filter((c) => c.status === "pending"),
    [missionClaims.data],
  );

  async function handleReviewMission(claimId: string, decision: "approved" | "rejected") {
    setBusyId(claimId);
    try {
      await reviewMissionClaim(claimId, decision);
      toast.success(`Klaim misi berhasil ${decision === "approved" ? "disetujui & dicairkan" : "ditolak"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses klaim misi.");
    } finally {
      setBusyId(null);
    }
  }
  const activeTiersList = useMemo(() => {
    return Array.isArray(rules.data.tiers) && rules.data.tiers.length > 0 ? rules.data.tiers : DEFAULT_TIERS;
  }, [rules.data.tiers]);

  const activeReferralTiers = useMemo(() => {
    return Array.isArray(rules.data.referralTiers) && rules.data.referralTiers.length > 0
      ? rules.data.referralTiers
      : DEFAULT_REFERRAL_TIERS;
  }, [rules.data.referralTiers]);

  // Referral tier management state
  const [isAddingRefTier, setIsAddingRefTier] = useState(false);
  const [newRefMinAcc, setNewRefMinAcc] = useState<number | "">("");
  const [newRefReward, setNewRefReward] = useState<number | "">("");
  const [savingRefTiers, setSavingRefTiers] = useState(false);

  function handleRemoveReferralTier(index: number) {
    if (activeReferralTiers.length <= 1) {
      toast.error("Minimal harus ada 1 tier referral.");
      return;
    }
    const updated = activeReferralTiers.filter((_, idx) => idx !== index);
    const valErr = validateReferralTiers(updated);
    if (valErr) {
      toast.error(valErr);
      return;
    }
    saveSettings("rules", { referralTiers: updated }).then(() => {
      toast.success("Tier referral berhasil dihapus!");
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan tier referral.");
    });
  }

  async function handleAddReferralTierSubmit() {
    if (newRefMinAcc === "" || typeof newRefMinAcc !== "number" || newRefMinAcc <= 0) {
      toast.error("Minimal ACC harus berupa bilangan bulat positif.");
      return;
    }
    if (newRefReward === "" || typeof newRefReward !== "number" || newRefReward < 0) {
      toast.error("Reward harus berupa angka non-negatif.");
      return;
    }

    const newTier: ReferralTierConfig = {
      minAcc: newRefMinAcc,
      reward: newRefReward,
    };

    const updated = [...activeReferralTiers, newTier].sort((a, b) => a.minAcc - b.minAcc);
    const valErr = validateReferralTiers(updated);
    if (valErr) {
      toast.error(valErr);
      return;
    }

    setSavingRefTiers(true);
    try {
      await saveSettings("rules", { referralTiers: updated });
      toast.success("Tier referral baru berhasil ditambahkan!");
      setIsAddingRefTier(false);
      setNewRefMinAcc("");
      setNewRefReward("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambahkan tier referral.");
    } finally {
      setSavingRefTiers(false);
    }
  }

  // Support / Help Center configuration state
  const [supportTitle, setSupportTitle] = useState<string | null>(null);
  const [supportTelegramUrl, setSupportTelegramUrl] = useState<string | null>(null);
  const [supportDescription, setSupportDescription] = useState<string | null>(null);
  const [supportEnabled, setSupportEnabled] = useState<boolean | null>(null);
  const [savingSupport, setSavingSupport] = useState(false);

  const activeSupportConfig = useMemo(() => {
    return rules.data.supportConfig ?? DEFAULT_RULES.supportConfig!;
  }, [rules.data.supportConfig]);

  const currentSupportTitle = supportTitle ?? activeSupportConfig.title ?? "Customer Service";
  const currentSupportTelegramUrl = supportTelegramUrl ?? activeSupportConfig.telegramUrl ?? "";
  const currentSupportDescription = supportDescription ?? activeSupportConfig.description ?? "Ada kendala? Hubungi Customer Service kami melalui Telegram.";
  const currentSupportEnabled = supportEnabled ?? (activeSupportConfig.enabled !== false);

  // Jam Operasional configuration state
  const activeOperatingHours = useMemo(() => {
    return rules.data.operatingHours ?? DEFAULT_OPERATING_HOURS;
  }, [rules.data.operatingHours]);

  const [operatingHoursState, setOperatingHoursState] = useState<OperatingHoursConfig | null>(null);
  const [savingOperatingHours, setSavingOperatingHours] = useState(false);

  const currentOperatingHours = operatingHoursState ?? activeOperatingHours;

  function handleUpdateDayOperatingHours(
    dayKey: keyof OperatingHoursConfig["days"],
    field: "enabled" | "open" | "close",
    value: boolean | string
  ) {
    setOperatingHoursState({
      ...currentOperatingHours,
      days: {
        ...currentOperatingHours.days,
        [dayKey]: {
          ...currentOperatingHours.days[dayKey],
          [field]: value,
        },
      },
    });
  }

  function handleUpdateGlobalOperatingHours(enabled: boolean) {
    setOperatingHoursState({
      ...currentOperatingHours,
      enabled,
    });
  }

  async function handleSaveOperatingHours() {
    const valError = validateOperatingHours(currentOperatingHours);
    if (valError) {
      toast.error("Jam operasional tidak valid.");
      return;
    }

    setSavingOperatingHours(true);
    try {
      await saveSettings("rules", {
        ...rules.data,
        operatingHours: currentOperatingHours,
      });
      toast.success("Jam operasional berhasil disimpan.");
      setOperatingHoursState(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan jam operasional.");
    } finally {
      setSavingOperatingHours(false);
    }
  }

  async function handleSaveSupportConfig() {
    const trimmedUrl = currentSupportTelegramUrl.trim();
    if (!isValidTelegramUrl(trimmedUrl)) {
      toast.error("Masukkan link Telegram yang valid.");
      return;
    }

    setSavingSupport(true);
    try {
      const updatedSupportConfig: SupportConfig = {
        enabled: currentSupportEnabled,
        title: currentSupportTitle.trim() || "Customer Service",
        description: currentSupportDescription.trim() || "Ada kendala? Hubungi Customer Service kami melalui Telegram.",
        telegramUrl: trimmedUrl,
      };

      await saveSettings("rules", {
        ...rules.data,
        supportConfig: updatedSupportConfig,
      });

      toast.success("Pengaturan pusat bantuan berhasil disimpan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan pusat bantuan.");
    } finally {
      setSavingSupport(false);
    }
  }

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Detail submission modal & per-item status state
  const [detailSubmission, setDetailSubmission] = useState<EmailSubmission | null>(null);
  const [itemStatuses, setItemStatuses] = useState<Record<string, "pending" | "approved" | "rejected">>({});

  // Filter states
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("all");

  function openDetailModal(sub: EmailSubmission) {
    setDetailSubmission(sub);
    const initialStatuses: Record<string, "pending" | "approved" | "rejected"> = {};
    if (Array.isArray(sub.items) && sub.items.length > 0) {
      sub.items.forEach((it, idx) => {
        initialStatuses[idx] = it.status ?? (sub.status === "available" || sub.status === "approved" ? "approved" : sub.status === "rejected" ? "rejected" : "pending");
      });
    } else if (sub.email) {
      initialStatuses[0] = sub.status === "available" || sub.status === "approved" ? "approved" : sub.status === "rejected" ? "rejected" : "pending";
    }
    setItemStatuses(initialStatuses);
  }

  const workerMap = useMemo(() => {
    const map = new Map<string, PortalUser>();
    users.data.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users.data]);

  const workerName = (id: string) => workerMap.get(id)?.name ?? shortId(id);

  // Map worker accumulated approved item counts
  const workerApprovedQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    submissions.data.forEach((sub) => {
      const isApprovedOrStock = sub.status === "approved" || sub.status === "available" || sub.status === "sold";
      if (isApprovedOrStock) {
        const count = getItemCountOfSubmission(sub);
        const current = map.get(sub.workerId) ?? 0;
        map.set(sub.workerId, current + count);
      }
    });
    return map;
  }, [submissions.data]);

  const stats = useMemo(() => {
    const totalWorkers = users.data.filter((u) => u.role === "worker").length;
    const pendingWorkers = users.data.filter((u) => u.role === "worker" && u.status === "pending").length;
    const activeWorkers = users.data.filter((u) => u.role === "worker" && (u.status === "approved" || u.status === "active")).length;
    const totalBalance = users.data.reduce((sum, u) => sum + (u.balance ?? 0), 0);
    const totalSubmissions = submissions.data.length;
    const pendingSubmissions = submissions.data.filter((s) => s.status === "pending").length;
    const availableStock = submissions.data.reduce((sum, s) => {
      if (s.status === "available" || s.status === "approved") {
        return sum + getItemCountOfSubmission(s);
      }
      return sum;
    }, 0);
    const soldStock = submissions.data.reduce((sum, s) => {
      if (s.status === "sold") {
        return sum + getItemCountOfSubmission(s);
      }
      return sum;
    }, 0);
    const pendingWithdrawals = withdrawals.data.filter((w) => w.status === "pending" || w.status === "processing").length;
    const pendingWithdrawalAmount = withdrawals.data
      .filter((w) => w.status === "pending" || w.status === "processing")
      .reduce((sum, w) => sum + w.amount, 0);
    const totalPaidOut = withdrawals.data
      .filter((w) => w.status === "success")
      .reduce((sum, w) => sum + w.amount, 0);

    return {
      totalWorkers,
      pendingWorkers,
      activeWorkers,
      totalBalance,
      totalSubmissions,
      pendingSubmissions,
      availableStock,
      soldStock,
      pendingWithdrawals,
      pendingWithdrawalAmount,
      totalPaidOut,
    };
  }, [users.data, submissions.data, withdrawals.data]);

  async function handleFinalizeBatchReview(sub: EmailSubmission) {
    setBusyId(sub.id);
    try {
      const baseItems = Array.isArray(sub.items) && sub.items.length > 0
        ? sub.items
        : sub.email
          ? [{ email: sub.email, password: sub.password }]
          : [];

      const updatedItems = baseItems.map((it, idx) => ({
        ...it,
        status: itemStatuses[idx] ?? "pending",
      }));

      const approvedCount = updatedItems.filter((it) => it.status === "approved").length;
      const rejectedCount = updatedItems.filter((it) => it.status === "rejected").length;

      // Determine resulting Tier and price per item based ONLY on final ACC/valid count
      const recTierCfg = getRecommendedTier(approvedCount, activeTiersList);
      const pricePerItem = recTierCfg.pricePerItem;
      const totalCredit = approvedCount * pricePerItem;

      const decision = approvedCount > 0 ? "approved" : "rejected";

      await reviewSubmission(
        sub.id,
        decision,
        notes[sub.id] ?? "",
        pricePerItem,
        recTierCfg.tier,
        updatedItems,
      );

      // Auto-evaluate referral qualification for worker if they have a pending referral
      if (approvedCount > 0) {
        evaluateReferralQualification(sub.workerId).catch((e) =>
          console.warn("[AdminDashboard] Referral auto-eval notice:", e)
        );
      }

      toast.success(
        `Finalisasi batch berhasil! ${approvedCount} ACC (${recTierCfg.name}), ${rejectedCount} ditolak. Saldo dicairkan: ${formatMoney(totalCredit)}.`,
      );
      setDetailSubmission(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses setoran.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStockStatusChange(id: string, status: "available" | "sold" | "rejected") {
    setBusyId(id);
    try {
      await updateEmailStockStatus(id, status, notes[id] ?? undefined);
      toast.success(`Status stok email berhasil diubah.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status stok.");
    } finally {
      setBusyId(null);
    }
  }

  const filteredSubmissions = useMemo(() => {
    return submissions.data.filter((item) => {
      const wName = (item.workerName || workerName(item.workerId)).toLowerCase();
      const search = submissionSearch.toLowerCase().trim();
      const firstEmail = item.items?.[0]?.email ?? item.email ?? "";
      const matchesSearch =
        !search ||
        firstEmail.toLowerCase().includes(search) ||
        item.workerId.toLowerCase().includes(search) ||
        wName.includes(search);

      let matchesStatus = true;
      if (submissionStatusFilter !== "all") {
        if (submissionStatusFilter === "available") {
          matchesStatus = item.status === "available" || item.status === "approved";
        } else {
          matchesStatus = item.status === submissionStatusFilter;
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [submissions.data, submissionSearch, submissionStatusFilter, workerName]);

  async function handleWithdrawalDecision(id: string, status: "processing" | "success" | "rejected") {
    setBusyId(id);
    try {
      await reviewWithdrawal(id, status, notes[id] ?? "");
      toast.success(
        status === "rejected"
          ? "Penarikan ditolak, saldo pekerja dikembalikan."
          : status === "success"
            ? "Penarikan ditandai berhasil."
            : "Penarikan sedang diproses.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses penarikan.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUserStatus(uid: string, status: UserStatus) {
    setBusyId(uid);
    try {
      await updatePortalUser(uid, { status });
      toast.success("Status pekerja diperbarui.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUserTier(uid: string, tier: UserTier) {
    try {
      await updatePortalUser(uid, { tier });
      toast.success("Tier pekerja berhasil diperbarui!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui tier.");
    }
  }

  async function handleDeleteUser(uid: string) {
    setBusyId(uid);
    try {
      await deletePortalUser(uid);
      toast.success("Data pekerja dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pekerja.");
    } finally {
      setBusyId(null);
    }
  }

  // --- Add worker dialog ---
  const [addOpen, setAddOpen] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: "", email: "", phone: "", password: "", tier: "1" });
  const [addBusy, setAddBusy] = useState(false);

  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorker.name.trim() || !newWorker.email.trim() || newWorker.password.length < 6) {
      toast.error("Nama, email, dan kata sandi (min. 6 karakter) wajib diisi.");
      return;
    }
    setAddBusy(true);
    try {
      await createWorkerAccount({
        name: newWorker.name.trim(),
        email: newWorker.email.trim(),
        password: newWorker.password,
        phone: newWorker.phone.trim() || undefined,
        tier: Number(newWorker.tier),
        status: "active",
        balance: 0,
      });
      toast.success("Akun pekerja berhasil dibuat.");
      setNewWorker({ name: "", email: "", phone: "", password: "", tier: "1" });
      setAddOpen(false);
    } catch (err) {
      console.error("[AdminDashboard] Add worker error:", err);
      const code = (err as { code?: string })?.code ?? "";
      const errMsg = err instanceof Error ? err.message : String(err);
      if (code === "auth/email-already-in-use" || errMsg.includes("email-already-in-use")) {
        toast.error("Email sudah terdaftar.");
      } else {
        toast.error(errMsg || "Gagal membuat akun pekerja.");
      }
    } finally {
      setAddBusy(false);
    }
  }

  // --- Rules & Tiers editor ---
  const [rulesDraft, setRulesDraft] = useState<{
    pricePerEmail: number;
    withdrawFeePercent: number;
    minWithdraw: number;
    maxWithdraw: number;
    paymentMethodsStr: string;
    submissionNotesText: string;
    tiers: TierConfig[];
  } | null>(null);

  const activePricePerEmail = rulesDraft !== null ? rulesDraft.pricePerEmail : rules.data.pricePerEmail;
  const activeWithdrawFeePercent = rulesDraft !== null ? rulesDraft.withdrawFeePercent : rules.data.withdrawFeePercent;
  const activeMinWithdraw = rulesDraft !== null ? rulesDraft.minWithdraw : rules.data.minWithdraw;
  const activeMaxWithdraw = rulesDraft !== null ? rulesDraft.maxWithdraw : rules.data.maxWithdraw;
  const activePaymentMethodsStr =
    rulesDraft !== null
      ? rulesDraft.paymentMethodsStr
      : Array.isArray(rules.data.paymentMethods)
        ? rules.data.paymentMethods.join(", ")
        : String(rules.data.paymentMethods ?? "");
  const activeSubmissionNotesText =
    rulesDraft !== null
      ? rulesDraft.submissionNotesText
      : Array.isArray(rules.data.submissionNotes)
        ? rules.data.submissionNotes.join("\n")
        : String(rules.data.submissionNotes ?? "");
  const activeTiers = rulesDraft !== null ? rulesDraft.tiers : activeTiersList;

  const [savingRules, setSavingRules] = useState(false);

  function handleAddTierConfig() {
    const nextNum = activeTiers.length + 1;
    const lastMax = activeTiers.length > 0 ? activeTiers[activeTiers.length - 1].maxQty : 0;
    const newTierItem: TierConfig = {
      tier: nextNum,
      name: `Tier ${nextNum}`,
      minQty: lastMax + 1,
      maxQty: lastMax + 10,
      pricePerItem: 3500,
    };

    setRulesDraft({
      pricePerEmail: activePricePerEmail,
      withdrawFeePercent: activeWithdrawFeePercent,
      minWithdraw: activeMinWithdraw,
      maxWithdraw: activeMaxWithdraw,
      paymentMethodsStr: activePaymentMethodsStr,
      submissionNotesText: activeSubmissionNotesText,
      tiers: [...activeTiers, newTierItem],
    });
  }

  function handleUpdateTierConfig(index: number, field: keyof TierConfig, value: unknown) {
    const updated = activeTiers.map((t, idx) => (idx === index ? { ...t, [field]: value } : t));
    setRulesDraft({
      pricePerEmail: activePricePerEmail,
      withdrawFeePercent: activeWithdrawFeePercent,
      minWithdraw: activeMinWithdraw,
      maxWithdraw: activeMaxWithdraw,
      paymentMethodsStr: activePaymentMethodsStr,
      submissionNotesText: activeSubmissionNotesText,
      tiers: updated,
    });
  }

  function handleRemoveTierConfig(index: number) {
    if (activeTiers.length <= 1) {
      toast.error("Minimal harus ada 1 tier konfigurasi.");
      return;
    }
    const updated = activeTiers.filter((_, idx) => idx !== index);
    setRulesDraft({
      pricePerEmail: activePricePerEmail,
      withdrawFeePercent: activeWithdrawFeePercent,
      minWithdraw: activeMinWithdraw,
      maxWithdraw: activeMaxWithdraw,
      paymentMethodsStr: activePaymentMethodsStr,
      submissionNotesText: activeSubmissionNotesText,
      tiers: updated,
    });
  }

  async function handleSaveRules() {
    const tierValError = validateTierConfigs(activeTiers);
    if (tierValError) {
      toast.error(tierValError);
      return;
    }

    setSavingRules(true);
    try {
      const parsedPaymentMethods = activePaymentMethodsStr
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const parsedSubmissionNotes = activeSubmissionNotesText
        .split("\n")
        .filter((line) => line !== undefined && line !== null);

      const updatedRules = {
        pricePerEmail: Number(activePricePerEmail) || 0,
        withdrawFeePercent: Number(activeWithdrawFeePercent) || 0,
        minWithdraw: Number(activeMinWithdraw) || 0,
        maxWithdraw: Number(activeMaxWithdraw) || 0,
        paymentMethods: parsedPaymentMethods,
        submissionNotes: parsedSubmissionNotes,
        tiers: activeTiers,
      };

      await saveSettings("rules", updatedRules);
      toast.success("Aturan & Konfigurasi Tier berhasil diperbarui!");
      setRulesDraft(null);
    } catch (err) {
      console.error("[AdminDashboard] Error saving rules:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan aturan.");
    } finally {
      setSavingRules(false);
    }
  }

  async function handleEvaluateReferrals() {
    setEvaluatingRefs(true);
    try {
      let count = 0;
      for (const refItem of referrals.data) {
        if (refItem.status === "PENDING" || refItem.status === "QUALIFIED") {
          await evaluateReferralQualification(refItem.referredWorkerId);
          count++;
        }
      }
      toast.success(`Evaluasi referral selesai! ${count} data referral diperiksa.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengevaluasi referral.");
    } finally {
      setEvaluatingRefs(false);
    }
  }

  async function handleApproveReferral(refId: string) {
    setBusyId(refId);
    try {
      await approveReferral(refId);
      toast.success("Referral berhasil disetujui & hadiah telah dicairkan ke pengundang!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyetujui referral.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectReferral(refId: string) {
    setBusyId(refId);
    try {
      await rejectReferral(refId, "Ditolak oleh admin");
      toast.success("Referral berhasil ditolak.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menolak referral.");
    } finally {
      setBusyId(null);
    }
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">Dashboard Admin</p>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
          <Button variant="outline" size="icon" onClick={onLogout} title="Keluar">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full mb-6">
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
            <TabsTrigger value="finance" className="gap-1 text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5" /> Keuangan
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" /> Batch & Stok
              {stats.pendingSubmissions > 0 && (
                <span className="ml-0.5 text-[10px] bg-red-500 text-white rounded-full px-1.5">{stats.pendingSubmissions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-1 text-xs">
              <Wallet className="w-3.5 h-3.5" /> Penarikan
              {stats.pendingWithdrawals > 0 && (
                <span className="ml-0.5 text-[10px] bg-red-500 text-white rounded-full px-1.5">{stats.pendingWithdrawals}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="workers" className="text-xs">
              <Users className="w-3.5 h-3.5" /> Pekerja
            </TabsTrigger>
            <TabsTrigger value="rewards" className="text-xs">
              <Gift className="w-3.5 h-3.5" /> Hadiah & Fitur
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">
              <SettingsIcon className="w-3.5 h-3.5" /> Aturan & Tier
            </TabsTrigger>
          </TabsList>

          {/* RINGKASAN */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Pekerja", value: stats.totalWorkers },
                { label: "Pekerja Menunggu", value: stats.pendingWorkers },
                { label: "Pekerja Aktif", value: stats.activeWorkers },
                { label: "Total Saldo Beredar", value: formatMoney(stats.totalBalance) },
                { label: "Total Batch Setoran", value: stats.totalSubmissions },
                { label: "Batch Menunggu Review", value: stats.pendingSubmissions },
                { label: "Stok Email Tersedia", value: `${stats.availableStock} item` },
                { label: "Stok Email Terjual", value: `${stats.soldStock} item` },
                { label: "Penarikan Menunggu", value: `${stats.pendingWithdrawals} (${formatMoney(stats.pendingWithdrawalAmount)})` },
                { label: "Total Dicairkan", value: formatMoney(stats.totalPaidOut) },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB KEUANGAN ADMIN */}
          <TabsContent value="finance" className="space-y-6">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-gray-900">
                      <DollarSign className="w-5 h-5 text-amber-600" /> Keuangan
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Laporan pemasukan, pengeluaran, dan saldo bersih per periode bulanan ({formatMonthYear(selectedPeriod)}).
                    </CardDescription>
                  </div>

                  {/* FILTER PERIODE BULAN */}
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 shrink-0">
                    <Calendar className="w-4 h-4 text-gray-500 ml-1" />
                    <Label className="text-xs font-semibold text-gray-700">Periode:</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="h-8 w-44 text-xs font-bold bg-white border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* RINGKASAN SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-green-50/80 border border-green-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-green-800">Pemasukan</span>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xl font-black text-green-700">{formatMoney(finSummary.totalIncome)}</p>
                    <p className="text-[11px] text-green-600/80">Periode {formatMonthYear(selectedPeriod)}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-red-50/80 border border-red-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-800">Pengeluaran</span>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-xl font-black text-red-700">{formatMoney(finSummary.totalExpense)}</p>
                    <p className="text-[11px] text-red-600/80">Periode {formatMonthYear(selectedPeriod)}</p>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-1 ${finSummary.netBalance >= 0 ? "bg-amber-50/80 border-amber-200/80 text-amber-900" : "bg-rose-50/80 border-rose-200/80 text-rose-900"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Saldo Bersih</span>
                      <Wallet className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className={`text-xl font-black ${finSummary.netBalance >= 0 ? "text-amber-700" : "text-rose-700"}`}>
                      {formatMoney(finSummary.netBalance)}
                    </p>
                    <p className="text-[11px] text-gray-500">Pemasukan - Pengeluaran</p>
                  </div>
                </div>

                {/* ACTION BUTTONS: CATAT PEMASUKAN & PENGELUARAN */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                  <div className="text-sm font-bold text-gray-900">
                    Riwayat Keuangan — {formatMonthYear(selectedPeriod)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openAddFinModal("income")}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 gap-1.5 shadow-sm"
                    >
                      <PlusCircle className="w-4 h-4" /> Catat Pemasukan
                    </Button>
                    <Button
                      onClick={() => openAddFinModal("expense")}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 gap-1.5 shadow-sm"
                    >
                      <MinusCircle className="w-4 h-4" /> Catat Pengeluaran
                    </Button>
                  </div>
                </div>

                {/* DAFTAR TRANSAKSI KEUANGAN */}
                {finLoading && <p className="text-sm text-gray-400 text-center py-8">Memuat laporan keuangan...</p>}
                {finError && (
                  <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-xs text-center rounded-lg">
                    Gagal memuat laporan keuangan. Silakan coba lagi.
                  </div>
                )}
                {!finLoading && !finError && finTransactions.length === 0 && (
                  <div className="p-10 border border-dashed border-gray-200 text-center rounded-xl bg-gray-50/50 space-y-1">
                    <p className="text-sm font-semibold text-gray-600">Belum ada transaksi pada periode ini.</p>
                    <p className="text-xs text-gray-400">Gunakan tombol di atas untuk mencatat pemasukan atau pengeluaran manual.</p>
                  </div>
                )}
                {!finLoading && !finError && finTransactions.length > 0 && (
                  <div className="space-y-3">
                    {finTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 hover:border-gray-300 transition-colors shadow-2xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 break-words">{tx.description}</span>
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold ${
                                  isIncome
                                    ? "bg-green-50 text-green-800 border-green-300"
                                    : "bg-red-50 text-red-800 border-red-300"
                                }`}
                              >
                                {isIncome ? "Pemasukan" : "Pengeluaran"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>Tanggal: {formatDate(tx.transactionDate)}</span>
                              {tx.note && <span className="italic truncate max-w-xs">Catatan: {tx.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-base font-black ${isIncome ? "text-green-600" : "text-red-600"}`}>
                              {isIncome ? "+" : "-"} {formatMoney(tx.amount)}
                            </span>

                            <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditFinModal(tx)}
                                className="h-8 w-8 text-gray-500 hover:text-amber-700 hover:bg-amber-50"
                                title="Edit Transaksi"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>

                              <AlertDialog
                                open={deletingFinTxId === tx.id}
                                onOpenChange={(open) => setDeletingFinTxId(open ? tx.id : null)}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Transaksi Keuangan?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Apakah Anda yakin ingin menghapus transaksi "{tx.description}" ({formatMoney(tx.amount)})?
                                      Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteFinTransaction(tx.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Hapus Transaksi
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DIALOG TAMBAH / EDIT TRANSAKSI KEUANGAN */}
            <Dialog open={finModalOpen} onOpenChange={setFinModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingFinTx ? "Edit Transaksi Keuangan" : finType === "income" ? "Catat Pemasukan" : "Catat Pengeluaran"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingFinTx ? "Perbarui detail transaksi keuangan." : "Masukkan detail transaksi keuangan untuk laporan bulanan."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveFinTransaction} className="space-y-4 pt-2">
                  <div>
                    <Label className="text-xs">Tipe Transaksi</Label>
                    <Select
                      value={finType}
                      onValueChange={(val: FinancialTransactionType) => setFinType(val)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income" className="text-xs font-semibold text-green-700">
                          Pemasukan (+)
                        </SelectItem>
                        <SelectItem value="expense" className="text-xs font-semibold text-red-700">
                          Pengeluaran (-)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fin-desc" className="text-xs">Jenis / Keterangan Transaksi *</Label>
                    <Input
                      id="fin-desc"
                      placeholder={finType === "income" ? "Contoh: Penjualan Storage Gmail" : "Contoh: Pembayaran Worker / Biaya Operasional"}
                      value={finDescription}
                      onChange={(e) => setFinDescription(e.target.value)}
                      className="mt-1 h-9 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-amount" className="text-xs">Jumlah Nominal (Rp) *</Label>
                    <FormattedNumberInput
                      id="fin-amount"
                      value={finAmount}
                      onChange={(val) => setFinAmount(val)}
                      placeholder="Contoh: 500.000"
                      className="mt-1 h-9 text-xs font-bold"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-date" className="text-xs">Tanggal Transaksi *</Label>
                    <Input
                      id="fin-date"
                      type="date"
                      value={finDate}
                      onChange={(e) => setFinDate(e.target.value)}
                      className="mt-1 h-9 text-xs font-mono"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Periode otomatis ditentukan berdasarkan tanggal ({getMonthlyPeriodKey(finDate)}).
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="fin-note" className="text-xs">Catatan Tambahan (opsional)</Label>
                    <Input
                      id="fin-note"
                      placeholder="Contoh: Pembayaran customer via DANA / Invoice #102"
                      value={finNote}
                      onChange={(e) => setFinNote(e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFinModalOpen(false)}
                      className="text-xs h-9"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={finSaving}
                      className={`${finType === "income" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white text-xs h-9 gap-1.5`}
                    >
                      {finSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {editingFinTx ? "Simpan Perubahan" : "Simpan Transaksi"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* KELOLA BATCH SETORAN & STOK EMAIL */}
          <TabsContent value="submissions" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Cari email, ID pekerja, atau nama..."
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                className="text-xs h-9 flex-1"
              />
              <Select value={submissionStatusFilter} onValueChange={setSubmissionStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                  <SelectItem value="available">Stok Tersedia / Terjual</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submissions.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!submissions.loading && filteredSubmissions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Tidak ada data setoran / batch email.</p>
            )}
            {filteredSubmissions.map((item) => {
              const count = getItemCountOfSubmission(item);
              const workerObj = workerMap.get(item.workerId);
              const displayWorkerName = item.workerName || workerObj?.name || shortId(item.workerId);

              const isFinalized = item.status !== "pending";
              const approvedCount = item.approvedItemCount ?? (item.status === "available" || item.status === "approved" || item.status === "sold" ? count : 0);
              const rejectedCount = item.rejectedItemCount ?? (item.status === "rejected" ? count : 0);

              const tierNum = item.appliedTier ?? item.currentTier ?? workerObj?.tier ?? 1;
              const tierCfg = getTierConfig(tierNum, activeTiersList);
              const pricePerItem = item.appliedPricePerItem ?? item.currentPricePerItem ?? tierCfg.pricePerItem;
              const totalVal = item.totalAmount ?? (approvedCount * pricePerItem);

              return (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-base text-gray-900">{displayWorkerName}</p>
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                            {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                          </Badge>
                        </div>
                        {isFinalized ? (
                          <div className="text-xs text-gray-600 font-medium flex flex-wrap items-center gap-2">
                            <span>Disetujui (ACC): <strong className="text-green-700">{approvedCount}</strong>/{count}</span>
                            <span>·</span>
                            <span>Ditolak: <strong className="text-red-700">{rejectedCount}</strong></span>
                            <span>·</span>
                            <span>Total Payout: <strong className="text-amber-700">{formatMoney(totalVal)}</strong></span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 font-medium">
                            <strong>{count} email disetorkan</strong> · Estimasi Awal: <span className="text-amber-700 font-bold">{formatMoney(count * pricePerItem)}</span>
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetailModal(item)}
                          className="text-xs h-7 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> {item.status === "pending" ? "Tinjau Per Email" : "Lihat Detail"}
                        </Button>
                      </div>
                    </div>

                    {item.status !== "pending" && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                        <span>Status Stok:</span>
                        {(item.status === "available" || item.status === "approved") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            onClick={() => handleStockStatusChange(item.id, "sold")}
                            className="h-7 text-xs bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                          >
                            Tandai Terjual (Sold)
                          </Button>
                        )}
                        {item.status === "sold" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            onClick={() => handleStockStatusChange(item.id, "available")}
                            className="h-7 text-xs bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                          >
                            Kembalikan ke Stok Tersedia
                          </Button>
                        )}
                        {item.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === item.id}
                            onClick={() => handleStockStatusChange(item.id, "rejected")}
                            className="h-7 text-xs text-red-600 hover:bg-red-50"
                          >
                            Nonaktifkan / Tolak
                          </Button>
                        )}
                      </div>
                    )}

                    {item.reviewNote && <p className="text-xs text-gray-500 mt-2 italic">Catatan: {item.reviewNote}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* KELOLA PENARIKAN */}
          <TabsContent value="withdrawals" className="space-y-3">
            {withdrawals.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!withdrawals.loading && withdrawals.data.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada penarikan.</p>
            )}
            {withdrawals.data.map((item) => {
              const holderName = item.accountHolderName ?? item.accountName ?? "Belum tersedia";
              return (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-bold text-base text-gray-900">{item.method}</p>
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                          <p>Pekerja: <strong className="text-gray-900">{workerName(item.workerId)}</strong></p>
                          <p>No. Rekening / Wallet: <strong className="text-gray-900">{item.account}</strong></p>
                          <p>Atas Nama: <strong className="text-gray-900">{holderName}</strong></p>
                          <p>Jumlah: <strong className="text-amber-700 font-bold">{formatMoney(item.amount)}</strong></p>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          #{shortId(item.id)} · {formatDateTime(item.requestedAt)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  {(item.status === "pending" || item.status === "processing") && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Input
                        placeholder="Catatan (opsional)"
                        value={notes[item.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="text-xs h-9 min-w-[140px] flex-1"
                      />
                      {item.status === "pending" && (
                        <Button
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => handleWithdrawalDecision(item.id, "processing")}
                          className="bg-blue-600 hover:bg-blue-700 gap-1 shrink-0"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Proses
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleWithdrawalDecision(item.id, "success")}
                        className="bg-green-600 hover:bg-green-700 gap-1 shrink-0"
                      >
                        {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Selesai
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === item.id}
                        onClick={() => handleWithdrawalDecision(item.id, "rejected")}
                        className="gap-1 shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </Button>
                    </div>
                  )}
                  {item.note && <p className="text-xs text-gray-500 mt-2 italic">Catatan: {item.note}</p>}
                </CardContent>
              </Card>
              );
            })}
          </TabsContent>

          {/* KELOLA PEKERJA (WITH TIER & RECOMMENDATIONS) */}
          <TabsContent value="workers" className="space-y-3">
            <div className="flex justify-end">
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-amber-600 hover:bg-amber-700 gap-2">
                    <UserPlus className="w-4 h-4" /> Tambah Pekerja
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Pekerja Baru</DialogTitle>
                    <DialogDescription>Akun akan langsung berstatus aktif.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddWorker} className="space-y-3">
                    <div>
                      <Label>Nama</Label>
                      <Input
                        value={newWorker.name}
                        onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newWorker.email}
                        onChange={(e) => setNewWorker((p) => ({ ...p, email: e.target.value }))}
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label>Nomor HP (opsional)</Label>
                      <Input
                        value={newWorker.phone}
                        onChange={(e) => setNewWorker((p) => ({ ...p, phone: e.target.value }))}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kata Sandi</Label>
                        <Input
                          type="password"
                          value={newWorker.password}
                          onChange={(e) => setNewWorker((p) => ({ ...p, password: e.target.value }))}
                          className="mt-1.5"
                          required
                        />
                      </div>
                      <div>
                        <Label>Tier Awal</Label>
                        <Select value={newWorker.tier} onValueChange={(v) => setNewWorker((p) => ({ ...p, tier: v }))}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activeTiersList.map((t) => (
                              <SelectItem key={t.tier} value={String(t.tier)}>
                                {t.name} ({formatMoney(t.pricePerItem)}/item)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={addBusy} className="bg-amber-600 hover:bg-amber-700 gap-2 w-full">
                        {addBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buat Akun
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {users.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {users.data
              .filter((u) => u.role === "worker")
              .map((u) => {
                const currentTierCfg = getTierConfig(u.tier ?? 1, activeTiersList);
                const approvedCount = workerApprovedQtyMap.get(u.uid) ?? 0;
                const recTierCfg = getRecommendedTier(approvedCount, activeTiersList);
                const needsTierChange = Number(recTierCfg.tier) !== Number(currentTierCfg.tier);

                return (
                  <Card key={u.uid}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900">{u.name}</p>
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                              {currentTierCfg.name} ({formatMoney(currentTierCfg.pricePerItem)}/item)
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                          <div className="flex gap-3 text-xs text-gray-600 mt-1">
                            <span>Total Item Disetujui: <strong>{approvedCount} item</strong></span>
                            <span>Saldo: <strong className="text-amber-700">{formatMoney(u.balance ?? 0)}</strong></span>
                          </div>
                        </div>
                        <StatusBadge status={u.status} />
                      </div>

                      {/* Tier Recommendation Notice */}
                      {needsTierChange && (
                        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>
                              Rekomendasi Tier: <strong>{recTierCfg.name}</strong> ({formatMoney(recTierCfg.pricePerItem)}/item) berdasarkan {approvedCount} item disetujui.
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUserTier(u.uid, recTierCfg.tier)}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-[11px] shrink-0"
                          >
                            Terapkan {recTierCfg.name}
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>Set Tier Manual:</span>
                          <Select value={String(u.tier)} onValueChange={(v) => handleUserTier(u.uid, Number(v))}>
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeTiersList.map((t) => (
                                <SelectItem key={t.tier} value={String(t.tier)}>
                                  {t.name} ({formatMoney(t.pricePerItem)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {u.status === "pending" && (
                          <>
                            <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="bg-green-600 hover:bg-green-700 h-8">
                              Setujui
                            </Button>
                            <Button size="sm" variant="destructive" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "rejected")} className="h-8">
                              Tolak
                            </Button>
                          </>
                        )}
                        {(u.status === "approved" || u.status === "active") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "inactive")} className="h-8">
                            Nonaktifkan
                          </Button>
                        )}
                        {(u.status === "inactive" || u.status === "rejected") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="h-8">
                            Aktifkan
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 ml-auto">
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus data pekerja ini?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ini menghapus profil "{u.name}" dari Firestore.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.uid)} className="bg-red-600 hover:bg-red-700">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          {/* PENGATURAN HADIAH & ENGAGEMENT FEATURES */}
          <TabsContent value="rewards" className="space-y-6">
            {/* PENDING MISSION CLAIMS REVIEW */}
            {pendingMissionClaims.length > 0 && (
              <Card className="border-amber-300 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600" /> Klaim Misi Menunggu Review ({pendingMissionClaims.length})
                  </CardTitle>
                  <CardDescription>
                    Pekerja mengajukan klaim misi. Verifikasi dan setujui untuk mencairkan saldo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingMissionClaims.map((claim) => (
                    <div key={claim.id} className="p-3 bg-white border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-900">{claim.workerName || workerName(claim.workerId)}</p>
                        <p className="text-gray-500 mt-0.5">Misi ID: {claim.missionId} · Periode: {claim.periodKey}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={busyId === claim.id}
                          onClick={() => handleReviewMission(claim.id, "approved")}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1"
                        >
                          {busyId === claim.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === claim.id}
                          onClick={() => handleReviewMission(claim.id, "rejected")}
                          className="text-xs h-8 gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* REFERRAL APPROVAL & CONTROL */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-600" /> Pengaturan & Approval Referral
                    </CardTitle>
                    <CardDescription>
                      Atur tier kualifikasi referral, kelola approval referral qualified, dan cairkan hadiah ke pengundang.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleEvaluateReferrals}
                    disabled={evaluatingRefs}
                    className="bg-amber-600 hover:bg-amber-700 text-xs gap-1.5 shrink-0"
                  >
                    {evaluatingRefs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Evaluasi Referral
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* TIER REWARD REFERRAL CONFIGURATION */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-bold text-gray-900">Tier Reward Referral</Label>
                      <p className="text-xs text-gray-500">Atur syarat minimal ACC dan hadiah reward untuk setiap tier referral.</p>
                    </div>
                    {!isAddingRefTier && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingRefTier(true)}
                        className="gap-1 text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Tier
                      </Button>
                    )}
                  </div>

                  {/* TABLE DISPLAY */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                        <tr>
                          <th className="px-3 py-2">Minimal ACC</th>
                          <th className="px-3 py-2">Reward</th>
                          <th className="px-3 py-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeReferralTiers.map((t, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 font-bold text-gray-900">{t.minAcc} ACC</td>
                            <td className="px-3 py-2.5 font-bold text-amber-700">{formatMoney(t.reward)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveReferralTier(idx)}
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* + TAMBAH TIER FORM */}
                  {isAddingRefTier && (
                    <Card className="border-amber-200 bg-amber-50/40">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-xs font-bold text-amber-900">Tambah Tier Referral Baru</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Minimal ACC</Label>
                            <Input
                              type="number"
                              placeholder="Contoh: 100"
                              value={newRefMinAcc}
                              onChange={(e) => setNewRefMinAcc(e.target.value === "" ? "" : Number(e.target.value))}
                              className="mt-1 h-8 text-xs bg-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reward (Rp)</Label>
                            <FormattedNumberInput
                              value={newRefReward === "" ? 0 : newRefReward}
                              onChange={(val) => setNewRefReward(val)}
                              placeholder="Contoh: 10000"
                              className="mt-1 h-8 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsAddingRefTier(false);
                              setNewRefMinAcc("");
                              setNewRefReward("");
                            }}
                            className="h-8 text-xs"
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingRefTiers}
                            onClick={handleAddReferralTierSubmit}
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                          >
                            {savingRefTiers && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Simpan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* TABLE DAFTAR REFERRAL APPROVAL */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-bold text-gray-900">
                      Daftar Hubungan & Approval Referral ({referrals.data.length})
                    </Label>
                  </div>

                  {referrals.data.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">
                      Belum ada data pendaftaran referral.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {referrals.data.map((ref) => {
                        const currentAcc = ref.currentAccCount ?? 0;
                        const qualTier = getReferralTierForAccCount(currentAcc, activeReferralTiers);
                        const sortedTiers = [...activeReferralTiers].sort((a, b) => a.minAcc - b.minAcc);
                        const lowestMinAcc = sortedTiers[0]?.minAcc ?? rules.data.referralMinAcc ?? 5;

                        const isPaid = ref.status === "PAID" || ref.status === "REWARDED";
                        const isQualified = ref.status === "QUALIFIED";
                        const isRejected = ref.status === "REJECTED";
                        const isCanApprove = isQualified || (ref.status === "PENDING" && currentAcc >= lowestMinAcc);

                        const rewardAmt = isPaid
                          ? (ref.rewardAmount ?? getReferralRewardForAccCount(currentAcc, activeReferralTiers))
                          : getReferralRewardForAccCount(currentAcc, activeReferralTiers);

                        let statusBadgeClass = "bg-amber-100 text-amber-800 hover:bg-amber-100";
                        let statusText = "PENDING";

                        if (isPaid) {
                          statusBadgeClass = "bg-green-100 text-green-800 hover:bg-green-100";
                          statusText = "PAID";
                        } else if (isQualified || isCanApprove) {
                          statusBadgeClass = "bg-blue-100 text-blue-800 hover:bg-blue-100";
                          statusText = "QUALIFIED";
                        } else if (isRejected) {
                          statusBadgeClass = "bg-red-100 text-red-800 hover:bg-red-100";
                          statusText = "REJECTED";
                        }

                        return (
                          <div key={ref.id} className="p-3 bg-gray-50/70 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-900">
                                  Pengundang: <span className="text-amber-800">{ref.referrerName || workerName(ref.referrerId)}</span> ({shortId(ref.referrerId)})
                                </span>
                                <span>→</span>
                                <span className="font-bold text-gray-900">
                                  Yang Diundang: <span className="text-blue-800">{ref.referredWorkerName || workerName(ref.referredWorkerId)}</span> ({shortId(ref.referredWorkerId)})
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-gray-600 font-medium">
                                <span>ACC: <strong className="text-gray-900">{currentAcc}</strong></span>
                                <span>Tier: <strong className="text-blue-900">{qualTier ? `${qualTier.minAcc} ACC` : "-"}</strong></span>
                                <span>Total Reward Diklaim: <strong className="text-amber-700">{formatMoney(ref.rewardAmount ?? (isPaid ? rewardAmt : 0))}</strong></span>
                              </div>

                              <div className="text-[11px] text-gray-400 flex flex-wrap gap-2">
                                <span>Daftar: {formatDateTime(ref.createdAt)}</span>
                                {ref.qualifiedAt ? <span>· Qualified: {formatDateTime(ref.qualifiedAt)}</span> : null}
                                {ref.rewardedAt ? <span>· Paid: {formatDateTime(ref.rewardedAt)}</span> : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-[11px] font-medium ${statusBadgeClass}`}>
                                {statusText}
                              </Badge>

                              {isCanApprove && (
                                <div className="flex gap-1.5 ml-2">
                                  <Button
                                    size="sm"
                                    disabled={busyId === ref.id}
                                    onClick={() => handleApproveReferral(ref.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2.5 gap-1"
                                  >
                                    {busyId === ref.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                    ACC
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={busyId === ref.id}
                                    onClick={() => handleRejectReferral(ref.id)}
                                    className="text-xs h-7 px-2.5 gap-1"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Tolak
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>


            {/* AUDIT LEDGER HADIAH */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audit Ledger Payout Hadiah</CardTitle>
                <CardDescription>
                  Rekam jejak seluruh pencairan hadiah (referral, misi, klasemen) yang transparan dan dapat diaudit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rewardLedger.data.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Belum ada transaksi pencairan hadiah.</p>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {rewardLedger.data.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-900">{log.workerName || workerName(log.workerId)}</p>
                        <p className="text-gray-500 mt-0.5">{log.description}</p>
                        <p className="text-[11px] text-gray-400">{formatDateTime(log.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold">
                          +{formatMoney(log.amount)}
                        </Badge>
                        <p className="text-[10px] text-gray-400 uppercase mt-1">{log.rewardType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATURAN & TIER CONFIGURATION */}
          <TabsContent value="rules">
            <div className="space-y-6">
              {/* TIER CONFIGURATION EDITOR */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Konfigurasi Tier Pekerja</CardTitle>
                      <CardDescription>
                        Atur rentang jumlah item dan harga per item untuk tiap tier. Sistem akan memberikan rekomendasi otomatis ke admin.
                      </CardDescription>
                    </div>
                    <Button onClick={handleAddTierConfig} variant="outline" className="gap-1 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Tambah Tier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeTiers.map((t, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                      <div>
                        <Label className="text-xs">Nama Tier</Label>
                        <Input
                          value={t.name}
                          onChange={(e) => handleUpdateTierConfig(idx, "name", e.target.value)}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Min. Qty</Label>
                        <Input
                          type="number"
                          value={t.minQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "minQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max. Qty</Label>
                        <Input
                          type="number"
                          value={t.maxQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "maxQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Harga / Item (Rp)</Label>
                        <FormattedNumberInput
                          value={t.pricePerItem}
                          onChange={(val) => handleUpdateTierConfig(idx, "pricePerItem", val)}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTierConfig(idx)}
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* GENERAL RULES */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Aturan & Biaya Penarikan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Minimal Penarikan (Rp)</Label>
                      <FormattedNumberInput
                        value={activeMinWithdraw}
                        onChange={(val) =>
                          setRulesDraft({
                            pricePerEmail: activePricePerEmail,
                            withdrawFeePercent: activeWithdrawFeePercent,
                            minWithdraw: val,
                            maxWithdraw: activeMaxWithdraw,
                            paymentMethodsStr: activePaymentMethodsStr,
                            submissionNotesText: activeSubmissionNotesText,
                            tiers: activeTiers,
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Maksimal Penarikan (Rp)</Label>
                      <FormattedNumberInput
                        value={activeMaxWithdraw}
                        onChange={(val) =>
                          setRulesDraft({
                            pricePerEmail: activePricePerEmail,
                            withdrawFeePercent: activeWithdrawFeePercent,
                            minWithdraw: activeMinWithdraw,
                            maxWithdraw: val,
                            paymentMethodsStr: activePaymentMethodsStr,
                            submissionNotesText: activeSubmissionNotesText,
                            tiers: activeTiers,
                          })
                        }
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Metode Pembayaran (pisahkan dengan koma)</Label>
                    <Input
                      value={activePaymentMethodsStr}
                      onChange={(e) =>
                        setRulesDraft({
                          pricePerEmail: activePricePerEmail,
                          withdrawFeePercent: activeWithdrawFeePercent,
                          minWithdraw: activeMinWithdraw,
                          maxWithdraw: activeMaxWithdraw,
                          paymentMethodsStr: e.target.value,
                          submissionNotesText: activeSubmissionNotesText,
                          tiers: activeTiers,
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Aturan Setor Email & Kata Sandi (Instruksi Multiline)</Label>
                    <Textarea
                      rows={6}
                      value={activeSubmissionNotesText}
                      onChange={(e) =>
                        setRulesDraft({
                          pricePerEmail: activePricePerEmail,
                          withdrawFeePercent: activeWithdrawFeePercent,
                          minWithdraw: activeMinWithdraw,
                          maxWithdraw: activeMaxWithdraw,
                          paymentMethodsStr: activePaymentMethodsStr,
                          submissionNotesText: e.target.value,
                          tiers: activeTiers,
                        })
                      }
                      placeholder="Tuliskan aturan setoran di sini..."
                      className="mt-1.5"
                    />
                  </div>
                  <Button onClick={handleSaveRules} disabled={savingRules} className="bg-amber-600 hover:bg-amber-700 gap-2">
                    {savingRules && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Pengaturan Aturan & Tier
                  </Button>
                </CardContent>
              </Card>

              {/* JAM OPERASIONAL */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Jam Operasional</CardTitle>
                  <CardDescription>
                    Atur jadwal operasional harian dan zona waktu platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <Label className="font-bold text-sm text-gray-900">Status Jam Operasional Global</Label>
                      <p className="text-xs text-gray-500">Aktifkan atau nonaktifkan fitur jam operasional secara menyeluruh.</p>
                    </div>
                    <Select
                      value={currentOperatingHours.enabled ? "ON" : "OFF"}
                      onValueChange={(val) => handleUpdateGlobalOperatingHours(val === "ON")}
                    >
                      <SelectTrigger className="w-28 text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: "monday" as const, label: "Senin" },
                      { key: "tuesday" as const, label: "Selasa" },
                      { key: "wednesday" as const, label: "Rabu" },
                      { key: "thursday" as const, label: "Kamis" },
                      { key: "friday" as const, label: "Jumat" },
                      { key: "saturday" as const, label: "Sabtu" },
                      { key: "sunday" as const, label: "Minggu" },
                    ].map((d) => {
                      const dayConfig = currentOperatingHours.days[d.key];
                      return (
                        <div
                          key={d.key}
                          className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                            dayConfig.enabled ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 text-gray-400"
                          }`}
                        >
                          <div className="flex items-center gap-3 w-32">
                            <span className="font-bold text-sm text-gray-900">{d.label}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <Select
                              value={dayConfig.enabled ? "ON" : "OFF"}
                              onValueChange={(val) => handleUpdateDayOperatingHours(d.key, "enabled", val === "ON")}
                            >
                              <SelectTrigger className="w-24 text-xs h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ON">ON</SelectItem>
                                <SelectItem value="OFF">OFF</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <span>Buka:</span>
                              <Input
                                value={dayConfig.open}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "open", e.target.value)}
                                placeholder="08:00"
                                className="w-24 h-8 text-xs font-mono"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span>Tutup:</span>
                              <Input
                                value={dayConfig.close}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "close", e.target.value)}
                                placeholder="18:00"
                                className="w-24 h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleSaveOperatingHours}
                    disabled={savingOperatingHours}
                    className="bg-amber-600 hover:bg-amber-700 gap-2 text-xs"
                  >
                    {savingOperatingHours && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Jam Operasional
                  </Button>
                </CardContent>
              </Card>

              {/* PUSAT BANTUAN / CUSTOMER SERVICE */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pusat Bantuan / Customer Service</CardTitle>
                  <CardDescription>
                    Atur tautan dan informasi Customer Service Telegram yang tampil untuk seluruh pekerja.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nama layanan</Label>
                    <Input
                      value={currentSupportTitle}
                      onChange={(e) => setSupportTitle(e.target.value)}
                      placeholder="Customer Service"
                      className="mt-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Link Telegram</Label>
                    <Input
                      value={currentSupportTelegramUrl}
                      onChange={(e) => setSupportTelegramUrl(e.target.value)}
                      placeholder="https://t.me/username"
                      className="mt-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Textarea
                      rows={3}
                      value={currentSupportDescription}
                      onChange={(e) => setSupportDescription(e.target.value)}
                      placeholder="Ada kendala? Hubungi Customer Service kami melalui Telegram."
                      className="mt-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={currentSupportEnabled ? "ON" : "OFF"}
                      onValueChange={(val) => setSupportEnabled(val === "ON")}
                    >
                      <SelectTrigger className="mt-1.5 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveSupportConfig}
                    disabled={savingSupport}
                    className="bg-amber-600 hover:bg-amber-700 gap-2 text-xs"
                  >
                    {savingSupport && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* DIALOG LIHAT & TINJAU DETAIL BATCH (PER EMAIL) */}
        <Dialog open={!!detailSubmission} onOpenChange={(open) => !open && setDetailSubmission(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tinjau Batch Setoran Email</DialogTitle>
              <DialogDescription>
                Pekerja: <strong>{detailSubmission?.workerName || workerName(detailSubmission?.workerId ?? "")}</strong> · #{shortId(detailSubmission?.id ?? "")}
              </DialogDescription>
            </DialogHeader>
            {detailSubmission && (() => {
              const baseItems = Array.isArray(detailSubmission.items) && detailSubmission.items.length > 0
                ? detailSubmission.items
                : detailSubmission.email
                  ? [{ email: detailSubmission.email, password: detailSubmission.password }]
                  : [];

              const isReadOnly = detailSubmission.status !== "pending";

              const approvedCount = isReadOnly
                ? (detailSubmission.approvedItemCount ?? baseItems.filter((i) => i.status === "approved").length)
                : baseItems.filter((_, idx) => (itemStatuses[idx] ?? "pending") === "approved").length;

              const rejectedCount = isReadOnly
                ? (detailSubmission.rejectedItemCount ?? baseItems.filter((i) => i.status === "rejected").length)
                : baseItems.filter((_, idx) => (itemStatuses[idx] ?? "pending") === "rejected").length;

              const pendingCount = isReadOnly
                ? 0
                : baseItems.filter((_, idx) => (itemStatuses[idx] ?? "pending") === "pending").length;

              // Resolved tier and price based on final ACC count (if pending, preview dynamic recommendation)
              const recTierCfg = isReadOnly
                ? getTierConfig(detailSubmission.appliedTier ?? detailSubmission.currentTier ?? 1, activeTiersList)
                : getRecommendedTier(approvedCount, activeTiersList);

              const pricePerItem = isReadOnly
                ? (detailSubmission.appliedPricePerItem ?? recTierCfg.pricePerItem)
                : recTierCfg.pricePerItem;

              const calcTotal = isReadOnly
                ? (detailSubmission.totalAmount ?? (approvedCount * pricePerItem))
                : (approvedCount * pricePerItem);

              return (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <span className="text-gray-500">Total Item:</span>
                      <p className="font-bold text-gray-900">{baseItems.length} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">ACC:</span>
                      <p className="font-bold text-green-600">{approvedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Ditolak:</span>
                      <p className="font-bold text-red-600">{rejectedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Hasil Tier:</span>
                      <p className="font-bold text-amber-800">{recTierCfg.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Saldo:</span>
                      <p className="font-bold text-amber-700">{formatMoney(calcTotal)}</p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center justify-between gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs">
                      <span className="text-amber-900 font-medium">Setujui/Tolak Semua:</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newMap: Record<string, "approved"> = {};
                            baseItems.forEach((_, idx) => { newMap[idx] = "approved"; });
                            setItemStatuses(newMap);
                          }}
                          className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                        >
                          Setujui Semua (✓)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newMap: Record<string, "rejected"> = {};
                            baseItems.forEach((_, idx) => { newMap[idx] = "rejected"; });
                            setItemStatuses(newMap);
                          }}
                          className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                        >
                          Tolak Semua (X)
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">
                      Tinjau Item Email Individu ({baseItems.length} item):
                    </Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                      {baseItems.map((it, idx) => {
                        const currentSt = itemStatuses[idx] ?? "pending";
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-md border flex items-center justify-between gap-2 text-xs transition-colors ${
                              currentSt === "approved"
                                ? "bg-green-50/60 border-green-200"
                                : currentSt === "rejected"
                                  ? "bg-red-50/60 border-red-200"
                                  : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <div className="min-w-0 flex-1 font-mono">
                              <p className="font-semibold text-gray-900 truncate">
                                {idx + 1}. {it.email}
                              </p>
                              {it.password && <p className="text-[11px] text-gray-500">Sandi: {it.password}</p>}
                            </div>

                            {isReadOnly ? (
                              <Badge
                                className={
                                  currentSt === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : currentSt === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-700"
                                }
                              >
                                {currentSt === "approved" ? "Terjual (✓)" : currentSt === "rejected" ? "Ditolak (X)" : "Menunggu"}
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setItemStatuses((prev) => ({ ...prev, [idx]: "approved" }))}
                                  className={`h-7 px-2.5 text-xs gap-1 ${
                                    currentSt === "approved"
                                      ? "bg-green-600 text-white hover:bg-green-700 font-bold"
                                      : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-800"
                                  }`}
                                >
                                  ✓ Disetujui
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setItemStatuses((prev) => ({ ...prev, [idx]: "rejected" }))}
                                  className={`h-7 px-2.5 text-xs gap-1 ${
                                    currentSt === "rejected"
                                      ? "bg-red-600 text-white hover:bg-red-700 font-bold"
                                      : "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-800"
                                  }`}
                                >
                                  X Ditolak
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div>
                        <Label htmlFor="batch-note" className="text-xs">Catatan Review Admin (opsional)</Label>
                        <Input
                          id="batch-note"
                          placeholder="Contoh: 3 email valid, 2 email tidak bisa login"
                          value={notes[detailSubmission.id] ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [detailSubmission.id]: e.target.value }))}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={busyId === detailSubmission.id || pendingCount > 0}
                        onClick={() => handleFinalizeBatchReview(detailSubmission)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs gap-2"
                      >
                        {busyId === detailSubmission.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Finalisasi Review Batch ({approvedCount} Disetujui · {formatMoney(calcTotal)})
                      </Button>
                      {pendingCount > 0 && (
                        <p className="text-[11px] text-amber-700 text-center font-medium">
                          Harap tentukan status (Disetujui / Ditolak) untuk seluruh {pendingCount} item sebelum finalisasi.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
