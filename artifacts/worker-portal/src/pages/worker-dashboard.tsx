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
  Mail,
  Megaphone,
  Building2,
  Smartphone,
  ArrowRight,
  Sparkles,
  Coins,
  Trophy,
  Home,
  PlusCircle,
  ChevronRight,
  BookOpen,
  Tag,
  SearchCheck,
  Share2,
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
import {
  DEFAULT_RULES,
  DEFAULT_OPERATING_HOURS,
  DEFAULT_WITHDRAWAL_SETTINGS,
  DEFAULT_MAINTENANCE,
  DEFAULT_GENERAL_SETTINGS,
  type EmailSubmission,
  type PortalUser,
  type PaymentMethodFeeConfig,
} from "@/lib/portal-types";
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

  const [, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number }>({
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

  // Email sensor state
  const [isEmailVisible, setIsEmailVisible] = useState(false);

  // Engagement UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitationCodeInput, setInvitationCodeInput] = useState("");
  const [claimingCode, setClaimingCode] = useState(false);

  // Pasif Income Simulation state
  const [simFriends, setSimFriends] = useState(10);
  const [simAccPerFriend, setSimAccPerFriend] = useState(10);

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

    // 2. Reward Ledger Entries
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

  // Profile fields display
  const displayName = profile?.name && profile.name.trim() ? profile.name.trim() : "Worker";
  const displayEmail = profile?.email && profile.email.trim() ? profile.email.trim() : "-";

  // Active Tab state
  const [mainTab, setMainTab] = useState<"submit" | "checker" | "leaderboard" | "referral" | "withdraw" | "history" | "cs" | "announcements">("submit");

  // Submit emails
  const [emailsText, setEmailsText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detail Dialog state
  const [detailSubmission, setDetailSubmission] = useState<EmailSubmission | null>(null);

  // Mobile menu / Akun drawer state
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);

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

  // Withdraw
  const [amount, setAmount] = useState<number>(0);

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

  // Menu items for "LAYANAN CEPAT" Grid Menu
  const quickServices = [
    {
      id: "submit" as const,
      title: "Job Gmail",
      subtitle: "Form Batch Email",
      icon: <Mail className="w-5 h-5 text-amber-700" />,
      badge: "Utama",
    },
    {
      id: "checker" as const,
      title: "Status ACC",
      subtitle: "Checker Status",
      icon: <SearchCheck className="w-5 h-5 text-amber-700" />,
      badge: "Real-time",
    },
    {
      id: "leaderboard" as const,
      title: "Klasemen",
      subtitle: "Event Reward",
      icon: <Trophy className="w-5 h-5 text-amber-700" />,
      badge: "Rp15k-50k",
    },
    {
      id: "referral" as const,
      title: "Referral",
      subtitle: "Komisi Pasif",
      icon: <Users className="w-5 h-5 text-amber-700" />,
      badge: "Rp 100",
    },
    {
      id: "withdraw" as const,
      title: "Tarik Saldo",
      subtitle: "Form Withdraw",
      icon: <Wallet className="w-5 h-5 text-amber-700" />,
      badge: "Instant",
    },
    {
      id: "history" as const,
      title: "Riwayat Job",
      subtitle: "Riwayat Setoran",
      icon: <History className="w-5 h-5 text-amber-700" />,
    },
    {
      id: "cs" as const,
      title: "Bantuan CS",
      subtitle: "Telegram & WA",
      icon: <MessageCircle className="w-5 h-5 text-amber-700" />,
      badge: "CS 24/7",
    },
    {
      id: "announcements" as const,
      title: "Info Resmi",
      subtitle: "Pengumuman",
      icon: <Megaphone className="w-5 h-5 text-amber-700" />,
      badge: announcements.data.length > 0 ? `${announcements.data.length}` : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100/80 flex flex-col items-center">
      {/* MOBILE SMARTPHONE CONTAINER WRAPPER (MAX-W-MD) */}
      <div className="w-full max-w-md min-h-screen bg-slate-50 border-x border-slate-200/80 shadow-2xl relative flex flex-col pb-28">

        {/* 1. TOP BAR (OPERASIONAL) - UKURAN RINGKAS */}
        <div className="bg-slate-900 text-slate-100 text-[11px] px-3.5 py-1.5 flex items-center justify-between border-b border-slate-800 font-medium sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-300 font-sans truncate">
              Senin - Jumat: 08:00 - 15:00 WIB
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                operatingStatus.isOpen
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  operatingStatus.isOpen ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {operatingStatus.isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </div>

        {/* TOP USER BAR (PROFILE & LOGOUT SHORTCUT) */}
        <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-amber-100/60 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs ring-2 ring-amber-400/30 shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-xs truncate leading-tight">{displayName}</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="font-mono">
                  {isEmailVisible ? displayEmail : "*".repeat(displayEmail.length || 10)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEmailVisible(!isEmailVisible)}
                  className="text-gray-400 hover:text-amber-600 p-0.5 focus:outline-none"
                  title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}
                >
                  {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAccountDrawerOpen(true)}
            className="text-amber-900 bg-amber-50 hover:bg-amber-100 hover:text-amber-950 font-bold text-xs h-8 px-2.5 rounded-xl border border-amber-200/60 gap-1"
          >
            <User className="w-3.5 h-3.5 text-amber-600" />
            <span>Akun</span>
          </Button>
        </div>

        {/* DASHBOARD CONTENT BODY */}
        <div className="p-4 space-y-4 flex-1">

          {/* 2. HEADER & SALDO CARD */}
          <div className="space-y-3">
            {/* Greeting */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Selamat Datang!</p>
                <h1 className="text-lg font-black text-gray-900 tracking-tight">
                  Hai, {displayName.split(" ")[0]} 👋
                </h1>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 font-bold text-[10px] px-2 py-0.5">
                Worker Portal
              </Badge>
            </div>

            {/* Card Saldo Utama */}
            <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl shadow-lg border-amber-400/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-amber-300/20 rounded-full blur-xl pointer-events-none" />

              <CardContent className="p-4 sm:p-5 space-y-3.5 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-100 text-[11px] font-extrabold uppercase tracking-wider">
                    <Wallet className="w-3.5 h-3.5 text-amber-200" />
                    <span>Saldo Utama</span>
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
                </div>

                {/* Saldo Besar */}
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-xs">
                    {formatMoney(profile.balance)}
                  </p>
                </div>

                {/* Badges Info Rate & Referral */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white border border-white/25">
                    <Tag className="w-3 h-3 text-amber-200 shrink-0" />
                    Rate Saat Ini: {formatMoney(currentTierConfig.pricePerItem)}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white border border-white/25">
                    <Coins className="w-3 h-3 text-amber-200 shrink-0" />
                    Bonus Referral: {formatMoney(rules.data.referralCommissionPerAcc || 100)}/ACC
                  </span>
                </div>

                {/* 2 Tombol Aksi Cepat: [Tarik Saldo] & [Setor Email] */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    type="button"
                    onClick={() => setMainTab("withdraw")}
                    className="bg-white text-amber-900 hover:bg-amber-50 font-black text-xs h-9 rounded-xl shadow-xs border border-white/80 gap-1.5 transition-transform active:scale-95"
                  >
                    <Wallet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tarik Saldo</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setMainTab("submit")}
                    className="bg-amber-950/40 hover:bg-amber-950/60 text-white font-black text-xs h-9 rounded-xl border border-white/30 backdrop-blur-md shadow-xs gap-1.5 transition-transform active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-300" />
                    <span>Setor Email</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. SECTION "LAYANAN CEPAT" (GRID MENU IKON) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Layanan Cepat
              </h2>
              <span className="text-[10px] text-gray-400 font-medium">Menu Akses Fitur</span>
            </div>

            {/* 4 KOLOM GRID MENU IKON */}
            <div className="grid grid-cols-4 gap-2.5">
              {quickServices.map((srv) => {
                const isActive = mainTab === srv.id;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setMainTab(srv.id)}
                    className={`relative p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1.5 select-none active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-b from-amber-500 to-orange-500 text-white border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/40"
                        : "bg-gradient-to-b from-amber-50/90 to-orange-50/50 hover:from-amber-100 hover:to-orange-100 text-gray-800 border-amber-200/80 shadow-2xs"
                    }`}
                  >
                    {/* Badge Kecil jika ada */}
                    {srv.badge && (
                      <span
                        className={`absolute -top-1.5 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black shadow-2xs ${
                          isActive
                            ? "bg-white text-amber-900"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {srv.badge}
                      </span>
                    )}

                    {/* Lingkaran Ikon */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-white text-amber-600 shadow-2xs border border-amber-200/60"
                      }`}
                    >
                      {srv.icon}
                    </div>

                    <div className="w-full text-center">
                      <p className={`text-[11px] font-extrabold leading-tight ${isActive ? "text-white" : "text-gray-900"}`}>
                        {srv.title}
                      </p>
                      <p className={`text-[9px] truncate font-medium mt-0.5 ${isActive ? "text-amber-100" : "text-gray-500"}`}>
                        {srv.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. AREA KONTEN DINAMIS */}
          <div className="space-y-4 pt-2">

            {/* A. JOB GMAIL (BATCH SETORAN EMAIL) */}
            {mainTab === "submit" && (
              <div className="space-y-4">
                {/* RATE CARD BANNER */}
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-3.5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-amber-600" />
                        Informasi Rate Harga Setor
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-bold">
                        RATE AKTIF
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-0">
                    <div className="p-3.5 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-50/80 to-orange-500/10 text-center shadow-2xs">
                      <div className="flex items-center justify-center gap-1.5 mb-1 text-amber-900 font-medium text-xs">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Rate Akun Valid</span>
                      </div>
                      <p className="text-2xl font-black text-amber-700 tracking-tight my-0.5">
                        {formatMoney(currentTierConfig.pricePerItem)}{" "}
                        <span className="text-xs font-semibold text-amber-900/80">/ akun valid</span>
                      </p>
                      <p className="text-[11px] text-amber-900/80 mt-1 font-medium">
                        Komisi langsung masuk ke saldo utama setelah verifikasi ACC.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ATURAN SETOR EMAIL */}
                <Card className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-100/40 border-amber-200/90 shadow-2xs">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Aturan Setor Email
                      </div>
                      <Badge className="bg-amber-500 text-white font-bold text-[10px] border-0">
                        {formatMoney(currentTierConfig.pricePerItem)} / akun
                      </Badge>
                    </div>
                    <ul className="space-y-1 text-[11px] text-amber-900/90 list-disc list-inside whitespace-pre-wrap leading-relaxed">
                      {rules.data.submissionNotes.map((note, idx) => (
                        <li key={idx} className="whitespace-pre-wrap">{note}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* OPERATIONAL CLOSED / LOCK WARNING BANNER */}
                {isSubmissionClosed && (
                  <Card className="bg-rose-50 border-rose-200 shadow-2xs">
                    <CardContent className="p-3.5 flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-rose-500 text-white shrink-0 mt-0.5">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-rose-900 text-xs">Pemberitahuan Setoran Ditutup</h4>
                        <p className="text-[11px] text-rose-800 font-medium leading-relaxed mt-0.5">
                          Setoran email saat ini sedang DITUTUP oleh Admin. Silakan coba kembali pada jam operasional.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* FORM BATCH SETORAN */}
                <Card className="bg-white border-amber-200/80 shadow-xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-amber-600" />
                      Form Batch Setoran Email
                    </CardTitle>
                    <CardDescription className="text-[11px] text-gray-600">
                      Masukkan satu atau banyak email sekaligus. Seluruh item dikirim sebagai 1 batch.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <form onSubmit={handleSubmitEmails} className="space-y-3.5">
                      <fieldset disabled={isSubmissionClosed} className="space-y-3.5 disabled:opacity-60 disabled:pointer-events-none">
                        <div>
                          <Label htmlFor="emails" className="text-xs font-bold text-gray-800">
                            Daftar Alamat Email ({emailList.length} item)
                          </Label>
                          <Textarea
                            id="emails"
                            rows={5}
                            value={emailsText}
                            onChange={(e) => setEmailsText(e.target.value)}
                            placeholder={"item1@example.com\nitem2@example.com\nitem3@example.com"}
                            className="mt-1 font-mono text-xs border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                            required
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Pisahkan setiap email dengan baris baru. Multi-item otomatis digabung.
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
                            className="mt-1 border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl text-xs"
                            required
                          />
                        </div>

                        <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-gray-600 font-medium text-[11px]">Estimasi Total Setoran: </span>
                            <strong className="text-gray-900 font-bold text-[11px]">{emailList.length} item × {formatMoney(currentTierConfig.pricePerItem)}</strong>
                          </div>
                          <span className="font-black text-amber-700 text-sm">{formatMoney(emailList.length * currentTierConfig.pricePerItem)}</span>
                        </div>
                      </fieldset>

                      <Button
                        type="submit"
                        disabled={submitting || isSubmissionClosed}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-10 text-xs gap-1.5 rounded-xl shadow-xs border border-amber-400/20 active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSubmissionClosed ? "Setoran Ditutup" : `Kirim Batch (${emailList.length} Item)`}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* B. STATUS ACC (CHECKER EMAIL REAL-TIME) */}
            {mainTab === "checker" && (
              <div className="space-y-3">
                <EmailChecker isAdminView={false} />
              </div>
            )}

            {/* C. KLASEMEN (LEADERBOARD & EVENT REWARDS) */}
            {mainTab === "leaderboard" && (
              <div className="space-y-3">
                <Leaderboard
                  currentUserId={profile.uid}
                  rewards={rules.data.leaderboardRewards}
                />
              </div>
            )}

            {/* D. REFERRAL & PASIF INCOME */}
            {mainTab === "referral" && (
              <div className="space-y-4">
                {/* BANNER REFERRAL */}
                <Card className="bg-gradient-to-r from-[#2D1B00] via-[#4A2800] to-[#5C3A00] text-white border-amber-900/80 shadow-md overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  <CardContent className="p-4 sm:p-5 space-y-2 relative z-10">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      Pasif Income
                    </div>
                    <h2 className="text-xl font-black text-white leading-tight">
                      Pasif Income Tanpa Batas
                    </h2>
                    <p className="text-xs text-amber-100/90 leading-relaxed">
                      Ajak rekan kerja Anda bergabung. Setiap kali downline Anda menyetor email dan disetujui (ACC), komisi referral otomatis LANGSUNG masuk ke Saldo Utama Anda!
                    </p>
                  </CardContent>
                </Card>

                {/* SIMULATOR PASIF INCOME */}
                <Card className="bg-gradient-to-br from-[#211300] via-[#321D00] to-[#211300] text-[#FFE0B2] border-amber-900/60 shadow-md">
                  <CardHeader className="p-3.5 pb-2 border-b border-amber-900/50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-xs font-black text-[#FFB74D] flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" />
                        Kalkulator Simulasi Pasif Income
                      </CardTitle>
                      <Badge variant="outline" className="bg-amber-500/10 text-[#FFB74D] border-amber-500/30 font-bold text-[10px] px-2 py-0.5">
                        Flat: {formatMoney(rules.data.referralCommissionPerAcc || 100)} / ACC
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Downline Slider */}
                      <div className="space-y-1 p-2 bg-[#2D1B00]/80 rounded-xl border border-amber-900/40">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-[#FFE0B2] uppercase">
                            Jumlah Downline
                          </Label>
                          <span className="text-xs font-black text-[#FFB74D] bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800/60">
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

                      {/* Email ACC Slider */}
                      <div className="space-y-1 p-2 bg-[#2D1B00]/80 rounded-xl border border-amber-900/40">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-[#FFE0B2] uppercase">
                            Email ACC / Downline / Hari
                          </Label>
                          <span className="text-xs font-black text-[#FFB74D] bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800/60">
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

                    {/* Proyeksi Hasil */}
                    <div className="p-2.5 rounded-xl bg-[#1A0E00] border border-amber-800/50 space-y-2">
                      <div className="text-[10px] text-amber-200/80 flex items-center justify-between border-b border-amber-900/60 pb-1">
                        <span>Total Volume Email ACC Tim / Hari:</span>
                        <strong className="text-[#FFB74D] font-mono text-xs">{simFriends * simAccPerFriend} ACC</strong>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-[#281500] border border-amber-900/60">
                          <p className="text-[9px] font-bold text-amber-300/80 uppercase">Estimasi / Hari</p>
                          <p className="text-sm sm:text-base font-black text-[#FFB74D]">
                            {formatMoney(simFriends * simAccPerFriend * (rules.data.referralCommissionPerAcc || 100))}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-[#281500] border border-amber-900/60">
                          <p className="text-[9px] font-bold text-amber-300/80 uppercase">Estimasi / Bulan</p>
                          <p className="text-sm sm:text-base font-black text-[#FFB74D]">
                            {formatMoney(simFriends * simAccPerFriend * (rules.data.referralCommissionPerAcc || 100) * 30)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3 KARTU STATISTIK REFERRAL */}
                <div className="grid grid-cols-3 gap-2">
                  <Card className="bg-[#FFF8F0] border-[#FFE0B2]">
                    <CardContent className="p-3 text-center space-y-1">
                      <p className="text-[9px] font-bold text-amber-900/70 uppercase">Total Bonus</p>
                      <p className="text-sm font-black text-[#E65100]">
                        {formatMoney(profile.totalReferralEarned ?? refStats.earnings ?? 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#FFF8F0] border-[#FFE0B2]">
                    <CardContent className="p-3 text-center space-y-1">
                      <p className="text-[9px] font-bold text-amber-900/70 uppercase">Downline</p>
                      <p className="text-sm font-black text-[#E65100]">
                        {downlines.data.length || refStats.total} <span className="text-[10px] font-normal">Worker</span>
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#FFF8F0] border-[#FFE0B2]">
                    <CardContent className="p-3 text-center space-y-1">
                      <p className="text-[9px] font-bold text-amber-900/70 uppercase">ACC Tim</p>
                      <p className="text-sm font-black text-[#E65100]">
                        {profile.teamAccCount ?? refStats.totalTeamAcc ?? 0} <span className="text-[10px] font-normal">ACC</span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* TAUTAN REFERRAL */}
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-3.5 pb-2">
                    <CardTitle className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-amber-600" />
                      Tautan Referral Saya
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-0 space-y-2.5">
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={referralLink}
                        className="font-mono text-xs bg-amber-50/40 border-amber-200 text-amber-950 rounded-xl"
                      />
                      <Button
                        onClick={handleCopyReferralLink}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0 gap-1 font-bold text-xs h-9 px-3 rounded-xl active:scale-95 transition-transform"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? "Tersalin!" : "Salin"}
                      </Button>
                    </div>

                    <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs space-y-1.5 text-amber-950">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px]">Kode Referral:</span>
                        <Badge variant="outline" className="font-mono bg-white text-amber-950 border-amber-300 font-bold text-[10px]">
                          {profile.uid}
                        </Badge>
                      </div>
                      {isAlreadyLinked ? (
                        <p className="text-[10px] text-amber-900">
                          ✓ Terhubung dengan Pengundang: <strong className="font-bold">{referrerDisplayName || "Rekan"}</strong>
                        </p>
                      ) : (
                        <form onSubmit={handleClaimInvitationCode} className="pt-1.5 border-t border-amber-200/60 space-y-1.5">
                          <p className="text-[10px] text-amber-900">Masukkan kode pengundang Anda jika ada:</p>
                          <div className="flex gap-2">
                            <Input
                              value={invitationCodeInput}
                              onChange={(e) => setInvitationCodeInput(e.target.value)}
                              placeholder="Kode Upline"
                              className="font-mono text-xs bg-white rounded-xl border-amber-200 h-8"
                              disabled={claimingCode}
                            />
                            <Button
                              type="submit"
                              disabled={claimingCode || !invitationCodeInput.trim()}
                              className="bg-amber-600 text-white text-xs font-bold rounded-xl h-8 px-3"
                            >
                              {claimingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* DAFTAR DOWNLINE TIM */}
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-3.5 pb-2">
                    <CardTitle className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      Daftar Tim Downline ({downlines.data.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 pt-0">
                    {downlines.loading && <p className="text-xs text-gray-400 text-center py-4">Memuat data downline...</p>}
                    {!downlines.loading && downlines.data.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-6 border border-dashed border-amber-200 rounded-xl bg-[#FFF8F0]">
                        Belum ada downline. Bagikan tautan referral untuk mulai mengajak tim.
                      </p>
                    )}
                    {!downlines.loading && downlines.data.length > 0 && (
                      <div className="space-y-2">
                        {downlines.data.map((dw) => (
                          <div key={dw.uid} className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/30 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-gray-900">{dw.name || "Worker"}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{formatDateTime(dw.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 font-bold text-[10px]">
                                {dw.accCount ?? 0} ACC
                              </Badge>
                              <p className="text-[10px] font-bold text-[#E65100] mt-0.5">
                                +{formatMoney((dw.accCount ?? 0) * (rules.data.referralCommissionPerAcc ?? 100))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* E. TARIK SALDO */}
            {mainTab === "withdraw" && (
              <div className="space-y-4">
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <CardTitle className="text-sm font-bold text-gray-900">Formulir Penarikan Saldo</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-300">
                        {currentFeeBadgeText}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-4">
                    <form onSubmit={handleWithdraw} className="space-y-4">
                      {/* Step 1: Kategori & Provider */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                          Metode Pembayaran
                        </Label>

                        <div className="inline-flex p-0.5 bg-amber-100/60 border border-amber-200/60 rounded-xl gap-1 text-xs w-full">
                          <button
                            type="button"
                            onClick={() => handleSelectCategory("ewallet")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              categoryTab === "ewallet"
                                ? "bg-amber-500 text-white shadow-2xs"
                                : "text-amber-950"
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5" /> E-Wallet
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectCategory("bank")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              categoryTab === "bank"
                                ? "bg-amber-500 text-white shadow-2xs"
                                : "text-amber-950"
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" /> Transfer Bank
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {visibleMethods.map((m) => {
                            const isSelected = method === m.method;
                            return (
                              <div
                                key={m.method}
                                onClick={() => setMethod(m.method)}
                                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between select-none ${
                                  isSelected
                                    ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/30"
                                    : "border-gray-200 bg-white hover:border-amber-300"
                                }`}
                              >
                                <span className="font-bold text-xs text-gray-900">{m.method}</span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 2: Nominal */}
                      <div className="space-y-2 pt-1 border-t border-gray-100">
                        <Label htmlFor="amount" className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
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
                            { label: `Maksimal (${formatMoney(profile.balance)})`, value: profile.balance },
                            { label: "Rp 25.000", value: 25000 },
                            { label: "Rp 50.000", value: 50000 },
                            { label: "Rp 100.000", value: 100000 },
                          ].map((chip, idx) => (
                            <Button
                              key={idx}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAmount(chip.value)}
                              className={`text-[11px] h-6 px-2.5 rounded-full ${
                                amount === chip.value
                                  ? "bg-amber-500 text-white border-amber-400 font-bold"
                                  : "bg-slate-50 text-gray-700 hover:bg-amber-50 border-gray-200"
                              }`}
                            >
                              {chip.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Step 3: Detail Akun */}
                      <div className="space-y-2 pt-1 border-t border-gray-100">
                        <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                          Detail Rekening / Wallet
                        </Label>
                        <div className="space-y-2">
                          <Input
                            id="account"
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            placeholder={`Nomor HP ${method} / Rekening`}
                            className="border-gray-200 focus-visible:ring-amber-500 rounded-xl text-xs h-9"
                            required
                          />
                          <Input
                            id="accountHolderName"
                            value={accountHolderName}
                            onChange={(e) => setAccountHolderName(e.target.value)}
                            placeholder="Atas Nama Pemilik Rekening/Wallet"
                            className="border-gray-200 focus-visible:ring-amber-500 rounded-xl text-xs h-9"
                            required
                          />
                        </div>

                        {/* Summary breakdown */}
                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 space-y-1.5 text-xs mt-2">
                          <div className="flex justify-between text-gray-600">
                            <span>Jumlah:</span>
                            <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Biaya Admin:</span>
                            <span className="font-bold text-emerald-700">
                              {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Bebas Biaya)"}
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-amber-200 flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                            <span className="font-black text-emerald-700 text-sm">{formatMoney(calculatedNet)}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={withdrawing}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-10 gap-1.5 text-xs shadow-xs rounded-xl border border-amber-400/20 active:scale-95 transition-transform"
                      >
                        {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                        Ajukan Penarikan ({formatMoney(calculatedNet)})
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* RIWAYAT PENARIKAN */}
                <TransactionHistory
                  transactions={transactionHistory}
                  loading={withdrawals.loading || engagement.rewardLedger.loading}
                />
              </div>
            )}

            {/* F. RIWAYAT JOB / SETORAN */}
            {mainTab === "history" && (
              <div className="space-y-3">
                <SubmissionHistory
                  submissions={submissions.data}
                  loading={submissions.loading}
                  rules={rules.data}
                  userTier={profile.tier}
                  onViewDetail={setDetailSubmission}
                />
              </div>
            )}

            {/* G. BANTUAN CS */}
            {mainTab === "cs" && (
              <div className="space-y-3">
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      Pusat Bantuan CS & Komunitas
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-600">
                      Hubungi tim dukungan kami jika mengalami kendala akun atau payout.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Telegram CS */}
                      <div className="p-3.5 rounded-2xl bg-[#2D1B00] border border-amber-900/60 text-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-[#FFB74D]">
                            <TelegramIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-[#FFB74D]">CS Telegram</p>
                            <p className="text-[10px] text-[#FFE0B2]/80">Kendala Akun & Payout</p>
                          </div>
                        </div>
                        {supportConfig.telegramUrl ? (
                          <Button
                            asChild
                            size="sm"
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-bold text-xs h-8 rounded-lg"
                          >
                            <a href={supportConfig.telegramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1">
                              <TelegramIcon className="w-3.5 h-3.5" />
                              <span>Hubungi Telegram</span>
                            </a>
                          </Button>
                        ) : (
                          <p className="text-[10px] text-amber-200/60 italic">Kontak belum dikonfigurasi admin.</p>
                        )}
                      </div>

                      {/* Komunitas WhatsApp */}
                      <div className="p-3.5 rounded-2xl bg-[#2D1B00] border border-amber-900/60 text-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-[#FFB74D]">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-[#FFB74D]">Komunitas WhatsApp</p>
                            <p className="text-[10px] text-[#FFE0B2]/80">Info & Saluran Resmi</p>
                          </div>
                        </div>
                        {supportConfig.communityWaLink ? (
                          <Button
                            asChild
                            size="sm"
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-bold text-xs h-8 rounded-lg"
                          >
                            <a href={supportConfig.communityWaLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Gabung Grup WA</span>
                            </a>
                          </Button>
                        ) : (
                          <p className="text-[10px] text-amber-200/60 italic">Kontak belum dikonfigurasi admin.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* H. PENGUMUMAN RESMI */}
            {mainTab === "announcements" && (
              <div className="space-y-3">
                <Card className="bg-white border-amber-200/80 shadow-2xs">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-gray-900">
                      <Megaphone className="w-4 h-4 text-amber-600" />
                      Pusat Pengumuman Resmi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    {announcements.loading && <p className="text-xs text-gray-400 text-center py-4">Memuat pengumuman...</p>}
                    {!announcements.loading && announcements.data.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                        Belum ada pengumuman resmi saat ini.
                      </p>
                    )}
                    {!announcements.loading && announcements.data.length > 0 && (
                      <div className="space-y-2.5">
                        {announcements.data.map((item) => (
                          <Card key={item.id} className="bg-slate-50 border-slate-200">
                            <CardHeader className="p-3 pb-1">
                              <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-xs font-bold text-gray-900">{item.title}</CardTitle>
                                {item.badge && (
                                  <Badge className="text-[10px] font-bold bg-amber-100 text-amber-800">
                                    {item.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400">{formatDateTime(item.createdAt)}</p>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </div>

        </div>

        {/* 5. BOTTOM NAVIGATION BAR (FIXED MELAYANG DI BAWAH SMARTPHONE) */}
        <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl px-2 py-1.5 flex items-center justify-around text-slate-200">
          {/* 1. HOME */}
          <button
            type="button"
            onClick={() => setMainTab("submit")}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              mainTab === "submit"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {mainTab === "submit" && (
              <span className="absolute -top-1.5 w-6 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-tight">Home</span>
          </button>

          {/* 2. SETOR */}
          <button
            type="button"
            onClick={() => setMainTab("submit")}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              mainTab === "submit"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="p-1 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-md shadow-amber-500/20 mb-0.5">
              <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="text-[9px] tracking-tight font-semibold">Setor</span>
          </button>

          {/* 3. WITHDRAW */}
          <button
            type="button"
            onClick={() => setMainTab("withdraw")}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              mainTab === "withdraw"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {mainTab === "withdraw" && (
              <span className="absolute -top-1.5 w-6 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <Wallet className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-tight">Withdraw</span>
          </button>

          {/* 4. CS */}
          <button
            type="button"
            onClick={() => setMainTab("cs")}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              mainTab === "cs"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {mainTab === "cs" && (
              <span className="absolute -top-1.5 w-6 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <MessageCircle className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-tight">CS</span>
          </button>

          {/* 5. AKUN */}
          <button
            type="button"
            onClick={() => setIsAccountDrawerOpen(true)}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              isAccountDrawerOpen
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {isAccountDrawerOpen && (
              <span className="absolute -top-1.5 w-6 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            <User className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] tracking-tight">Akun</span>
          </button>
        </nav>

        {/* AKUN / PROFIL DRAWER MODAL SHEET */}
        <Dialog open={isAccountDrawerOpen} onOpenChange={setIsAccountDrawerOpen}>
          <DialogContent className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border-slate-800 text-slate-100 p-0 overflow-hidden rounded-t-3xl sm:rounded-2xl border shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-md ring-2 ring-amber-400/30">
                  {displayName.charAt(0).toUpperCase()}
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
                      {isEmailVisible ? displayEmail : "*".repeat(displayEmail.length || 10)}
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
                <p className="font-black text-amber-400 text-xs">{formatMoney(profile.balance)}</p>
              </div>
            </div>

            <div className="p-3.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Menu Portal</p>

              <button
                type="button"
                onClick={() => {
                  setMainTab("checker");
                  setIsAccountDrawerOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <SearchCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs">Checker Email & Status</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab("referral");
                  setIsAccountDrawerOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs">Referral & Pasif Income</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab("leaderboard");
                  setIsAccountDrawerOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span className="text-xs">Klasemen & Reward</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainTab("cs");
                  setIsAccountDrawerOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs">Bantuan CS & WA</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-950/80">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAccountDrawerOpen(false);
                  onLogout();
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 font-bold gap-2 text-xs h-9 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar dari Akun
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* DIALOG DETAIL BATCH SETORAN */}
        <Dialog open={!!detailSubmission} onOpenChange={(open) => !open && setDetailSubmission(null)}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Detail Setoran Batch Email</DialogTitle>
              <DialogDescription className="text-xs">
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
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2.5 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <span className="text-gray-500 text-[10px]">Total Email:</span>
                      <p className="font-bold text-gray-900">{baseItems.length} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px]">Terjual (✓):</span>
                      <p className="font-bold text-green-600">{approvedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px]">Ditolak (X):</span>
                      <p className="font-bold text-red-600">{rejectedCount} item</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px]">Total Didapat:</span>
                      <p className="font-bold text-amber-700">{formatMoney(earned)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-gray-600">
                        Status per Email ({baseItems.length} item):
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">
                        Rate: {formatMoney(pricePerItem)}/akun
                      </Badge>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                      {baseItems.map((it, idx) => {
                        const st = it.status ?? (detailSubmission.status === "available" || detailSubmission.status === "approved" ? "approved" : detailSubmission.status === "rejected" ? "rejected" : "pending");
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-md border flex items-center justify-between gap-2 text-xs font-mono transition-colors ${
                              st === "approved"
                                ? "bg-green-50/60 border-green-200"
                                : st === "rejected"
                                  ? "bg-red-50/60 border-red-200"
                                  : "bg-amber-50/60 border-amber-200"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 truncate text-[11px]">
                                {idx + 1}. {it.email}
                              </p>
                              {it.password && <p className="text-[10px] text-gray-500 font-sans">Sandi: {it.password}</p>}
                            </div>

                            <Badge
                              className={`shrink-0 text-[10px] font-sans ${
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
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                      <p className="font-bold text-[11px]">Catatan Admin:</p>
                      <p className="italic text-[11px]">{detailSubmission.reviewNote}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
