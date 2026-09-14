import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Send,
  History,
  Wallet,
  LogOut,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Award,
  Users,
  Copy,
  Check,
  HelpCircle,
  MessageCircle,
  User,
  Megaphone,
  Building2,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Share2,
  Coins,
  Trophy,
  Home,
  PlusCircle,
  ChevronRight,
  BookOpen,
  Tag,
  SearchCheck,
} from "lucide-react";
import { EmailChecker } from "@/components/EmailChecker";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useWorkerData,
  useWorkerEngagementData,
  useSettings,
  useMyReferral,
  useAnnouncements,
  useReferralTransactions,
  useDownlineWorkers,
  claimReferralCode,
  claimReferralReward,
  createSubmission,
  createWithdrawal,
} from "@/hooks/use-portal";
import { DEFAULT_RULES, DEFAULT_OPERATING_HOURS, DEFAULT_WITHDRAWAL_SETTINGS, DEFAULT_MAINTENANCE, DEFAULT_GENERAL_SETTINGS, type EmailSubmission, type PortalUser, type PaymentMethodFeeConfig } from "@/lib/portal-types";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { SubmissionHistory } from "@/components/SubmissionHistory";
import { TransactionHistory } from "@/components/TransactionHistory";
import {
  formatDateTime,
  formatMoney,
  getTierConfig,
  shortId,
  validatePasswordAgainstRules,
  getOperatingStatus,
  getPaymentMethodFeeConfig,
  calculateWithdrawalFee,
  formatFeeBadge,
} from "@/lib/portal-utils";

function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: React.JSX.Element }> = {
    pending: { label: "Menunggu", className: "bg-amber-100 text-amber-800 hover:bg-amber-100", icon: <Clock className="w-3 h-3" /> },
    processing: { label: "Diproses", className: "bg-blue-100 text-blue-800 hover:bg-blue-100", icon: <Loader2 className="w-3 h-3" /> },
    approved: { label: "Terjual", className: "bg-green-100 text-green-800 hover:bg-green-100", icon: <CheckCircle2 className="w-3 h-3" /> },
    available: { label: "Terjual", className: "bg-green-100 text-green-800 hover:bg-green-100", icon: <CheckCircle2 className="w-3 h-3" /> },
    sold: { label: "Terjual", className: "bg-green-100 text-green-800 hover:bg-green-100", icon: <CheckCircle2 className="w-3 h-3" /> },
    success: { label: "Berhasil", className: "bg-green-100 text-green-800 hover:bg-green-100", icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: "Ditolak", className: "bg-red-100 text-red-800 hover:bg-red-100", icon: <XCircle className="w-3 h-3" /> },
  };
  const v = variants[status] ?? variants.pending;
  return (
    <Badge className={`gap-1 font-medium ${v.className}`} variant="secondary">
      {v.icon}
      {v.label}
    </Badge>
  );
}

export type DashboardView =
  | "home"
  | "submit"
  | "checker"
  | "leaderboard"
  | "referral"
  | "withdraw"
  | "history"
  | "cs"
  | "announcements";

export default function WorkerDashboard({ profile, onLogout }: { profile: PortalUser; onLogout: () => void }) {
  const { submissions, withdrawals } = useWorkerData(profile.uid);
  const engagement = useWorkerEngagementData(profile.uid);
  const referralTxs = useReferralTransactions(profile.uid);
  const downlines = useDownlineWorkers(profile.uid);
  const rules = useSettings("rules", DEFAULT_RULES);
  const generalSettingsHook = useSettings("general", DEFAULT_GENERAL_SETTINGS);
  const withdrawalSettingsHook = useSettings("withdrawal", DEFAULT_WITHDRAWAL_SETTINGS);
  const maintenanceHook = useSettings("maintenance", DEFAULT_MAINTENANCE);
  const myReferral = useMyReferral(profile.uid);
  const announcements = useAnnouncements();

  // Maintenance Mode real-time countdown & unlock logic
  const maintenance = maintenanceHook.data ?? DEFAULT_MAINTENANCE;
  const isMaintenanceActive = maintenance.enabled && profile.role !== "admin";

  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
  });

  useEffect(() => {
    if (!isMaintenanceActive) return;

    function calcTimeLeft() {
      if (!maintenance.targetEndTime) {
        return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
      }
      const targetMs = new Date(maintenance.targetEndTime).getTime();
      const nowMs = Date.now();
      const diffMs = targetMs - nowMs;

      if (diffMs <= 0 || isNaN(diffMs)) {
        return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      return { hours, minutes, seconds, totalMs: diffMs };
    }

    setTimeLeft(calcTimeLeft());

    const timer = setInterval(() => {
      const remaining = calcTimeLeft();
      setTimeLeft(remaining);
      if (remaining.totalMs <= 0 && maintenance.targetEndTime) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isMaintenanceActive, maintenance.targetEndTime]);

  // Render Maintenance Mode Screen if maintenance is enabled and user is not Admin
  if (isMaintenanceActive) {
    return <MaintenanceScreen maintenance={maintenance} onLogout={onLogout} />;
  }

  // Active View State (Full-Page Navigation)
  const [activeView, setActiveView] = useState<DashboardView>("home");

  // Email sensor state
  const [isEmailVisible, setIsEmailVisible] = useState(false);

  // Engagement UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitationCodeInput, setInvitationCodeInput] = useState("");
  const [claimingCode, setClaimingCode] = useState(false);
  const [busyClaimTierKey, setBusyClaimTierKey] = useState<string | null>(null);

  // Pasif Income Simulation state
  const [simFriends, setSimFriends] = useState(10);
  const [simAccPerFriend, setSimAccPerFriend] = useState(10);

  const pendingClaimsSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(engagement.referralClaims?.data)) {
      engagement.referralClaims.data.forEach((c) => {
        if (c.status === "pending") {
          set.add(`${c.referralId}_${c.minAcc}`);
        }
      });
    }
    return set;
  }, [engagement.referralClaims?.data]);

  async function handleClaimTier(referralId: string, minAcc: number) {
    const key = `${referralId}_${minAcc}`;
    if (busyClaimTierKey) return;
    setBusyClaimTierKey(key);
    try {
      const res = await claimReferralReward(referralId, minAcc);
      toast.success(res.message || `🎉 Reward referral berhasil diklaim +${formatMoney(res.rewardAmount || 0)}`);
    } catch (err) {
      console.error("REFERRAL_CLAIM_ERROR_DETAIL:", err);
      const errMsg = err instanceof Error ? err.message : String(err || "Gagal mengklaim reward tier referral.");
      const errCode = (err as { code?: string })?.code ? ` [${(err as { code?: string }).code}]` : "";
      toast.error(`${errMsg}${errCode}`);
    } finally {
      setBusyClaimTierKey(null);
    }
  }

  const isAlreadyLinked = !!profile.referredBy || !!myReferral.data;
  const referrerDisplayName = myReferral.data?.referrerName || (profile.referredBy ? shortId(profile.referredBy) : "");

  const referralCode = profile.uid;
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${referralCode}` : `/register?ref=${referralCode}`;

  async function handleClaimInvitationCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = invitationCodeInput.trim();

    if (!cleanCode) {
      toast.error("Kode undangan wajib diisi.");
      return;
    }

    if (cleanCode === profile.uid) {
      toast.error("Tidak dapat menggunakan kode undangan milik sendiri.");
      return;
    }

    if (isAlreadyLinked) {
      toast.error("Akun kamu sudah terhubung dengan kode undangan.");
      return;
    }

    setClaimingCode(true);
    try {
      await claimReferralCode(profile, cleanCode);
      toast.success("Berhasil mengklaim kode undangan! Akun kamu sekarang terhubung.");
      setInvitationCodeInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengklaim kode undangan.");
    } finally {
      setClaimingCode(false);
    }
  }

  function handleCopyReferralLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success("Tautan referral berhasil disalin!");
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // Active Tier configuration
  const currentTierConfig = useMemo(() => {
    return getTierConfig(profile.tier ?? 1, rules.data.tiers);
  }, [profile.tier, rules.data.tiers]);

  // Calculate Engagement Stats
  const refStats = useMemo(() => {
    const total = engagement.referrals.data.length;
    const pending = engagement.referrals.data.filter((r) => r.status === "PENDING").length;
    const qualified = engagement.referrals.data.filter((r) => r.status === "QUALIFIED" || r.status === "REWARDED" || r.status === "PAID").length;
    const totalTeamAcc = engagement.referrals.data.reduce((sum, r) => sum + (r.currentAccCount ?? 0), 0);
    const earnings = engagement.rewardLedger.data
      .filter((l) => l.rewardType === "referral")
      .reduce((sum, item) => sum + item.amount, 0);
    return { total, pending, qualified, totalTeamAcc, earnings };
  }, [engagement.referrals.data, engagement.rewardLedger.data]);

  // Unified Transaction History derived from existing withdrawals & reward ledger
  const transactionHistory = useMemo(() => {
    const list: Array<{
      id: string;
      date: unknown;
      type: string;
      description: string;
      amount: number;
      isCredit: boolean;
      status: string;
      note?: string;
    }> = [];

    // 1. Withdrawals
    withdrawals.data.forEach((w) => {
      const holderName = w.accountHolderName ?? w.accountName ?? "Belum tersedia";
      list.push({
        id: `wd-${w.id}`,
        date: w.requestedAt,
        type: "Penarikan Saldo",
        description: `${w.method} · ${w.account} (a.n. ${holderName})`,
        amount: w.amount,
        isCredit: false,
        status: w.status,
        note: w.note,
      });
    });

    // 2. Reward Ledger Entries (Referral, Mission, Leaderboard)
    engagement.rewardLedger.data.forEach((r) => {
      const typeLabel =
        r.rewardType === "referral"
          ? "Bonus Referral"
          : r.rewardType === "mission"
          ? "Bonus Misi"
          : "Bonus Reward Leaderboard";
      list.push({
        id: `rw-${r.id}`,
        date: r.createdAt,
        type: typeLabel,
        description: r.description || typeLabel,
        amount: r.amount,
        isCredit: true,
        status: "success",
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => {
      const at =
        a.date && typeof a.date === "object" && "toMillis" in (a.date as any)
          ? (a.date as any).toMillis()
          : Number(a.date) || 0;
      const bt =
        b.date && typeof b.date === "object" && "toMillis" in (b.date as any)
          ? (b.date as any).toMillis()
          : Number(b.date) || 0;
      return bt - at;
    });
  }, [withdrawals.data, engagement.rewardLedger.data]);

  const supportConfig = useMemo(() => {
    return rules.data.supportConfig ?? DEFAULT_RULES.supportConfig!;
  }, [rules.data.supportConfig]);

  const isSupportEnabled = supportConfig.enabled !== false;

  const operatingHoursConfig = useMemo(() => {
    return rules.data.operatingHours ?? DEFAULT_OPERATING_HOURS;
  }, [rules.data.operatingHours]);

  const operatingStatus = useMemo(() => {
    return getOperatingStatus(operatingHoursConfig);
  }, [operatingHoursConfig]);

  const isSubmissionClosed = useMemo(() => {
    const isManualClosed = generalSettingsHook.data?.submissionOpen === false;
    return isManualClosed || !operatingStatus.isOpen;
  }, [generalSettingsHook.data?.submissionOpen, operatingStatus.isOpen]);

  // Profile fields display with robust fallbacks
  const displayName = profile?.name && profile.name.trim() ? profile.name.trim() : "Worker";
  const displayEmail = profile?.email && profile.email.trim() ? profile.email.trim() : "-";

  // --- Submit emails ---
  const [emailsText, setEmailsText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detail Dialog state
  const [detailSubmission, setDetailSubmission] = useState<EmailSubmission | null>(null);

  // Mobile menu drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const emailList = useMemo(
    () =>
      emailsText
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [emailsText],
  );

  async function handleSubmitEmails(e: React.FormEvent) {
    e.preventDefault();
    if (emailList.length === 0) {
      toast.error("Masukkan minimal satu alamat email.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emailList.filter((email) => !emailPattern.test(email));
    if (invalidEmails.length > 0) {
      toast.error(`Format email tidak valid: ${invalidEmails.slice(0, 3).join(", ")}${invalidEmails.length > 3 ? ", ..." : ""}`);
      return;
    }

    if (!password || password.trim().length === 0) {
      toast.error("Kata sandi akun wajib diisi.");
      return;
    }

    const passwordError = validatePasswordAgainstRules(password, rules.data.submissionNotes);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      const batchItems = emailList.map((email) => ({
        email,
        password: password.trim(),
      }));

      await createSubmission({
        workerId: profile.uid,
        workerName: profile.name,
        items: batchItems,
        itemCount: batchItems.length,
        currentTier: currentTierConfig.tier,
        currentPricePerItem: currentTierConfig.pricePerItem,
      });

      toast.success(`Berhasil mengirim batch berisi ${batchItems.length} email untuk ditinjau admin!`);
      setEmailsText("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim setoran.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Withdraw ---
  const [amount, setAmount] = useState<number>(0);

  // Active payment method fee configurations
  const activeWithdrawalSettings = useMemo(() => {
    return {
      minWithdraw: withdrawalSettingsHook.data?.minWithdraw ?? rules.data.minWithdraw ?? 50000,
      maxWithdraw: withdrawalSettingsHook.data?.maxWithdraw ?? rules.data.maxWithdraw ?? 5000000,
      methods: Array.isArray(withdrawalSettingsHook.data?.methods) && withdrawalSettingsHook.data.methods.length > 0
        ? withdrawalSettingsHook.data.methods
        : (rules.data.paymentMethods ?? ["DANA", "OVO", "GoPay", "ShopeePay", "Bank Transfer"]).map((m) => ({
            method: m,
            enabled: true,
            feeType: "free" as const,
            feeValue: 0,
          })),
    };
  }, [withdrawalSettingsHook.data, rules.data]);

  const enabledMethods = useMemo(() => {
    return activeWithdrawalSettings.methods.filter((m) => m.enabled !== false);
  }, [activeWithdrawalSettings.methods]);

  const [method, setMethod] = useState<string>(() => enabledMethods[0]?.method ?? "DANA");

  // Keep selected method valid if enabled methods list updates
  const activeMethodConfig = useMemo(() => {
    return getPaymentMethodFeeConfig(method, activeWithdrawalSettings, rules.data);
  }, [method, activeWithdrawalSettings, rules.data]);

  const [account, setAccount] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [categoryTab, setCategoryTab] = useState<"ewallet" | "bank">("ewallet");
  const [withdrawing, setWithdrawing] = useState(false);

  const isEWalletMethod = (m: PaymentMethodFeeConfig) => {
    if (m.category === "ewallet") return true;
    if (m.category === "bank") return false;
    const name = m.method.toUpperCase();
    return ["DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA", "QRIS", "DOKU"].some((e) => name.includes(e));
  };

  const ewalletMethods = useMemo(() => enabledMethods.filter(isEWalletMethod), [enabledMethods]);
  const bankMethods = useMemo(() => enabledMethods.filter((m) => !isEWalletMethod(m)), [enabledMethods]);

  const visibleMethods = useMemo(() => {
    const list = categoryTab === "ewallet" ? ewalletMethods : bankMethods;
    return list.length > 0 ? list : enabledMethods;
  }, [categoryTab, ewalletMethods, bankMethods, enabledMethods]);

  function handleSelectCategory(cat: "ewallet" | "bank") {
    setCategoryTab(cat);
    const targetList = cat === "ewallet" ? ewalletMethods : bankMethods;
    if (targetList.length > 0 && !targetList.some((m) => m.method === method)) {
      setMethod(targetList[0].method);
    }
  }

  // Dynamic fee calculation
  const calculatedFee = useMemo(() => {
    return calculateWithdrawalFee(amount, activeMethodConfig);
  }, [amount, activeMethodConfig]);

  const calculatedNet = useMemo(() => {
    return Math.max(0, amount - calculatedFee);
  }, [amount, calculatedFee]);

  const currentFeeBadgeText = useMemo(() => {
    return formatFeeBadge(activeMethodConfig);
  }, [activeMethodConfig]);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!account.trim()) {
      toast.error("Nomor rekening / e-wallet wajib diisi.");
      return;
    }
    if (!accountHolderName.trim()) {
      toast.error("Atas Nama (nama pemilik rekening/wallet) wajib diisi.");
      return;
    }
    const value = amount;
    if (!value || value <= 0) {
      toast.error("Masukkan jumlah penarikan yang valid.");
      return;
    }
    if (value < activeWithdrawalSettings.minWithdraw) {
      toast.error(`Minimal penarikan adalah ${formatMoney(activeWithdrawalSettings.minWithdraw)}.`);
      return;
    }
    if (value > activeWithdrawalSettings.maxWithdraw) {
      toast.error(`Maksimal penarikan adalah ${formatMoney(activeWithdrawalSettings.maxWithdraw)}.`);
      return;
    }
    if (value > profile.balance) {
      toast.error("Saldo Anda tidak mencukupi.");
      return;
    }

    setWithdrawing(true);
    try {
      await createWithdrawal({
        workerId: profile.uid,
        amount: value,
        method: activeMethodConfig.method,
        account: account.trim(),
        accountHolderName: accountHolderName.trim(),
        fee: calculatedFee,
        netAmount: calculatedNet,
      });
      toast.success("Permintaan penarikan berhasil dikirim!");
      setAmount(0);
      setAccount("");
      setAccountHolderName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim permintaan penarikan.");
    } finally {
      setWithdrawing(false);
    }
  }

  function getViewTitle(view: DashboardView): string {
    switch (view) {
      case "submit":
        return "Job Gmail / Setor Email";
      case "checker":
        return "Status ACC & Checker Email";
      case "leaderboard":
        return "Klasemen Worker & Reward";
      case "referral":
        return "Program Referral & Pasif Income";
      case "withdraw":
        return "Tarik Saldo";
      case "history":
        return "Riwayat Job & Setoran";
      case "cs":
        return "Bantuan CS & Komunitas";
      case "announcements":
        return "Informasi Resmi Admin";
      default:
        return "Dashboard Worker";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* GLOBAL TOP BAR HEADER */}
      <header className="bg-white/95 backdrop-blur-md border-b border-amber-100 sticky top-0 z-20 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm ring-2 ring-amber-400/30 hover:opacity-90 transition-opacity"
            >
              {profile.name?.charAt(0).toUpperCase() || "W"}
            </button>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-gray-900 text-xs leading-tight">{displayName}</p>
                <Badge variant="outline" className="text-[10px] bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-300 font-bold px-1.5 py-0">
                  Rate: {formatMoney(currentTierConfig.pricePerItem)}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="font-mono">
                  {isEmailVisible ? displayEmail : "*".repeat(Math.min(10, displayEmail.length || 8))}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEmailVisible(!isEmailVisible)}
                  className="text-gray-400 hover:text-amber-600 transition-colors p-0.5 rounded focus:outline-none"
                  title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}
                >
                  {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              onClick={() => setActiveView("withdraw")}
              className="text-right bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-2.5 py-1 rounded-xl border border-amber-200/80 cursor-pointer hover:border-amber-300 transition-colors"
            >
              <p className="text-[9px] text-amber-800 font-bold uppercase tracking-wider">Saldo</p>
              <p className="font-black text-amber-700 text-xs sm:text-sm">{formatMoney(profile.balance)}</p>
            </div>
            <Button variant="outline" size="icon" onClick={onLogout} title="Keluar" className="w-8 h-8 border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-24 md:pb-8 space-y-4">
        {/* SUB-PAGE TOP NAVIGATION BAR (Show on dedicated views) */}
        {activeView !== "home" && (
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("home")}
              className="gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 hover:bg-amber-100/80 px-2.5 h-8 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 text-amber-600" />
              <span>Kembali ke Home</span>
            </Button>
            <Badge variant="outline" className="text-[11px] bg-amber-50/90 text-amber-950 border-amber-300/80 font-bold px-2.5 py-0.5 shadow-2xs">
              {getViewTitle(activeView)}
            </Badge>
          </div>
        )}

        {/* ==================== 1. HOME VIEW ==================== */}
        {activeView === "home" && (
          <div className="space-y-4">
            {/* SALDO UTAMA HIGHLIGHT CARD */}
            <Card className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50 shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-200" /> Saldo Utamaku
                    </p>
                    <p className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                      {formatMoney(profile.balance)}
                    </p>
                    <p className="text-[11px] text-amber-100/90 font-medium">
                      Total Setoran ACC: <strong className="text-white font-bold">{profile.accCount ?? 0} Email</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-0">
                    <Button
                      type="button"
                      onClick={() => setActiveView("withdraw")}
                      className="flex-1 sm:flex-initial bg-white text-amber-900 hover:bg-amber-50 font-extrabold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5 transition-transform active:scale-95"
                    >
                      <Wallet className="w-3.5 h-3.5 text-amber-600" />
                      Tarik Saldo
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveView("submit")}
                      className="flex-1 sm:flex-initial bg-amber-950/40 hover:bg-amber-950/60 backdrop-blur-md text-amber-100 font-extrabold text-xs h-9 px-3.5 rounded-xl border border-amber-300/30 gap-1.5 transition-transform active:scale-95"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                      Setor Email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* COMPACT LAYANAN CEPAT GRID (8 ITEMS / 4 COLUMNS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Layanan Cepat
                </h3>
                <span className="text-[10px] text-gray-500 font-medium">Pilih Menu</span>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                {[
                  {
                    id: "submit" as DashboardView,
                    label: "Job Gmail",
                    subtext: "Setor Email",
                    icon: <Send className="w-4 h-4 text-amber-600" />,
                    badgeBg: "bg-amber-50 border-amber-200/80",
                  },
                  {
                    id: "checker" as DashboardView,
                    label: "Status ACC",
                    subtext: "Checker",
                    icon: <SearchCheck className="w-4 h-4 text-orange-600" />,
                    badgeBg: "bg-orange-50 border-orange-200/80",
                  },
                  {
                    id: "leaderboard" as DashboardView,
                    label: "Klasemen",
                    subtext: "Top Worker",
                    icon: <Trophy className="w-4 h-4 text-amber-600" />,
                    badgeBg: "bg-amber-50 border-amber-200/80",
                  },
                  {
                    id: "referral" as DashboardView,
                    label: "Referral",
                    subtext: "Pasif Income",
                    icon: <Users className="w-4 h-4 text-amber-700" />,
                    badgeBg: "bg-amber-50 border-amber-200/80",
                  },
                  {
                    id: "withdraw" as DashboardView,
                    label: "Tarik Saldo",
                    subtext: "Pencairan",
                    icon: <Wallet className="w-4 h-4 text-emerald-600" />,
                    badgeBg: "bg-emerald-50 border-emerald-200/80",
                  },
                  {
                    id: "history" as DashboardView,
                    label: "Riwayat Job",
                    subtext: "Log Setoran",
                    icon: <History className="w-4 h-4 text-blue-600" />,
                    badgeBg: "bg-blue-50 border-blue-200/80",
                  },
                  {
                    id: "cs" as DashboardView,
                    label: "Bantuan CS",
                    subtext: "Pusat Bantuan",
                    icon: <HelpCircle className="w-4 h-4 text-amber-600" />,
                    badgeBg: "bg-amber-50 border-amber-200/80",
                  },
                  {
                    id: "announcements" as DashboardView,
                    label: "Info Resmi",
                    subtext: "Pengumuman",
                    icon: <Megaphone className="w-4 h-4 text-rose-600" />,
                    badgeBg: "bg-rose-50 border-rose-200/80",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className="p-2 sm:p-2.5 bg-white border border-amber-100/80 rounded-2xl shadow-2xs hover:border-amber-300 hover:bg-amber-50/40 text-center flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 group cursor-pointer"
                  >
                    <div className={`p-2 rounded-xl border ${item.badgeBg} group-hover:scale-105 transition-transform shadow-2xs`}>
                      {item.icon}
                    </div>
                    <div className="w-full">
                      <p className="text-[11px] font-bold text-gray-800 leading-tight truncate w-full group-hover:text-amber-900">
                        {item.label}
                      </p>
                      <p className="text-[9px] text-gray-400 font-medium truncate w-full hidden sm:block">
                        {item.subtext}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* JAM OPERASIONAL COMPACT CARD */}
            <Card className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-100/30 border-amber-200/80 shadow-xs relative overflow-hidden">
              <CardHeader className="p-3.5 pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Jam Operasional Layanan</span>
                  </CardTitle>
                  <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs border ${
                    operatingStatus.isOpen
                      ? "bg-emerald-500 text-white border-emerald-400"
                      : "bg-rose-500 text-white border-rose-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${operatingStatus.isOpen ? "bg-emerald-200" : "bg-rose-200"}`} />
                    {operatingStatus.statusText}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <p className="text-[11px] text-gray-600">
                  Layanan setoran & verifikasi diproses sesuai jadwal operasional WIB (Asia/Jakarta).
                </p>
              </CardContent>
            </Card>

            {/* LATEST ANNOUNCEMENT / INFO SINGKAT CARD */}
            {announcements.data.length > 0 && (
              <Card
                onClick={() => setActiveView("announcements")}
                className="bg-white border-amber-200/80 shadow-2xs hover:border-amber-300 transition-colors cursor-pointer p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/60 shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Info Resmi Terbaru</p>
                    <p className="text-xs font-bold text-gray-900 truncate">{announcements.data[0].title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{announcements.data[0].content}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </Card>
            )}
          </div>
        )}

        {/* ==================== 2. JOB GMAIL / SETOR EMAIL VIEW ==================== */}
        {activeView === "submit" && (
          <div className="space-y-4">
            {/* CURRENT RATE DISPLAY CARD */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    Informasi Rate Harga Setor
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-bold">
                    RATE AKTIF
                  </Badge>
                </div>
                <CardDescription className="text-xs text-gray-600">
                  Harga komisi per akun valid yang berlaku saat ini ditentukan oleh Admin secara transparan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-50/80 to-orange-500/10 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-1.5 mb-1 text-amber-900 font-medium text-xs">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Rate Akun Valid</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight my-1">
                    {formatMoney(currentTierConfig.pricePerItem)} <span className="text-xs sm:text-sm font-semibold text-amber-900/80">/ akun valid</span>
                  </p>
                  <p className="text-[11px] text-amber-900/80 mt-1.5 font-medium">
                    Komisi langsung masuk ke saldo utama setiap email selesai diverifikasi ACC.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-100/40 border-amber-200/90 shadow-2xs">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Aturan Setor Email
                  </div>
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[10px] border-0 shadow-2xs">
                    Rate: {formatMoney(currentTierConfig.pricePerItem)} / akun
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs text-amber-900/90 list-disc list-inside whitespace-pre-wrap leading-relaxed">
                  {rules.data.submissionNotes.map((note, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">{note}</li>
                  ))}
                  <li>Harga komisi aktif saat ini: <strong className="text-amber-950 font-bold">{formatMoney(currentTierConfig.pricePerItem)}</strong> per akun valid.</li>
                </ul>
              </CardContent>
            </Card>

            {/* OPERATIONAL CLOSED WARNING BANNER */}
            {isSubmissionClosed && (
              <Card className="bg-rose-50 border-rose-200 shadow-xs">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-1.5 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-rose-900 text-xs sm:text-sm">Pemberitahuan Setoran Ditutup</h4>
                    <p className="text-[11px] text-rose-800 font-medium leading-relaxed mt-0.5">
                      Mohon maaf, setoran email saat ini sedang DITUTUP oleh Admin. Silakan coba lagi pada jam operasional.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold text-gray-900">Detail Batch Setoran</CardTitle>
                <CardDescription className="text-xs text-gray-600">Masukkan satu atau banyak email sekaligus. Seluruh item akan dikirim sebagai 1 batch.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitEmails} className="space-y-4">
                  <fieldset disabled={isSubmissionClosed} className="space-y-4 disabled:opacity-60 disabled:pointer-events-none">
                    <div>
                      <Label htmlFor="emails" className="text-xs font-bold text-gray-800">
                        Daftar Alamat Email ({emailList.length} item)
                      </Label>
                      <Textarea
                        id="emails"
                        rows={6}
                        value={emailsText}
                        onChange={(e) => setEmailsText(e.target.value)}
                        placeholder={"item1@example.com\nitem2@example.com\nitem3@example.com"}
                        className="mt-1.5 font-mono text-sm border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                        required
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Pisahkan setiap email dengan baris baru. Multi-item akan otomatis digabung dalam 1 batch.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-xs font-bold text-gray-800">Kata Sandi Akun</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Kata sandi untuk seluruh email di atas"
                        className="mt-1.5 border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                        required
                      />
                    </div>

                    <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-gray-600 font-medium">Estimasi Total Setoran: </span>
                        <strong className="text-gray-900 font-bold">{emailList.length} item × {formatMoney(currentTierConfig.pricePerItem)}</strong>
                      </div>
                      <span className="font-black text-amber-700 text-sm">{formatMoney(emailList.length * currentTierConfig.pricePerItem)}</span>
                    </div>
                  </fieldset>

                  <Button type="submit" disabled={submitting || isSubmissionClosed} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-10 gap-2 rounded-xl shadow-sm border border-amber-400/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmissionClosed ? "Setoran Sedang Ditutup" : `Kirim Batch (${emailList.length} Item)`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ==================== 3. CHECKER EMAIL VIEW ==================== */}
        {activeView === "checker" && (
          <div className="space-y-4">
            <EmailChecker isAdminView={false} />
          </div>
        )}

        {/* ==================== 4. LEADERBOARD / KLASEMEN VIEW ==================== */}
        {activeView === "leaderboard" && (
          <div className="space-y-4">
            <Leaderboard
              currentUserId={profile.uid}
              rewards={rules.data.leaderboardRewards}
            />
          </div>
        )}

        {/* ==================== 5. REFERRAL VIEW ==================== */}
        {activeView === "referral" && (
          <div className="space-y-5">
            {/* BANNER REFERRAL */}
            <Card className="bg-gradient-to-r from-[#2D1B00] via-[#4A2800] to-[#5C3A00] text-white border-amber-900/80 shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <CardContent className="p-5 sm:p-6 space-y-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Program Pasif Income Kerja
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Pasif Income Tanpa Batas
                </h2>
                <p className="text-xs text-amber-100/90 leading-relaxed max-w-2xl">
                  Ajak rekan kerja Anda bergabung. Setiap kali downline Anda menyetor email dan disetujui (ACC) oleh admin, komisi referral otomatis LANGSUNG masuk ke Saldo Utama Anda!
                </p>
              </CardContent>
            </Card>

            {/* WIDGET SIMULASI PASIF INCOME */}
            <Card className="bg-gradient-to-br from-[#211300] via-[#321D00] to-[#211300] text-[#FFE0B2] border-amber-900/60 shadow-lg overflow-hidden relative">
              <CardHeader className="p-3 sm:p-4 pb-2 border-b border-amber-900/50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-xs sm:text-sm font-black text-[#FFB74D] flex items-center gap-1.5">
                    <div className="p-1 rounded-md bg-amber-500/20 text-[#FFB74D] border border-amber-500/30">
                      <Coins className="w-3.5 h-3.5" />
                    </div>
                    Kalkulator Simulasi Pasif Income
                  </CardTitle>
                  <Badge variant="outline" className="bg-amber-500/10 text-[#FFB74D] border-amber-500/30 font-bold text-[10px] px-2 py-0.5">
                    Flat: {formatMoney(rules.data.referralCommissionPerAcc || 100)} / ACC
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 p-2.5 bg-[#2D1B00]/80 rounded-xl border border-amber-900/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-[#FFE0B2] uppercase tracking-wider">
                        Jumlah Downline
                      </Label>
                      <span className="text-xs font-black text-[#FFB74D] bg-amber-950 px-2 py-0.5 rounded border border-amber-800/60">
                        {simFriends} Orang
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={simFriends}
                      onChange={(e) => setSimFriends(Number(e.target.value))}
                      className="w-full h-1.5 bg-amber-950 rounded-lg appearance-none cursor-pointer accent-[#FFB74D]"
                    />
                  </div>

                  <div className="space-y-1.5 p-2.5 bg-[#2D1B00]/80 rounded-xl border border-amber-900/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-[#FFE0B2] uppercase tracking-wider">
                        Email ACC / Downline / Hari
                      </Label>
                      <span className="text-xs font-black text-[#FFB74D] bg-amber-950 px-2 py-0.5 rounded border border-amber-800/60">
                        {simAccPerFriend} Email
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={simAccPerFriend}
                      onChange={(e) => setSimAccPerFriend(Number(e.target.value))}
                      className="w-full h-1.5 bg-amber-950 rounded-lg appearance-none cursor-pointer accent-[#FFB74D]"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#1A0E00] border border-amber-800/50 space-y-2">
                  <div className="text-[11px] text-amber-200/80 flex items-center justify-between border-b border-amber-900/60 pb-1.5">
                    <span>Total Volume Email ACC Tim / Hari:</span>
                    <strong className="text-[#FFB74D] font-mono text-xs">{simFriends * simAccPerFriend} ACC</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="p-2 rounded-lg bg-[#281500] border border-amber-900/60 space-y-0.5">
                      <p className="text-[10px] font-bold text-amber-300/80 uppercase tracking-wider">Estimasi / Hari</p>
                      <p className="text-base font-black text-[#FFB74D] tracking-tight">
                        {formatMoney(simFriends * simAccPerFriend * (rules.data.referralCommissionPerAcc || 100))}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#281500] border border-amber-900/60 space-y-0.5">
                      <p className="text-[10px] font-bold text-amber-300/80 uppercase tracking-wider">Estimasi / Bulan</p>
                      <p className="text-base font-black text-[#FFB74D] tracking-tight">
                        {formatMoney(simFriends * simAccPerFriend * (rules.data.referralCommissionPerAcc || 100) * 30)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3 STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-[#FFF8F0] border-[#FFE0B2] shadow-xs">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider">TOTAL BONUS DIDAPAT</p>
                    <Wallet className="w-4 h-4 text-[#E65100]" />
                  </div>
                  <p className="text-xl font-black text-[#E65100] tracking-tight">
                    {formatMoney(profile.totalReferralEarned ?? refStats.earnings ?? 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#FFF8F0] border-[#FFE0B2] shadow-xs">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider">TOTAL DOWNLINE</p>
                    <Users className="w-4 h-4 text-[#E65100]" />
                  </div>
                  <p className="text-xl font-black text-[#E65100] tracking-tight">
                    {downlines.data.length || refStats.total} <span className="text-xs font-medium text-amber-900/70">Worker</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#FFF8F0] border-[#FFE0B2] shadow-xs">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider">TOTAL EMAIL ACC TIM</p>
                    <Award className="w-4 h-4 text-[#E65100]" />
                  </div>
                  <p className="text-xl font-black text-[#E65100] tracking-tight">
                    {profile.teamAccCount ?? refStats.totalTeamAcc ?? 0} <span className="text-xs font-medium text-amber-900/70">Email</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* TAUTAN REFERRAL */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-600" />
                  Tautan Referral Saya
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={referralLink}
                    className="font-mono text-xs bg-amber-50/40 border-amber-200 text-amber-950 rounded-xl"
                  />
                  <Button
                    onClick={handleCopyReferralLink}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0 font-bold text-xs h-10 px-3.5 rounded-xl border border-amber-400/20"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? "Tersalin!" : "Salin Link"}
                  </Button>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1.5 text-xs text-amber-950">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold">Kode Referral Anda:</span>
                    <Badge variant="outline" className="font-mono bg-white text-amber-950 border-amber-300 font-bold text-xs">
                      {profile.uid}
                    </Badge>
                  </div>
                  {isAlreadyLinked ? (
                    <p className="text-[11px] text-amber-900">
                      ✓ Terhubung Upline: <strong className="font-bold">{referrerDisplayName || "Rekan"}</strong>
                    </p>
                  ) : (
                    <form onSubmit={handleClaimInvitationCode} className="pt-1.5 border-t border-amber-200/60 flex gap-2">
                      <Input
                        value={invitationCodeInput}
                        onChange={(e) => setInvitationCodeInput(e.target.value)}
                        placeholder="Masukkan Kode Upline"
                        className="font-mono text-xs bg-white rounded-xl border-amber-200 h-8"
                        disabled={claimingCode}
                      />
                      <Button
                        type="submit"
                        disabled={claimingCode || !invitationCodeInput.trim()}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl h-8 shrink-0"
                      >
                        {claimingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : "Hubungkan"}
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* DAFTAR TIM DOWNLINE */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  Daftar Tim Downline ({downlines.data.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {downlines.loading ? (
                  <p className="text-xs text-gray-400 text-center py-6">Memuat data downline...</p>
                ) : downlines.data.length === 0 ? (
                  <div className="p-6 border border-dashed border-amber-200 rounded-2xl text-center space-y-1.5 bg-[#FFF8F0]">
                    <Users className="w-6 h-6 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-amber-950">Belum Ada Downline Terdaftar</p>
                    <p className="text-[11px] text-amber-900/80">
                      Bagikan link referral Anda untuk mulai mengumpulkan komisi pasif income.
                    </p>
                  </div>
                ) : (
                  <div className="border border-amber-200/80 rounded-xl overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#FFF8F0] border-b border-[#FFE0B2] text-amber-950 font-bold">
                          <tr>
                            <th className="px-3 py-2">Worker</th>
                            <th className="px-3 py-2">Bergabung</th>
                            <th className="px-3 py-2 text-center">ACC</th>
                            <th className="px-3 py-2 text-right">Komisi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {downlines.data.map((dw) => {
                            const dwAcc = dw.accCount ?? 0;
                            const commRate = rules.data.referralCommissionPerAcc ?? 100;
                            const totalComm = dwAcc * commRate;

                            return (
                              <tr key={dw.uid} className="hover:bg-amber-50/50 transition-colors">
                                <td className="px-3 py-2">
                                  <p className="font-bold text-gray-900">{dw.name || "Worker"}</p>
                                </td>
                                <td className="px-3 py-2 text-gray-600 font-mono text-[11px]">
                                  {formatDateTime(dw.createdAt)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 font-bold text-[10px]">
                                    {dwAcc} ACC
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-[#E65100]">
                                  {formatMoney(totalComm)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* LOG TRANSAKSI KOMISI */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600" />
                  Riwayat Log Komisi Referral ({referralTxs.data.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {referralTxs.loading ? (
                  <p className="text-xs text-gray-400 text-center py-6">Memuat riwayat...</p>
                ) : referralTxs.data.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4 border border-dashed border-amber-200 rounded-xl bg-[#FFF8F0]">
                    Belum ada riwayat transaksi komisi.
                  </p>
                ) : (
                  <div className="border border-amber-200/80 rounded-xl overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#FFF8F0] border-b border-[#FFE0B2] text-amber-950 font-bold">
                          <tr>
                            <th className="px-3 py-2">Waktu</th>
                            <th className="px-3 py-2">Downline</th>
                            <th className="px-3 py-2 text-center">ACC</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {referralTxs.data.map((tx) => (
                            <tr key={tx.id} className="hover:bg-amber-50/50">
                              <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">
                                {formatDateTime(tx.createdAt)}
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-900">
                                {tx.downlineName || shortId(tx.downlineId)}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-gray-800">
                                {tx.accCount}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-[#E65100]">
                                +{formatMoney(tx.totalCommission)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ==================== 6. WITHDRAW / TARIK SALDO VIEW ==================== */}
        {activeView === "withdraw" && (
          <div className="space-y-5">
            {/* SALDO HIGHLIGHT BANNER */}
            <Card className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50 shadow-md overflow-hidden relative">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-200" /> Salso Siap Ditarik
                    </p>
                    <p className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                      {formatMoney(profile.balance)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-amber-100/90 pt-0.5">
                      <span>Min: <strong className="text-white">{formatMoney(activeWithdrawalSettings.minWithdraw)}</strong></span>
                      <span>•</span>
                      <span>Max: <strong className="text-white">{formatMoney(activeWithdrawalSettings.maxWithdraw)}</strong></span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setActiveView("referral")}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-xs h-8 px-3 rounded-xl border border-white/30 shadow-2xs gap-1 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    Bonus Referral
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900">Formulir Penarikan Saldo</CardTitle>
                    <CardDescription className="text-xs text-gray-600">
                      Pilih penyedia layanan, nominal, dan detail akun penerima.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold px-2 py-0.5 ${
                      activeMethodConfig.feeType === "free" || activeMethodConfig.feeValue <= 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}
                  >
                    {currentFeeBadgeText}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleWithdraw} className="space-y-5">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                        Pilih Metode Pembayaran
                      </Label>
                    </div>

                    <div className="inline-flex p-1 bg-amber-100/60 border border-amber-200/60 rounded-xl gap-1 text-xs font-medium w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("ewallet")}
                        className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          categoryTab === "ewallet"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
                            : "text-amber-950 hover:text-amber-900"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        E-Wallet
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("bank")}
                        className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          categoryTab === "bank"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
                            : "text-amber-950 hover:text-amber-900"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Transfer Bank
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {visibleMethods.map((m) => {
                        const isSelected = method === m.method;
                        const feeBadge = formatFeeBadge(m);
                        const isEWallet = isEWalletMethod(m);

                        return (
                          <div
                            key={m.method}
                            onClick={() => setMethod(m.method)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 select-none ${
                              isSelected
                                ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50/80 ring-2 ring-amber-500/30 shadow-xs"
                                : "border-gray-200 bg-white hover:border-amber-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                {isEWallet ? (
                                  <Smartphone className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500"}`} />
                                ) : (
                                  <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500"}`} />
                                )}
                                <span className="font-bold text-xs text-gray-900 truncate">{m.method}</span>
                              </div>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            </div>

                            <Badge
                              variant="secondary"
                              className={`text-[9px] w-fit font-semibold px-1.5 py-0 ${
                                m.feeType === "free" || m.feeValue <= 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {feeBadge}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <Label htmlFor="amount" className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      Nominal Penarikan
                    </Label>

                    <FormattedNumberInput
                      id="amount"
                      value={amount}
                      onChange={(val) => setAmount(val)}
                      placeholder="Contoh: 100.000"
                      className="font-mono text-sm font-semibold h-10 border-gray-200 focus-visible:ring-amber-500 rounded-xl"
                      required
                    />

                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: `Max (${formatMoney(profile.balance)})`, value: profile.balance },
                        { label: "Rp 25.000", value: 25000 },
                        { label: "Rp 50.000", value: 50000 },
                        { label: "Rp 100.000", value: 100000 },
                        { label: "Rp 250.000", value: 250000 },
                      ].map((chip, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(chip.value)}
                          className={`text-[11px] h-6 px-2.5 rounded-full ${
                            amount === chip.value
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 font-bold"
                              : "bg-slate-50 text-gray-700 hover:bg-amber-50 border-gray-200"
                          }`}
                        >
                          {chip.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                      Detail Akun Penerima
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label htmlFor="account" className="text-[11px] text-gray-600 font-semibold">
                          Nomor HP / Rekening {method}
                        </Label>
                        <Input
                          id="account"
                          value={account}
                          onChange={(e) => setAccount(e.target.value)}
                          placeholder={`Nomor HP ${method} / Rekening`}
                          className="mt-1 border-gray-200 focus-visible:ring-amber-500 rounded-xl h-9 text-xs"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountHolderName" className="text-[11px] text-gray-600 font-semibold">
                          Atas Nama (Pemilik Wallet/Rekening)
                        </Label>
                        <Input
                          id="accountHolderName"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          placeholder="Nama pemilik rekening"
                          className="mt-1 border-gray-200 focus-visible:ring-amber-500 rounded-xl h-9 text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-amber-100/30 rounded-xl border border-amber-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Nominal Penarikan:</span>
                        <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Biaya Admin ({activeMethodConfig.method}):</span>
                        <span className={calculatedFee > 0 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                          {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Free)"}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/80 flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                        <span className="font-black text-emerald-700">{formatMoney(calculatedNet)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-10 gap-2 text-xs rounded-xl shadow-sm border border-amber-400/20 active:scale-95 transition-transform"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Ajukan Penarikan ({formatMoney(calculatedNet)})
                  </Button>
                </form>
              </CardContent>
            </Card>

            <TransactionHistory
              transactions={transactionHistory}
              loading={withdrawals.loading || engagement.rewardLedger.loading}
            />
          </div>
        )}

        {/* ==================== 7. RIWAYAT JOB / SETORAN VIEW ==================== */}
        {activeView === "history" && (
          <div className="space-y-4">
            <SubmissionHistory
              submissions={submissions.data}
              loading={submissions.loading}
              rules={rules.data}
              userTier={profile.tier}
              onViewDetail={setDetailSubmission}
            />
          </div>
        )}

        {/* ==================== 8. BANTUAN CS VIEW ==================== */}
        {activeView === "cs" && (
          <div className="space-y-4">
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  Pusat Bantuan & Layanan Pelanggan
                </CardTitle>
                <CardDescription className="text-xs">
                  Hubungi customer service kami jika mengalami kendala setoran, pembayaran, atau pertanyaan lainnya.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-[#2D1B00] border border-amber-900/60 text-slate-100 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-[#FFB74D] border border-amber-500/30">
                          <TelegramIcon className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-sm text-[#FFB74D]">CS Telegram</span>
                      </div>
                      <p className="text-xs text-[#FFE0B2]/80 leading-relaxed">
                        Layanan cepat penanganan kendala akun, email setoran, dan status payout saldo.
                      </p>
                    </div>
                    {supportConfig.telegramUrl ? (
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs h-9 rounded-xl border border-amber-400/30"
                      >
                        <a
                          href={supportConfig.telegramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5"
                        >
                          <TelegramIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>Hubungi CS Telegram</span>
                        </a>
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="w-full text-xs h-9 bg-slate-900/80 text-slate-500 border-slate-800">
                        Belum Diatur
                      </Button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-[#2D1B00] border border-amber-900/60 text-slate-100 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-[#FFB74D] border border-amber-500/30">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-sm text-[#FFB74D]">Komunitas WhatsApp</span>
                      </div>
                      <p className="text-xs text-[#FFE0B2]/80 leading-relaxed">
                        Saluran resmi informasi worker, update jam operasional, dan diskusi komunitas.
                      </p>
                    </div>
                    {supportConfig.communityWaLink ? (
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs h-9 rounded-xl border border-amber-400/30"
                      >
                        <a
                          href={supportConfig.communityWaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Gabung Komunitas WA</span>
                        </a>
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="w-full text-xs h-9 bg-slate-900/80 text-slate-500 border-slate-800">
                        Belum Diatur
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ==================== 9. PENGUMUMAN / INFO RESMI VIEW ==================== */}
        {activeView === "announcements" && (
          <div className="space-y-4">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  Pusat Pengumuman & Informasi Resmi
                </CardTitle>
                <CardDescription className="text-xs">
                  Informasi resmi langsung dari admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {announcements.loading && (
                  <p className="text-xs text-gray-400 text-center py-8">Memuat pengumuman...</p>
                )}
                {announcements.error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl text-center">
                    Gagal memuat pengumuman: {announcements.error}
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length === 0 && (
                  <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center text-xs text-gray-400">
                    Belum ada pengumuman resmi saat ini.
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length > 0 && (
                  <div className="space-y-3">
                    {announcements.data.map((item) => {
                      const badgeUpper = item.badge?.toUpperCase().trim() || "";
                      let badgeStyle = "bg-blue-100 text-blue-800 hover:bg-blue-100";
                      if (badgeUpper === "BARU" || badgeUpper === "PENTING") {
                        badgeStyle = "bg-red-100 text-red-800 hover:bg-red-100";
                      } else if (badgeUpper === "IMPORTANT" || badgeUpper === "PERHATIAN") {
                        badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-100";
                      } else if (badgeUpper === "INFO") {
                        badgeStyle = "bg-sky-100 text-sky-800 hover:bg-sky-100";
                      }

                      return (
                        <Card key={item.id} className="bg-white border-gray-200/80 shadow-2xs hover:border-gray-300 transition-colors">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <CardTitle className="text-sm font-bold text-gray-900">{item.title}</CardTitle>
                                  {item.badge && (
                                    <Badge className={`text-[10px] font-bold ${badgeStyle}`}>
                                      {item.badge}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  {formatDateTime(item.updatedAt || item.createdAt)}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {item.content}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-200 shadow-2xl px-2 py-1.5 flex items-center justify-around">
          {/* 1. HOME */}
          <button
            type="button"
            onClick={() => {
              setActiveView("home");
              setIsMobileMenuOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              activeView === "home" && !isMobileMenuOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {activeView === "home" && !isMobileMenuOpen && (
              <span className="absolute -top-1.5 w-7 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Home</span>
          </button>

          {/* 2. SETOR / SUBMIT */}
          <button
            type="button"
            onClick={() => {
              setActiveView("submit");
              setIsMobileMenuOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              activeView === "submit" && !isMobileMenuOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="p-1 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-md shadow-amber-500/20 mb-0.5">
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] tracking-tight font-semibold">Setor</span>
          </button>

          {/* 3. WITHDRAW */}
          <button
            type="button"
            onClick={() => {
              setActiveView("withdraw");
              setIsMobileMenuOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              activeView === "withdraw" && !isMobileMenuOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {activeView === "withdraw" && !isMobileMenuOpen && (
              <span className="absolute -top-1.5 w-7 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <Wallet className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Withdraw</span>
          </button>

          {/* 4. BANTUAN CS */}
          <button
            type="button"
            onClick={() => {
              setActiveView("cs");
              setIsMobileMenuOpen(false);
            }}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              activeView === "cs" && !isMobileMenuOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {activeView === "cs" && !isMobileMenuOpen && (
              <span className="absolute -top-1.5 w-7 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <HelpCircle className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">CS</span>
          </button>

          {/* 5. AKUN / PROFIL MENU */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isMobileMenuOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {isMobileMenuOpen && (
              <span className="absolute -top-1.5 w-7 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Akun</span>
          </button>
        </nav>

        {/* MOBILE PROFIL / MENU DRAWER SHEET */}
        <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <DialogContent className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border-slate-800 text-slate-100 p-0 overflow-hidden rounded-t-3xl sm:rounded-2xl border shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-lg ring-2 ring-amber-400/30">
                  {profile.name?.charAt(0).toUpperCase() || "W"}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-white text-xs">{displayName}</p>
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30 font-bold">
                      Rate: {formatMoney(currentTierConfig.pricePerItem)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="font-mono">
                      {isEmailVisible ? displayEmail : "*".repeat(Math.min(10, displayEmail.length || 8))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEmailVisible(!isEmailVisible)}
                      className="text-slate-400 hover:text-amber-400 p-0.5 rounded"
                    >
                      {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-400 uppercase font-semibold">Saldo</p>
                <p className="font-black text-amber-400 text-xs sm:text-sm">{formatMoney(profile.balance)}</p>
              </div>
            </div>

            <div className="p-3.5 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Menu Navigation</p>

              {[
                {
                  id: "home" as DashboardView,
                  title: "Dashboard Home",
                  desc: "Saldo Card & Layanan Cepat",
                  icon: <Home className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: "submit" as DashboardView,
                  title: "Job Gmail / Setor Email",
                  desc: "Kirim batch email setoran",
                  icon: <Send className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: "checker" as DashboardView,
                  title: "Checker Email & Master Riset",
                  desc: "Screening format & status email",
                  icon: <SearchCheck className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: "leaderboard" as DashboardView,
                  title: "Klasemen / Top Worker",
                  desc: "Peringkat mingguan & reward bonus",
                  icon: <Trophy className="w-4 h-4 text-orange-400" />,
                },
                {
                  id: "referral" as DashboardView,
                  title: "Referral & Pasif Income",
                  desc: "Undang teman & komisi otomatis",
                  icon: <Users className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: "withdraw" as DashboardView,
                  title: "Tarik Saldo",
                  desc: "Pencairan ke E-Wallet & Bank",
                  icon: <Wallet className="w-4 h-4 text-emerald-400" />,
                },
                {
                  id: "history" as DashboardView,
                  title: "Riwayat Job & Setoran",
                  desc: "Status verifikasi & detail batch",
                  icon: <History className="w-4 h-4 text-blue-400" />,
                },
                {
                  id: "cs" as DashboardView,
                  title: "Bantuan CS & Komunitas",
                  desc: "CS Telegram & Saluran WA",
                  icon: <HelpCircle className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: "announcements" as DashboardView,
                  title: "Pengumuman Resmi",
                  desc: "Informasi resmi dari admin",
                  icon: <Megaphone className="w-4 h-4 text-rose-400" />,
                },
              ].map((menuItem) => (
                <button
                  key={menuItem.id}
                  type="button"
                  onClick={() => {
                    setActiveView(menuItem.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    activeView === menuItem.id
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      {menuItem.icon}
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{menuItem.title}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{menuItem.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              ))}
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-950/80">
              <Button
                variant="outline"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 font-bold gap-2 text-xs h-9 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar dari Akun (Logout)
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DIALOG LIHAT DETAIL BATCH */}
        <Dialog open={!!detailSubmission} onOpenChange={(open) => !open && setDetailSubmission(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Setoran Batch Email</DialogTitle>
              <DialogDescription>
                Waktu setor: {formatDateTime(detailSubmission?.submittedAt)} · #{shortId(detailSubmission?.id ?? "")}
              </DialogDescription>
            </DialogHeader>
            {detailSubmission && (() => {
              const baseItems = Array.isArray(detailSubmission.items) && detailSubmission.items.length > 0
                ? detailSubmission.items
                : detailSubmission.email
                  ? [{
                      email: detailSubmission.email,
                      password: detailSubmission.password,
                      status: detailSubmission.status === "available" || detailSubmission.status === "approved" ? "approved" : detailSubmission.status === "rejected" ? "rejected" : "pending"
                    }]
                  : [];

              const tierCfg = getTierConfig(detailSubmission.appliedTier ?? detailSubmission.currentTier ?? profile.tier, rules.data.tiers);
              const pricePerItem = detailSubmission.appliedPricePerItem ?? detailSubmission.currentPricePerItem ?? tierCfg.pricePerItem;

              const approvedCount = detailSubmission.approvedItemCount ?? baseItems.filter((i) => i.status === "approved").length;
              const rejectedCount = detailSubmission.rejectedItemCount ?? baseItems.filter((i) => i.status === "rejected").length;
              const earned = detailSubmission.totalAmount ?? (approvedCount * pricePerItem);

              return (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <span className="text-gray-500">Total Email:</span>
                      <p className="font-bold text-gray-900">{baseItems.length} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Terjual (✓):</span>
                      <p className="font-bold text-green-600">{approvedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Ditolak (X):</span>
                      <p className="font-bold text-red-600">{rejectedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Didapat:</span>
                      <p className="font-bold text-amber-700">{formatMoney(earned)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs text-gray-600">
                        Status per Alamat Email ({baseItems.length} item):
                      </Label>
                      <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-300">
                        Rate: {formatMoney(pricePerItem)}/akun
                      </Badge>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                      {baseItems.map((it, idx) => {
                        const st = it.status ?? (detailSubmission.status === "available" || detailSubmission.status === "approved" ? "approved" : detailSubmission.status === "rejected" ? "rejected" : "pending");
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-md border flex items-center justify-between gap-2 text-xs font-mono transition-colors ${
                              st === "approved"
                                ? "bg-green-50/60 border-green-200"
                                : st === "rejected"
                                  ? "bg-red-50/60 border-red-200"
                                  : "bg-amber-50/60 border-amber-200"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate">
                                {idx + 1}. {it.email}
                              </p>
                              {it.password && <p className="text-[11px] text-gray-500 font-sans">Sandi: {it.password}</p>}
                            </div>

                            <Badge
                              className={`shrink-0 text-[11px] font-sans ${
                                st === "approved"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : st === "rejected"
                                    ? "bg-red-100 text-red-800 hover:bg-red-100"
                                    : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                              }`}
                            >
                              {st === "approved" ? "✓ Terjual" : st === "rejected" ? "X Ditolak" : "Menunggu"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {detailSubmission.reviewNote && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                      <p className="font-bold mb-0.5">Catatan Admin:</p>
                      <p className="italic">{detailSubmission.reviewNote}</p>
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
