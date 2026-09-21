import { useEffect, useMemo, useState, useRef } from "react";
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
  MessageSquare,
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
  Menu,
  CheckCheck,
  Trash2,
  X,
  MoreVertical,
  Timer,
  Bell,
} from "lucide-react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmailChecker } from "@/components/EmailChecker";
import { Leaderboard } from "@/components/Leaderboard";
import { SidebarNavigation, type DashboardView } from "@/components/SidebarNavigation";
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
  useWorkerChat,
  useConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  deleteMessageForMe,
  deleteMessageForAll,
} from "@/hooks/use-portal";
import {
  type ChatMessage,
  type DisappearingTimer,
} from "@/lib/portal-types";
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
    pending: { label: "Menunggu", className: "bg-blue-100 text-blue-800 hover:bg-blue-100", icon: <Clock className="w-3 h-3" /> },
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

  // Sidebar States (Mobile Drawer & Desktop Collapsed)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  // Engagement UI States
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [invitationCodeInput, setInvitationCodeInput] = useState("");
  const [claimingCode, setClaimingCode] = useState(false);
  const [busyClaimTierKey, setBusyClaimTierKey] = useState<string | null>(null);

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

  function handleCopyReferralCode() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(profile.uid);
      setCopiedCode(true);
      toast.success("Kode referral berhasil disalin!");
      setTimeout(() => setCopiedCode(false), 2500);
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

  // Worker Chat State
  const [workerChatText, setWorkerChatText] = useState("");
  const [sendingWorkerChat, setSendingWorkerChat] = useState(false);
  const [chatTimerOption, setChatTimerOption] = useState<DisappearingTimer>("off");

  // Delete Modal state
  const [deleteChatModalMsg, setDeleteChatModalMsg] = useState<ChatMessage | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  const workerChatEndRef = useRef<HTMLDivElement | null>(null);

  const workerChatData = useWorkerChat(profile.uid);
  const workerMessagesData = useConversationMessages(profile.uid);

  // Automatically mark conversation as read when activeView === 'chat'
  useEffect(() => {
    if (activeView === "chat" && profile?.uid) {
      markConversationAsRead(profile.uid, "worker");
    }
  }, [activeView, profile?.uid, workerMessagesData.messages]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeView === "chat") {
      workerChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeView, workerMessagesData.messages]);

  const handleSendWorkerChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerChatText.trim() || sendingWorkerChat) return;

    setSendingWorkerChat(true);

    try {
      await sendChatMessage({
        conversationId: profile.uid,
        senderId: profile.uid,
        senderRole: "worker",
        senderName: profile.name,
        senderEmail: profile.email,
        text: workerChatText,
        type: "text",
        disappearingTimer: chatTimerOption,
      });

      setWorkerChatText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesan.");
    } finally {
      setSendingWorkerChat(false);
    }
  };

  const handleDeleteMessageForMe = async (msg: ChatMessage) => {
    setDeletingChat(true);
    try {
      await deleteMessageForMe(profile.uid, msg.id, profile.uid);
      toast.success("Pesan dihapus untuk Anda.");
      setDeleteChatModalMsg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pesan.");
    } finally {
      setDeletingChat(false);
    }
  };

  const handleDeleteMessageForAll = async (msg: ChatMessage) => {
    setDeletingChat(true);
    try {
      await deleteMessageForAll(profile.uid, msg.id, profile.uid);
      toast.success("Pesan dihapus untuk semua.");
      setDeleteChatModalMsg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pesan.");
    } finally {
      setDeletingChat(false);
    }
  };

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
      case "chat":
        return "Pesan Admin / Live Chat";
      default:
        return "Dashboard Worker";
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] flex flex-col md:flex-row">
      {/* REUSABLE SIDEBAR NAVIGATION */}
      <SidebarNavigation
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsedDesktop={isDesktopSidebarCollapsed}
        onToggleCollapseDesktop={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
        profile={profile}
        ratePerItem={currentTierConfig.pricePerItem}
        isEmailVisible={isEmailVisible}
        onToggleEmailVisible={() => setIsEmailVisible(!isEmailVisible)}
        onLogout={onLogout}
      />

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* 1. TOP HEADER */}
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
          <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
            {/* Left: Worker avatar + Brand Identity */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="relative rounded-full focus:outline-none ring-2 ring-blue-500/20 active:scale-95 transition-transform"
                title="Buka Profil / Menu"
              >
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                  {profile.name?.charAt(0).toUpperCase() || "W"}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </button>

              <div>
                <h1 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5 leading-tight">
                  GMAIL JOB ID
                </h1>
                <p className="text-[10px] font-semibold text-slate-500 leading-tight">
                  Worker Portal
                </p>
              </div>
            </div>

            {/* Right: Actions (Notification Bell + Menu/Profile action) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveView("announcements")}
                className="relative p-2 rounded-full text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                title="Pengumuman / Notifikasi"
              >
                <Bell className="w-5 h-5" />
                {announcements.data.length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 rounded-full text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                title="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 pb-24 md:pb-8 space-y-4">
          {/* SUB-PAGE TOP NAVIGATION BAR (Show on dedicated sub-views) */}
          {activeView !== "home" && (
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveView("home")}
                className="gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2.5 h-8 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600" />
                <span>Kembali ke Home</span>
              </Button>
              <Badge variant="outline" className="text-[11px] bg-white text-slate-800 border-slate-200 font-bold px-2.5 py-0.5 shadow-2xs">
                {getViewTitle(activeView)}
              </Badge>
            </div>
          )}

          {/* ==================== HOME VIEW ==================== */}
          {activeView === "home" && (
            <div className="space-y-4">
              {/* 2. GREETING SECTION */}
              <section className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    Hallo, {displayName} 👋
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Selamat datang kembali! Siap menyetor email hari ini?
                  </p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-xs px-2.5 py-1 rounded-full shrink-0">
                  Rate: {formatMoney(currentTierConfig.pricePerItem)} / email
                </Badge>
              </section>

              {/* 3. BALANCE CARD */}
              <Card className="bg-blue-600 text-white border-0 shadow-md rounded-[20px] overflow-hidden">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-blue-100 font-medium flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-blue-200" />
                        Saldo Utama
                      </p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                        {formatMoney(profile.balance)}
                      </p>
                    </div>
                    <Badge className="bg-blue-700/80 text-blue-100 border-0 font-medium text-xs px-2.5 py-0.5 rounded-full">
                      Total Setoran ACC: {profile.accCount ?? 0} Email
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Button
                      type="button"
                      onClick={() => setActiveView("withdraw")}
                      className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs h-10 rounded-xl shadow-xs gap-1.5 transition-all active:scale-95"
                    >
                      <Wallet className="w-4 h-4 text-blue-600" />
                      Tarik Saldo
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveView("submit")}
                      className="bg-blue-700/60 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl border border-blue-400/30 gap-1.5 transition-all active:scale-95"
                    >
                      <PlusCircle className="w-4 h-4 text-blue-200" />
                      Setor Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4. LAYANAN CEPAT (4-COLUMN SERVICE GRID) */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Layanan Cepat
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Pilih Menu</span>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    {
                      id: "submit" as DashboardView,
                      label: "Job Gmail",
                      icon: <Send className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "checker" as DashboardView,
                      label: "Screening Email",
                      icon: <SearchCheck className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "leaderboard" as DashboardView,
                      label: "Klasemen",
                      icon: <Trophy className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "referral" as DashboardView,
                      label: "Referral",
                      icon: <Users className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "withdraw" as DashboardView,
                      label: "Tarik Saldo",
                      icon: <Wallet className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "history" as DashboardView,
                      label: "Riwayat",
                      icon: <History className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "cs" as DashboardView,
                      label: "Bantuan CS",
                      icon: <HelpCircle className="w-5 h-5 text-blue-600" />,
                    },
                    {
                      id: "announcements" as DashboardView,
                      label: "Info Resmi",
                      icon: <Megaphone className="w-5 h-5 text-blue-600" />,
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveView(item.id)}
                      className="bg-white border border-slate-200/80 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-xs hover:border-blue-300 hover:shadow-sm transition-all active:scale-95 group cursor-pointer min-h-[82px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-1.5 group-hover:bg-blue-100 transition-colors">
                        {item.icon}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-800 leading-tight group-hover:text-blue-600">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 5. OPERATIONAL HOURS */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">Jam Operasional Layanan</h4>
                    </div>

                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      operatingStatus.isOpen
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${operatingStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      {operatingStatus.statusText}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed pl-10">
                    Layanan setoran & verifikasi diproses sesuai jadwal operasional WIB (Asia/Jakarta).
                  </p>
                </CardContent>
              </Card>

              {/* 6. OFFICIAL ANNOUNCEMENT */}
              {announcements.data.length > 0 && (
                <Card
                  onClick={() => setActiveView("announcements")}
                  className="bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                          INFO RESMI TERBARU
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {announcements.data[0].title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {announcements.data[0].content}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ==================== 2. JOB GMAIL / SETOR EMAIL VIEW ==================== */}
          {activeView === "submit" && (
            <div className="space-y-4">
              {/* CURRENT RATE DISPLAY CARD */}
              <Card className="bg-white border-blue-100 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-600" />
                      Informasi Rate Harga Setor
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-900 border-blue-300 font-bold">
                      RATE AKTIF
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-gray-600">
                    Harga komisi per akun valid yang berlaku saat ini ditentukan oleh Admin secara transparan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl border border-blue-200/90 bg-gradient-to-br from-blue-500/10 via-amber-50/80 to-indigo-500/10 text-center shadow-xs">
                    <div className="flex items-center justify-center gap-1.5 mb-1 text-blue-900 font-medium text-xs">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rate Akun Valid</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-blue-700 tracking-tight my-1">
                      {formatMoney(currentTierConfig.pricePerItem)} <span className="text-xs sm:text-sm font-semibold text-blue-900/80">/ akun valid</span>
                    </p>
                    <p className="text-[11px] text-blue-900/80 mt-1.5 font-medium">
                      Komisi langsung masuk ke saldo utama setiap email selesai diverifikasi ACC.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 via-orange-50/60 to-blue-100/40 border-blue-200/90 shadow-2xs">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                      Aturan Setor Email
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-[10px] border-0 shadow-2xs">
                      Rate: {formatMoney(currentTierConfig.pricePerItem)} / akun
                    </Badge>
                  </div>
                  <ul className="space-y-1 text-xs text-blue-900/90 list-disc list-inside whitespace-pre-wrap leading-relaxed">
                    {rules.data.submissionNotes.map((note, idx) => (
                      <li key={idx} className="whitespace-pre-wrap">{note}</li>
                    ))}
                    <li>Harga komisi aktif saat ini: <strong className="text-blue-950 font-bold">{formatMoney(currentTierConfig.pricePerItem)}</strong> per akun valid.</li>
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

              <Card className="bg-white border-blue-100 shadow-xs">
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
                          className="mt-1.5 font-mono text-sm border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-xl"
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
                          className="mt-1.5 border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-xl"
                          required
                        />
                      </div>

                      <div className="p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-200/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-gray-600 font-medium">Estimasi Total Setoran: </span>
                          <strong className="text-gray-900 font-bold">{emailList.length} item × {formatMoney(currentTierConfig.pricePerItem)}</strong>
                        </div>
                        <span className="font-black text-blue-700 text-sm">{formatMoney(emailList.length * currentTierConfig.pricePerItem)}</span>
                      </div>
                    </fieldset>

                    <Button type="submit" disabled={submitting || isSubmissionClosed} className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold h-10 gap-2 rounded-xl shadow-sm border border-blue-400/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
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
            <div className="space-y-4">
              {/* 1. REFERRAL HEADER */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Referral
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ajak teman dan dapatkan komisi dari aktivitas mereka.
                  </p>
                </div>
              </div>

              {/* 2. REFERRAL SUMMARY CARD */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">Referral Anda</CardTitle>
                      <CardDescription className="text-xs text-slate-500">Ajak teman untuk bergabung</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px]">
                      Rate: {formatMoney(rules.data.referralCommissionPerAcc || 100)} / ACC
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        Total Downline
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                      </p>
                      <p className="text-xl font-extrabold text-slate-900">
                        {downlines.data.length || refStats.total} <span className="text-xs font-semibold text-slate-500">Worker</span>
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        Total ACC
                        <Award className="w-3.5 h-3.5 text-blue-600" />
                      </p>
                      <p className="text-xl font-extrabold text-slate-900">
                        {profile.teamAccCount ?? refStats.totalTeamAcc ?? 0} <span className="text-xs font-semibold text-slate-500">Email</span>
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-between">
                        Total Komisi
                        <Coins className="w-3.5 h-3.5 text-blue-600" />
                      </p>
                      <p className="text-xl font-black text-blue-600">
                        {formatMoney(profile.totalReferralEarned ?? refStats.earnings ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. REFERRAL LINK / CODE CARD */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-blue-600" />
                    Link Referral Anda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Tautan Pendaftaran</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={referralLink}
                        className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-800 rounded-xl min-h-[44px]"
                      />
                      <Button
                        type="button"
                        onClick={handleCopyReferralLink}
                        className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-bold text-xs h-10 px-3.5 rounded-xl gap-1.5 min-h-[44px] active:scale-95 transition-transform"
                      >
                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedLink ? "Tersalin" : "Salin Link"}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Kode Referral</Label>
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="font-mono font-bold text-slate-900 text-sm pl-1">
                        {profile.uid}
                      </span>
                      <Button
                        type="button"
                        onClick={handleCopyReferralCode}
                        variant="outline"
                        className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50 font-bold text-xs h-9 px-3 rounded-xl gap-1.5 min-h-[36px]"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                        <span>{copiedCode ? "Tersalin" : "Salin Kode"}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. INVITATION CODE CLAIM CARD */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Masukkan Kode Undangan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isAlreadyLinked ? (
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Akun kamu sudah terhubung dengan upline: <strong className="font-bold">{referrerDisplayName || "Rekan"}</strong>
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleClaimInvitationCode} className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          value={invitationCodeInput}
                          onChange={(e) => setInvitationCodeInput(e.target.value)}
                          placeholder="Kode Undangan Teman / Upline"
                          className="font-mono text-xs bg-slate-50 border-slate-200 rounded-xl text-slate-900 h-10 min-h-[44px]"
                          disabled={claimingCode}
                        />
                        <Button
                          type="submit"
                          disabled={claimingCode || !invitationCodeInput.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-10 px-4 shrink-0 min-h-[44px] active:scale-95 transition-transform"
                        >
                          {claimingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Klaim Kode"}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Hubungkan akun ke upline untuk saling mendapatkan statistik tim referral.
                      </p>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* 5. REFERRAL REWARD / PASSIVE INCOME INFO */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-blue-600" />
                      Komisi Passive Income
                    </CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      {formatMoney(rules.data.referralCommissionPerAcc || 100)} / 1 ACC
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-700 leading-relaxed space-y-1">
                    <p className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Skema Komisi Passive Income
                    </p>
                    <p className="text-xs text-slate-600">
                      Anda mendapatkan komisi <strong className="text-blue-700">{formatMoney(rules.data.referralCommissionPerAcc || 100)}</strong> untuk setiap email ACC yang dicapai oleh downline Anda.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 6. DAFTAR TIM DOWNLINE */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Daftar Tim Downline ({downlines.data.length})
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200 text-slate-700">
                      {downlines.data.length} Orang
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {downlines.loading ? (
                    <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Memuat data downline...</span>
                    </div>
                  ) : downlines.data.length === 0 ? (
                    <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center space-y-1.5 bg-slate-50/50">
                      <Users className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">Belum Ada Downline Terdaftar</p>
                      <p className="text-[11px] text-slate-500">
                        Bagikan link referral Anda untuk mulai membangun tim dan mengumpulkan komisi pasif income.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile View: Compact Cards */}
                      <div className="space-y-2.5 md:hidden">
                        {downlines.data.map((dw) => {
                          const dwAcc = dw.accCount ?? 0;
                          const commRate = rules.data.referralCommissionPerAcc ?? 100;
                          const totalComm = dwAcc * commRate;

                          return (
                            <div
                              key={dw.uid}
                              className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900">{dw.name || "Worker"}</span>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                  {dwAcc} ACC
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                                <span>Bergabung: <strong className="text-slate-700 font-mono">{formatDateTime(dw.createdAt)}</strong></span>
                                <span className="font-bold text-blue-600">{formatMoney(totalComm)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop View: Table */}
                      <div className="hidden md:block border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <tr>
                              <th className="px-3 py-2.5">Worker</th>
                              <th className="px-3 py-2.5">Bergabung</th>
                              <th className="px-3 py-2.5 text-center">ACC</th>
                              <th className="px-3 py-2.5 text-right">Komisi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {downlines.data.map((dw) => {
                              const dwAcc = dw.accCount ?? 0;
                              const commRate = rules.data.referralCommissionPerAcc ?? 100;
                              const totalComm = dwAcc * commRate;

                              return (
                                <tr key={dw.uid} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-3 py-2.5 font-bold text-slate-900">
                                    {dw.name || "Worker"}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                                    {formatDateTime(dw.createdAt)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px]">
                                      {dwAcc} ACC
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-bold text-blue-600">
                                    {formatMoney(totalComm)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 7. RIWAYAT KOMISI REFERRAL */}
              <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-blue-600" />
                      Riwayat Log Komisi Referral ({referralTxs.data.length})
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200 text-slate-700">
                      Log Transaksi
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {referralTxs.loading ? (
                    <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Memuat riwayat...</span>
                    </div>
                  ) : referralTxs.data.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      Belum ada riwayat transaksi komisi.
                    </p>
                  ) : (
                    <>
                      {/* Mobile View: Compact Transaction Cards */}
                      <div className="space-y-2.5 md:hidden">
                        {referralTxs.data.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">
                                {tx.downlineName || shortId(tx.downlineId)}
                              </span>
                              <span className="font-black text-xs text-emerald-600">
                                +{formatMoney(tx.totalCommission)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span className="font-mono">{formatDateTime(tx.createdAt)}</span>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                {tx.accCount} ACC
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop View: Table */}
                      <div className="hidden md:block border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <tr>
                              <th className="px-3 py-2.5">Waktu</th>
                              <th className="px-3 py-2.5">Downline</th>
                              <th className="px-3 py-2.5 text-center">ACC</th>
                              <th className="px-3 py-2.5 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {referralTxs.data.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">
                                  {formatDateTime(tx.createdAt)}
                                </td>
                                <td className="px-3 py-2.5 font-bold text-slate-900">
                                  {tx.downlineName || shortId(tx.downlineId)}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                                  {tx.accCount}
                                </td>
                                <td className="px-3 py-2.5 text-right font-black text-emerald-600">
                                  +{formatMoney(tx.totalCommission)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 6. WITHDRAW / TARIK SALDO VIEW ==================== */}
          {activeView === "withdraw" && (
            <div className="space-y-5">
              {/* SALDO HIGHLIGHT BANNER */}
              <Card className="bg-gradient-to-r from-blue-500 via-orange-500 to-blue-600 text-white border-blue-400/50 shadow-md overflow-hidden relative">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-blue-100 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-blue-200" /> Salso Siap Ditarik
                      </p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                        {formatMoney(profile.balance)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-blue-100/90 pt-0.5">
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
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      Bonus Referral
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-blue-100 shadow-xs">
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
                          : "bg-blue-50 text-blue-800 border-blue-300"
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
                          <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                          Pilih Metode Pembayaran
                        </Label>
                      </div>

                      <div className="inline-flex p-1 bg-blue-100/60 border border-blue-200/60 rounded-xl gap-1 text-xs font-medium w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleSelectCategory("ewallet")}
                          className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            categoryTab === "ewallet"
                              ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-xs"
                              : "text-blue-950 hover:text-blue-900"
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
                              ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-xs"
                              : "text-blue-950 hover:text-blue-900"
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
                                  ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50/80 ring-2 ring-blue-500/30 shadow-xs"
                                  : "border-gray-200 bg-white hover:border-blue-300"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  {isEWallet ? (
                                    <Smartphone className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-500"}`} />
                                  ) : (
                                    <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-600" : "text-gray-500"}`} />
                                  )}
                                  <span className="font-bold text-xs text-gray-900 truncate">{m.method}</span>
                                </div>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                              </div>

                              <Badge
                                variant="secondary"
                                className={`text-[9px] w-fit font-semibold px-1.5 py-0 ${
                                  m.feeType === "free" || m.feeValue <= 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
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
                        <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                        Nominal Penarikan
                      </Label>

                      <FormattedNumberInput
                        id="amount"
                        value={amount}
                        onChange={(val) => setAmount(val)}
                        placeholder="Contoh: 100.000"
                        className="font-mono text-sm font-semibold h-10 border-gray-200 focus-visible:ring-blue-500 rounded-xl"
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
                                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-400 font-bold"
                                : "bg-slate-50 text-gray-700 hover:bg-blue-50 border-gray-200"
                            }`}
                          >
                            {chip.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <Label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
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
                            className="mt-1 border-gray-200 focus-visible:ring-blue-500 rounded-xl h-9 text-xs"
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
                            className="mt-1 border-gray-200 focus-visible:ring-blue-500 rounded-xl h-9 text-xs"
                            required
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-gradient-to-br from-blue-50/80 via-orange-50/40 to-blue-100/30 rounded-xl border border-blue-200/80 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-gray-600">
                          <span>Nominal Penarikan:</span>
                          <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-600">
                          <span>Biaya Admin ({activeMethodConfig.method}):</span>
                          <span className={calculatedFee > 0 ? "font-bold text-blue-700" : "font-bold text-emerald-700"}>
                            {calculatedFee > 0 ? `- ${formatMoney(calculatedFee)}` : "Rp 0 (Free)"}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-blue-200/80 flex justify-between items-center text-xs sm:text-sm">
                          <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
                          <span className="font-black text-emerald-700">{formatMoney(calculatedNet)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={withdrawing}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold h-10 gap-2 text-xs rounded-xl shadow-sm border border-blue-400/20 active:scale-95 transition-transform"
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
              <Card className="bg-white border-blue-100 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    Pusat Bantuan & Layanan Pelanggan
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Hubungi customer service kami jika mengalami kendala setoran, pembayaran, atau pertanyaan lainnya.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-[#1e293b] border border-blue-900/60 text-slate-100 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-500/20 text-[#FFB74D] border border-blue-500/30">
                            <TelegramIcon className="w-4 h-4" />
                          </div>
                          <span className="font-extrabold text-sm text-[#FFB74D]">CS Telegram</span>
                        </div>
                        <p className="text-xs text-[#e2e8f0]/80 leading-relaxed">
                          Layanan cepat penanganan kendala akun, email setoran, dan status payout saldo.
                        </p>
                      </div>
                      {supportConfig.telegramUrl ? (
                        <Button
                          asChild
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-slate-950 font-bold text-xs h-9 rounded-xl border border-blue-400/30"
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

                    <div className="p-4 rounded-2xl bg-[#1e293b] border border-blue-900/60 text-slate-100 shadow-xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-500/20 text-[#FFB74D] border border-blue-500/30">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <span className="font-extrabold text-sm text-[#FFB74D]">Komunitas WhatsApp</span>
                        </div>
                        <p className="text-xs text-[#e2e8f0]/80 leading-relaxed">
                          Saluran resmi informasi worker, update jam operasional, dan diskusi komunitas.
                        </p>
                      </div>
                      {supportConfig.communityWaLink ? (
                        <Button
                          asChild
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-slate-950 font-bold text-xs h-9 rounded-xl border border-blue-400/30"
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

          {/* ==================== 10. PESAN ADMIN / LIVE CHAT VIEW ==================== */}
          {activeView === "chat" && (
            <div className="space-y-4">
              <Card className="bg-white border-blue-200/80 shadow-xs flex flex-col h-[650px] max-h-[80vh] overflow-hidden">
                {/* CHAT HEADER */}
                <CardHeader className="p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 via-amber-50/50 to-indigo-500/10 border-b border-blue-200/80 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/20 text-blue-700 border border-blue-400/30 shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-1.5">
                          <span>Chat Resmi Admin / CS</span>
                        </CardTitle>
                        <CardDescription className="text-[11px] text-blue-900/80 font-medium">
                          Saluran percakapan privat 1-on-1 langsung dengan Admin.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-900 border-blue-300 font-bold hidden sm:inline-flex">
                      Privat & Aman
                    </Badge>
                  </div>
                </CardHeader>

                {/* MESSAGES BODY */}
                <CardContent className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {workerMessagesData.loading ? (
                    <div className="flex items-center justify-center py-12 text-xs text-gray-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      Memuat pesan chat...
                    </div>
                  ) : workerMessagesData.messages.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-blue-200/80 rounded-2xl bg-white space-y-2">
                      <div className="p-3 rounded-full bg-blue-50 text-blue-600 w-fit mx-auto border border-blue-200/60">
                        <MessageCircle className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-gray-900">Belum Ada Pesan</p>
                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                        Tanyakan seputar akun, setoran email, kendala verifikasi, atau bantuan pencairan saldo di sini.
                      </p>
                    </div>
                  ) : (
                    workerMessagesData.messages
                      .filter((msg) => !(Array.isArray(msg.deletedFor) && msg.deletedFor.includes(profile.uid)))
                      .map((msg) => {
                        const isMe = msg.senderRole === "worker";
                        const isRead = !!msg.readAt;

                        // Check if deleted for all
                        const isDeleted = !!msg.deletedAt;

                        // Check if expired
                        const nowMs = Date.now();
                        const expiresMs = msg.expiresAt && typeof msg.expiresAt === "object" && "toMillis" in msg.expiresAt
                          ? msg.expiresAt.toMillis()
                          : msg.expiresAt ? new Date(msg.expiresAt).getTime() : null;
                        const isExpired = expiresMs ? expiresMs <= nowMs : false;

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-xs space-y-1 shadow-2xs relative ${
                                isMe
                                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-none"
                                  : "bg-white border border-blue-200/80 text-gray-900 rounded-bl-none"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[10px] opacity-90 font-semibold mb-0.5">
                                <span>{isMe ? "Saya" : "Admin / CS"}</span>
                                {!isDeleted && !isExpired && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteChatModalMsg(msg)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-blue-200 p-0.5 transition-opacity"
                                    title="Opsi Pesan"
                                  >
                                    <MoreVertical className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {isDeleted ? (
                                <p className="italic text-slate-300 flex items-center gap-1 my-1 text-[11px]">
                                  <Trash2 className="w-3 h-3 text-slate-400" />
                                  <span>Pesan telah dihapus</span>
                                </p>
                              ) : isExpired ? (
                                <p className="italic text-slate-300 flex items-center gap-1 my-1 text-[11px]">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Pesan telah kedaluwarsa</span>
                                </p>
                              ) : (
                                <>
                                  {/* Text Message */}
                                  {msg.text && (
                                    <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.text}</p>
                                  )}
                                </>
                              )}

                              <div className="flex items-center justify-end gap-1 text-[9px] font-mono mt-1 opacity-80">
                                {msg.disappearingTimer && msg.disappearingTimer !== "off" && (
                                  <span className="flex items-center gap-0.5 text-blue-200" title={`Timer hapus otomatis: ${msg.disappearingTimer}`}>
                                    <Timer className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <span>{formatDateTime(msg.createdAt)}</span>
                                {isMe && !isDeleted && !isExpired && (
                                  <span title={isRead ? "Telah dibaca Admin (2 check)" : "Terkirim (1 check)"}>
                                    {isRead ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                                    ) : (
                                      <Check className="w-3 h-3 text-blue-100" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                  <div ref={workerChatEndRef} />
                </CardContent>

                {/* CHAT INPUT FORM */}
                <form
                  onSubmit={handleSendWorkerChat}
                  className="p-3 bg-white border-t border-blue-200/80 flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <EmojiPicker onSelectEmoji={(emoji: string) => setWorkerChatText((prev) => prev + emoji)} />

                    {/* Disappearing Timer Selector */}
                    <div className="relative group">
                      <select
                        value={chatTimerOption}
                        onChange={(e) => setChatTimerOption(e.target.value as DisappearingTimer)}
                        className="text-[11px] h-10 px-2 rounded-xl bg-blue-50/50 border border-blue-200/80 text-blue-900 font-semibold focus:outline-none min-h-[44px]"
                        title="Timer Pesan Menghilang"
                      >
                        <option value="off">⏱️ Timer Off</option>
                        <option value="24h">⏱️ 24 Jam</option>
                        <option value="7d">⏱️ 7 Hari</option>
                        <option value="30d">⏱️ 30 Hari</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    placeholder="Tulis pesan untuk Admin..."
                    value={workerChatText}
                    onChange={(e) => setWorkerChatText(e.target.value)}
                    disabled={sendingWorkerChat}
                    className="text-xs h-10 bg-blue-50/30 border-blue-200/80 text-gray-900 focus:border-blue-500 flex-1 rounded-xl min-h-[44px]"
                  />

                  <Button
                    type="submit"
                    disabled={sendingWorkerChat || !workerChatText.trim()}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold h-10 px-4 rounded-xl shadow-2xs border border-blue-400/20 shrink-0 min-h-[44px]"
                  >
                    {sendingWorkerChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </Card>

              {/* DELETE MESSAGE CONFIRMATION DIALOG */}
              <Dialog open={!!deleteChatModalMsg} onOpenChange={(open) => !open && setDeleteChatModalMsg(null)}>
                <DialogContent className="max-w-md bg-white border-blue-200">
                  <DialogHeader>
                    <DialogTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Hapus Pesan</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-600">
                      Pilih opsi penghapusan untuk pesan ini.
                    </DialogDescription>
                  </DialogHeader>

                  {deleteChatModalMsg && (
                    <div className="space-y-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
                        "{deleteChatModalMsg.text || "Pesan"}"
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <Button
                          onClick={() => handleDeleteMessageForMe(deleteChatModalMsg)}
                          disabled={deletingChat}
                          variant="outline"
                          className="w-full text-xs h-10 justify-start font-semibold border-blue-200 hover:bg-blue-50 min-h-[44px]"
                        >
                          <Trash2 className="w-4 h-4 text-blue-600 mr-2" />
                          Hapus untuk Saya (Sembunyikan hanya di perangkat Anda)
                        </Button>

                        {deleteChatModalMsg.senderRole === "worker" && (
                          <Button
                            onClick={() => handleDeleteMessageForAll(deleteChatModalMsg)}
                            disabled={deletingChat}
                            className="w-full text-xs h-10 justify-start bg-rose-600 hover:bg-rose-700 text-white font-semibold min-h-[44px]"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Hapus untuk Semua (Hapus untuk Worker & Admin)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ==================== 9. PENGUMUMAN / INFO RESMI VIEW ==================== */}
          {activeView === "announcements" && (
            <div className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                    <Megaphone className="w-4 h-4 text-blue-600" />
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
                          badgeStyle = "bg-blue-100 text-blue-800 hover:bg-blue-100";
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

          {/* 7. MOBILE BOTTOM NAVIGATION */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-2 py-1 flex items-center justify-around">
            {/* 1. HOME */}
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                activeView === "home"
                  ? "text-blue-600 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Home className={`w-5 h-5 mb-0.5 ${activeView === "home" ? "text-blue-600 stroke-[2.5]" : ""}`} />
              <span className="text-[10px] tracking-tight">Home</span>
            </button>

            {/* 2. SETOR / SUBMIT */}
            <button
              type="button"
              onClick={() => setActiveView("submit")}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                activeView === "submit"
                  ? "text-blue-600 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <PlusCircle className={`w-5 h-5 mb-0.5 ${activeView === "submit" ? "text-blue-600 stroke-[2.5]" : ""}`} />
              <span className="text-[10px] tracking-tight">Setor</span>
            </button>

            {/* 3. WITHDRAW */}
            <button
              type="button"
              onClick={() => setActiveView("withdraw")}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                activeView === "withdraw"
                  ? "text-blue-600 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Wallet className={`w-5 h-5 mb-0.5 ${activeView === "withdraw" ? "text-blue-600 stroke-[2.5]" : ""}`} />
              <span className="text-[10px] tracking-tight">Withdraw</span>
            </button>

            {/* 4. CS */}
            <button
              type="button"
              onClick={() => setActiveView("cs")}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                activeView === "cs"
                  ? "text-blue-600 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <HelpCircle className={`w-5 h-5 mb-0.5 ${activeView === "cs" ? "text-blue-600 stroke-[2.5]" : ""}`} />
              <span className="text-[10px] tracking-tight">CS</span>
            </button>

            {/* 5. MENU */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-600 transition-colors min-h-[44px] min-w-[44px]"
            >
              <Menu className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">Menu</span>
            </button>
          </nav>

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
                        <p className="font-bold text-blue-700">{formatMoney(earned)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs text-gray-600">
                          Status per Alamat Email ({baseItems.length} item):
                        </Label>
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-800 border-blue-300">
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
                                    : "bg-blue-50/60 border-blue-200"
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
                                      : "bg-blue-100 text-blue-800 hover:bg-blue-100"
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
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
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
    </div>
  );
}
