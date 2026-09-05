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
  Award,
  Users,
  Copy,
  Check,
  HelpCircle,
  MessageCircle,
  User,
  Mail,
  Phone,
  Megaphone,
  Building2,
  Smartphone,
  ArrowRight,
  Sparkles,
  CreditCard,
  Share2,
  Coins,
  Wrench,
  Sparkles as SparklesIcon,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { Leaderboard } from "@/components/Leaderboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
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
  claimReferralCode,
  claimReferralReward,
  createSubmission,
  createWithdrawal,
} from "@/hooks/use-portal";
import { DEFAULT_RULES, DEFAULT_REFERRAL_TIERS, DEFAULT_OPERATING_HOURS, DEFAULT_WITHDRAWAL_SETTINGS, DEFAULT_MAINTENANCE, type EmailSubmission, type PortalUser, type PaymentMethodFeeConfig } from "@/lib/portal-types";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { SubmissionHistory } from "@/components/SubmissionHistory";
import { TransactionHistory } from "@/components/TransactionHistory";
import {
  formatDateTime,
  formatMoney,
  getItemCountOfSubmission,
  getTierConfig,
  shortId,
  validatePasswordAgainstRules,
  getReferralRewardForAccCount,
  getReferralTierForAccCount,
  getNextReferralTierForAccCount,
  getOperatingStatus,
  isReferralTierClaimed,
  isReferralTierClaimable,
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
  const rules = useSettings("rules", DEFAULT_RULES);
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

  // Active Tier configuration & active referral tiers
  const currentTierConfig = useMemo(() => {
    return getTierConfig(profile.tier ?? 1, rules.data.tiers);
  }, [profile.tier, rules.data.tiers]);

  const activeReferralTiers = useMemo(() => {
    return Array.isArray(rules.data.referralTiers) && rules.data.referralTiers.length > 0
      ? rules.data.referralTiers
      : DEFAULT_REFERRAL_TIERS;
  }, [rules.data.referralTiers]);

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

  const simulatedEarnings = useMemo(() => {
    const rewardPerFriend = activeReferralTiers
      .filter((t) => simAccPerFriend >= t.minAcc)
      .reduce((s, t) => s + t.reward, 0);
    return simFriends * rewardPerFriend;
  }, [simFriends, simAccPerFriend, activeReferralTiers]);

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

  // Profile fields display with robust fallbacks
  const displayName = profile?.name && profile.name.trim() ? profile.name.trim() : "Worker";
  const displayEmail = profile?.email && profile.email.trim() ? profile.email.trim() : "-";
  const displayPhone = profile?.phone && profile.phone.trim() ? profile.phone.trim() : "Belum ditambahkan";

  // --- Submit emails ---
  const [emailsText, setEmailsText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detail Dialog state
  const [detailSubmission, setDetailSubmission] = useState<EmailSubmission | null>(null);

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
  const [mainTab, setMainTab] = useState("submit");
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

  return (
    <div className="min-h-screen bg-slate-50/80">
      <header className="bg-white/95 backdrop-blur-md border-b border-amber-100 sticky top-0 z-20 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-extrabold flex items-center justify-center text-base shadow-sm ring-2 ring-amber-400/30">
              {profile.name?.charAt(0).toUpperCase() || "W"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-sm leading-tight">{profile.name}</p>
                <Badge variant="outline" className="text-[11px] bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-300 font-bold gap-1 shadow-2xs">
                  <Award className="w-3 h-3 text-amber-600 shrink-0" />
                  {currentTierConfig.name} ({formatMoney(currentTierConfig.pricePerItem)}/item)
                </Badge>
              </div>
              <p className="text-[11px] text-gray-500">{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-1.5 rounded-xl border border-amber-200/80">
              <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Saldo Utama</p>
              <p className="font-black text-amber-700 text-sm">{formatMoney(profile.balance)}</p>
            </div>
            <Button variant="outline" size="icon" onClick={onLogout} title="Keluar" className="border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* JAM OPERASIONAL CARD */}
        <Card className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-100/30 border-amber-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-300/20 to-transparent rounded-bl-full pointer-events-none" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
                <span>Jam Operasional Layanan</span>
              </CardTitle>
              {operatingStatus.isDisabled ? (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 font-medium text-xs px-2.5 py-1">
                  {operatingStatus.statusText}
                </Badge>
              ) : (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs border ${
                  operatingStatus.isOpen
                    ? "bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400/20"
                    : "bg-rose-500 text-white border-rose-400 ring-2 ring-rose-400/20"
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${operatingStatus.isOpen ? "bg-emerald-200" : "bg-rose-200"}`} />
                  {operatingStatus.statusText}
                </div>
              )}
            </div>
            <CardDescription className="text-xs text-gray-600">
              Jadwal jam operasional layanan peninjauan dan pengerjaan (WIB - Asia/Jakarta).
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: "monday" as const, label: "Senin" },
                { key: "tuesday" as const, label: "Selasa" },
                { key: "wednesday" as const, label: "Rabu" },
                { key: "thursday" as const, label: "Kamis" },
                { key: "friday" as const, label: "Jumat" },
                { key: "saturday" as const, label: "Sabtu" },
                { key: "sunday" as const, label: "Minggu" },
              ].map((d) => {
                const dayCfg = operatingHoursConfig?.days?.[d.key];
                const isDayActive = dayCfg?.enabled;
                const scheduleText = isDayActive ? `${dayCfg.open} - ${dayCfg.close}` : "Tutup";

                return (
                  <div
                    key={d.key}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                      isDayActive
                        ? "bg-white/90 border border-amber-200/80 shadow-2xs text-gray-900"
                        : "bg-gray-100/60 border border-gray-200 text-gray-500"
                    }`}
                  >
                    <span className={`font-bold ${isDayActive ? "text-amber-950" : "text-gray-500"}`}>{d.label}</span>
                    <span className={`font-mono ${isDayActive ? "font-extrabold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200/60" : "font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"}`}>
                      {scheduleText}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isSupportEnabled && (
          <Card className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border-blue-800 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white font-bold">
                <div className="p-1.5 rounded-lg bg-blue-500/30 border border-blue-400/40 text-blue-200">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                </div>
                {supportConfig.title || "Pusat Bantuan CS Telegram"}
              </CardTitle>
              <CardDescription className="text-xs text-blue-200/90 whitespace-pre-wrap leading-relaxed">
                {supportConfig.description || "Ada kendala saat menggunakan platform? Hubungi Customer Service kami melalui Telegram."}
              </CardDescription>
            </CardHeader>
            {supportConfig.telegramUrl ? (
              <CardContent className="pt-1">
                <Button
                  asChild
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold gap-2 text-xs h-9 px-4 rounded-xl shadow-sm border border-amber-400/30 transition-transform active:scale-95"
                >
                  <a
                    href={supportConfig.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <TelegramIcon className="w-4 h-4 text-white shrink-0" />
                    <span>Hubungi CS Telegram</span>
                  </a>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        )}

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full h-auto p-1.5 mb-6 bg-amber-100/60 border border-amber-200/80 rounded-2xl gap-1">
            <TabsTrigger
              value="submit"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <Send className="w-3.5 h-3.5" /> STORAN
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <Trophy className="w-3.5 h-3.5" /> KLASEMEN
            </TabsTrigger>
            <TabsTrigger
              value="announcements"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <Megaphone className="w-3.5 h-3.5" /> PENGUMUMAN
              {announcements.data.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-rose-500 text-white rounded-full px-1.5 font-bold shadow-2xs">
                  {announcements.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="withdraw"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <Wallet className="w-3.5 h-3.5" /> PENARIKAN
            </TabsTrigger>
            <TabsTrigger
              value="referral"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <Users className="w-3.5 h-3.5" /> REFERRAL
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-1.5 text-xs py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-amber-300/50 text-amber-950 hover:text-amber-900 hover:bg-amber-200/50"
            >
              <History className="w-3.5 h-3.5" /> RIWAYAT
            </TabsTrigger>
          </TabsList>

          {/* KLASEMEN / LEADERBOARD */}
          <TabsContent value="leaderboard" className="space-y-4">
            <Leaderboard
              currentUserId={profile.uid}
              rewards={rules.data.leaderboardRewards}
            />
          </TabsContent>

          {/* PENGUMUMAN & INFORMASI RESMI */}
          <TabsContent value="announcements" className="space-y-4">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  Pusat Pengumuman & Informasi Resmi
                </CardTitle>
                <CardDescription className="text-xs">
                  Informasi terbaru langsung dari admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {announcements.loading && (
                  <p className="text-sm text-gray-400 text-center py-8">Memuat pengumuman...</p>
                )}
                {announcements.error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-center">
                    Gagal memuat pengumuman: {announcements.error}
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length === 0 && (
                  <div className="p-8 border border-dashed border-gray-200 rounded-lg text-center text-xs text-gray-400">
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
                                  <CardTitle className="text-base font-bold text-gray-900">{item.title}</CardTitle>
                                  {item.badge && (
                                    <Badge className={`text-xs font-bold ${badgeStyle}`}>
                                      {item.badge}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400">
                                  {item.updatedAt ? "Diperbarui pada: " : "Diterbitkan pada: "}
                                  {formatDateTime(item.updatedAt || item.createdAt)}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
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
          </TabsContent>

          {/* SETOR EMAIL (BATCH) */}
          <TabsContent value="submit" className="space-y-4">
            {/* TIER CONFIGURATION LIST FOR WORKER */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    Daftar Tier & Harga Setor
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-300 font-bold">
                    Tier Anda Saat Ini: {currentTierConfig.name}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-gray-600">
                  Semakin banyak email yang Anda setor dan disetujui, semakin tinggi tier dan harga per akun.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(rules.data.tiers && rules.data.tiers.length > 0 ? rules.data.tiers : [currentTierConfig]).map((t) => {
                    const isCurrentTier = Number(t.tier) === Number(currentTierConfig.tier);
                    const qtyText = t.maxQty >= 99999 ? `${t.minQty}+ akun` : `${t.minQty}–${t.maxQty} akun`;

                    return (
                      <div
                        key={t.tier}
                        className={`p-3.5 rounded-xl border text-center transition-all ${
                          isCurrentTier
                            ? "bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-500/10 border-amber-400 ring-2 ring-amber-400/30 shadow-xs"
                            : "bg-slate-50/80 border-gray-200 text-gray-700 hover:border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="font-bold text-sm text-gray-900">{t.name}</span>
                          {isCurrentTier && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold border-0">
                              Aktif
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mb-1">{qtyText}</p>
                        <p className="text-base font-black text-amber-700">
                          {formatMoney(t.pricePerItem)} <span className="text-[11px] font-normal text-gray-500">/ akun</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-100/40 border-amber-200/90 shadow-2xs">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Aturan Setor Email
                  </div>
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs border-0 shadow-2xs">
                    {currentTierConfig.name} · {formatMoney(currentTierConfig.pricePerItem)}/item
                  </Badge>
                </div>
                <ul className="space-y-1.5 text-xs text-amber-900/90 list-disc list-inside whitespace-pre-wrap leading-relaxed">
                  {rules.data.submissionNotes.map((note, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">{note}</li>
                  ))}
                  <li>Harga aktif Anda: <strong className="text-amber-950 font-bold">{formatMoney(currentTierConfig.pricePerItem)}</strong> per item ({currentTierConfig.name}).</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">Detail Batch Setoran</CardTitle>
                <CardDescription className="text-xs text-gray-600">Masukkan satu atau banyak email sekaligus. Seluruh item akan dikirim sebagai 1 batch.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitEmails} className="space-y-4">
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

                  <div className="p-3.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-600 font-medium">Estimasi Total Setoran: </span>
                      <strong className="text-gray-900 font-bold">{emailList.length} item × {formatMoney(currentTierConfig.pricePerItem)}</strong>
                    </div>
                    <span className="font-black text-amber-700 text-sm">{formatMoney(emailList.length * currentTierConfig.pricePerItem)}</span>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-11 gap-2 rounded-xl shadow-sm border border-amber-400/20 active:scale-95 transition-transform">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Kirim Batch ({emailList.length} Item)
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REFERRAL SYSTEM */}
          <TabsContent value="referral" className="space-y-6">
            {/* 1. HERO BANNER & STATS CARDS */}
            <Card className="bg-gradient-to-br from-amber-950 via-orange-950 to-amber-900 text-white border-amber-800/80 shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <CardContent className="p-6 sm:p-8 space-y-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Program Pasif Income Kerja
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                      Bangun Jaringan & Cetak Cuan Otomatis
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                      Undang rekan atau pekerja baru dan dapatkan komisi bertingkat otomatis dari setiap pengerjaan akun email (ACC) yang diselesaikan tim downline Anda.
                    </p>
                  </div>

                  {/* VISUAL / INTERACTIVE WIDGET: SIMULASI PASIF INCOME */}
                  <div className="bg-amber-900/60 border border-amber-700/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 space-y-3 shrink-0 sm:min-w-[280px]">
                    <div className="flex items-center justify-between border-b border-amber-800/80 pb-2">
                      <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        Simulasi Pasif Income
                      </span>
                      <Badge className="bg-amber-500/30 text-amber-200 text-[10px] font-bold">
                        Kalkulator
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-amber-200 text-[11px] mb-1">
                          <span>Jumlah Teman Diundang:</span>
                          <strong className="text-white">{simFriends} Orang</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={simFriends}
                          onChange={(e) => setSimFriends(Number(e.target.value))}
                          className="w-full accent-amber-400 h-1.5 bg-amber-950 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-amber-200 text-[11px] mb-1">
                          <span>Estimasi Email ACC / Teman:</span>
                          <strong className="text-white">{simAccPerFriend} ACC</strong>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={simAccPerFriend}
                          onChange={(e) => setSimAccPerFriend(Number(e.target.value))}
                          className="w-full accent-amber-400 h-1.5 bg-amber-950 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-amber-300">Estimasi Bonus:</span>
                      <span className="text-lg font-black text-amber-300">{formatMoney(simulatedEarnings)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3-COLUMN KEY METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* CARD 1: TOTAL BONUS REFERRAL DIDAPAT */}
              <Card className="bg-white border-amber-100 shadow-xs hover:border-amber-300 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Total Bonus Referral Didapat
                    </p>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-amber-900 tracking-tight">
                    {formatMoney(refStats.earnings)}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Otomatis masuk Saldo Utama (Saldo: {formatMoney(profile.balance)})
                  </p>
                </CardContent>
              </Card>

              {/* CARD 2: TOTAL DOWNLINE */}
              <Card className="bg-white border-amber-100 shadow-xs hover:border-amber-300 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Total Downline
                    </p>
                    <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-amber-950 tracking-tight">
                    {refStats.total} <span className="text-xs font-medium text-gray-500">Pekerja</span>
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    {refStats.qualified} Pekerja Qualified
                  </p>
                </CardContent>
              </Card>

              {/* CARD 3: TOTAL AKUN SUKSES TIM */}
              <Card className="bg-white border-amber-100 shadow-xs hover:border-amber-300 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Total Akun Sukses Tim
                    </p>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-gray-900 tracking-tight">
                    {refStats.totalTeamAcc} <span className="text-xs font-medium text-gray-500">Email ACC</span>
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Disetujui oleh admin
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 2. REFERRAL LINK SHARE WIDGET */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-600" />
                  Bagikan Tautan Referral Anda
                </CardTitle>
                <CardDescription className="text-xs text-gray-600">
                  Gunakan link unik Anda untuk merekrut tim baru. Bonus otomatis masuk ke saldo ketika downline mencetak email ACC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-700 font-bold">Tautan Referral Resmi Anda</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={referralLink} className="font-mono text-xs bg-amber-50/40 border-amber-200 text-amber-950 focus-visible:ring-amber-500 rounded-xl" />
                    <Button onClick={handleCopyReferralLink} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shrink-0 gap-1.5 font-bold text-xs h-10 px-4 rounded-xl border border-amber-400/20 active:scale-95 transition-transform">
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? "Tersalin!" : "Salin Link"}
                    </Button>
                  </div>
                </div>

                {/* DAFTAR TIER REWARD REFERRAL PREVIEW */}
                <div className="pt-2">
                  <Label className="text-xs text-gray-700 font-bold mb-2 block">
                    🎁 Skema Multi-Tier Reward Per Downline:
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {activeReferralTiers.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-200/80 rounded-xl text-center space-y-0.5"
                      >
                        <p className="text-[11px] text-gray-600 font-bold">{t.minAcc} Email ACC</p>
                        <p className="text-sm font-black text-amber-700">
                          {formatMoney(t.reward)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🎁 KODE UNDANGAN CLAIM CARD */}
                <div className="p-4 bg-slate-50/80 border border-gray-200/80 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Klaim Kode Undangan Pengundang
                  </p>
                  {isAlreadyLinked ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ✓ Kode undangan sudah terhubung
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Akun Anda terhubung dengan pengundang:{" "}
                        <strong className="font-semibold text-emerald-950">{referrerDisplayName || "Rekan"}</strong>.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleClaimInvitationCode} className="space-y-2.5">
                      <p className="text-[11px] text-gray-500">
                        Jika Anda mendaftar tanpa link referral, masukkan kode undangan pengundang Anda di sini:
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={invitationCodeInput}
                          onChange={(e) => setInvitationCodeInput(e.target.value)}
                          placeholder="Masukkan kode / UID pengundang"
                          className="font-mono text-xs bg-white rounded-xl border-gray-200"
                          disabled={claimingCode}
                        />
                        <Button
                          type="submit"
                          disabled={claimingCode || !invitationCodeInput.trim()}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shrink-0 gap-1.5 text-xs font-bold rounded-xl active:scale-95 transition-transform"
                        >
                          {claimingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                          Gunakan Kode
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-950 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-amber-900">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Aturan Kualifikasi Referral:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900/90">
                    <li>Pendaftaran akun baru saja TIDAK langsung mencairkan bonus.</li>
                    <li>Bonus terbuka saat downline mencapai target email ACC terverifikasi (5, 10, 20, 50 ACC).</li>
                    <li>Reward dapat diklaim bertahap per-tier secara instant tanpa perlu menunggu tier akhir.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 3. DOWNLINE LIST & ACTIVITY TABLE */}
            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  Riwayat Downline Saya ({engagement.referrals.data.length})
                </CardTitle>
                <CardDescription className="text-xs text-gray-600">
                  Daftar seluruh pekerja yang mendaftar melalui tautan referral Anda beserta progress email ACC dan klaim komisi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {engagement.referrals.loading && (
                  <p className="text-sm text-gray-400 text-center py-8">Memuat data downline...</p>
                )}
                {!engagement.referrals.loading && engagement.referrals.data.length === 0 && (
                  <div className="p-8 border border-dashed border-amber-200 rounded-2xl text-center space-y-2 bg-amber-50/20">
                    <Users className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-sm font-bold text-gray-800">Belum Ada Downline</p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Bagikan tautan referral Anda ke rekan kerja untuk mulai mencetak komisi pasif income otomatis.
                    </p>
                    <Button onClick={handleCopyReferralLink} size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-1.5 font-bold text-xs mt-2 rounded-xl active:scale-95 transition-transform">
                      <Copy className="w-3.5 h-3.5" />
                      Salin Tautan Referral
                    </Button>
                  </div>
                )}
                {!engagement.referrals.loading && engagement.referrals.data.length > 0 && (
                  <div className="space-y-4">
                    {engagement.referrals.data.map((ref) => {
                      const accProgress = ref.currentAccCount ?? 0;
                      const sortedTiers = [...activeReferralTiers].sort((a, b) => a.minAcc - b.minAcc);

                      return (
                        <div key={ref.id} className="p-4 rounded-2xl border border-amber-100 bg-amber-50/20 hover:bg-amber-50/40 transition-colors space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100/80 pb-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 text-sm">
                                  {ref.referredWorkerName || shortId(ref.referredWorkerId)}
                                </p>
                                <Badge className="bg-amber-100 text-amber-950 border-amber-200 text-[10px] font-mono">
                                  ID: {shortId(ref.referredWorkerId)}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-gray-500">
                                Bergabung: <strong className="text-gray-700">{formatDateTime(ref.createdAt)}</strong> · Total ACC: <strong className="text-amber-900 font-bold">{accProgress} Email ACC</strong>
                              </p>
                            </div>

                            <Badge variant="outline" className="bg-white text-amber-950 border-amber-200 text-xs font-bold w-fit">
                              Komisi Earned: {formatMoney(ref.rewardAmount ?? 0)}
                            </Badge>
                          </div>

                          {/* TIER CLAIM GRID */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sortedTiers.map((t) => {
                              const isClaimed = isReferralTierClaimed(ref, t.minAcc, activeReferralTiers);
                              const isClaimable = isReferralTierClaimable(ref, t.minAcc, activeReferralTiers);
                              const isPendingClaim = pendingClaimsSet.has(`${ref.id}_${t.minAcc}`);
                              const busyKey = `${ref.id}_${t.minAcc}`;
                              const isBusy = busyClaimTierKey === busyKey;

                              return (
                                <div
                                  key={t.minAcc}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                                    isClaimed
                                      ? "bg-emerald-50/80 border-emerald-200"
                                      : isPendingClaim
                                        ? "bg-amber-50/80 border-amber-200"
                                        : isClaimable
                                          ? "bg-white border-amber-300 shadow-2xs"
                                          : "bg-gray-50/80 border-gray-200 opacity-75"
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-gray-900">
                                      Target {t.minAcc} ACC — <span className="text-amber-700 font-black">{formatMoney(t.reward)}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                      Progress: <strong className="text-gray-800">{accProgress}/{t.minAcc} ACC</strong>
                                    </p>
                                  </div>

                                  <div>
                                    {isClaimed ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[11px] font-semibold">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        Sudah Diklaim
                                      </Badge>
                                    ) : isClaimable ? (
                                      <Button
                                        size="sm"
                                        disabled={isBusy}
                                        onClick={() => handleClaimTier(ref.id, t.minAcc)}
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs h-7 px-3 gap-1 shrink-0 rounded-lg shadow-2xs active:scale-95 transition-transform"
                                      >
                                        {isBusy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="w-3 h-3 text-amber-200" />
                                        )}
                                        🎉 Claim
                                      </Button>
                                    ) : (
                                      <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 gap-1 text-[11px]">
                                        🔒 Belum Tersedia
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TARIK SALDO */}
          <TabsContent value="withdraw" className="space-y-6">
            {/* SALDO HIGHLIGHT BANNER */}
            <Card className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-amber-400/50 shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-100 text-xs font-bold uppercase tracking-wider">
                      <Wallet className="w-4 h-4 text-amber-200" />
                      Saldo Siap Ditarik
                    </div>
                    <p className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                      {formatMoney(profile.balance)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-amber-100/90 pt-1">
                      <span>
                        Min: <strong className="text-white">{formatMoney(activeWithdrawalSettings.minWithdraw)}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Max: <strong className="text-white">{formatMoney(activeWithdrawalSettings.maxWithdraw)}</strong>
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setMainTab("referral")}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-xs h-9 px-4 rounded-xl border border-white/30 shadow-2xs gap-1.5 shrink-0 transition-transform active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    Bonus Saldo Referral
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-amber-100 shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900">Formulir Penarikan Saldo</CardTitle>
                    <CardDescription className="text-xs text-gray-600">
                      Pilih penyedia layanan, nominal, dan detail akun penerima.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold px-2.5 py-1 ${
                      activeMethodConfig.feeType === "free" || activeMethodConfig.feeValue <= 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}
                  >
                    {currentFeeBadgeText}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleWithdraw} className="space-y-6">
                  {/* STEP 1: PAYMENT CATEGORY & PROVIDER GRID SELECTION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        Pilih Metode & Penyedia Pembayaran
                      </Label>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {enabledMethods.length} metode aktif
                      </span>
                    </div>

                    {/* CATEGORY TOGGLE PILLS */}
                    <div className="inline-flex p-1 bg-amber-100/60 border border-amber-200/60 rounded-xl gap-1 text-xs font-medium w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("ewallet")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "ewallet"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
                            : "text-amber-950 hover:text-amber-900"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        E-Wallet (Instant)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("bank")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "bank"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
                            : "text-amber-950 hover:text-amber-900"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Transfer Bank
                      </button>
                    </div>

                    {/* PROVIDER GRID CARDS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      {visibleMethods.map((m) => {
                        const isSelected = method === m.method;
                        const feeBadge = formatFeeBadge(m);
                        const isEWallet = isEWalletMethod(m);

                        return (
                          <div
                            key={m.method}
                            onClick={() => setMethod(m.method)}
                            className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 select-none ${
                              isSelected
                                ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50/80 ring-2 ring-amber-500/30 shadow-xs"
                                : "border-gray-200 bg-white hover:border-amber-300 hover:bg-slate-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isEWallet ? (
                                  <Smartphone className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500"}`} />
                                ) : (
                                  <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500"}`} />
                                )}
                                <span className="font-bold text-sm text-gray-900 truncate">{m.method}</span>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                              )}
                            </div>

                            <Badge
                              variant="secondary"
                              className={`text-[10px] w-fit font-semibold px-2 py-0.5 ${
                                m.feeType === "free" || m.feeValue <= 0
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                            >
                              {feeBadge}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2: NOMINAL QUICK CHIPS & INPUT */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <Label htmlFor="amount" className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                      Nominal Penarikan
                    </Label>

                    <div className="space-y-2">
                      <FormattedNumberInput
                        id="amount"
                        value={amount}
                        onChange={(val) => setAmount(val)}
                        placeholder="Contoh: 100.000"
                        className="font-mono text-base font-semibold h-11 border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                        required
                      />

                      {/* QUICK-SELECT PRESET CHIPS */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: `Maksimal (${formatMoney(profile.balance)})`, value: profile.balance },
                          { label: "Rp 25.000", value: 25000 },
                          { label: "Rp 50.000", value: 50000 },
                          { label: "Rp 100.000", value: 100000 },
                          { label: "Rp 250.000", value: 250000 },
                          { label: "Rp 500.000", value: 500000 },
                        ].map((chip, idx) => {
                          const isActive = amount === chip.value;
                          return (
                            <Button
                              key={idx}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAmount(chip.value)}
                              className={`text-xs h-7 px-3 rounded-full transition-colors ${
                                isActive
                                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 font-bold shadow-2xs"
                                  : "bg-slate-50 text-gray-700 hover:bg-amber-50 hover:text-amber-900 border-gray-200"
                              }`}
                            >
                              {chip.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: ACCOUNT DETAILS & REAL-TIME CALCULATION SUMMARY */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                      Detail Akun & Ringkasan Penarikan
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="account" className="text-xs text-gray-600 font-semibold">
                          Nomor Rekening / Nomor {method}
                        </Label>
                        <Input
                          id="account"
                          value={account}
                          onChange={(e) => setAccount(e.target.value)}
                          placeholder={`Nomor HP ${method} / Rekening`}
                          className="mt-1 border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountHolderName" className="text-xs text-gray-600 font-semibold">
                          Atas Nama (Pemilik Rekening/Wallet)
                        </Label>
                        <Input
                          id="accountHolderName"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          placeholder="Masukkan nama sesuai rekening/wallet"
                          className="mt-1 border-gray-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    {/* DYNAMIC BREAKDOWN SUMMARY CARD */}
                    <div className="p-4 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-amber-100/30 rounded-xl border border-amber-200/80 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-gray-600 font-medium">
                        <span>Jumlah Penarikan:</span>
                        <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600 font-medium">
                        <span>Biaya Admin / Layanan ({activeMethodConfig.method}):</span>
                        <span className={calculatedFee > 0 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                          {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Bebas Biaya)"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-amber-200/80 flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                        <span className="font-black text-emerald-700 text-base">{formatMoney(calculatedNet)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-11 gap-2 text-sm shadow-sm rounded-xl border border-amber-400/20 active:scale-95 transition-transform"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Ajukan Penarikan ({formatMoney(calculatedNet)})
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RIWAYAT TRANSAKSI / PENARIKAN */}
            <TransactionHistory
              transactions={transactionHistory}
              loading={withdrawals.loading || engagement.rewardLedger.loading}
            />
          </TabsContent>

          {/* RIWAYAT STORAN EMAIL */}
          <TabsContent value="history" className="space-y-4">
            <SubmissionHistory
              submissions={submissions.data}
              loading={submissions.loading}
              rules={rules.data}
              userTier={profile.tier}
              onViewDetail={setDetailSubmission}
            />
          </TabsContent>
        </Tabs>

        {/* DIALOG LIHAT DETAIL BATCH (WORKER PER-ITEM VIEW) */}
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
                        {tierCfg.name} ({formatMoney(pricePerItem)}/item)
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
