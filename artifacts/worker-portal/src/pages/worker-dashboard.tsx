import { useMemo, useState } from "react";
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
} from "lucide-react";
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
import { DEFAULT_RULES, DEFAULT_REFERRAL_TIERS, DEFAULT_OPERATING_HOURS, DEFAULT_WITHDRAWAL_SETTINGS, type EmailSubmission, type PortalUser, type PaymentMethodFeeConfig } from "@/lib/portal-types";
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
  const myReferral = useMyReferral(profile.uid);
  const announcements = useAnnouncements();

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
      toast.error(err instanceof Error ? err.message : "Gagal mengklaim reward tier referral.");
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
          : "Bonus Klasemen";
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900">{profile.name}</p>
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 gap-1">
                <Award className="w-3 h-3" />
                {currentTierConfig.name} ({formatMoney(currentTierConfig.pricePerItem)}/item)
              </Badge>
            </div>
            <p className="text-xs text-gray-500">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Saldo</p>
              <p className="font-bold text-amber-700">{formatMoney(profile.balance)}</p>
            </div>
            <Button variant="outline" size="icon" onClick={onLogout} title="Keluar">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* JAM OPERASIONAL CARD */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                🕐 Jam Operasional
              </CardTitle>
              {operatingStatus.isDisabled ? (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 font-medium text-xs">
                  {operatingStatus.statusText}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={
                    operatingStatus.isOpen
                      ? "bg-green-50 text-green-800 border-green-300 font-semibold text-xs"
                      : "bg-red-50 text-red-800 border-red-300 font-semibold text-xs"
                  }
                >
                  {operatingStatus.statusText}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Jadwal jam operasional layanan (WIB - Asia/Jakarta).
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-100"
                  >
                    <span className="font-semibold text-gray-700">{d.label}</span>
                    <span className={isDayActive ? "font-mono font-medium text-gray-900" : "font-medium text-red-600"}>
                      {scheduleText}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isSupportEnabled && (
          <Card className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                {supportConfig.title || "Pusat Bantuan"}
              </CardTitle>
              <CardDescription className="text-xs text-blue-800/90 whitespace-pre-wrap">
                {supportConfig.description || "Ada kendala saat menggunakan platform? Hubungi Customer Service kami melalui Telegram."}
              </CardDescription>
            </CardHeader>
            {supportConfig.telegramUrl ? (
              <CardContent className="pt-1">
                <Button
                  asChild
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs h-9 font-medium"
                >
                  <a
                    href={supportConfig.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Hubungi CS Telegram
                  </a>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        )}

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 mb-6">
            <TabsTrigger value="submit" className="gap-1.5 text-xs py-2">
              <Send className="w-3.5 h-3.5" /> STORAN EMAIL
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5 text-xs py-2">
              <Megaphone className="w-3.5 h-3.5" /> PENGUMUMAN
              {announcements.data.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-red-500 text-white rounded-full px-1.5 font-bold">
                  {announcements.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-1.5 text-xs py-2">
              <Wallet className="w-3.5 h-3.5" /> PENARIKAN
            </TabsTrigger>
            <TabsTrigger value="referral" className="gap-1.5 text-xs py-2">
              <Users className="w-3.5 h-3.5" /> REFERRAL
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs py-2">
              <History className="w-3.5 h-3.5" /> RIWAYAT STORAN EMAIL
            </TabsTrigger>
          </TabsList>

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
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    Daftar Tier & Harga Setor
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300">
                    Tier Anda Saat Ini: {currentTierConfig.name}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
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
                        className={`p-3 rounded-lg border text-center transition-all ${
                          isCurrentTier
                            ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/30 shadow-sm"
                            : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="font-bold text-sm text-gray-900">{t.name}</span>
                          {isCurrentTier && (
                            <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 font-semibold">
                              Aktif
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mb-1">{qtyText}</p>
                        <p className="text-sm font-extrabold text-amber-700">
                          {formatMoney(t.pricePerItem)} <span className="text-[11px] font-normal text-gray-500">/ akun</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4" />
                    Aturan Setor Email
                  </div>
                  <Badge className="bg-amber-600 text-white font-semibold">
                    {currentTierConfig.name} · {formatMoney(currentTierConfig.pricePerItem)}/item
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs text-amber-800 list-disc list-inside whitespace-pre-wrap">
                  {rules.data.submissionNotes.map((note, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">{note}</li>
                  ))}
                  <li>Harga aktif Anda: {formatMoney(currentTierConfig.pricePerItem)} per item ({currentTierConfig.name}).</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detail Batch Setoran</CardTitle>
                <CardDescription>Masukkan satu atau banyak email sekaligus. Seluruh item akan dikirim sebagai 1 batch.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitEmails} className="space-y-4">
                  <div>
                    <Label htmlFor="emails">Daftar Alamat Email ({emailList.length} item)</Label>
                    <Textarea
                      id="emails"
                      rows={6}
                      value={emailsText}
                      onChange={(e) => setEmailsText(e.target.value)}
                      placeholder={"item1@example.com\nitem2@example.com\nitem3@example.com"}
                      className="mt-1.5 font-mono text-sm"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Pisahkan setiap email dengan baris baru. Multi-item akan otomatis digabung dalam 1 batch.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="password">Kata Sandi Akun</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Kata sandi untuk seluruh email di atas"
                      className="mt-1.5"
                      required
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between text-xs text-gray-600">
                    <div>
                      <span>Estimasi Total Setoran: </span>
                      <strong className="text-gray-900">{emailList.length} item × {formatMoney(currentTierConfig.pricePerItem)}</strong>
                    </div>
                    <span className="font-bold text-amber-700 text-sm">{formatMoney(emailList.length * currentTierConfig.pricePerItem)}</span>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
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
            <Card className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white border-indigo-800 shadow-lg overflow-hidden relative">
              <CardContent className="p-6 sm:p-8 space-y-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                      Program Pasif Income Kerja
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                      Bangun Jaringan & Cetak Cuan Otomatis
                    </h2>
                    <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
                      Undang rekan atau pekerja baru dan dapatkan komisi bertingkat otomatis dari setiap pengerjaan akun email (ACC) yang diselesaikan tim downline Anda.
                    </p>
                  </div>

                  {/* VISUAL / INTERACTIVE WIDGET: SIMULASI PASIF INCOME */}
                  <div className="bg-indigo-900/60 border border-indigo-700/50 backdrop-blur-md rounded-2xl p-4 sm:p-5 space-y-3 shrink-0 sm:min-w-[280px]">
                    <div className="flex items-center justify-between border-b border-indigo-800/80 pb-2">
                      <span className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-indigo-400" />
                        Simulasi Pasif Income
                      </span>
                      <Badge className="bg-indigo-500/30 text-indigo-200 text-[10px]">
                        Kalkulator
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-indigo-200 text-[11px] mb-1">
                          <span>Jumlah Teman Diundang:</span>
                          <strong className="text-white">{simFriends} Orang</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={simFriends}
                          onChange={(e) => setSimFriends(Number(e.target.value))}
                          className="w-full accent-indigo-400 h-1.5 bg-indigo-950 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-indigo-200 text-[11px] mb-1">
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
                          className="w-full accent-indigo-400 h-1.5 bg-indigo-950 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-indigo-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-indigo-300">Estimasi Bonus:</span>
                      <span className="text-lg font-extrabold text-indigo-300">{formatMoney(simulatedEarnings)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3-COLUMN KEY METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* CARD 1: SALDO BONUS TERSEDIA */}
              <Card className="bg-white border-indigo-100 shadow-xs hover:border-indigo-200 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Saldo Bonus Tersedia
                    </p>
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-indigo-900 tracking-tight">
                    {formatMoney(refStats.earnings)}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Siap ditarik kapan saja
                  </p>
                </CardContent>
              </Card>

              {/* CARD 2: TOTAL DOWNLINE */}
              <Card className="bg-white border-indigo-100 shadow-xs hover:border-indigo-200 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Total Downline
                    </p>
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-purple-950 tracking-tight">
                    {refStats.total} <span className="text-xs font-normal text-gray-500">Pekerja</span>
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-500" />
                    {refStats.qualified} Pekerja Qualified
                  </p>
                </CardContent>
              </Card>

              {/* CARD 3: TOTAL AKUN SUKSES TIM */}
              <Card className="bg-white border-indigo-100 shadow-xs hover:border-indigo-200 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Total Akun Sukses Tim
                    </p>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {refStats.totalTeamAcc} <span className="text-xs font-normal text-gray-500">Email ACC</span>
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Disetujui oleh admin
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 2. REFERRAL LINK SHARE WIDGET */}
            <Card className="bg-white border-indigo-100 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                  Bagikan Tautan Referral Anda
                </CardTitle>
                <CardDescription className="text-xs">
                  Gunakan link unik Anda untuk merekrut tim baru. Bonus otomatis masuk ke saldo ketika downline mencetak email ACC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600 font-semibold">Tautan Referral Resmi Anda</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={referralLink} className="font-mono text-xs bg-indigo-50/40 border-indigo-200 text-indigo-950 focus-visible:ring-indigo-500" />
                    <Button onClick={handleCopyReferralLink} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1.5 font-bold text-xs h-10 px-4">
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? "Tersalin!" : "Salin Link"}
                    </Button>
                  </div>
                </div>

                {/* DAFTAR TIER REWARD REFERRAL PREVIEW */}
                <div className="pt-2">
                  <Label className="text-xs text-gray-600 font-semibold mb-2 block">
                    🎁 Skema Multi-Tier Reward Per Downline:
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {activeReferralTiers.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-lg text-center space-y-0.5"
                      >
                        <p className="text-[11px] text-gray-500 font-semibold">{t.minAcc} Email ACC</p>
                        <p className="text-sm font-extrabold text-indigo-700">
                          {formatMoney(t.reward)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 🎁 KODE UNDANGAN CLAIM CARD */}
                <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Klaim Kode Undangan Pengundang
                  </p>
                  {isAlreadyLinked ? (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
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
                          className="font-mono text-xs bg-white"
                          disabled={claimingCode}
                        />
                        <Button
                          type="submit"
                          disabled={claimingCode || !invitationCodeInput.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1.5 text-xs font-bold"
                        >
                          {claimingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                          Gunakan Kode
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-950 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-indigo-900">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" /> Aturan Kualifikasi Referral:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-indigo-900/80">
                    <li>Pendaftaran akun baru saja TIDAK langsung mencairkan bonus.</li>
                    <li>Bonus terbuka saat downline mencapai target email ACC terverifikasi (5, 10, 20, 50 ACC).</li>
                    <li>Reward dapat diklaim bertahap per-tier secara instant tanpa perlu menunggu tier akhir.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 3. DYNAMIC REFERRAL WITHDRAWAL FORM */}
            <Card className="bg-white border-indigo-100 shadow-xs">
              <CardHeader className="pb-4 border-b border-indigo-50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-indigo-600" />
                      Tarik Saldo Bonus Referral
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cairkan saldo hasil komisi tim referral langsung ke E-Wallet atau Rekening Bank Anda.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold px-2.5 py-1 ${
                      activeMethodConfig.feeType === "free" || activeMethodConfig.feeValue <= 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-indigo-50 text-indigo-800 border-indigo-300"
                    }`}
                  >
                    {currentFeeBadgeText}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* REFERRAL BALANCE HIGHLIGHT CARD */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">Saldo Siap Ditarik</p>
                    <p className="text-2xl font-extrabold text-white tracking-tight">{formatMoney(profile.balance)}</p>
                  </div>
                  <div className="text-xs text-indigo-200 space-y-0.5 sm:text-right">
                    <p>Minimal: <strong className="text-white">{formatMoney(activeWithdrawalSettings.minWithdraw)}</strong></p>
                    <p>Maksimal: <strong className="text-white">{formatMoney(activeWithdrawalSettings.maxWithdraw)}</strong></p>
                  </div>
                </div>

                <form onSubmit={handleWithdraw} className="space-y-6">
                  {/* STEP 1: PAYMENT CATEGORY & PROVIDER GRID SELECTION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] flex items-center justify-center font-bold">1</span>
                        Pilih Metode & Penyedia Pembayaran
                      </Label>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {enabledMethods.length} metode aktif
                      </span>
                    </div>

                    {/* CATEGORY TOGGLE PILLS */}
                    <div className="inline-flex p-1 bg-gray-100 rounded-lg gap-1 text-xs font-medium w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("ewallet")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "ewallet"
                            ? "bg-white text-indigo-950 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                        E-Wallet (Instant)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("bank")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "bank"
                            ? "bg-white text-indigo-950 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
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
                                ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/30 shadow-sm"
                                : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isEWallet ? (
                                  <Smartphone className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-600" : "text-gray-500"}`} />
                                ) : (
                                  <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-purple-600" : "text-gray-500"}`} />
                                )}
                                <span className="font-bold text-sm text-gray-900 truncate">{m.method}</span>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </div>

                            <Badge
                              variant="secondary"
                              className={`text-[10px] w-fit font-semibold px-2 py-0.5 ${
                                m.feeType === "free" || m.feeValue <= 0
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-indigo-100 text-indigo-800 border-indigo-200"
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
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] flex items-center justify-center font-bold">2</span>
                      Nominal Penarikan
                    </Label>

                    <div className="space-y-2">
                      <FormattedNumberInput
                        id="amount"
                        value={amount}
                        onChange={(val) => setAmount(val)}
                        placeholder="Contoh: 100.000"
                        className="font-mono text-base font-semibold h-11 focus-visible:ring-indigo-500"
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
                              className={`text-xs h-7 px-2.5 rounded-full transition-colors ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-900 border-indigo-400 font-bold"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
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
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] flex items-center justify-center font-bold">3</span>
                      Detail Akun & Ringkasan Penarikan
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="account" className="text-xs text-gray-600">
                          Nomor Rekening / Nomor {method}
                        </Label>
                        <Input
                          id="account"
                          value={account}
                          onChange={(e) => setAccount(e.target.value)}
                          placeholder={`Nomor HP ${method} / Rekening`}
                          className="mt-1 focus-visible:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountHolderName" className="text-xs text-gray-600">
                          Atas Nama (Pemilik Rekening/Wallet)
                        </Label>
                        <Input
                          id="accountHolderName"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          placeholder="Masukkan nama sesuai rekening/wallet"
                          className="mt-1 focus-visible:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    {/* DYNAMIC BREAKDOWN SUMMARY CARD */}
                    <div className="p-4 bg-indigo-50/30 rounded-xl border border-indigo-100 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Jumlah Penarikan:</span>
                        <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Biaya Admin / Layanan ({activeMethodConfig.method}):</span>
                        <span className={calculatedFee > 0 ? "font-bold text-indigo-700" : "font-bold text-emerald-700"}>
                          {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Bebas Biaya)"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-indigo-100 flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                        <span className="font-extrabold text-emerald-700 text-base">{formatMoney(calculatedNet)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 gap-2 text-sm shadow-sm"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Request Withdraw Bonus ({formatMoney(calculatedNet)})
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* 4. DOWNLINE LIST & ACTIVITY TABLE */}
            <Card className="bg-white border-indigo-100 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Riwayat Downline Saya ({engagement.referrals.data.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Daftar seluruh pekerja yang mendaftar melalui tautan referral Anda beserta progress email ACC dan klaim komisi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {engagement.referrals.loading && (
                  <p className="text-sm text-gray-400 text-center py-8">Memuat data downline...</p>
                )}
                {!engagement.referrals.loading && engagement.referrals.data.length === 0 && (
                  <div className="p-8 border border-dashed border-indigo-200 rounded-xl text-center space-y-2 bg-indigo-50/20">
                    <Users className="w-8 h-8 text-indigo-300 mx-auto" />
                    <p className="text-sm font-semibold text-gray-800">Belum Ada Downline</p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Bagikan tautan referral Anda ke rekan kerja untuk mulai mencetak komisi pasif income otomatis.
                    </p>
                    <Button onClick={handleCopyReferralLink} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-semibold text-xs mt-2">
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
                        <div key={ref.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/40 transition-colors space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/80 pb-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 text-sm">
                                  {ref.referredWorkerName || shortId(ref.referredWorkerId)}
                                </p>
                                <Badge className="bg-indigo-100 text-indigo-900 border-indigo-200 text-[10px] font-mono">
                                  ID: {shortId(ref.referredWorkerId)}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-gray-500">
                                Bergabung: <strong className="text-gray-700">{formatDateTime(ref.createdAt)}</strong> · Total ACC: <strong className="text-indigo-900 font-bold">{accProgress} Email ACC</strong>
                              </p>
                            </div>

                            <Badge variant="outline" className="bg-white text-indigo-950 border-indigo-200 text-xs font-bold w-fit">
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
                                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                                    isClaimed
                                      ? "bg-emerald-50/80 border-emerald-200"
                                      : isPendingClaim
                                        ? "bg-blue-50/80 border-blue-200"
                                        : isClaimable
                                          ? "bg-white border-indigo-300 shadow-2xs"
                                          : "bg-gray-50/80 border-gray-200 opacity-75"
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-gray-900">
                                      Target {t.minAcc} ACC — <span className="text-indigo-700 font-extrabold">{formatMoney(t.reward)}</span>
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
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-7 px-3 gap-1 shrink-0 shadow-2xs"
                                      >
                                        {isBusy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="w-3 h-3 text-amber-300" />
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
            <Card className="bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 text-white border-amber-500 shadow-md overflow-hidden relative">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-200 text-xs font-medium uppercase tracking-wider">
                      <Wallet className="w-4 h-4" />
                      Saldo Siap Ditarik
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      {formatMoney(profile.balance)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-amber-100/90 pt-1">
                      <span>
                        Min: <strong>{formatMoney(activeWithdrawalSettings.minWithdraw)}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Max: <strong>{formatMoney(activeWithdrawalSettings.maxWithdraw)}</strong>
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setMainTab("referral")}
                    className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs h-9 px-4 rounded-lg shadow-sm gap-1.5 shrink-0 transition-transform active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-900" />
                    Bonus Saldo Referral
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200 shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900">Formulir Penarikan Saldo</CardTitle>
                    <CardDescription className="text-xs">
                      Pilih penyedia layanan, nominal, dan detail akun penerima.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold px-2.5 py-1 ${
                      activeMethodConfig.feeType === "free" || activeMethodConfig.feeValue <= 0
                        ? "bg-green-50 text-green-800 border-green-300"
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
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] flex items-center justify-center font-bold">1</span>
                        Pilih Metode & Penyedia Pembayaran
                      </Label>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {enabledMethods.length} metode aktif
                      </span>
                    </div>

                    {/* CATEGORY TOGGLE PILLS */}
                    <div className="inline-flex p-1 bg-gray-100 rounded-lg gap-1 text-xs font-medium w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("ewallet")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "ewallet"
                            ? "bg-white text-amber-900 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                        E-Wallet (Instant)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCategory("bank")}
                        className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          categoryTab === "bank"
                            ? "bg-white text-amber-900 shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
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
                                ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/30 shadow-sm"
                                : "border-gray-200 bg-white hover:border-amber-300 hover:bg-gray-50/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isEWallet ? (
                                  <Smartphone className={`w-4 h-4 shrink-0 ${isSelected ? "text-amber-600" : "text-gray-500"}`} />
                                ) : (
                                  <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-500"}`} />
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
                                  ? "bg-green-100 text-green-800 border-green-200"
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
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] flex items-center justify-center font-bold">2</span>
                      Nominal Penarikan
                    </Label>

                    <div className="space-y-2">
                      <FormattedNumberInput
                        id="amount"
                        value={amount}
                        onChange={(val) => setAmount(val)}
                        placeholder="Contoh: 100.000"
                        className="font-mono text-base font-semibold h-11"
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
                              className={`text-xs h-7 px-2.5 rounded-full transition-colors ${
                                isActive
                                  ? "bg-amber-100 text-amber-900 border-amber-400 font-bold"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
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
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] flex items-center justify-center font-bold">3</span>
                      Detail Akun & Ringkasan Penarikan
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="account" className="text-xs text-gray-600">
                          Nomor Rekening / Nomor {method}
                        </Label>
                        <Input
                          id="account"
                          value={account}
                          onChange={(e) => setAccount(e.target.value)}
                          placeholder={`Nomor HP ${method} / Rekening`}
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountHolderName" className="text-xs text-gray-600">
                          Atas Nama (Pemilik Rekening/Wallet)
                        </Label>
                        <Input
                          id="accountHolderName"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          placeholder="Masukkan nama sesuai rekening/wallet"
                          className="mt-1"
                          required
                        />
                      </div>
                    </div>

                    {/* DYNAMIC BREAKDOWN SUMMARY CARD */}
                    <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Jumlah Penarikan:</span>
                        <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Biaya Admin / Layanan ({activeMethodConfig.method}):</span>
                        <span className={calculatedFee > 0 ? "font-bold text-amber-700" : "font-bold text-green-700"}>
                          {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Bebas Biaya)"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                        <span className="font-extrabold text-green-700 text-base">{formatMoney(calculatedNet)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 gap-2 text-sm shadow-sm"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Ajukan Penarikan ({formatMoney(calculatedNet)})
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RIWAYAT TRANSAKSI / PENARIKAN */}
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                  <span>💰</span> Riwayat Transaksi
                </CardTitle>
                <CardDescription className="text-xs">
                  Riwayat penarikan saldo dan penerimaan bonus reward Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(withdrawals.loading || engagement.rewardLedger.loading) && (
                  <p className="text-sm text-gray-400 text-center py-6">Memuat…</p>
                )}
                {!withdrawals.loading && !engagement.rewardLedger.loading && transactionHistory.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat transaksi.</p>
                )}
                {!withdrawals.loading && !engagement.rewardLedger.loading && transactionHistory.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/50">
                          <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                          <th className="py-2.5 px-3 font-semibold">Jenis Transaksi</th>
                          <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                          <th className="py-2.5 px-3 font-semibold">Nominal</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactionHistory.map((tx) => (
                          <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3 px-3 align-top whitespace-nowrap text-gray-500">
                              {formatDateTime(tx.date)}
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap font-medium text-gray-900">
                              {tx.type}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <p className="text-gray-800 font-medium">{tx.description}</p>
                              {tx.note && <p className="text-[11px] text-gray-400 italic mt-0.5">Catatan: {tx.note}</p>}
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap font-bold">
                              <span className={tx.isCredit ? "text-green-600" : "text-red-600"}>
                                {tx.isCredit ? "+" : "-"} {formatMoney(tx.amount)}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap text-right">
                              <StatusBadge status={tx.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RIWAYAT STORAN EMAIL (TAB BARU) */}
          <TabsContent value="history" className="space-y-4">
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                  <span>📧</span> Riwayat Storan Email
                </CardTitle>
                <CardDescription className="text-xs">
                  Daftar batch email yang telah Anda kirim beserta status persetujuannya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submissions.loading && (
                  <p className="text-sm text-gray-400 text-center py-6">Memuat…</p>
                )}
                {!submissions.loading && submissions.data.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Belum ada batch setoran email.</p>
                )}
                {!submissions.loading && submissions.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/50">
                          <th className="py-2.5 px-3 font-semibold">Tanggal & ID</th>
                          <th className="py-2.5 px-3 font-semibold">Jumlah Email</th>
                          <th className="py-2.5 px-3 font-semibold">Tier & Harga</th>
                          <th className="py-2.5 px-3 font-semibold">Rincian Status</th>
                          <th className="py-2.5 px-3 font-semibold">Total Saldo</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {submissions.data.map((item) => {
                          const baseItems =
                            Array.isArray(item.items) && item.items.length > 0
                              ? item.items
                              : item.email
                              ? [
                                  {
                                    email: item.email,
                                    password: item.password,
                                    status:
                                      item.status === "available" || item.status === "approved"
                                        ? "approved"
                                        : item.status === "rejected"
                                        ? "rejected"
                                        : "pending",
                                  },
                                ]
                              : [];

                          const count = baseItems.length || getItemCountOfSubmission(item);
                          const approvedCount =
                            item.approvedItemCount ?? baseItems.filter((i) => i.status === "approved").length;
                          const rejectedCount =
                            item.rejectedItemCount ?? baseItems.filter((i) => i.status === "rejected").length;
                          const pendingCount = count - approvedCount - rejectedCount;

                          const tierNum = item.appliedTier ?? item.currentTier ?? profile.tier;
                          const tierCfg = getTierConfig(tierNum, rules.data.tiers);
                          const pricePerItem =
                            item.appliedPricePerItem ?? item.currentPricePerItem ?? tierCfg.pricePerItem;
                          const earnedAmount = item.totalAmount ?? approvedCount * pricePerItem;

                          return (
                            <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <p className="font-semibold text-gray-900">#{shortId(item.id)}</p>
                                <p className="text-[11px] text-gray-400">{formatDateTime(item.submittedAt)}</p>
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap font-medium text-gray-900">
                                {count} Email
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <Badge variant="outline" className="text-[11px] py-0 bg-amber-50 text-amber-800 border-amber-200">
                                  {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                                </Badge>
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <div className="space-y-0.5 text-[11px]">
                                  <p className="text-green-600 font-medium">ACC: {approvedCount}</p>
                                  <p className="text-red-600 font-medium">Ditolak: {rejectedCount}</p>
                                  {pendingCount > 0 && (
                                    <p className="text-amber-600 font-medium">Menunggu: {pendingCount}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <p className="font-bold text-amber-700">{formatMoney(earnedAmount)}</p>
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap">
                                <StatusBadge status={item.status} />
                                {item.reviewNote && (
                                  <p className="text-[11px] text-gray-500 italic mt-1 max-w-[150px] truncate" title={item.reviewNote}>
                                    Catatan: {item.reviewNote}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top whitespace-nowrap text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDetailSubmission(item)}
                                  className="text-xs h-7 gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Lihat Email
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
