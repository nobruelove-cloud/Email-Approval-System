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
  EyeOff,
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
  Megaphone,
  Copy,
  Check,
  Wrench,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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
  updateSubmissionTier,
  reviewSubmission,
  updateEmailStockStatus,
  reviewWithdrawal,
  updatePortalUser,
  deletePortalUser,
  createWorkerAccount,
  updateReferralTier,
  saveSettings,
  evaluateReferralQualification,
  distributeLeaderboardReward,
  reviewMissionClaim,
  useAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
} from "@/hooks/use-portal";
import { type Announcement } from "@/lib/portal-types";
import { DEFAULT_RULES, DEFAULT_TIERS, DEFAULT_REFERRAL_TIERS, DEFAULT_OPERATING_HOURS, DEFAULT_WITHDRAWAL_SETTINGS, DEFAULT_PAYMENT_METHOD_FEES, DEFAULT_MAINTENANCE, type EmailSubmission, type PortalUser, type TierConfig, type ReferralTierConfig, type UserStatus, type UserTier, type SupportConfig, type OperatingHoursConfig, type FinancialTransaction, type FinancialTransactionType, type PaymentMethodFeeConfig, type WithdrawalSettings, type MethodFeeType, type MaintenanceConfig } from "@/lib/portal-types";
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
  formatBatchEmailsOnly,
  formatBatchEmailsWithPasswords,
  calculateLeaderboardStandings,
  maskWorkerName,
} from "@/lib/portal-utils";

function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    return false;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold",
    processing: "bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold",
    approved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold",
    available: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold",
    sold: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold",
    rejected: "bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold",
    inactive: "bg-slate-800 text-slate-400 border border-slate-700 font-semibold",
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
  const { users, submissions, withdrawals, referrals, rewardLedger, leaderboardPayouts } = useAdminData();
  const announcements = useAnnouncements({ includeInactive: true });

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
  const withdrawalSettingsHook = useSettings("withdrawal", DEFAULT_WITHDRAWAL_SETTINGS);
  const maintenanceHook = useSettings("maintenance", DEFAULT_MAINTENANCE);
  const [evaluatingRefs, setEvaluatingRefs] = useState(false);

  // Email sensor toggle state
  const [isEmailVisible, setIsEmailVisible] = useState(false);

  // Global Maintenance Mode state
  const activeMaintenance = useMemo(() => {
    return maintenanceHook.data ?? DEFAULT_MAINTENANCE;
  }, [maintenanceHook.data]);

  const [maintEnabled, setMaintEnabled] = useState<boolean | null>(null);
  const [maintMessage, setMaintNoteMessage] = useState<string | null>(null);
  const [maintTargetTime, setMaintTargetTime] = useState<string | null>(null);
  const [savingMaint, setSavingMaint] = useState(false);

  const currentMaintEnabled = maintEnabled ?? activeMaintenance.enabled;
  const currentMaintMessage = maintMessage ?? activeMaintenance.message;
  const currentMaintTargetTime = maintTargetTime ?? activeMaintenance.targetEndTime;

  function handleQuickSetDuration(minutes: number) {
    const target = new Date(Date.now() + minutes * 60 * 1000);
    // Format YYYY-MM-THH:mm for datetime-local input
    const isoLocal = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setMaintTargetTime(isoLocal);
  }

  async function handleSaveMaintenance() {
    setSavingMaint(true);
    try {
      const payload: MaintenanceConfig = {
        enabled: currentMaintEnabled,
        targetEndTime: currentMaintTargetTime,
        message: currentMaintMessage.trim() || DEFAULT_MAINTENANCE.message,
      };
      await saveSettings("maintenance", payload);
      toast.success(
        currentMaintEnabled
          ? "Mode Maintenance System BERHASIL DIAKTIFKAN!"
          : "Mode Maintenance System BERHASIL DINONAKTIFKAN."
      );
      setMaintEnabled(null);
      setMaintNoteMessage(null);
      setMaintTargetTime(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan mode maintenance.");
    } finally {
      setSavingMaint(false);
    }
  }

  // Daily Trend Analytics calculation over last 14 days
  const dailySubmissionTrends = useMemo(() => {
    const daysMap = new Map<string, { dateStr: string; label: string; totalSubmitted: number; gmailAcc: number }>();

    // Generate array for last 14 days up to today
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDailyPeriodKey(d); // "YYYY-MM-DD"
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      daysMap.set(key, { dateStr: key, label, totalSubmitted: 0, gmailAcc: 0 });
    }

    submissions.data.forEach((sub) => {
      if (!sub.submittedAt) return;
      const subDate = new Date(
        typeof sub.submittedAt === "object" && "toMillis" in (sub.submittedAt as any)
          ? (sub.submittedAt as any).toMillis()
          : Number(sub.submittedAt) || Date.now()
      );
      const key = getDailyPeriodKey(subDate);

      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        const totalCount = getItemCountOfSubmission(sub);
        item.totalSubmitted += totalCount;

        const isApprovedOrAvailable =
          sub.status === "approved" || sub.status === "available" || sub.status === "sold";

        if (isApprovedOrAvailable) {
          const accCount =
            typeof sub.approvedItemCount === "number"
              ? sub.approvedItemCount
              : Array.isArray(sub.items) && sub.items.length > 0
              ? sub.items.filter((it) => it.status === "approved").length
              : totalCount;
          item.gmailAcc += accCount;
        }
      }
    });

    return Array.from(daysMap.values());
  }, [submissions.data]);

  // Per-method fee state
  const activeWithdrawalSettings = useMemo(() => {
    return {
      minWithdraw: withdrawalSettingsHook.data?.minWithdraw ?? rules.data.minWithdraw ?? 50000,
      maxWithdraw: withdrawalSettingsHook.data?.maxWithdraw ?? rules.data.maxWithdraw ?? 5000000,
      methods: Array.isArray(withdrawalSettingsHook.data?.methods) && withdrawalSettingsHook.data.methods.length > 0
        ? withdrawalSettingsHook.data.methods
        : DEFAULT_PAYMENT_METHOD_FEES,
    };
  }, [withdrawalSettingsHook.data, rules.data]);

  const [methodsDraft, setMethodsDraft] = useState<PaymentMethodFeeConfig[] | null>(null);
  const currentMethods = methodsDraft ?? activeWithdrawalSettings.methods;
  const [savingWithdrawalSettings, setSavingWithdrawalSettings] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodCategory, setNewMethodCategory] = useState<"bank" | "ewallet">("ewallet");

  function handleToggleMethodEnabled(index: number, enabled: boolean) {
    const updated = currentMethods.map((m, idx) => (idx === index ? { ...m, enabled } : m));
    setMethodsDraft(updated);
  }

  function handleUpdateMethodFee(index: number, field: "feeType" | "feeValue" | "category", value: any) {
    const updated = currentMethods.map((m, idx) => {
      if (idx === index) {
        if (field === "feeType") {
          const newType = value as MethodFeeType;
          const defaultVal = newType === "free" ? 0 : newType === "percentage" ? 1.5 : 2500;
          return { ...m, feeType: newType, feeValue: defaultVal };
        }
        return { ...m, [field]: value };
      }
      return m;
    });
    setMethodsDraft(updated);
  }

  function handleAddMethod() {
    if (!newMethodName.trim()) {
      toast.error("Nama metode pembayaran wajib diisi.");
      return;
    }
    const norm = newMethodName.trim();
    if (currentMethods.some((m) => m.method.toLowerCase() === norm.toLowerCase())) {
      toast.error("Metode pembayaran ini sudah ada.");
      return;
    }
    const newConfig: PaymentMethodFeeConfig = {
      method: norm,
      category: newMethodCategory,
      enabled: true,
      feeType: "free",
      feeValue: 0,
    };
    setMethodsDraft([...currentMethods, newConfig]);
    setNewMethodName("");
  }

  function handleRemoveMethod(index: number) {
    if (currentMethods.length <= 1) {
      toast.error("Minimal harus ada 1 metode pembayaran.");
      return;
    }
    const updated = currentMethods.filter((_, idx) => idx !== index);
    setMethodsDraft(updated);
  }

  async function handleSaveWithdrawalSettings() {
    setSavingWithdrawalSettings(true);
    try {
      const payload: WithdrawalSettings = {
        minWithdraw: activeMinWithdraw,
        maxWithdraw: activeMaxWithdraw,
        methods: currentMethods,
      };

      await saveSettings("withdrawal", payload);

      // Also sync paymentMethods string array to settings/rules for backward compatibility
      const enabledMethodNames = currentMethods.filter((m) => m.enabled).map((m) => m.method);
      if (enabledMethodNames.length > 0) {
        await saveSettings("rules", { paymentMethods: enabledMethodNames });
      }

      toast.success("Pengaturan penarikan & biaya per-metode berhasil disimpan!");
      setMethodsDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan penarikan.");
    } finally {
      setSavingWithdrawalSettings(false);
    }
  }

  // --- Keuangan / Financial Tracking state ---
  // --- Announcements state ---
  const [annModalOpen, setAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annBadge, setAnnBadge] = useState("");
  const [annIsActive, setAnnIsActive] = useState(true);
  const [annSaving, setAnnSaving] = useState(false);
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);

  function openAddAnnModal() {
    setEditingAnn(null);
    setAnnTitle("");
    setAnnContent("");
    setAnnBadge("BARU");
    setAnnIsActive(true);
    setAnnModalOpen(true);
  }

  function openEditAnnModal(ann: Announcement) {
    setEditingAnn(ann);
    setAnnTitle(ann.title);
    setAnnContent(ann.content);
    setAnnBadge(ann.badge ?? "");
    setAnnIsActive(ann.isActive !== false);
    setAnnModalOpen(true);
  }

  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!annTitle.trim()) {
      toast.error("Judul pengumuman wajib diisi.");
      return;
    }
    if (!annContent.trim()) {
      toast.error("Isi pengumuman wajib diisi.");
      return;
    }

    setAnnSaving(true);
    try {
      if (editingAnn) {
        await updateAnnouncement(editingAnn.id, {
          title: annTitle,
          content: annContent,
          badge: annBadge,
          isActive: annIsActive,
        });
        toast.success("Pengumuman berhasil diperbarui.");
      } else {
        await createAnnouncement({
          title: annTitle,
          content: annContent,
          badge: annBadge,
          isActive: annIsActive,
        });
        toast.success("Pengumuman baru berhasil diterbitkan!");
      }
      setAnnModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengumuman.");
    } finally {
      setAnnSaving(false);
    }
  }

  async function handleToggleAnnStatus(id: string, currentStatus: boolean) {
    setBusyId(id);
    try {
      await toggleAnnouncementStatus(id, currentStatus);
      toast.success(`Status pengumuman diubah menjadi ${!currentStatus ? "Aktif" : "Nonaktif"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status pengumuman.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    setBusyId(id);
    try {
      await deleteAnnouncement(id);
      toast.success("Pengumuman berhasil dihapus.");
      setDeletingAnnId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pengumuman.");
    } finally {
      setBusyId(null);
    }
  }

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => getMonthlyPeriodKey(new Date()));
  const [finSearch, setFinSearch] = useState("");
  const [vendorSalePrice, setVendorSalePrice] = useState<number>(4000);
  const { transactions: finTransactions, loading: finLoading, error: finError } = useFinancialData(selectedPeriod);

  // Period options for dropdown including transactions, submissions, withdrawals, and ledger dates
  const periodOptions = useMemo(() => {
    const combinedTx: { period: string }[] = [...finTransactions];
    submissions.data.forEach((s) => {
      if (s.submittedAt) combinedTx.push({ period: getMonthlyPeriodKey(s.submittedAt) });
    });
    withdrawals.data.forEach((w) => {
      if (w.requestedAt) combinedTx.push({ period: getMonthlyPeriodKey(w.requestedAt) });
    });
    rewardLedger.data.forEach((r) => {
      if (r.createdAt) combinedTx.push({ period: getMonthlyPeriodKey(r.createdAt) });
    });
    return getPeriodOptions(combinedTx, selectedPeriod);
  }, [finTransactions, submissions.data, withdrawals.data, rewardLedger.data, selectedPeriod]);

  // Auto-calculated Automated Financial Ledger Stats for selectedPeriod
  const automatedFinSummary = useMemo(() => {
    // 1. Email ACC Income calculation
    let periodApprovedAccs = 0;
    let periodWorkerCommissions = 0;

    submissions.data.forEach((sub) => {
      const subPeriod = getMonthlyPeriodKey(sub.submittedAt || sub.reviewedAt);
      if (subPeriod === selectedPeriod) {
        const isApprovedOrAvailable =
          sub.status === "approved" || sub.status === "available" || sub.status === "sold";
        if (isApprovedOrAvailable) {
          const accCount =
            typeof sub.approvedItemCount === "number"
              ? sub.approvedItemCount
              : Array.isArray(sub.items) && sub.items.length > 0
              ? sub.items.filter((it) => it.status === "approved").length
              : getItemCountOfSubmission(sub);

          periodApprovedAccs += accCount;

          const pricePerItem = sub.appliedPricePerItem ?? sub.currentPricePerItem ?? sub.pricePerEmail ?? 2000;
          const comm = sub.totalAmount ?? (accCount * pricePerItem);
          periodWorkerCommissions += comm;
        }
      }
    });

    const vendorEmailIncome = periodApprovedAccs * vendorSalePrice;

    // 2. Manual Income
    let manualIncome = 0;
    let manualExpense = 0;

    finTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") {
        manualIncome += amt;
      } else if (tx.type === "expense") {
        manualExpense += amt;
      }
    });

    const totalIncome = vendorEmailIncome + manualIncome;

    // 3. Withdrawals Expense in selectedPeriod
    let periodWithdrawalsExpense = 0;
    withdrawals.data.forEach((w) => {
      if (w.status === "success") {
        const wPeriod = getMonthlyPeriodKey(w.processedAt || w.requestedAt);
        if (wPeriod === selectedPeriod) {
          periodWithdrawalsExpense += w.amount;
        }
      }
    });

    // 4. Rewards Expense in selectedPeriod (Leaderboard, Referral, Missions)
    let periodRewardsExpense = 0;
    rewardLedger.data.forEach((r) => {
      const rPeriod = getMonthlyPeriodKey(r.createdAt);
      if (rPeriod === selectedPeriod) {
        periodRewardsExpense += r.amount;
      }
    });

    const totalExpense = periodWorkerCommissions + periodWithdrawalsExpense + periodRewardsExpense + manualExpense;
    const netBalance = totalIncome - totalExpense;

    return {
      periodApprovedAccs,
      vendorEmailIncome,
      manualIncome,
      totalIncome,
      periodWorkerCommissions,
      periodWithdrawalsExpense,
      periodRewardsExpense,
      manualExpense,
      totalExpense,
      netBalance,
    };
  }, [submissions.data, withdrawals.data, rewardLedger.data, finTransactions, selectedPeriod, vendorSalePrice]);

  // Search filtered transactions
  const filteredFinTransactions = useMemo(() => {
    const q = finSearch.toLowerCase().trim();
    if (!q) return finTransactions;
    return finTransactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        (tx.note && tx.note.toLowerCase().includes(q))
    );
  }, [finTransactions, finSearch]);

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

  // Edit referral tier state
  const [isEditingRefTierOpen, setIsEditingRefTierOpen] = useState(false);
  const [editingRefTierIndex, setEditingRefTierIndex] = useState<number | null>(null);
  const [editingRefMinAcc, setEditingRefMinAcc] = useState<number | "">("");
  const [editingRefReward, setEditingRefReward] = useState<number | "">("");
  const [savingEditRefTier, setSavingEditRefTier] = useState(false);

  function openEditRefTierModal(index: number, tier: ReferralTierConfig) {
    setEditingRefTierIndex(index);
    setEditingRefMinAcc(tier.minAcc);
    setEditingRefReward(tier.reward);
    setIsEditingRefTierOpen(true);
  }

  async function handleEditReferralTierSubmit() {
    if (editingRefTierIndex === null) return;
    if (editingRefMinAcc === "" || typeof editingRefMinAcc !== "number" || editingRefMinAcc <= 0) {
      toast.error("Minimal ACC harus berupa bilangan bulat positif.");
      return;
    }
    if (editingRefReward === "" || typeof editingRefReward !== "number" || editingRefReward < 0) {
      toast.error("Reward harus berupa angka non-negatif.");
      return;
    }

    setSavingEditRefTier(true);
    try {
      await updateReferralTier(editingRefTierIndex, {
        minAcc: editingRefMinAcc,
        reward: editingRefReward,
      });
      toast.success("Tier referral berhasil diperbarui!");
      setIsEditingRefTierOpen(false);
      setEditingRefTierIndex(null);
      setEditingRefMinAcc("");
      setEditingRefReward("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui tier referral.");
    } finally {
      setSavingEditRefTier(false);
    }
  }

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

  // Leaderboard Management State
  const [distributingLeaderboard, setDistributingLeaderboard] = useState(false);

  const currentLeaderboardTimeframe = useMemo(() => {
    const now = new Date();
    const { start, end } = getStartAndEndOfWeek(now);
    const key = getWeeklyPeriodKey(now);
    return { key, label: `Mingguan (${key})`, start, end };
  }, []);

  const leaderboardRewardsConfig = useMemo(() => {
    return Array.isArray(rules.data.leaderboardRewards) && rules.data.leaderboardRewards.length > 0
      ? rules.data.leaderboardRewards
      : [
          { rank: 1, rewardAmount: 50000 },
          { rank: 2, rewardAmount: 30000 },
          { rank: 3, rewardAmount: 15000 },
        ];
  }, [rules.data.leaderboardRewards]);

  const currentLeaderboardStandings = useMemo(() => {
    return calculateLeaderboardStandings(
      submissions.data,
      users.data,
      currentLeaderboardTimeframe.start,
      currentLeaderboardTimeframe.end,
      leaderboardRewardsConfig
    );
  }, [submissions.data, users.data, currentLeaderboardTimeframe.start, currentLeaderboardTimeframe.end, leaderboardRewardsConfig]);

  // Set of paid payout IDs for fast lookup
  const paidLeaderboardSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(leaderboardPayouts?.data)) {
      leaderboardPayouts.data.forEach((p) => {
        set.add(`${p.periodKey}_rank${p.rank}_${p.workerId}`);
      });
    }
    return set;
  }, [leaderboardPayouts?.data]);

  const [payingIndividualWorkerId, setPayingIndividualWorkerId] = useState<string | null>(null);

  async function handleCairkanIndividualReward(winner: {
    workerId: string;
    rank: number;
    validAccCount: number;
    rewardAmount?: number;
    workerName: string;
  }) {
    const payoutId = `${currentLeaderboardTimeframe.key}_rank${winner.rank}_${winner.workerId}`;
    if (paidLeaderboardSet.has(payoutId)) {
      toast.info(`Hadiah Juara #${winner.rank} (${winner.workerName}) sudah pernah dicairkan untuk periode ini.`);
      return;
    }

    const rewardAmt = winner.rewardAmount || (winner.rank === 1 ? 50000 : winner.rank === 2 ? 30000 : 15000);
    setPayingIndividualWorkerId(winner.workerId);
    try {
      await distributeLeaderboardReward(
        winner.workerId,
        currentLeaderboardTimeframe.key,
        winner.rank,
        winner.validAccCount,
        rewardAmt,
        winner.workerName
      );
      toast.success(`Berhasil mencairkan bonus Juara #${winner.rank} (${formatMoney(rewardAmt)}) ke saldo ${winner.workerName}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Gagal mencairkan reward: ${msg}`);
    } finally {
      setPayingIndividualWorkerId(null);
    }
  }

  async function handleDistributeLeaderboardRewards() {
    if (currentLeaderboardStandings.length === 0) {
      toast.error("Tidak ada pengerjaan email ACC pada periode ini.");
      return;
    }

    const topWinners = currentLeaderboardStandings.slice(0, 3).filter((s) => s.validAccCount > 0);
    if (topWinners.length === 0) {
      toast.error("Tidak ada pemenang dengan pengerjaan ACC > 0.");
      return;
    }

    // Filter out workers who have already been paid for this period
    const unpaidWinners = topWinners.filter(
      (w) => !paidLeaderboardSet.has(`${currentLeaderboardTimeframe.key}_rank${w.rank}_${w.workerId}`)
    );

    if (unpaidWinners.length === 0) {
      toast.info(`Seluruh pemenang untuk periode ${currentLeaderboardTimeframe.key} sudah dicairkan.`);
      return;
    }

    setDistributingLeaderboard(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const winner of unpaidWinners) {
      const rewardAmt = winner.rewardAmount || (winner.rank === 1 ? 50000 : winner.rank === 2 ? 30000 : 15000);
      try {
        await distributeLeaderboardReward(
          winner.workerId,
          currentLeaderboardTimeframe.key,
          winner.rank,
          winner.validAccCount,
          rewardAmt,
          winner.workerName
        );
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${winner.workerName}: ${msg}`);
      }
    }

    setDistributingLeaderboard(false);

    if (successCount > 0) {
      toast.success(`Berhasil mencairkan bonus leaderboard untuk ${successCount} juara! Saldo telah ditambahkan.`);
    }

    if (errors.length > 0) {
      toast.error(`Gagal memproses beberapa juara: ${errors.join(", ")}`);
    }
  }

  // Detail submission modal & per-item status state
  const [detailSubmission, setDetailSubmission] = useState<EmailSubmission | null>(null);
  const [itemStatuses, setItemStatuses] = useState<Record<string, "pending" | "approved" | "rejected">>({});
  const [copiedSingleIndex, setCopiedSingleIndex] = useState<number | null>(null);
  const [copiedBulkType, setCopiedBulkType] = useState<"emails" | "passwords" | null>(null);

  function handleCopyAllEmails(baseItems: { email: string; password?: string }[]) {
    const text = formatBatchEmailsOnly(baseItems);
    if (!text) {
      toast.error("Tidak ada email untuk disalin.");
      return;
    }
    copyToClipboard(text).then(() => {
      toast.success("Daftar email berhasil disalin!");
      setCopiedBulkType("emails");
      setTimeout(() => setCopiedBulkType(null), 2000);
    });
  }

  function handleCopyEmailsWithPasswords(baseItems: { email: string; password?: string }[]) {
    const text = formatBatchEmailsWithPasswords(baseItems);
    if (!text) {
      toast.error("Tidak ada email & sandi untuk disalin.");
      return;
    }
    copyToClipboard(text).then(() => {
      toast.success("Daftar email & sandi berhasil disalin!");
      setCopiedBulkType("passwords");
      setTimeout(() => setCopiedBulkType(null), 2000);
    });
  }

  function handleCopySingleEmail(email: string, idx: number) {
    if (!email) return;
    copyToClipboard(email).then(() => {
      toast.success(`Email ${email} berhasil disalin!`);
      setCopiedSingleIndex(idx);
      setTimeout(() => setCopiedSingleIndex(null), 2000);
    });
  }

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

  async function handleBatchTierChange(submissionId: string, newTierStr: string) {
    const selectedTierNum = Number(newTierStr);
    const selectedTierCfg = activeTiersList.find((t) => Number(t.tier) === selectedTierNum) || getTierConfig(selectedTierNum, activeTiersList);

    setBusyId(submissionId);
    try {
      await updateSubmissionTier(submissionId, selectedTierCfg);
      toast.success(`Tier batch berhasil diubah ke ${selectedTierCfg.name} (${formatMoney(selectedTierCfg.pricePerItem)}/item).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah tier batch.");
    } finally {
      setBusyId(null);
    }
  }

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

      // Determine resulting Tier and price per item - prioritize manually overridden batch tier/rate if present
      const activeTierNum = sub.currentTier;
      const fallbackTierCfg = getRecommendedTier(approvedCount, activeTiersList);
      const activeTierCfg = activeTierNum ? getTierConfig(activeTierNum, activeTiersList) : fallbackTierCfg;

      const pricePerItem = sub.currentPricePerItem ?? sub.pricePerEmail ?? activeTierCfg.pricePerItem;
      const tierNum = sub.currentTier ?? activeTierCfg.tier;
      const totalCredit = approvedCount * pricePerItem;

      const decision = approvedCount > 0 ? "approved" : "rejected";

      await reviewSubmission(
        sub.id,
        decision,
        notes[sub.id] ?? "",
        pricePerItem,
        tierNum,
        updatedItems,
      );

      // Auto-evaluate referral qualification for worker if they have a pending referral
      if (approvedCount > 0) {
        evaluateReferralQualification(sub.workerId).catch((e) =>
          console.warn("[AdminDashboard] Referral auto-eval notice:", e)
        );
      }

      toast.success(
        `Finalisasi batch berhasil! ${approvedCount} ACC (${activeTierCfg.name}), ${rejectedCount} ditolak. Saldo dicairkan: ${formatMoney(totalCredit)}.`,
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



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-100 text-lg tracking-tight">Obsidian Command Center</p>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                  ADMIN
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                <span>
                  {isEmailVisible
                    ? (profile.email && profile.email.trim() ? profile.email.trim() : "-")
                    : "*".repeat((profile.email && profile.email.trim() ? profile.email.trim() : "-").length)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEmailVisible(!isEmailVisible)}
                  className="text-slate-400 hover:text-emerald-400 transition-colors p-0.5 rounded focus:outline-none"
                  title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}
                >
                  {isEmailVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onLogout}
            title="Keluar"
            className="border-slate-800 bg-slate-950/60 text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-4 sm:grid-cols-8 w-full mb-6 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl backdrop-blur-xl gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-all">
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <Megaphone className="w-3.5 h-3.5" /> Pengumuman
            </TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <DollarSign className="w-3.5 h-3.5" /> Keuangan
            </TabsTrigger>
            <TabsTrigger value="submissions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <FileText className="w-3.5 h-3.5" /> Batch
              {stats.pendingSubmissions > 0 && (
                <span className="ml-0.5 text-[10px] bg-emerald-500 text-slate-950 font-extrabold rounded-full px-1.5">{stats.pendingSubmissions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <Wallet className="w-3.5 h-3.5" /> Penarikan
              {stats.pendingWithdrawals > 0 && (
                <span className="ml-0.5 text-[10px] bg-emerald-500 text-slate-950 font-extrabold rounded-full px-1.5">{stats.pendingWithdrawals}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="workers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <Users className="w-3.5 h-3.5" /> Pekerja
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <Gift className="w-3.5 h-3.5" /> Hadiah
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-teal-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 border border-transparent text-slate-400 hover:text-slate-200 gap-1 text-xs font-semibold rounded-lg transition-all">
              <SettingsIcon className="w-3.5 h-3.5" /> Aturan
            </TabsTrigger>
          </TabsList>

          {/* TAB KELOLA PENGUMUMAN ADMIN */}
          <TabsContent value="announcements" className="space-y-6">
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                      <Megaphone className="w-5 h-5 text-emerald-400" /> Kelola Pengumuman
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      Buat, edit, dan kelola pengumuman atau informasi resmi untuk seluruh pekerja portal.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={openAddAnnModal}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Buat Pengumuman Baru
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {announcements.loading && <p className="text-sm text-slate-400 text-center py-8">Memuat pengumuman...</p>}
                {announcements.error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center rounded-lg">
                    Gagal memuat pengumuman: {announcements.error}
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length === 0 && (
                  <div className="p-10 border border-dashed border-slate-800 text-center rounded-xl bg-slate-950/40 space-y-1">
                    <p className="text-sm font-semibold text-slate-300">Belum ada pengumuman.</p>
                    <p className="text-xs text-slate-500">Gunakan tombol "Buat Pengumuman Baru" di atas untuk menambah pengumuman pertama.</p>
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length > 0 && (
                  <div className="space-y-3">
                    {announcements.data.map((item) => {
                      const isActive = item.isActive !== false;
                      const badgeUpper = item.badge?.toUpperCase().trim() || "";
                      let badgeStyle = "bg-sky-500/10 text-sky-400 border-sky-500/30";
                      if (badgeUpper === "BARU" || badgeUpper === "PENTING") {
                        badgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                      } else if (badgeUpper === "IMPORTANT" || badgeUpper === "PERHATIAN") {
                        badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                      } else if (badgeUpper === "INFO") {
                        badgeStyle = "bg-teal-500/10 text-teal-400 border-teal-500/30";
                      }

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-all shadow-sm space-y-2 ${
                            isActive ? "bg-slate-950/60 border-slate-800 hover:border-slate-700" : "bg-slate-950/30 border-slate-900 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-base text-slate-100">{item.title}</span>
                                {item.badge && (
                                  <Badge className={`text-xs font-bold border ${badgeStyle}`}>
                                    {item.badge}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-semibold ${
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-slate-800 text-slate-400 border-slate-700"
                                  }`}
                                >
                                  {isActive ? "Aktif (Tampil)" : "Nonaktif"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {item.updatedAt ? "Diperbarui: " : "Dibuat: "}
                                {formatDateTime(item.updatedAt || item.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => handleToggleAnnStatus(item.id, isActive)}
                                className={`text-xs h-8 border-slate-800 ${
                                  isActive
                                    ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                }`}
                              >
                                {isActive ? "Sembunyikan" : "Aktifkan"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditAnnModal(item)}
                                className="text-xs h-8 text-emerald-400 border-slate-800 bg-slate-900 hover:bg-slate-800 gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </Button>

                              <AlertDialog
                                open={deletingAnnId === item.id}
                                onOpenChange={(open) => setDeletingAnnId(open ? item.id : null)}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    title="Hapus Pengumuman"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-900/95 border-slate-800 text-slate-100">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-100">Hapus Pengumuman?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400">
                                      Apakah Anda yakin ingin menghapus pengumuman "{item.title}"? Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteAnnouncement(item.id)}
                                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed pt-2 border-t border-slate-800/80">
                            {item.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DIALOG BUAT / EDIT PENGUMUMAN */}
            <Dialog open={annModalOpen} onOpenChange={setAnnModalOpen}>
              <DialogContent className="max-w-md bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">{editingAnn ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {editingAnn ? "Perbarui isi atau status pengumuman resmi." : "Terbitkan pengumuman baru yang akan langsung muncul di dashboard pekerja."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveAnnouncement} className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="ann-title" className="text-xs text-slate-300">Judul Pengumuman *</Label>
                    <Input
                      id="ann-title"
                      placeholder="Contoh: Perubahan Harga Tier & Jam Operasional"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="ann-badge" className="text-xs text-slate-300">Label Badge (opsional)</Label>
                    <Input
                      id="ann-badge"
                      placeholder="Contoh: BARU, IMPORTANT, INFO, PENTING"
                      value={annBadge}
                      onChange={(e) => setAnnBadge(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Badge tampil sebagai tag warna di samping judul pengumuman.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="ann-content" className="text-xs text-slate-300">Isi Pengumuman *</Label>
                    <Textarea
                      id="ann-content"
                      rows={5}
                      placeholder="Tuliskan isi pengumuman secara lengkap di sini..."
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      className="mt-1 text-xs leading-relaxed bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Status Publikasi</Label>
                    <Select
                      value={annIsActive ? "ACTIVE" : "INACTIVE"}
                      onValueChange={(val) => setAnnIsActive(val === "ACTIVE")}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="ACTIVE" className="text-xs font-semibold text-emerald-400">
                          Aktif (Langsung Tampil di Workers)
                        </SelectItem>
                        <SelectItem value="INACTIVE" className="text-xs font-semibold text-slate-400">
                          Draft / Nonaktif (Disembunyikan)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAnnModalOpen(false)}
                      className="text-xs h-9 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={annSaving}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
                    >
                      {annSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {editingAnn ? "Simpan Perubahan" : "Terbitkan Pengumuman"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* RINGKASAN */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Batch Menunggu Review", value: stats.pendingSubmissions, highlight: true, accent: "emerald" },
                { label: "Stok Email Tersedia", value: `${stats.availableStock} item`, highlight: true, accent: "emerald" },
                { label: "Total Saldo Beredar", value: formatMoney(stats.totalBalance), highlight: true, accent: "teal" },
                { label: "Pekerja Aktif", value: stats.activeWorkers, highlight: true, accent: "emerald" },
                { label: "Total Pekerja", value: stats.totalWorkers },
                { label: "Pekerja Menunggu", value: stats.pendingWorkers },
                { label: "Total Batch Setoran", value: stats.totalSubmissions },
                { label: "Stok Email Terjual", value: `${stats.soldStock} item` },
                { label: "Penarikan Menunggu", value: `${stats.pendingWithdrawals} (${formatMoney(stats.pendingWithdrawalAmount)})` },
                { label: "Total Dicairkan", value: formatMoney(stats.totalPaidOut) },
              ].map((s) => (
                <Card key={s.label} className={`bg-slate-900/80 border backdrop-blur-xl transition-all shadow-md ${s.highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800"}`}>
                  <CardContent className="pt-5 pb-5">
                    <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                    <p className={`text-lg font-black mt-1 ${s.accent === "emerald" ? "text-emerald-400" : s.accent === "teal" ? "text-teal-400" : "text-slate-100"}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* VISUAL ANALYTICS & TREND CHART CARD */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-100">
                      <BarChart3 className="w-5 h-5 text-emerald-400" />
                      Grafik Tren Setoran & Verifikasi Gmail ACC (14 Hari Terakhir)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      Membandingkan jumlah email yang disetor vs email terverifikasi ACC per hari.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Gmail ACC Valid
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 rounded-md font-bold">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Total Disetor
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 pb-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dailySubmissionTrends}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#64748b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#020617",
                          borderColor: "#1e293b",
                          borderRadius: "0.75rem",
                          color: "#f8fafc",
                          fontSize: "12px",
                          boxShadow: "0 10px 25px -3px rgba(0,0,0,0.8)",
                        }}
                        itemStyle={{ padding: "2px 0" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalSubmitted"
                        name="Total Email Disetor"
                        stroke="#64748b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                      />
                      <Area
                        type="monotone"
                        dataKey="gmailAcc"
                        name="Gmail ACC Valid"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorAcc)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* GLOBAL MAINTENANCE MODE CONTROL CARD */}
            <Card className={`border transition-all backdrop-blur-xl ${currentMaintEnabled ? "bg-amber-950/20 border-amber-500/80 ring-2 ring-amber-500/20" : "bg-slate-900/80 border-slate-800"}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl text-slate-950 font-bold ${currentMaintEnabled ? "bg-amber-500 animate-pulse" : "bg-slate-800 text-slate-300"}`}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                          Mode Maintenance / Perbaikan Sistem Global
                          <Badge className={currentMaintEnabled ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 border-slate-700"}>
                            {currentMaintEnabled ? "BERJALAN (AKTIF)" : "NONAKTIF"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          Aktifkan untuk memblokir sementara dashboard pekerja dengan halaman maintenance resmi dan countdown timer real-time.
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setMaintEnabled(!currentMaintEnabled)}
                      className={currentMaintEnabled ? "bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"}
                    >
                      {currentMaintEnabled ? "Matikan Mode Maintenance" : "Aktifkan Mode Maintenance"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ESTIMATED COMPLETION TIMESTAMP INPUT & QUICK PRESETS */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" /> Estimasi Waktu Selesai (Target Completion)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={currentMaintTargetTime}
                      onChange={(e) => setMaintTargetTime(e.target.value)}
                      className="text-xs h-9 font-mono bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-semibold self-center mr-1">Quick Select:</span>
                      {[
                        { label: "+15 Menit", mins: 15 },
                        { label: "+30 Menit", mins: 30 },
                        { label: "+1 Jam", mins: 60 },
                        { label: "+2 Jam", mins: 120 },
                      ].map((preset, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickSetDuration(preset.mins)}
                          className="text-[11px] h-7 px-2.5 bg-slate-950 hover:bg-emerald-500/10 hover:text-emerald-400 border-slate-800 text-slate-300"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOM MAINTENANCE MESSAGE */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-300">
                      Pesan Pengumuman Maintenance (Tampil untuk Worker)
                    </Label>
                    <Textarea
                      rows={3}
                      value={currentMaintMessage}
                      onChange={(e) => setMaintNoteMessage(e.target.value)}
                      placeholder="Contoh: Pembaruan sistem & server rilis versi baru..."
                      className="text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveMaintenance}
                    disabled={savingMaint}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
                  >
                    {savingMaint && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Mode Maintenance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB KEUANGAN ADMIN */}
          <TabsContent value="finance" className="space-y-6">
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                      <DollarSign className="w-5 h-5 text-emerald-400" /> Keuangan
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      Laporan pemasukan, pengeluaran, dan saldo bersih per periode bulanan ({formatMonthYear(selectedPeriod)}).
                    </CardDescription>
                  </div>

                  {/* FILTER PERIODE BULAN */}
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-400 ml-1" />
                    <Label className="text-xs font-semibold text-slate-300">Periode:</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="h-8 w-44 text-xs font-bold bg-slate-900 border-slate-800 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
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
              <CardContent className="space-y-6 pt-4">
                {/* VENDOR SALE PRICE CONTROL */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-200">Harga Jual Vendor Per Email ACC:</span>
                    <p className="text-slate-400 text-[11px]">Digunakan untuk menghitung otomatis total estimasi Pemasukan kotor dari vendor.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 font-bold">Rp</span>
                    <FormattedNumberInput
                      value={vendorSalePrice}
                      onChange={(val) => setVendorSalePrice(val > 0 ? val : 4000)}
                      className="w-28 h-8 text-xs font-bold bg-slate-900 border-slate-800 text-emerald-400 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* RINGKASAN AUTOMATED FINANCIAL LEDGER CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* PEMASUKAN CARD */}
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400">Total Pemasukan (Income)</span>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-400">{formatMoney(automatedFinSummary.totalIncome)}</p>
                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-emerald-500/20">
                      <div className="flex justify-between">
                        <span>Vendor Email ({automatedFinSummary.periodApprovedAccs} ACC @ {formatMoney(vendorSalePrice)}):</span>
                        <strong className="text-emerald-300">{formatMoney(automatedFinSummary.vendorEmailIncome)}</strong>
                      </div>
                      {automatedFinSummary.manualIncome > 0 && (
                        <div className="flex justify-between">
                          <span>Pemasukan Manual:</span>
                          <strong className="text-emerald-300">{formatMoney(automatedFinSummary.manualIncome)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PENGELUARAN CARD */}
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-rose-400">Total Pengeluaran (Expense)</span>
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-rose-400">{formatMoney(automatedFinSummary.totalExpense)}</p>
                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-rose-500/20">
                      <div className="flex justify-between">
                        <span>Komisi Worker ACC:</span>
                        <strong className="text-rose-300">{formatMoney(automatedFinSummary.periodWorkerCommissions)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Penarikan Worker:</span>
                        <strong className="text-rose-300">{formatMoney(automatedFinSummary.periodWithdrawalsExpense)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Hadiah & Bonus (Leaderboard/Referral):</span>
                        <strong className="text-rose-300">{formatMoney(automatedFinSummary.periodRewardsExpense)}</strong>
                      </div>
                      {automatedFinSummary.manualExpense > 0 && (
                        <div className="flex justify-between">
                          <span>Pengeluaran Manual:</span>
                          <strong className="text-rose-300">{formatMoney(automatedFinSummary.manualExpense)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SALDO BERSIH CARD */}
                  <div className={`p-4 rounded-xl border space-y-2 flex flex-col justify-between ${automatedFinSummary.netBalance >= 0 ? "bg-teal-950/30 border-teal-500/30 text-teal-300" : "bg-rose-950/40 border-rose-500/40 text-rose-300"}`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">Saldo Bersih (Net Balance)</span>
                        <Wallet className="w-4 h-4 text-teal-400" />
                      </div>
                      <p className={`text-2xl font-black ${automatedFinSummary.netBalance >= 0 ? "text-teal-300" : "text-rose-400"}`}>
                        {formatMoney(automatedFinSummary.netBalance)}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      Auto-calculated: Pemasukan - Pengeluaran ({formatMonthYear(selectedPeriod)})
                    </p>
                  </div>
                </div>

                {/* SEARCH FILTER & ACTION BUTTONS: CATAT PEMASUKAN & PENGELUARAN */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <Input
                      placeholder="Cari transaksi manual..."
                      value={finSearch}
                      onChange={(e) => setFinSearch(e.target.value)}
                      className="h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => openAddFinModal("income")}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
                    >
                      <PlusCircle className="w-4 h-4" /> Catat Pemasukan
                    </Button>
                    <Button
                      onClick={() => openAddFinModal("expense")}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-rose-600/20"
                    >
                      <MinusCircle className="w-4 h-4" /> Catat Pengeluaran
                    </Button>
                  </div>
                </div>

                {/* DAFTAR TRANSAKSI KEUANGAN MANUAL */}
                {finLoading && <p className="text-sm text-slate-400 text-center py-8">Memuat laporan keuangan...</p>}
                {finError && (
                  <div className="p-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center rounded-lg">
                    Gagal memuat laporan keuangan. Silakan coba lagi.
                  </div>
                )}
                {!finLoading && !finError && filteredFinTransactions.length === 0 && (
                  <div className="p-10 border border-dashed border-slate-800 text-center rounded-xl bg-slate-950/40 space-y-1">
                    <p className="text-sm font-semibold text-slate-300">Belum ada transaksi manual pada periode ini.</p>
                    <p className="text-xs text-slate-500">Gunakan tombol di atas untuk mencatat penyesuaian pemasukan atau pengeluaran manual.</p>
                  </div>
                )}
                {!finLoading && !finError && filteredFinTransactions.length > 0 && (
                  <div className="space-y-3">
                    {filteredFinTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors shadow-sm"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-100 break-words">{tx.description}</span>
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold ${
                                  isIncome
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {isIncome ? "Pemasukan" : "Pengeluaran"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                              <span>Tanggal: {formatDate(tx.transactionDate)}</span>
                              {tx.note && <span className="italic truncate max-w-xs font-sans text-slate-500">Catatan: {tx.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-base font-black ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                              {isIncome ? "+" : "-"} {formatMoney(tx.amount)}
                            </span>

                            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditFinModal(tx)}
                                className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
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
                                    className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-900/95 border-slate-800 text-slate-100">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-100">Hapus Transaksi Keuangan?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400">
                                      Apakah Anda yakin ingin menghapus transaksi "{tx.description}" ({formatMoney(tx.amount)})?
                                      Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteFinTransaction(tx.id)}
                                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
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
              <DialogContent className="max-w-md bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">
                    {editingFinTx ? "Edit Transaksi Keuangan" : finType === "income" ? "Catat Pemasukan" : "Catat Pengeluaran"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {editingFinTx ? "Perbarui detail transaksi keuangan." : "Masukkan detail transaksi keuangan untuk laporan bulanan."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveFinTransaction} className="space-y-4 pt-2">
                  <div>
                    <Label className="text-xs text-slate-300">Tipe Transaksi</Label>
                    <Select
                      value={finType}
                      onValueChange={(val: FinancialTransactionType) => setFinType(val)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="income" className="text-xs font-semibold text-emerald-400">
                          Pemasukan (+)
                        </SelectItem>
                        <SelectItem value="expense" className="text-xs font-semibold text-rose-400">
                          Pengeluaran (-)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fin-desc" className="text-xs text-slate-300">Jenis / Keterangan Transaksi *</Label>
                    <Input
                      id="fin-desc"
                      placeholder={finType === "income" ? "Contoh: Penjualan Storage Gmail" : "Contoh: Pembayaran Worker / Biaya Operasional"}
                      value={finDescription}
                      onChange={(e) => setFinDescription(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-amount" className="text-xs text-slate-300">Jumlah Nominal (Rp) *</Label>
                    <FormattedNumberInput
                      id="fin-amount"
                      value={finAmount}
                      onChange={(val) => setFinAmount(val)}
                      placeholder="Contoh: 500.000"
                      className="mt-1 h-9 text-xs font-bold bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-date" className="text-xs text-slate-300">Tanggal Transaksi *</Label>
                    <Input
                      id="fin-date"
                      type="date"
                      value={finDate}
                      onChange={(e) => setFinDate(e.target.value)}
                      className="mt-1 h-9 text-xs font-mono bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      Periode otomatis ditentukan berdasarkan tanggal ({getMonthlyPeriodKey(finDate)}).
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="fin-note" className="text-xs text-slate-300">Catatan Tambahan (opsional)</Label>
                    <Input
                      id="fin-note"
                      placeholder="Contoh: Pembayaran customer via DANA / Invoice #102"
                      value={finNote}
                      onChange={(e) => setFinNote(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFinModalOpen(false)}
                      className="text-xs h-9 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={finSaving}
                      className={`${finType === "income" ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20" : "bg-rose-600 hover:bg-rose-500 text-white"} font-bold text-xs h-9 gap-1.5 shadow-lg`}
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
                className="text-xs h-9 flex-1 bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
              />
              <Select value={submissionStatusFilter} onValueChange={setSubmissionStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-44 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                  <SelectItem value="available">Stok Tersedia / Terjual</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submissions.loading && <p className="text-sm text-slate-400 text-center py-8">Memuat…</p>}
            {!submissions.loading && filteredSubmissions.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada data setoran / batch email.</p>
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
                <Card key={item.id} className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-md hover:border-slate-700 transition-all">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-base text-slate-100">{displayWorkerName}</p>
                          {!isFinalized ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400 font-medium">Tier Batch:</span>
                              <Select
                                disabled={busyId === item.id}
                                value={String(tierNum)}
                                onValueChange={(val) => handleBatchTierChange(item.id, val)}
                              >
                                <SelectTrigger className="h-7 text-xs bg-slate-950 border-emerald-500/40 text-emerald-400 font-bold min-w-[130px]">
                                  <SelectValue placeholder="Pilih Tier" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                  {activeTiersList.map((t) => (
                                    <SelectItem key={t.tier} value={String(t.tier)} className="text-xs font-medium">
                                      {t.name} ({formatMoney(t.pricePerItem)}/item)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                            </Badge>
                          )}
                        </div>
                        {isFinalized ? (
                          <div className="text-xs text-slate-300 font-medium flex flex-wrap items-center gap-2">
                            <span>Disetujui (ACC): <strong className="text-emerald-400">{approvedCount}</strong>/{count}</span>
                            <span>·</span>
                            <span>Ditolak: <strong className="text-rose-400">{rejectedCount}</strong></span>
                            <span>·</span>
                            <span>Total Payout: <strong className="text-teal-300">{formatMoney(totalVal)}</strong></span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300 font-medium">
                            <strong>{count} email disetorkan</strong> · Estimasi Awal: <span className="text-emerald-400 font-bold">{formatMoney(item.totalAmount ?? (count * pricePerItem))}</span>
                          </p>
                        )}
                        <p className="text-xs text-slate-500 font-mono">
                          #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetailModal(item)}
                          className="text-xs h-7 gap-1 border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" /> {item.status === "pending" ? "Tinjau Per Email" : "Lihat Detail"}
                        </Button>
                      </div>
                    </div>

                    {item.status !== "pending" && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                        <span>Status Stok:</span>
                        {(item.status === "available" || item.status === "approved") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            onClick={() => handleStockStatusChange(item.id, "sold")}
                            className="h-7 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
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
                            className="h-7 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
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
                            className="h-7 text-xs text-rose-400 hover:bg-rose-500/10"
                          >
                            Nonaktifkan / Tolak
                          </Button>
                        )}
                      </div>
                    )}

                    {item.reviewNote && <p className="text-xs text-slate-400 mt-2 italic">Catatan: {item.reviewNote}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* KELOLA PENARIKAN */}
          <TabsContent value="withdrawals" className="space-y-3">
            {withdrawals.loading && <p className="text-sm text-slate-400 text-center py-8">Memuat…</p>}
            {!withdrawals.loading && withdrawals.data.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Belum ada penarikan.</p>
            )}
            {withdrawals.data.map((item) => {
              const holderName = item.accountHolderName ?? item.accountName ?? "Belum tersedia";
              return (
                <Card key={item.id} className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-md">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-bold text-base text-slate-100">{item.method}</p>
                        <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                          <p>Pekerja: <strong className="text-slate-100">{workerName(item.workerId)}</strong></p>
                          <p>No. Rekening / Wallet: <strong className="text-slate-100 font-mono">{item.account}</strong></p>
                          <p>Atas Nama: <strong className="text-slate-100">{holderName}</strong></p>
                          <p>Jumlah: <strong className="text-emerald-400 font-bold">{formatMoney(item.amount)}</strong></p>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">
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
                        className="text-xs h-9 min-w-[140px] flex-1 bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      />
                      {item.status === "pending" && (
                        <Button
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => handleWithdrawalDecision(item.id, "processing")}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold gap-1 shrink-0"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Proses
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleWithdrawalDecision(item.id, "success")}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-1 shrink-0 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
                      >
                        {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Selesai
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleWithdrawalDecision(item.id, "rejected")}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-1 shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </Button>
                    </div>
                  )}
                  {item.note && <p className="text-xs text-slate-400 mt-2 italic">Catatan: {item.note}</p>}
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
                  <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-2 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500">
                    <UserPlus className="w-4 h-4" /> Tambah Pekerja
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Tambah Pekerja Baru</DialogTitle>
                    <DialogDescription className="text-slate-400">Akun akan langsung berstatus aktif.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddWorker} className="space-y-3">
                    <div>
                      <Label className="text-xs text-slate-300">Nama</Label>
                      <Input
                        value={newWorker.name}
                        onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-300">Email</Label>
                      <Input
                        type="email"
                        value={newWorker.email}
                        onChange={(e) => setNewWorker((p) => ({ ...p, email: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-300">Nomor HP (opsional)</Label>
                      <Input
                        value={newWorker.phone}
                        onChange={(e) => setNewWorker((p) => ({ ...p, phone: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-300">Kata Sandi</Label>
                        <Input
                          type="password"
                          value={newWorker.password}
                          onChange={(e) => setNewWorker((p) => ({ ...p, password: e.target.value }))}
                          className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Tier Awal</Label>
                        <Select value={newWorker.tier} onValueChange={(v) => setNewWorker((p) => ({ ...p, tier: v }))}>
                          <SelectTrigger className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                            {activeTiersList.map((t) => (
                              <SelectItem key={t.tier} value={String(t.tier)}>
                                {t.name} ({formatMoney(t.pricePerItem)}/item)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter className="pt-2">
                      <Button type="submit" disabled={addBusy} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-2 w-full hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20">
                        {addBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buat Akun
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {users.loading && <p className="text-sm text-slate-400 text-center py-8">Memuat…</p>}
            {users.data
              .filter((u) => u.role === "worker")
              .map((u) => {
                const currentTierCfg = getTierConfig(u.tier ?? 1, activeTiersList);
                const approvedCount = workerApprovedQtyMap.get(u.uid) ?? 0;
                const recTierCfg = getRecommendedTier(approvedCount, activeTiersList);
                const needsTierChange = Number(recTierCfg.tier) !== Number(currentTierCfg.tier);

                return (
                  <Card key={u.uid} className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-md">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-100">{u.name}</p>
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              {currentTierCfg.name} ({formatMoney(currentTierCfg.pricePerItem)}/item)
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                          <div className="flex gap-3 text-xs text-slate-300 mt-1">
                            <span>Total Item Disetujui: <strong>{approvedCount} item</strong></span>
                            <span>Saldo: <strong className="text-emerald-400">{formatMoney(u.balance ?? 0)}</strong></span>
                          </div>
                        </div>
                        <StatusBadge status={u.status} />
                      </div>

                      {/* Tier Recommendation Notice */}
                      {needsTierChange && (
                        <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                              Rekomendasi Tier: <strong>{recTierCfg.name}</strong> ({formatMoney(recTierCfg.pricePerItem)}/item) berdasarkan {approvedCount} item disetujui.
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUserTier(u.uid, recTierCfg.tier)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-7 text-[11px] shrink-0"
                          >
                            Terapkan {recTierCfg.name}
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <span>Set Tier Manual:</span>
                          <Select value={String(u.tier)} onValueChange={(v) => handleUserTier(u.uid, Number(v))}>
                            <SelectTrigger className="h-8 w-36 text-xs bg-slate-950/80 border-slate-800 text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
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
                            <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-8">
                              Setujui
                            </Button>
                            <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "rejected")} className="bg-rose-600 hover:bg-rose-500 text-white font-bold h-8">
                              Tolak
                            </Button>
                          </>
                        )}
                        {(u.status === "approved" || u.status === "active") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "inactive")} className="h-8 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800">
                            Nonaktifkan
                          </Button>
                        )}
                        {(u.status === "inactive" || u.status === "rejected") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="h-8 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800">
                            Aktifkan
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1 ml-auto">
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-900/95 border-slate-800 text-slate-100">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-slate-100">Hapus data pekerja ini?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-400">
                                Ini menghapus profil "{u.name}" dari Firestore.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.uid)} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
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
            {/* LEADERBOARD MANAGEMENT SECTION */}
            <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                      <Trophy className="w-5 h-5 text-emerald-400" />
                      Manajemen Leaderboard & Otomatisasi Payout Reward
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      Hitung real-time top pekerja berdasarkan email ACC terverifikasi dan cairkan bonus Juara 1, 2, 3 langsung ke Wallet Balance pekerja.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" />
                      Mingguan
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={distributingLeaderboard || currentLeaderboardStandings.length === 0}
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
                        >
                          {distributingLeaderboard ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Gift className="w-4 h-4" />
                          )}
                          End Period & Distribute Reward
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900/95 border-slate-800 text-slate-100">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Akhiri Periode & Cairkan Hadiah Leaderboard?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Tindakan ini akan mentransfer bonus secara otomatis langsung ke Wallet Balance pemenang Top 3 untuk periode{" "}
                            <strong className="text-emerald-400">{currentLeaderboardTimeframe.label}</strong> dan mencatat transaksi "Bonus Reward Leaderboard".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2 space-y-2 text-xs border-y border-slate-800 my-2">
                          <p className="font-bold text-slate-200">Calon Penerima Hadiah:</p>
                          {currentLeaderboardStandings.slice(0, 3).map((w) => (
                            <div key={w.workerId} className="flex justify-between items-center bg-slate-950/80 p-2 rounded-md border border-slate-800">
                              <span>Juara #{w.rank}: <strong className="text-slate-100">{w.workerName}</strong> ({w.validAccCount} ACC)</span>
                              <strong className="text-emerald-400">{formatMoney(w.rewardAmount || 0)}</strong>
                            </div>
                          ))}
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDistributeLeaderboardRewards}
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold hover:from-emerald-400 hover:to-teal-500"
                          >
                            Cairkan Saldo Sekarang
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* STANDINGS PREVIEW GRID */}
                <div>
                  <Label className="text-xs font-bold text-slate-200 mb-2 block">
                    Klasemen Sementara ({currentLeaderboardTimeframe.label}):
                  </Label>
                  {currentLeaderboardStandings.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                      Belum ada email ACC terverifikasi pada periode ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {currentLeaderboardStandings.slice(0, 3).map((item) => {
                        const payoutKey = `${currentLeaderboardTimeframe.key}_rank${item.rank}_${item.workerId}`;
                        const isPaid = paidLeaderboardSet.has(payoutKey);
                        const isPaying = payingIndividualWorkerId === item.workerId;
                        const rewardAmt = item.rewardAmount || (item.rank === 1 ? 50000 : item.rank === 2 ? 30000 : 15000);

                        return (
                          <div
                            key={item.workerId}
                            className={`p-3.5 rounded-xl border text-left bg-slate-950/60 shadow-sm space-y-2 flex flex-col justify-between ${
                              item.rank === 1 ? "border-emerald-500/50 ring-1 ring-emerald-500/20 bg-emerald-500/5" : "border-slate-800"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Badge
                                  className={`text-[10px] font-extrabold ${
                                    item.rank === 1
                                      ? "bg-emerald-500 text-slate-950"
                                      : item.rank === 2
                                        ? "bg-slate-700 text-slate-200"
                                        : "bg-slate-800 text-slate-300"
                                  }`}
                                >
                                  Juara #{item.rank}
                                </Badge>
                                <span className="text-[11px] font-mono text-slate-500">{item.maskedName}</span>
                              </div>
                              <div>
                                <p className="font-bold text-slate-100 text-sm">{item.workerName}</p>
                                <p className="text-xs text-emerald-400 font-bold">{item.validAccCount} Email ACC Valid</p>
                              </div>
                              <div className="pt-1 border-t border-slate-800/80 flex justify-between items-center text-xs">
                                <span className="text-slate-400">Reward:</span>
                                <span className="font-black text-emerald-400">{formatMoney(rewardAmt)}</span>
                              </div>
                            </div>

                            <div className="pt-1">
                              {isPaid ? (
                                <Button
                                  disabled
                                  size="sm"
                                  variant="outline"
                                  className="w-full text-xs h-8 bg-slate-900 border-slate-800 text-emerald-400 font-bold gap-1 opacity-80 cursor-not-allowed"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Sudah Dicairkan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={isPaying || item.validAccCount <= 0}
                                  onClick={() => handleCairkanIndividualReward(item)}
                                  className="w-full text-xs h-8 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold hover:from-emerald-400 hover:to-teal-500 shadow-md shadow-emerald-500/10 gap-1"
                                >
                                  {isPaying ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Gift className="w-3.5 h-3.5" />
                                  )}
                                  Cairkan Reward
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIWAYAT PAYOUT LEADERBOARD HISTORICAL TABLE */}
                <div className="pt-2 border-t border-slate-800">
                  <Label className="text-xs font-bold text-slate-200 mb-2 block">
                    Riwayat Pencairan Hadiah Leaderboard ({leaderboardPayouts?.data?.length || 0})
                  </Label>
                  {(!leaderboardPayouts?.data || leaderboardPayouts.data.length === 0) ? (
                    <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                      Belum ada pencairan hadiah leaderboard sebelumnya.
                    </p>
                  ) : (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80 max-h-60 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3 py-2">Waktu Cair</th>
                            <th className="px-3 py-2">Periode</th>
                            <th className="px-3 py-2">Juara</th>
                            <th className="px-3 py-2">Pekerja</th>
                            <th className="px-3 py-2 text-right">Hadiah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {leaderboardPayouts.data.map((payout) => (
                            <tr key={payout.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-3 py-2 font-mono text-slate-400">{formatDateTime(payout.paidAt)}</td>
                              <td className="px-3 py-2 font-bold text-slate-200">{payout.periodKey}</td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold text-[10px]">
                                  Juara #{payout.rank}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-200">{payout.workerName || workerName(payout.workerId)}</td>
                              <td className="px-3 py-2 font-black text-emerald-400 text-right">{formatMoney(payout.rewardAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* PENDING MISSION CLAIMS REVIEW */}
            {pendingMissionClaims.length > 0 && (
              <Card className="border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl text-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                    <Target className="w-5 h-5 text-emerald-400" /> Klaim Misi Menunggu Review ({pendingMissionClaims.length})
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Pekerja mengajukan klaim misi. Verifikasi dan setujui untuk mencairkan saldo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingMissionClaims.map((claim) => (
                    <div key={claim.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-100">{claim.workerName || workerName(claim.workerId)}</p>
                        <p className="text-slate-400 mt-0.5">Misi ID: {claim.missionId} · Periode: {claim.periodKey}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={busyId === claim.id}
                          onClick={() => handleReviewMission(claim.id, "approved")}
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-8 gap-1 hover:from-emerald-400 hover:to-teal-500"
                        >
                          {busyId === claim.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Setujui
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyId === claim.id}
                          onClick={() => handleReviewMission(claim.id, "rejected")}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs h-8 gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* REFERRAL DATA & CONTROL */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                      <Users className="w-5 h-5 text-emerald-400" /> Pengaturan & Data Referral
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Atur tier kualifikasi referral dan lihat status kualifikasi serta total reward yang diklaim pengundang.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleEvaluateReferrals}
                    disabled={evaluatingRefs}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs gap-1.5 shrink-0 hover:from-emerald-400 hover:to-teal-500"
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
                      <Label className="text-sm font-bold text-slate-200">Tier Reward Referral</Label>
                      <p className="text-xs text-slate-400">Atur syarat minimal ACC dan hadiah reward untuk setiap tier referral.</p>
                    </div>
                    {!isAddingRefTier && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingRefTier(true)}
                        className="gap-1 text-xs h-8 border-slate-800 bg-slate-950 text-emerald-400 hover:bg-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Tier
                      </Button>
                    )}
                  </div>

                  {/* TABLE DISPLAY */}
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                        <tr>
                          <th className="px-3 py-2">Minimal ACC</th>
                          <th className="px-3 py-2">Reward</th>
                          <th className="px-3 py-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeReferralTiers.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-slate-100">{t.minAcc} ACC</td>
                            <td className="px-3 py-2.5 font-bold text-emerald-400">{formatMoney(t.reward)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditRefTierModal(idx, t)}
                                  className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveReferralTier(idx)}
                                  className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* + TAMBAH TIER FORM */}
                  {isAddingRefTier && (
                    <Card className="border-slate-800 bg-slate-950/80">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-xs font-bold text-emerald-400">Tambah Tier Referral Baru</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-slate-300">Minimal ACC</Label>
                            <Input
                              type="number"
                              placeholder="Contoh: 100"
                              value={newRefMinAcc}
                              onChange={(e) => setNewRefMinAcc(e.target.value === "" ? "" : Number(e.target.value))}
                              className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-300">Reward (Rp)</Label>
                            <FormattedNumberInput
                              value={newRefReward === "" ? 0 : newRefReward}
                              onChange={(val) => setNewRefReward(val)}
                              placeholder="Contoh: 10000"
                              className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
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
                            className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingRefTiers}
                            onClick={handleAddReferralTierSubmit}
                            className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-1 hover:from-emerald-400 hover:to-teal-500"
                          >
                            {savingRefTiers && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Simpan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* TABLE DAFTAR REFERRAL DATA */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-bold text-slate-200">
                      Daftar Hubungan Referral ({referrals.data.length})
                    </Label>
                  </div>

                  {referrals.data.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded-lg">
                      Belum ada data pendaftaran referral.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {referrals.data.map((ref) => {
                        const currentAcc = ref.currentAccCount ?? 0;
                        const qualTier = getReferralTierForAccCount(currentAcc, activeReferralTiers);

                        const isPaid = ref.status === "PAID" || ref.status === "REWARDED";
                        const isQualified = ref.status === "QUALIFIED";
                        const isRejected = ref.status === "REJECTED";

                        let statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                        let statusText = "PENDING";

                        if (isPaid) {
                          statusBadgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                          statusText = "PAID";
                        } else if (isQualified) {
                          statusBadgeClass = "bg-sky-500/10 text-sky-400 border-sky-500/30";
                          statusText = "QUALIFIED";
                        } else if (isRejected) {
                          statusBadgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                          statusText = "REJECTED";
                        }

                        return (
                          <div key={ref.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-200">
                                  Pengundang: <span className="text-emerald-400">{ref.referrerName || workerName(ref.referrerId)}</span> ({shortId(ref.referrerId)})
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="font-bold text-slate-200">
                                  Yang Diundang: <span className="text-teal-300">{ref.referredWorkerName || workerName(ref.referredWorkerId)}</span> ({shortId(ref.referredWorkerId)})
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-slate-400 font-medium">
                                <span>ACC: <strong className="text-slate-100">{currentAcc}</strong></span>
                                <span>Tier: <strong className="text-teal-300">{qualTier ? `${qualTier.minAcc} ACC` : "-"}</strong></span>
                                <span>Total Reward Diklaim: <strong className="text-emerald-400">{formatMoney(ref.rewardAmount ?? 0)}</strong></span>
                              </div>

                              <div className="text-[11px] text-slate-500 font-mono flex flex-wrap gap-2">
                                <span>Daftar: {formatDateTime(ref.createdAt)}</span>
                                {ref.qualifiedAt ? <span>· Qualified: {formatDateTime(ref.qualifiedAt)}</span> : null}
                                {ref.rewardedAt ? <span>· Paid: {formatDateTime(ref.rewardedAt)}</span> : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-[11px] font-medium border ${statusBadgeClass}`}>
                                {statusText}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>


            {/* DIALOG EDIT TIER REFERRAL */}
            <Dialog open={isEditingRefTierOpen} onOpenChange={setIsEditingRefTierOpen}>
              <DialogContent className="max-w-md bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">Edit Tier Referral</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Perbarui syarat minimal ACC dan nominal reward untuk tier referral ini.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={(e) => { e.preventDefault(); handleEditReferralTierSubmit(); }} className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="edit-ref-minacc" className="text-xs text-slate-300">Minimal ACC *</Label>
                    <Input
                      id="edit-ref-minacc"
                      type="number"
                      placeholder="Contoh: 10"
                      value={editingRefMinAcc}
                      onChange={(e) => setEditingRefMinAcc(e.target.value === "" ? "" : Number(e.target.value))}
                      className="mt-1 h-9 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-ref-reward" className="text-xs text-slate-300">Reward Amount (Rp) *</Label>
                    <FormattedNumberInput
                      id="edit-ref-reward"
                      value={editingRefReward === "" ? 0 : editingRefReward}
                      onChange={(val) => setEditingRefReward(val)}
                      placeholder="Contoh: 5000"
                      className="mt-1 h-9 text-xs font-bold bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingRefTierOpen(false)}
                      className="text-xs h-9 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingEditRefTier}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
                    >
                      {savingEditRefTier && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Perubahan
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* AUDIT LEDGER HADIAH */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100">Audit Ledger Payout Hadiah</CardTitle>
                <CardDescription className="text-slate-400">
                  Rekam jejak seluruh pencairan hadiah (referral, misi, klasemen) yang transparan dan dapat diaudit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rewardLedger.data.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">Belum ada transaksi pencairan hadiah.</p>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {rewardLedger.data.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-100">{log.workerName || workerName(log.workerId)}</p>
                        <p className="text-slate-400 mt-0.5">{log.description}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{formatDateTime(log.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold">
                          +{formatMoney(log.amount)}
                        </Badge>
                        <p className="text-[10px] text-slate-500 uppercase font-mono mt-1">{log.rewardType}</p>
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
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-100">Konfigurasi Tier Pekerja</CardTitle>
                      <CardDescription className="text-slate-400">
                        Atur rentang jumlah item dan harga per item untuk tiap tier. Sistem akan memberikan rekomendasi otomatis ke admin.
                      </CardDescription>
                    </div>
                    <Button onClick={handleAddTierConfig} variant="outline" className="gap-1 text-xs border-slate-800 bg-slate-950 text-emerald-400 hover:bg-slate-800">
                      <Plus className="w-3.5 h-3.5" /> Tambah Tier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeTiers.map((t, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                      <div>
                        <Label className="text-xs text-slate-300">Nama Tier</Label>
                        <Input
                          value={t.name}
                          onChange={(e) => handleUpdateTierConfig(idx, "name", e.target.value)}
                          className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Min. Qty</Label>
                        <Input
                          type="number"
                          value={t.minQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "minQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Max. Qty</Label>
                        <Input
                          type="number"
                          value={t.maxQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "maxQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Harga / Item (Rp)</Label>
                        <FormattedNumberInput
                          value={t.pricePerItem}
                          onChange={(val) => handleUpdateTierConfig(idx, "pricePerItem", val)}
                          className="mt-1 h-8 text-xs bg-slate-900 border-slate-800 text-slate-100"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTierConfig(idx)}
                          className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* PER-METHOD WITHDRAWAL FEE CONFIGURATION */}
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                        <Wallet className="w-5 h-5 text-emerald-400" /> Pengaturan Biaya Penarikan Per-Metode Pembayaran
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        Konfigurasi jenis dan nilai biaya admin/layanan secara spesifik untuk setiap Bank dan E-Wallet.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleSaveWithdrawalSettings}
                      disabled={savingWithdrawalSettings}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shrink-0 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
                    >
                      {savingWithdrawalSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Konfigurasi Penarikan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
                    <div>
                      <Label className="text-xs font-semibold text-slate-300">Minimal Penarikan (Rp)</Label>
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
                        className="mt-1 h-9 text-xs bg-slate-900 border-slate-800 text-slate-100"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-300">Maksimal Penarikan (Rp)</Label>
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
                        className="mt-1 h-9 text-xs bg-slate-900 border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-bold text-slate-200 mb-2 block">
                      Daftar Metode Pembayaran & Struktur Biaya
                    </Label>
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Metode Pembayaran</th>
                            <th className="px-3 py-2.5">Kategori</th>
                            <th className="px-3 py-2.5">Jenis Biaya</th>
                            <th className="px-3 py-2.5">Nilai Biaya</th>
                            <th className="px-3 py-2.5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {currentMethods.map((m, idx) => (
                            <tr key={idx} className={m.enabled ? "hover:bg-slate-800/40 transition-colors" : "bg-slate-950/40 opacity-50"}>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleMethodEnabled(idx, !m.enabled)}
                                  className={`text-[11px] h-7 px-2 font-bold border-slate-800 ${
                                    m.enabled
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                  }`}
                                >
                                  {m.enabled ? "✓ Aktif" : "Nonaktif"}
                                </Button>
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-100 whitespace-nowrap">{m.method}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <Select
                                  value={m.category ?? "bank"}
                                  onValueChange={(val) => handleUpdateMethodFee(idx, "category", val)}
                                >
                                  <SelectTrigger className="h-7 text-[11px] w-28 bg-slate-900 border-slate-800 text-slate-100">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                    <SelectItem value="bank" className="text-xs">Bank Transfer</SelectItem>
                                    <SelectItem value="ewallet" className="text-xs">E-Wallet</SelectItem>
                                    <SelectItem value="other" className="text-xs">Lainnya</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <Select
                                  value={m.feeType}
                                  onValueChange={(val) => handleUpdateMethodFee(idx, "feeType", val)}
                                >
                                  <SelectTrigger className="h-7 text-[11px] w-32 bg-slate-900 border-slate-800 text-slate-100">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                    <SelectItem value="free" className="text-xs text-emerald-400 font-semibold">Bebas Biaya (Gratis)</SelectItem>
                                    <SelectItem value="fixed" className="text-xs text-sky-400 font-semibold">Biaya Tetap (Rp)</SelectItem>
                                    <SelectItem value="percentage" className="text-xs text-teal-300 font-semibold">Persentase (%)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {m.feeType === "free" ? (
                                  <span className="text-emerald-400 font-semibold">Rp 0 (Gratis)</span>
                                ) : m.feeType === "fixed" ? (
                                  <div className="w-32">
                                    <FormattedNumberInput
                                      value={m.feeValue}
                                      onChange={(val) => handleUpdateMethodFee(idx, "feeValue", val)}
                                      className="h-7 text-xs bg-slate-900 border-slate-800 font-bold text-sky-400"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 w-28">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={m.feeValue}
                                      onChange={(e) => handleUpdateMethodFee(idx, "feeValue", parseFloat(e.target.value) || 0)}
                                      className="h-7 text-xs bg-slate-900 border-slate-800 font-bold text-teal-300"
                                    />
                                    <span className="font-bold text-slate-400 text-xs">%</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMethod(idx)}
                                  className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FORM TAMBAH METODE BARU */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
                    <p className="text-xs font-bold text-slate-200">Tambah Metode Pembayaran Baru</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Nama Metode (contoh: Permata, LinkAja)"
                        value={newMethodName}
                        onChange={(e) => setNewMethodName(e.target.value)}
                        className="h-8 text-xs flex-1 bg-slate-900 border-slate-800 text-slate-100 focus:border-emerald-500"
                      />
                      <Select
                        value={newMethodCategory}
                        onValueChange={(val: "bank" | "ewallet") => setNewMethodCategory(val)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full sm:w-36 bg-slate-900 border-slate-800 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="bank" className="text-xs">Bank Transfer</SelectItem>
                          <SelectItem value="ewallet" className="text-xs">E-Wallet</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleAddMethod}
                        className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-1 shrink-0 hover:from-emerald-400 hover:to-teal-500 shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Metode
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* GENERAL RULES & NOTES */}
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100">Aturan Setor Email & Instruksi Kata Sandi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-300">Aturan Setor Email & Kata Sandi (Instruksi Multiline)</Label>
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
                      className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                  <Button onClick={handleSaveRules} disabled={savingRules} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-2 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20">
                    {savingRules && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Pengaturan Aturan & Tier
                  </Button>
                </CardContent>
              </Card>

              {/* JAM OPERASIONAL */}
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100">Jam Operasional</CardTitle>
                  <CardDescription className="text-slate-400">
                    Atur jadwal operasional harian dan zona waktu platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
                    <div>
                      <Label className="font-bold text-sm text-slate-200">Status Jam Operasional Global</Label>
                      <p className="text-xs text-slate-400">Aktifkan atau nonaktifkan fitur jam operasional secara menyeluruh.</p>
                    </div>
                    <Select
                      value={currentOperatingHours.enabled ? "ON" : "OFF"}
                      onValueChange={(val) => handleUpdateGlobalOperatingHours(val === "ON")}
                    >
                      <SelectTrigger className="w-28 text-xs h-8 bg-slate-900 border-slate-800 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
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
                            dayConfig.enabled ? "bg-slate-950/60 border-slate-800" : "bg-slate-950/30 border-slate-900 text-slate-500 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-3 w-32">
                            <span className="font-bold text-sm text-slate-100">{d.label}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <Select
                              value={dayConfig.enabled ? "ON" : "OFF"}
                              onValueChange={(val) => handleUpdateDayOperatingHours(d.key, "enabled", val === "ON")}
                            >
                              <SelectTrigger className="w-24 text-xs h-8 bg-slate-900 border-slate-800 text-slate-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                                <SelectItem value="ON">ON</SelectItem>
                                <SelectItem value="OFF">OFF</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Buka:</span>
                              <Input
                                value={dayConfig.open}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "open", e.target.value)}
                                placeholder="08:00"
                                className="w-24 h-8 text-xs font-mono bg-slate-900 border-slate-800 text-slate-100"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Tutup:</span>
                              <Input
                                value={dayConfig.close}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "close", e.target.value)}
                                placeholder="18:00"
                                className="w-24 h-8 text-xs font-mono bg-slate-900 border-slate-800 text-slate-100"
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
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-2 text-xs hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
                  >
                    {savingOperatingHours && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Jam Operasional
                  </Button>
                </CardContent>
              </Card>

              {/* PUSAT BANTUAN / CUSTOMER SERVICE */}
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100">Pusat Bantuan / Customer Service</CardTitle>
                  <CardDescription className="text-slate-400">
                    Atur tautan dan informasi Customer Service Telegram yang tampil untuk seluruh pekerja.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-300">Nama layanan</Label>
                    <Input
                      value={currentSupportTitle}
                      onChange={(e) => setSupportTitle(e.target.value)}
                      placeholder="Customer Service"
                      className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Link Telegram</Label>
                    <Input
                      value={currentSupportTelegramUrl}
                      onChange={(e) => setSupportTelegramUrl(e.target.value)}
                      placeholder="https://t.me/username"
                      className="mt-1.5 text-xs font-mono bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Deskripsi</Label>
                    <Textarea
                      rows={3}
                      value={currentSupportDescription}
                      onChange={(e) => setSupportDescription(e.target.value)}
                      placeholder="Ada kendala? Hubungi Customer Service kami melalui Telegram."
                      className="mt-1.5 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300">Status</Label>
                    <Select
                      value={currentSupportEnabled ? "ON" : "OFF"}
                      onValueChange={(val) => setSupportEnabled(val === "ON")}
                    >
                      <SelectTrigger className="mt-1.5 w-36 text-xs bg-slate-950/80 border-slate-800 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveSupportConfig}
                    disabled={savingSupport}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold gap-2 text-xs hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
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
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900/95 border-slate-800 text-slate-100 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Tinjau Batch Setoran Email</DialogTitle>
              <DialogDescription className="text-slate-400">
                Pekerja: <strong className="text-slate-200">{detailSubmission?.workerName || workerName(detailSubmission?.workerId ?? "")}</strong> · <span className="font-mono">#{shortId(detailSubmission?.id ?? "")}</span>
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

              // Resolved tier and price based on submission override or dynamic default
              const currentBatchTierNum = detailSubmission.appliedTier ?? detailSubmission.currentTier;
              const recTierCfg = isReadOnly
                ? getTierConfig(currentBatchTierNum ?? 1, activeTiersList)
                : (currentBatchTierNum ? getTierConfig(currentBatchTierNum, activeTiersList) : getRecommendedTier(approvedCount, activeTiersList));

              const pricePerItem = isReadOnly
                ? (detailSubmission.appliedPricePerItem ?? recTierCfg.pricePerItem)
                : (detailSubmission.currentPricePerItem ?? detailSubmission.pricePerEmail ?? recTierCfg.pricePerItem);

              const calcTotal = isReadOnly
                ? (detailSubmission.totalAmount ?? (approvedCount * pricePerItem))
                : (approvedCount * pricePerItem);

              return (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-400">Total Item:</span>
                      <p className="font-bold text-slate-100">{baseItems.length} item</p>
                    </div>
                    <div>
                      <span className="text-slate-400">ACC:</span>
                      <p className="font-bold text-emerald-400">{approvedCount} item</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Ditolak:</span>
                      <p className="font-bold text-rose-400">{rejectedCount} item</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Hasil Tier:</span>
                      <p className="font-bold text-teal-300">{recTierCfg.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Saldo:</span>
                      <p className="font-bold text-emerald-400">{formatMoney(calcTotal)}</p>
                    </div>
                  </div>

                  {/* BULK COPY TOOLBAR */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Salin Rekap Email:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyAllEmails(baseItems)}
                        className="h-7 text-xs bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800 gap-1 font-medium"
                      >
                        {copiedBulkType === "emails" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        Salin Semua Email
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyEmailsWithPasswords(baseItems)}
                        className="h-7 text-xs bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800 gap-1 font-medium"
                      >
                        {copiedBulkType === "passwords" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        Salin Email | Sandi
                      </Button>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center justify-between gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-300 font-medium">Setujui/Tolak Semua:</span>
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
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
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
                          className="h-7 text-xs text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                        >
                          Tolak Semua (X)
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-slate-400 mb-1.5 block">
                      Tinjau Item Email Individu ({baseItems.length} item):
                    </Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950/80">
                      {baseItems.map((it, idx) => {
                        const currentSt = itemStatuses[idx] ?? "pending";
                        const isCopied = copiedSingleIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-md border flex items-center justify-between gap-2 text-xs transition-colors ${
                              currentSt === "approved"
                                ? "bg-emerald-950/30 border-emerald-500/30"
                                : currentSt === "rejected"
                                  ? "bg-rose-950/30 border-rose-500/30"
                                  : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <div className="min-w-0 flex-1 font-mono">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                                <span className="truncate">{idx + 1}. {it.email}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                                  title="Salin Email"
                                  onClick={() => handleCopySingleEmail(it.email, idx)}
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                              {it.password && <p className="text-[11px] text-slate-400">Sandi: {it.password}</p>}
                            </div>

                            {isReadOnly ? (
                              <Badge
                                className={
                                  currentSt === "approved"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                    : currentSt === "rejected"
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                      : "bg-slate-800 text-slate-400"
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
                                      ? "bg-emerald-500 text-slate-950 font-bold"
                                      : "bg-slate-900 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400 border border-slate-800"
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
                                      ? "bg-rose-600 text-white font-bold"
                                      : "bg-slate-900 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-800"
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
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div>
                        <Label htmlFor="batch-note" className="text-xs text-slate-300">Catatan Review Admin (opsional)</Label>
                        <Input
                          id="batch-note"
                          placeholder="Contoh: 3 email valid, 2 email tidak bisa login"
                          value={notes[detailSubmission.id] ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [detailSubmission.id]: e.target.value }))}
                          className="mt-1 h-8 text-xs bg-slate-950/80 border-slate-800 text-slate-100 focus:border-emerald-500"
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={busyId === detailSubmission.id || pendingCount > 0}
                        onClick={() => handleFinalizeBatchReview(detailSubmission)}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs gap-2 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
                      >
                        {busyId === detailSubmission.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Finalisasi Review Batch ({approvedCount} Disetujui · {formatMoney(calcTotal)})
                      </Button>
                      {pendingCount > 0 && (
                        <p className="text-[11px] text-amber-400 text-center font-medium">
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
