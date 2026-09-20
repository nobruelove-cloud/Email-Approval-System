import { useEffect, useMemo, useState, useRef } from "react";
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
  CheckCheck,
  Wrench,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  SearchCheck,
  ArrowLeft,
  Home,
  HelpCircle,
  MessageSquare,
  Send,
  Search,
  Paperclip,
  Image as ImageIcon,
  X,
  MoreVertical,
  Maximize2,
  Timer,
} from "lucide-react";

export type AdminTab =
  | "overview"
  | "checker"
  | "announcements"
  | "finance"
  | "submissions"
  | "withdrawals"
  | "workers"
  | "rewards"
  | "rules"
  | "chat";
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
import { EmailChecker } from "@/components/EmailChecker";
import { MasterResetModal } from "@/components/MasterResetModal";
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
  saveSettings,
  evaluateReferralQualification,
  distributeLeaderboardReward,
  reviewMissionClaim,
  useAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  masterResetOperasional,
  reconcileHistoricalNabilWithdrawal,
  useAdminConversations,
  useConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  initiateWorkerConversation,
  uploadChatImage,
  deleteMessageForMe,
  deleteMessageForAll,
} from "@/hooks/use-portal";
import {
  type ChatMessage,
  type ChatAttachment,
  type DisappearingTimer,
} from "@/lib/portal-types";
import { type Announcement } from "@/lib/portal-types";
import { DEFAULT_RULES, DEFAULT_TIERS, DEFAULT_OPERATING_HOURS, DEFAULT_WITHDRAWAL_SETTINGS, DEFAULT_PAYMENT_METHOD_FEES, DEFAULT_MAINTENANCE, DEFAULT_TELEGRAM_CONFIG, DEFAULT_GENERAL_SETTINGS, type EmailSubmission, type PortalUser, type TierConfig, type UserStatus, type UserTier, type SupportConfig, type OperatingHoursConfig, type FinancialTransaction, type FinancialTransactionType, type PaymentMethodFeeConfig, type WithdrawalSettings, type MethodFeeType, type MaintenanceConfig, type TelegramConfig, type GeneralSettings } from "@/lib/portal-types";
import { sendTelegramNotification } from "@/lib/telegram-bot";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getItemCountOfSubmission,
  getRecommendedTier,
  getTierConfig,
  shortId,
  validateTierConfigs,
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
  getLeaderboardUserProgress,
  maskWorkerName,
  getWeeklyPeriodOptions,
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
    pending: "bg-amber-50 text-amber-800 border border-amber-200 font-semibold",
    processing: "bg-sky-50 text-sky-800 border border-sky-200 font-semibold",
    approved: "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold",
    available: "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold",
    sold: "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold",
    rejected: "bg-rose-50 text-rose-800 border border-rose-200 font-semibold",
    inactive: "bg-slate-100 text-slate-600 border border-slate-200 font-semibold",
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
  return (
    <Badge className={`whitespace-nowrap shrink-0 text-xs px-2.5 py-0.5 ${variants[status] ?? variants.pending}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

function OnlineStatusBadge({ lastActiveAt }: { lastActiveAt?: unknown }) {
  if (!lastActiveAt) {
    return (
      <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold gap-1.5 text-xs py-0.5">
        <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
        Offline - Belum pernah
      </Badge>
    );
  }

  let ms = 0;
  if (typeof lastActiveAt === "object" && lastActiveAt !== null && "toMillis" in (lastActiveAt as any)) {
    ms = (lastActiveAt as { toMillis: () => number }).toMillis();
  } else if (lastActiveAt instanceof Date) {
    ms = lastActiveAt.getTime();
  } else if (typeof lastActiveAt === "number") {
    ms = lastActiveAt;
  } else if (typeof lastActiveAt === "string") {
    ms = new Date(lastActiveAt).getTime();
  }

  if (!ms || isNaN(ms)) {
    return (
      <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold gap-1.5 text-xs py-0.5">
        <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
        Offline
      </Badge>
    );
  }

  const diffMs = Date.now() - ms;
  const isOnline = diffMs <= 5 * 60 * 1000;

  if (isOnline) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold gap-1.5 text-xs py-0.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        ONLINE
      </Badge>
    );
  }

  const diffMins = Math.floor(diffMs / (60 * 1000));
  let timeStr = `${diffMins}m lalu`;
  if (diffMins >= 60) {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours >= 24) {
      const diffDays = Math.floor(diffHours / 24);
      timeStr = `${diffDays}h lalu`;
    } else {
      timeStr = `${diffHours}j lalu`;
    }
  }

  return (
    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold gap-1.5 text-xs py-0.5">
      <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
      Offline - {timeStr}
    </Badge>
  );
}

export default function AdminDashboard({ profile, onLogout }: { profile: PortalUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const { users, submissions, withdrawals, referrals, rewardLedger, leaderboardPayouts } = useAdminData();
  const announcements = useAnnouncements({ includeInactive: true });

  // Admin Chat States
  const adminChatData = useAdminConversations();
  const [selectedWorkerUid, setSelectedWorkerUid] = useState<string | null>(null);
  const selectedWorkerMessages = useConversationMessages(selectedWorkerUid);
  const [adminChatText, setAdminChatText] = useState("");
  const [sendingAdminChat, setSendingAdminChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // Admin Chat Media & Timer & Modal State
  const [selectedAdminChatFiles, setSelectedAdminChatFiles] = useState<File[]>([]);
  const [adminUploadProgress, setAdminUploadProgress] = useState<number | null>(null);
  const [adminChatTimerOption, setAdminChatTimerOption] = useState<DisappearingTimer>("off");

  const [adminPreviewImageModalUrl, setAdminPreviewImageModalUrl] = useState<string | null>(null);
  const [adminDeleteChatModalMsg, setAdminDeleteChatModalMsg] = useState<ChatMessage | null>(null);
  const [deletingAdminChat, setDeletingAdminChat] = useState(false);

  const adminFileInputRef = useRef<HTMLInputElement | null>(null);
  const adminChatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of admin chat & mark read on select or update
  useEffect(() => {
    if (selectedWorkerUid) {
      markConversationAsRead(selectedWorkerUid, "admin");
      adminChatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedWorkerUid, selectedWorkerMessages.messages]);

  const handleSelectAdminChatImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 5) {
      toast.error("Maksimal 5 foto per album/pengiriman.");
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const oversized = files.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      toast.error(`Ukuran file "${oversized.name}" melebihi batas 5MB.`);
      return;
    }

    setSelectedAdminChatFiles(files);
  };

  const handleRemoveSelectedAdminFile = (index: number) => {
    setSelectedAdminChatFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleSendAdminChat(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWorkerUid || (!adminChatText.trim() && selectedAdminChatFiles.length === 0) || sendingAdminChat) return;

    setSendingAdminChat(true);
    setAdminUploadProgress(0);

    try {
      let attachments: ChatAttachment[] = [];
      if (selectedAdminChatFiles.length > 0) {
        const dummyMsgId = `msg_${Date.now()}`;
        for (let i = 0; i < selectedAdminChatFiles.length; i++) {
          const file = selectedAdminChatFiles[i];
          const att = await uploadChatImage(selectedWorkerUid, dummyMsgId, file, (percent) => {
            const overall = ((i + percent / 100) / selectedAdminChatFiles.length) * 100;
            setAdminUploadProgress(Math.round(overall));
          });
          attachments.push(att);
        }
      }

      await sendChatMessage({
        conversationId: selectedWorkerUid,
        senderId: profile.uid,
        senderRole: "admin",
        senderName: "Admin",
        senderEmail: profile.email,
        text: adminChatText,
        type: attachments.length > 1 ? "album" : attachments.length === 1 ? "image" : "text",
        attachments: attachments.length > 0 ? attachments : undefined,
        disappearingTimer: adminChatTimerOption,
      });

      setAdminChatText("");
      setSelectedAdminChatFiles([]);
      if (adminFileInputRef.current) adminFileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesan chat.");
    } finally {
      setSendingAdminChat(false);
      setAdminUploadProgress(null);
    }
  }

  const handleDeleteAdminMessageForMe = async (msg: ChatMessage) => {
    if (!selectedWorkerUid) return;
    setDeletingAdminChat(true);
    try {
      await deleteMessageForMe(selectedWorkerUid, msg.id, profile.uid);
      toast.success("Pesan dihapus untuk Anda.");
      setAdminDeleteChatModalMsg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pesan.");
    } finally {
      setDeletingAdminChat(false);
    }
  };

  const handleDeleteAdminMessageForAll = async (msg: ChatMessage) => {
    if (!selectedWorkerUid) return;
    setDeletingAdminChat(true);
    try {
      await deleteMessageForAll(selectedWorkerUid, msg.id, profile.uid);
      toast.success("Pesan dihapus untuk semua.");
      setAdminDeleteChatModalMsg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus pesan.");
    } finally {
      setDeletingAdminChat(false);
    }
  }

  function handleStartChatWithWorker(workerUid: string) {
    const workerObj = users.data.find((u) => u.uid === workerUid);
    if (workerObj) {
      initiateWorkerConversation({
        uid: workerObj.uid,
        name: workerObj.name,
        email: workerObj.email,
      });
    }
    setSelectedWorkerUid(workerUid);
    setActiveTab("chat");
  }

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
  const generalSettingsHook = useSettings("general", DEFAULT_GENERAL_SETTINGS);
  const withdrawalSettingsHook = useSettings("withdrawal", DEFAULT_WITHDRAWAL_SETTINGS);
  const maintenanceHook = useSettings("maintenance", DEFAULT_MAINTENANCE);
  const [evaluatingRefs, setEvaluatingRefs] = useState(false);

  // Reconciliation state for Nabil Alfiansyah
  const [reconcilingNabil, setReconcilingNabil] = useState(false);

  async function handleReconcileNabil() {
    setReconcilingNabil(true);
    try {
      const res = await reconcileHistoricalNabilWithdrawal();
      if (res.status === "already_reconciled") {
        toast.info(res.message);
      } else {
        toast.success(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal melakukan rekonsiliasi.");
    } finally {
      setReconcilingNabil(false);
    }
  }

  // Master Reset state
  const [masterResetModalOpen, setMasterResetModalOpen] = useState(false);
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [masterResetBusy, setMasterResetBusy] = useState(false);

  async function handleMasterReset(e: React.FormEvent) {
    e.preventDefault();
    if (!adminConfirmPassword.trim()) {
      toast.error("Password / PIN Admin wajib diisi.");
      return;
    }

    setMasterResetBusy(true);
    try {
      const res = await masterResetOperasional(adminConfirmPassword);
      toast.success(res.message || "Master Reset Operasional Berhasil!");
      setMasterResetModalOpen(false);
      setAdminConfirmPassword("");
    } catch (err) {
      console.error("[AdminDashboard] Master reset error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal melakukan Master Reset Operasional.");
    } finally {
      setMasterResetBusy(false);
    }
  }

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
  const [vendorSalePrice, setVendorSalePrice] = useState<number>(4500);
  const [simVendorRate, setSimVendorRate] = useState<number>(4500);
  const [simWorkerRate, setSimWorkerRate] = useState<number>(3000);
  const [simDailyAccVolume, setSimDailyAccVolume] = useState<number>(100);

  function handleSimVendorRateChange(val: number) {
    const rate = val > 0 ? val : 4000;
    setSimVendorRate(rate);
    setVendorSalePrice(rate);
  }

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

    // Exclude periodWithdrawalsExpense from totalExpense to avoid double counting with periodWorkerCommissions
    const totalExpense = periodWorkerCommissions + periodRewardsExpense + manualExpense;
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

  // Flat referral commission rate state
  const [refCommission, setRefCommission] = useState<number | null>(null);
  const [savingRefCommission, setSavingRefCommission] = useState(false);

  const currentRefCommission = refCommission ?? (rules.data.referralCommissionPerAcc ?? 100);

  async function handleSaveRefCommission() {
    if (typeof currentRefCommission !== "number" || currentRefCommission < 0) {
      toast.error("Komisi referral per ACC harus berupa angka non-negatif.");
      return;
    }

    setSavingRefCommission(true);
    try {
      await saveSettings("rules", { referralCommissionPerAcc: currentRefCommission });
      toast.success("Nominal komisi referral flat berhasil disimpan!");
      setRefCommission(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan komisi referral.");
    } finally {
      setSavingRefCommission(false);
    }
  }

  // Support / Help Center configuration state
  const [supportTitle, setSupportTitle] = useState<string | null>(null);
  const [supportTelegramUrl, setSupportTelegramUrl] = useState<string | null>(null);
  const [communityWaLink, setCommunityWaLink] = useState<string | null>(null);
  const [supportDescription, setSupportDescription] = useState<string | null>(null);
  const [supportEnabled, setSupportEnabled] = useState<boolean | null>(null);
  const [savingSupport, setSavingSupport] = useState(false);

  // Telegram Bot configuration state
  const activeTelegramConfig = useMemo(() => {
    return rules.data.telegramConfig ?? DEFAULT_TELEGRAM_CONFIG;
  }, [rules.data.telegramConfig]);

  const [telegramBotToken, setTelegramBotToken] = useState<string | null>(null);
  const [telegramAdminChatId, setTelegramAdminChatId] = useState<string | null>(null);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean | null>(null);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  const currentTelegramBotToken = telegramBotToken ?? activeTelegramConfig.botToken ?? "";
  const currentTelegramAdminChatId = telegramAdminChatId ?? activeTelegramConfig.adminChatId ?? "";
  const currentTelegramEnabled = telegramEnabled ?? (activeTelegramConfig.enabled !== false);

  async function handleSaveTelegramConfig() {
    setSavingTelegram(true);
    try {
      const updatedTelegramConfig: TelegramConfig = {
        enabled: currentTelegramEnabled,
        botToken: currentTelegramBotToken.trim(),
        adminChatId: currentTelegramAdminChatId.trim(),
      };

      await saveSettings("rules", {
        ...rules.data,
        telegramConfig: updatedTelegramConfig,
      });

      // Also sync to settings/telegram document for backward compatibility
      await saveSettings("telegram", updatedTelegramConfig);

      toast.success("Pengaturan Telegram Bot Notification Service berhasil disimpan!");
      setTelegramBotToken(null);
      setTelegramAdminChatId(null);
      setTelegramEnabled(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan Telegram.");
    } finally {
      setSavingTelegram(false);
    }
  }

  async function handleTestTelegramNotification() {
    if (!currentTelegramBotToken.trim()) {
      toast.error("Telegram Bot Token wajib diisi untuk melakukan test.");
      return;
    }
    if (!currentTelegramAdminChatId.trim()) {
      toast.error("Telegram Admin Chat ID / Group ID wajib diisi untuk melakukan test.");
      return;
    }

    setTestingTelegram(true);
    try {
      const testMessage =
        `🤖 TEST NOTIFIKASI TELEGRAM BOT\n\n` +
        `Koneksi Telegram Bot Notification Service BERHASIL terhubung ke Obsidian Command Center Admin!\n\n` +
        `🕒 Waktu Test: ${formatDateTime(new Date())}`;

      const res = await sendTelegramNotification(testMessage, {
        botToken: currentTelegramBotToken.trim(),
        adminChatId: currentTelegramAdminChatId.trim(),
      });

      if (res.success) {
        toast.success("Notifikasi test BERHASIL dikirim ke Telegram!");
      } else {
        toast.error(`Gagal mengirim notifikasi test: ${res.error || "Terjadi kesalahan"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menguji koneksi Telegram Bot.");
    } finally {
      setTestingTelegram(false);
    }
  }

  const activeSupportConfig = useMemo(() => {
    return rules.data.supportConfig ?? DEFAULT_RULES.supportConfig!;
  }, [rules.data.supportConfig]);

  const currentSupportTitle = supportTitle ?? activeSupportConfig.title ?? "Customer Service";
  const currentSupportTelegramUrl = supportTelegramUrl ?? activeSupportConfig.telegramUrl ?? "";
  const currentCommunityWaLink = communityWaLink ?? activeSupportConfig.communityWaLink ?? "";
  const currentSupportDescription = supportDescription ?? activeSupportConfig.description ?? "Ada kendala? Hubungi Customer Service kami melalui Telegram.";
  const currentSupportEnabled = supportEnabled ?? (activeSupportConfig.enabled !== false);

  // Jam Operasional & Submission Lock configuration state
  const activeOperatingHours = useMemo(() => {
    return rules.data.operatingHours ?? DEFAULT_OPERATING_HOURS;
  }, [rules.data.operatingHours]);

  const [operatingHoursState, setOperatingHoursState] = useState<OperatingHoursConfig | null>(null);
  const [submissionOpenState, setSubmissionOpenState] = useState<boolean | null>(null);
  const [savingOperatingHours, setSavingOperatingHours] = useState(false);

  const currentOperatingHours = operatingHoursState ?? activeOperatingHours;
  const currentSubmissionOpen = submissionOpenState ?? (generalSettingsHook.data?.submissionOpen !== false);

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

      await saveSettings("general", {
        ...generalSettingsHook.data,
        submissionOpen: currentSubmissionOpen,
      });

      toast.success("Jam operasional & pengaturan kunci setoran berhasil disimpan.");
      setOperatingHoursState(null);
      setSubmissionOpenState(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan jam operasional.");
    } finally {
      setSavingOperatingHours(false);
    }
  }

  async function handleSaveSupportConfig() {
    const trimmedTelegramUrl = currentSupportTelegramUrl.trim();
    if (trimmedTelegramUrl && !isValidTelegramUrl(trimmedTelegramUrl)) {
      toast.error("Masukkan link Telegram yang valid.");
      return;
    }

    setSavingSupport(true);
    try {
      const updatedSupportConfig: SupportConfig = {
        enabled: currentSupportEnabled,
        title: currentSupportTitle.trim() || "Customer Service",
        description: currentSupportDescription.trim() || "Ada kendala? Hubungi Customer Service kami melalui Telegram & Komunitas WhatsApp.",
        telegramUrl: trimmedTelegramUrl,
        communityWaLink: currentCommunityWaLink.trim(),
      };

      await saveSettings("rules", {
        ...rules.data,
        supportConfig: updatedSupportConfig,
      });

      toast.success("Pengaturan Pusat Bantuan & Komunitas berhasil disimpan.");
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

  const weeklyPeriodOptions = useMemo(() => getWeeklyPeriodOptions(10), []);
  const [selectedWeeklyPeriod, setSelectedWeeklyPeriod] = useState<string>(() => weeklyPeriodOptions[0]?.value || getWeeklyPeriodKey(new Date()));

  const selectedWeeklyTimeframe = useMemo(() => {
    const found = weeklyPeriodOptions.find((w) => w.value === selectedWeeklyPeriod);
    if (found) return found;

    const now = new Date();
    const { start, end } = getStartAndEndOfWeek(now);
    const key = getWeeklyPeriodKey(now);
    return { value: key, label: `Minggu Ini (${key})`, start, end, isCurrent: true };
  }, [weeklyPeriodOptions, selectedWeeklyPeriod]);

  // Check if selected weekly period is currently active (Senin-Minggu running)
  const isCurrentWeeklyPeriodActive = useMemo(() => {
    const nowMs = Date.now();
    return nowMs >= selectedWeeklyTimeframe.start.getTime() && nowMs <= selectedWeeklyTimeframe.end.getTime();
  }, [selectedWeeklyTimeframe]);

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
      selectedWeeklyTimeframe.start,
      selectedWeeklyTimeframe.end,
      leaderboardRewardsConfig
    );
  }, [submissions.data, users.data, selectedWeeklyTimeframe.start, selectedWeeklyTimeframe.end, leaderboardRewardsConfig]);

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
    if (isCurrentWeeklyPeriodActive) {
      toast.error("Pencairan reward belum dapat dilakukan. Periode minggu ini masih berjalan (Senin-Minggu).");
      return;
    }

    const minReq = winner.rank === 1 ? 200 : winner.rank === 2 ? 100 : 50;
    if (winner.validAccCount < minReq) {
      toast.error(`Worker Juara #${winner.rank} (${winner.workerName}) tidak memenuhi syarat minimal ACC (${winner.validAccCount}/${minReq} ACC).`);
      return;
    }

    const payoutId = `${selectedWeeklyTimeframe.value}_rank${winner.rank}_${winner.workerId}`;
    if (paidLeaderboardSet.has(payoutId)) {
      toast.info(`Hadiah Juara #${winner.rank} (${winner.workerName}) sudah pernah dicairkan untuk periode ini.`);
      return;
    }

    const rewardAmt = winner.rewardAmount || (winner.rank === 1 ? 50000 : winner.rank === 2 ? 30000 : 15000);
    setPayingIndividualWorkerId(winner.workerId);
    try {
      await distributeLeaderboardReward(
        winner.workerId,
        selectedWeeklyTimeframe.value,
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
    if (isCurrentWeeklyPeriodActive) {
      toast.error("Pencairan reward belum dapat dilakukan. Periode minggu ini masih berjalan (Senin-Minggu).");
      return;
    }

    if (currentLeaderboardStandings.length === 0) {
      toast.error("Tidak ada pengerjaan email ACC pada periode ini.");
      return;
    }

    // Filter qualified top 3 winners matching min ACC thresholds (Juara 1: 200, Juara 2: 100, Juara 3: 50)
    const qualifiedWinners = currentLeaderboardStandings.slice(0, 3).filter((s) => {
      const minReq = s.rank === 1 ? 200 : s.rank === 2 ? 100 : 50;
      return s.validAccCount >= minReq && (s.rewardAmount ?? 0) > 0;
    });

    if (qualifiedWinners.length === 0) {
      toast.error("Tidak ada pemenang Top 3 yang memenuhi syarat minimal ACC (Juara 1: 200, Juara 2: 100, Juara 3: 50).");
      return;
    }

    // Filter out workers who have already been paid for this period
    const unpaidWinners = qualifiedWinners.filter(
      (w) => !paidLeaderboardSet.has(`${selectedWeeklyTimeframe.value}_rank${w.rank}_${w.workerId}`)
    );

    if (unpaidWinners.length === 0) {
      toast.info(`Seluruh pemenang qualified untuk periode ${selectedWeeklyTimeframe.value} sudah dicairkan.`);
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
          selectedWeeklyTimeframe.value,
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
    users.data.forEach((u) => {
      if (u.uid) map.set(u.uid, u);
      if (u.email && u.email.trim()) {
        map.set(u.email.trim().toLowerCase(), u);
      }
      if (u.name && u.name.trim()) {
        map.set(u.name.trim().toLowerCase(), u);
      }
    });
    return map;
  }, [users.data]);

  const getWorkerObj = (id?: string, email?: string, name?: string) => {
    if (id && workerMap.has(id)) return workerMap.get(id);
    if (id && workerMap.has(id.trim().toLowerCase())) return workerMap.get(id.trim().toLowerCase());
    if (email && workerMap.has(email.trim().toLowerCase())) {
      return workerMap.get(email.trim().toLowerCase());
    }
    if (name && workerMap.has(name.trim().toLowerCase())) {
      return workerMap.get(name.trim().toLowerCase());
    }
    return undefined;
  };

  const workerName = (idOrEmail?: string, email?: string, name?: string) => {
    if (!idOrEmail && !email && !name) return "-";
    const found = getWorkerObj(idOrEmail, email, name);
    return found?.name ?? name ?? (idOrEmail ? shortId(idOrEmail) : "-");
  };

  // One-time auto-sync migration effect for missing approved payouts
  const hasSyncedBalancesRef = useRef(false);

  useEffect(() => {
    if (hasSyncedBalancesRef.current || users.loading || submissions.loading || withdrawals.loading) {
      return;
    }

    if (!users.data.length || !submissions.data.length) {
      return;
    }

    hasSyncedBalancesRef.current = true;

    // Scan approved submissions per worker
    const workerNetPayouts = new Map<string, number>();

    submissions.data.forEach((sub) => {
      const st = (sub.status || "").toLowerCase();
      const isApproved = st === "approved" || st === "available" || st === "sold" || st === "acc" || st === "terjual";
      if (!isApproved) return;

      const count = typeof sub.approvedItemCount === "number"
        ? sub.approvedItemCount
        : Array.isArray(sub.items) && sub.items.length > 0
        ? sub.items.filter((it) => it.status === "approved").length
        : getItemCountOfSubmission(sub);

      const pricePerItem = sub.appliedPricePerItem ?? sub.currentPricePerItem ?? sub.pricePerEmail ?? 2000;
      const payout = sub.totalAmount ?? (count * pricePerItem);

      const workerObj = getWorkerObj(sub.workerId, (sub as any).workerEmail || (sub as any).userEmail, sub.workerName);
      if (workerObj && workerObj.uid) {
        const prev = workerNetPayouts.get(workerObj.uid) || 0;
        workerNetPayouts.set(workerObj.uid, prev + payout);
      }
    });

    // Subtract completed withdrawals
    withdrawals.data.forEach((w) => {
      const st = (w.status || "").toLowerCase();
      const isSuccess = st === "success" || st === "withdrawn";
      if (!isSuccess) return;

      const workerObj = getWorkerObj(w.workerId, (w as any).workerEmail, (w as any).accountHolderName);
      if (workerObj && workerObj.uid) {
        const prev = workerNetPayouts.get(workerObj.uid) || 0;
        workerNetPayouts.set(workerObj.uid, Math.max(0, prev - w.amount));
      }
    });

    // Sync workers whose balances were left at Rp 0 despite having approved submissions
    // Strictly preserve Firestore transaction balances as the source of truth.
    workerNetPayouts.forEach((expectedBalance, workerUid) => {
      if (expectedBalance <= 0) return;

      const workerUser = users.data.find((u) => u.uid === workerUid);
      if (!workerUser) return;

      const currentBal = Number(workerUser.balance ?? workerUser.saldoUtama ?? 0) || 0;
      // Only attempt sync if current balance is strictly 0 and expectedBalance > 0
      if (currentBal === 0 && expectedBalance > 0) {
        // Do not overwrite if worker has any processed or completed withdrawals that validly reduced balance to 0
        const hasProcessedWd = withdrawals.data.some((w) => {
          const st = (w.status || "").toLowerCase();
          return (
            (w.workerId === workerUid || (w as any).workerEmail === workerUser.email) &&
            (st === "success" || st === "approved" || st === "processing" || st === "withdrawn")
          );
        });

        if (hasProcessedWd) {
          console.log(`[Auto-Sync Balance] Skipping auto-sync for ${workerUser.name} (${workerUid}) because worker has processed withdrawals.`);
          return;
        }

        console.log(`[Auto-Sync Balance] Updating worker ${workerUser.name} (${workerUid}) balance from Rp ${currentBal} to Rp ${expectedBalance}`);
        updatePortalUser(workerUid, {
          balance: expectedBalance,
          saldoUtama: expectedBalance,
        }).catch((err) => {
          console.warn(`[Auto-Sync Balance] Failed to sync balance for ${workerUid}:`, err);
        });
      }
    });
  }, [users.loading, submissions.loading, withdrawals.loading, users.data, submissions.data, withdrawals.data, getWorkerObj]);

  // Map worker accumulated approved item counts
  const workerApprovedQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    submissions.data.forEach((sub) => {
      const st = (sub.status || "").toLowerCase();
      const isApprovedOrStock = st === "approved" || st === "available" || st === "sold" || st === "acc" || st === "terjual";
      if (isApprovedOrStock) {
        const count = getItemCountOfSubmission(sub);
        const workerObj = getWorkerObj(sub.workerId, (sub as any).workerEmail || (sub as any).userEmail, sub.workerName);
        const primaryKey = workerObj?.uid || sub.workerId;
        const current = map.get(primaryKey) ?? 0;
        map.set(primaryKey, current + count);
      }
    });
    return map;
  }, [submissions.data, workerMap]);

  const stats = useMemo(() => {
    const workerUsers = users.data.filter((u) => u.role !== "admin");
    const totalWorkers = workerUsers.length;
    const pendingWorkers = workerUsers.filter((u) => u.status === "pending").length;
    const activeWorkers = workerUsers.filter((u) => u.status === "approved" || u.status === "active").length;

    const totalBalance = workerUsers.reduce(
      (sum, u) => sum + (Number(u.balance ?? (u as any).saldoUtama ?? 0) || 0),
      0
    );

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
      .filter((w) => (w.status || "").toLowerCase() === "success" || (w.status || "").toLowerCase() === "withdrawn")
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
  }, [users.data, submissions.data, withdrawals.data, workerMap]);

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
      const workerObj = getWorkerObj(item.workerId, (item as any).workerEmail || (item as any).userEmail, item.workerName);
      const wName = (workerObj?.name || item.workerName || workerName(item.workerId, (item as any).workerEmail || (item as any).userEmail, item.workerName)).toLowerCase();
      const wEmail = (workerObj?.email || (item as any).workerEmail || (item as any).userEmail || "").toLowerCase();
      const search = submissionSearch.toLowerCase().trim();
      const firstEmail = item.items?.[0]?.email ?? item.email ?? "";
      const matchesSearch =
        !search ||
        firstEmail.toLowerCase().includes(search) ||
        item.workerId.toLowerCase().includes(search) ||
        wEmail.includes(search) ||
        wName.includes(search);

      let matchesStatus = true;
      if (submissionStatusFilter !== "all") {
        const itemStatusStr = (item.status as string || "").toLowerCase();
        if (submissionStatusFilter === "available") {
          matchesStatus = itemStatusStr === "available" || itemStatusStr === "approved" || itemStatusStr === "sold" || itemStatusStr === "acc" || itemStatusStr === "terjual";
        } else {
          matchesStatus = itemStatusStr === submissionStatusFilter.toLowerCase();
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [submissions.data, submissionSearch, submissionStatusFilter, workerName, workerMap]);

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



  const getTabTitle = (tab: AdminTab) => {
    switch (tab) {
      case "overview": return "Command Center";
      case "checker": return "Screening Email";
      case "announcements": return "Kelola Pengumuman";
      case "finance": return "Keuangan Platform";
      case "submissions": return "Kelola Batch Setoran";
      case "withdrawals": return "Kelola Penarikan Saldo";
      case "workers": return "Manajemen Pekerja";
      case "rewards": return "Rewards & Klasemen";
      case "rules": return "Aturan & Operasional";
      default: return "Admin Dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 selection:text-indigo-700 pb-20 sm:pb-8 w-full max-w-full overflow-x-hidden box-border flex flex-col md:flex-row">
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-screen sticky top-0 shrink-0 z-30 shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-indigo-500/20">
              G
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm tracking-tight leading-tight">GMAIL JOB ID</h1>
              <p className="text-[11px] text-slate-500 font-medium">Admin Portal v2.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button type="button" onClick={() => setActiveTab("overview")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "overview" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Command Center</span>
          </button>
          <button type="button" onClick={() => setActiveTab("submissions")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "submissions" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 shrink-0" />
              <span>Batch Review</span>
            </div>
            {stats.pendingSubmissions > 0 && <span className="text-[10px] bg-indigo-600 text-white font-extrabold rounded-full px-2 py-0.5 shadow-2xs">{stats.pendingSubmissions}</span>}
          </button>
          <button type="button" onClick={() => setActiveTab("withdrawals")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "withdrawals" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <div className="flex items-center gap-3">
              <Wallet className="w-4 h-4 shrink-0" />
              <span>Penarikan Saldo</span>
            </div>
            {stats.pendingWithdrawals > 0 && <span className="text-[10px] bg-amber-500 text-white font-extrabold rounded-full px-2 py-0.5 shadow-2xs">{stats.pendingWithdrawals}</span>}
          </button>
          <button type="button" onClick={() => setActiveTab("chat")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "chat" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>Pesan Worker</span>
            </div>
            {adminChatData.totalAdminUnread > 0 && <span className="text-[10px] bg-rose-500 text-white font-extrabold rounded-full px-2 py-0.5 shadow-2xs">{adminChatData.totalAdminUnread}</span>}
          </button>
          <button type="button" onClick={() => setActiveTab("workers")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "workers" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Users className="w-4 h-4 shrink-0" />
            <span>Kelola Worker</span>
          </button>
          <button type="button" onClick={() => setActiveTab("checker")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "checker" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <SearchCheck className="w-4 h-4 shrink-0" />
            <span>Screening Email</span>
          </button>
          <button type="button" onClick={() => setActiveTab("finance")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "finance" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>Keuangan Platform</span>
          </button>
          <button type="button" onClick={() => setActiveTab("rewards")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "rewards" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Gift className="w-4 h-4 shrink-0" />
            <span>Rewards & Referral</span>
          </button>
          <button type="button" onClick={() => setActiveTab("announcements")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "announcements" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Megaphone className="w-4 h-4 shrink-0" />
            <span>Kelola Pengumuman</span>
          </button>
          <button type="button" onClick={() => setActiveTab("rules")} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all min-h-[44px] ${activeTab === "rules" ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span>Aturan & Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{profile.name || profile.email || "Admin System"}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <span className="truncate max-w-[110px]">
                  {isEmailVisible
                    ? (profile.email && profile.email.trim() ? profile.email.trim() : "-")
                    : "*".repeat((profile.email && profile.email.trim() ? profile.email.trim() : "-").length)}
                </span>
                <button type="button" onClick={() => setIsEmailVisible(!isEmailVisible)} className="text-slate-500 hover:text-indigo-600 p-0.5 rounded" title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}>
                  {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={onLogout} title="Keluar" className="border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 shrink-0 rounded-lg">
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 w-full">
<header className="bg-white/90 border-b border-slate-200/80 sticky top-0 z-20 backdrop-blur-md shadow-2xs w-full max-w-full box-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 w-full max-w-full box-border">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-2xs shrink-0">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <p className="font-bold text-slate-900 text-sm sm:text-lg tracking-tight truncate">Command Center</p>
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase tracking-wider shrink-0">
                  ADMIN
                </span>
                {adminChatData.totalAdminUnread > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("chat")}
                    className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px] sm:text-xs rounded-full flex items-center gap-1 shadow-2xs hover:bg-amber-100 transition-colors shrink-0"
                  >
                    <MessageSquare className="w-3 h-3 text-amber-600" />
                    <span>{adminChatData.totalAdminUnread} Pesan</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-mono mt-0.5">
                <span className="truncate max-w-[130px] sm:max-w-xs">
                  {isEmailVisible
                    ? (profile.email && profile.email.trim() ? profile.email.trim() : "-")
                    : "*".repeat((profile.email && profile.email.trim() ? profile.email.trim() : "-").length)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEmailVisible(!isEmailVisible)}
                  className="text-slate-500 hover:text-indigo-600 transition-colors p-1 rounded focus:outline-none min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center shrink-0"
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
            className="border-slate-200/80 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] sm:h-9 sm:w-9 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 w-full max-w-full overflow-x-hidden box-border">
        {/* SUB-PAGE TOP NAVIGATION BAR (Shows on dedicated feature pages on mobile) */}
        {activeTab !== "overview" && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 h-9 rounded-xl border border-indigo-200"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-600" />
              <span>Kembali ke Command Center</span>
            </Button>
            <Badge variant="outline" className="text-xs bg-white text-indigo-600 border-indigo-200 font-bold px-3 py-1 shadow-md">
              {getTabTitle(activeTab)}
            </Badge>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as AdminTab)} className="w-full">
          {/* DESKTOP TOP TAB NAVIGATION (Hidden on mobile to avoid crowded tab bars) */}
          <TabsList className="hidden sm:grid sm:grid-cols-10 w-full mb-6 bg-slate-100/90 border border-slate-200/80 p-1.5 rounded-2xl backdrop-blur-md gap-1 shrink-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="checker" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <SearchCheck className="w-3.5 h-3.5" /> Master Riset
            </TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <Megaphone className="w-3.5 h-3.5" /> Pengumuman
            </TabsTrigger>
            <TabsTrigger value="finance" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <DollarSign className="w-3.5 h-3.5" /> Keuangan
            </TabsTrigger>
            <TabsTrigger value="submissions" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <FileText className="w-3.5 h-3.5" /> Batch
              {stats.pendingSubmissions > 0 && (
                <span className="ml-0.5 text-[10px] bg-emerald-500 text-white font-extrabold rounded-full px-1.5">{stats.pendingSubmissions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <Wallet className="w-3.5 h-3.5" /> Penarikan
              {stats.pendingWithdrawals > 0 && (
                <span className="ml-0.5 text-[10px] bg-emerald-500 text-white font-extrabold rounded-full px-1.5">{stats.pendingWithdrawals}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="workers" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <Users className="w-3.5 h-3.5" /> Pekerja
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <Gift className="w-3.5 h-3.5" /> Hadiah
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:border-slate-200/80 data-[state=active]:shadow-2xs border border-transparent text-slate-600 hover:text-slate-900 gap-1 text-xs font-semibold rounded-lg transition-all min-h-[44px] px-3 shrink-0 whitespace-nowrap">
              <SettingsIcon className="w-3.5 h-3.5" /> Aturan
            </TabsTrigger>
          </TabsList>

          {/* MASTER RISET / BULK EMAIL CHECKER */}
          <TabsContent value="checker" className="space-y-4">
            <EmailChecker isAdminView={true} />
          </TabsContent>

          {/* TAB KELOLA PENGUMUMAN ADMIN */}
          <TabsContent value="announcements" className="space-y-6">
            <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                      <Megaphone className="w-5 h-5 text-indigo-600" /> Kelola Pengumuman
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Buat, edit, dan kelola pengumuman atau informasi resmi untuk seluruh pekerja portal.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={openAddAnnModal}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Buat Pengumuman Baru
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {announcements.loading && <p className="text-sm text-slate-500 text-center py-8">Memuat pengumuman...</p>}
                {announcements.error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs text-center rounded-lg">
                    Gagal memuat pengumuman: {announcements.error}
                  </div>
                )}
                {!announcements.loading && !announcements.error && announcements.data.length === 0 && (
                  <div className="p-10 border border-dashed border-slate-200/80 text-center rounded-xl bg-slate-50 space-y-1">
                    <p className="text-sm font-semibold text-slate-700">Belum ada pengumuman.</p>
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
                        badgeStyle = "bg-rose-500/10 text-rose-600 border-rose-500/30";
                      } else if (badgeUpper === "IMPORTANT" || badgeUpper === "PERHATIAN") {
                        badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                      } else if (badgeUpper === "INFO") {
                        badgeStyle = "bg-teal-500/10 text-indigo-600 border-teal-500/30";
                      }

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-all shadow-sm space-y-2 ${
                            isActive ? "bg-slate-50 border-slate-200/80 hover:border-slate-200" : "bg-slate-50 border-slate-200 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-base text-slate-900">{item.title}</span>
                                {item.badge && (
                                  <Badge className={`text-xs font-bold border ${badgeStyle}`}>
                                    {item.badge}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-semibold ${
                                    isActive
                                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
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
                                className={`text-xs h-8 border-slate-200/80 ${
                                  isActive
                                    ? "bg-white text-slate-700 hover:bg-slate-100"
                                    : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                }`}
                              >
                                {isActive ? "Sembunyikan" : "Aktifkan"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditAnnModal(item)}
                                className="text-xs h-8 text-indigo-600 border-slate-200/80 bg-white hover:bg-slate-100 gap-1"
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
                                    className="text-xs h-8 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10"
                                    title="Hapus Pengumuman"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 p-4 sm:p-6">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-900">Hapus Pengumuman?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-500">
                                      Apakah Anda yakin ingin menghapus pengumuman "{item.title}"? Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200">Batal</AlertDialogCancel>
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

                          <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pt-2 border-t border-slate-100">
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
              <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 shadow-2xl p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-slate-900">{editingAnn ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</DialogTitle>
                  <DialogDescription className="text-slate-500">
                    {editingAnn ? "Perbarui isi atau status pengumuman resmi." : "Terbitkan pengumuman baru yang akan langsung muncul di dashboard pekerja."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveAnnouncement} className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="ann-title" className="text-xs text-slate-700">Judul Pengumuman *</Label>
                    <Input
                      id="ann-title"
                      placeholder="Contoh: Perubahan Harga Tier & Jam Operasional"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="ann-badge" className="text-xs text-slate-700">Label Badge (opsional)</Label>
                    <Input
                      id="ann-badge"
                      placeholder="Contoh: BARU, IMPORTANT, INFO, PENTING"
                      value={annBadge}
                      onChange={(e) => setAnnBadge(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Badge tampil sebagai tag warna di samping judul pengumuman.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="ann-content" className="text-xs text-slate-700">Isi Pengumuman *</Label>
                    <Textarea
                      id="ann-content"
                      rows={5}
                      placeholder="Tuliskan isi pengumuman secara lengkap di sini..."
                      value={annContent}
                      onChange={(e) => setAnnContent(e.target.value)}
                      className="mt-1 text-xs leading-relaxed bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700">Status Publikasi</Label>
                    <Select
                      value={annIsActive ? "ACTIVE" : "INACTIVE"}
                      onValueChange={(val) => setAnnIsActive(val === "ACTIVE")}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                        <SelectItem value="ACTIVE" className="text-xs font-semibold text-indigo-600">
                          Aktif (Langsung Tampil di Workers)
                        </SelectItem>
                        <SelectItem value="INACTIVE" className="text-xs font-semibold text-slate-500">
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
                      className="text-xs h-9 border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={annSaving}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500"
                    >
                      {annSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {editingAnn ? "Simpan Perubahan" : "Terbitkan Pengumuman"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* RINGKASAN / COMMAND CENTER */}
          <TabsContent value="overview" className="space-y-6">
            {/* ADMIN HERO WELCOME BANNER */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang, Admin!</h2>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
                    System Control
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  Pantau performa setoran email, tinjau penarikan worker, dan kelola operasional platform secara realtime.
                </p>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Operasional</p>
                <div className="flex items-center gap-2 mt-0.5 sm:justify-end">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-extrabold text-emerald-600">Sistem Berjalan Normal</span>
                </div>
              </div>
            </div>

            {/* SUMMARY STATISTIC CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              <Card className="bg-white border-slate-200/80 shadow-2xs p-4 rounded-xl hover:shadow-xs transition-shadow">
                <CardContent className="p-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Batch Review
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pendingSubmissions}</p>
                  <p className="text-[11px] text-amber-600 font-medium">Menunggu verifikasi</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-2xs p-4 rounded-xl hover:shadow-xs transition-shadow">
                <CardContent className="p-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <SearchCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Stok Email
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{stats.availableStock}</p>
                  <p className="text-[11px] text-indigo-600 font-medium">Siap dijual ke vendor</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-2xs p-4 rounded-xl hover:shadow-xs transition-shadow">
                <CardContent className="p-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Pekerja Aktif
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{stats.activeWorkers}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Total: {stats.totalWorkers} pekerja</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-2xs p-4 rounded-xl hover:shadow-xs transition-shadow">
                <CardContent className="p-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Penarikan Pending
                  </p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pendingWithdrawals}</p>
                  <p className="text-[11px] text-amber-600 font-medium truncate">{formatMoney(stats.pendingWithdrawalAmount)}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-2xs p-4 rounded-xl hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
                <CardContent className="p-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Total Saldo
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">{formatMoney(stats.totalBalance)}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Dompet seluruh pekerja</p>
                </CardContent>
              </Card>
            </div>

            {/* QUICK SERVICES / ADMIN SHORTCUTS GRID */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Layanan Cepat Admin
                </h3>
                <span className="text-xs text-slate-500">Pilih menu untuk verifikasi & pengelolaan</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {/* PROMINENT PESAN WORKER SHORTCUT CARD */}
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className="p-4 rounded-xl bg-white border border-indigo-200 shadow-2xs hover:shadow-md hover:border-indigo-400 transition-all text-left flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    {adminChatData.totalAdminUnread > 0 ? (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white animate-bounce shadow-2xs">
                        {adminChatData.totalAdminUnread} BARU
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                      Pesan Worker
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Chat langsung realtime dengan worker</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("submissions")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    {stats.pendingSubmissions > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                        {stats.pendingSubmissions} Batch
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Batch Review
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Verifikasi setoran email masal</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("withdrawals")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Wallet className="w-5 h-5" />
                    </div>
                    {stats.pendingWithdrawals > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        {stats.pendingWithdrawals} Req
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-amber-600 transition-colors">
                      Penarikan Saldo
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Persetujuan cashout DANA, OVO, dll</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("checker")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors w-fit">
                    <SearchCheck className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Screening Email
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Master riset & email checker</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("finance")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors w-fit">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Keuangan Platform
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Ledger profit vendor & komisi</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("workers")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors w-fit">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Kelola Worker
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Daftar anggota & status online</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("rewards")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors w-fit">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Rewards & Referral
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bonus klasemen & komisi referral</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("rules")}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col justify-between group"
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors w-fit">
                    <SettingsIcon className="w-5 h-5" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      Aturan & Operating
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Jam operasional & rate komisi</p>
                  </div>
                </button>
              </div>
            </div>

            {/* VISUAL ANALYTICS & TREND CHART CARD */}
            <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Grafik Tren Setoran & Verifikasi Gmail ACC (14 Hari Terakhir)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Membandingkan jumlah email yang disetor vs email terverifikasi ACC per hari.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-md font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Gmail ACC Valid
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/80 text-slate-500 rounded-md font-bold">
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
            <Card className={`border transition-all backdrop-blur-xl ${currentMaintEnabled ? "bg-amber-50/50 border-amber-500/80 ring-2 ring-amber-500/20" : "bg-white border-slate-200/80"}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl text-white font-bold ${currentMaintEnabled ? "bg-amber-500 animate-pulse" : "bg-slate-100 text-slate-600"}`}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          Mode Maintenance / Perbaikan Sistem Global
                          <Badge className={currentMaintEnabled ? "bg-amber-500 text-white font-bold" : "bg-slate-100 text-slate-600 border-slate-200"}>
                            {currentMaintEnabled ? "BERJALAN (AKTIF)" : "NONAKTIF"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Aktifkan untuk memblokir sementara dashboard pekerja dengan halaman maintenance resmi dan countdown timer real-time.
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setMaintEnabled(!currentMaintEnabled)}
                      className={currentMaintEnabled ? "bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs" : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500"}
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
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> Estimasi Waktu Selesai (Target Completion)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={currentMaintTargetTime}
                      onChange={(e) => setMaintTargetTime(e.target.value)}
                      className="text-xs h-9 font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500 font-semibold self-center mr-1">Quick Select:</span>
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
                          className="text-[11px] h-7 px-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200/80 text-slate-700"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOM MAINTENANCE MESSAGE */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">
                      Pesan Pengumuman Maintenance (Tampil untuk Worker)
                    </Label>
                    <Textarea
                      rows={3}
                      value={currentMaintMessage}
                      onChange={(e) => setMaintNoteMessage(e.target.value)}
                      placeholder="Contoh: Pembaruan sistem & server rilis versi baru..."
                      className="text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveMaintenance}
                    disabled={savingMaint}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500"
                  >
                    {savingMaint && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Simpan Mode Maintenance
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* MASTER RESET OPERASIONAL CARD */}
            <Card className="bg-rose-50/50 border-rose-500/40 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-rose-600 text-white font-bold">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          Master Reset Operasional Sistem
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Menghapus seluruh riwayat setoran email, penarikan saldo, dan log referral, serta mereset saldo & hitungan ACC seluruh worker menjadi 0. Akun user & konfigurasi sistem TIDAK terhapus.
                        </CardDescription>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setMasterResetModalOpen(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs h-9 gap-1.5 shadow-lg shadow-rose-600/20 shrink-0"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Master Reset Operasional
                  </Button>

                  <MasterResetModal
                    isOpen={masterResetModalOpen}
                    onClose={() => setMasterResetModalOpen(false)}
                  />
                </div>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* TAB KEUANGAN ADMIN */}
          <TabsContent value="finance" className="space-y-6">
            <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                      <DollarSign className="w-5 h-5 text-indigo-600" /> Keuangan
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Laporan pemasukan, pengeluaran, dan saldo bersih per periode bulanan ({formatMonthYear(selectedPeriod)}).
                    </CardDescription>
                  </div>

                  {/* FILTER PERIODE BULAN */}
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/80 shrink-0">
                    <Calendar className="w-4 h-4 text-indigo-600 ml-1" />
                    <Label className="text-xs font-semibold text-slate-700">Periode:</Label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="h-8 w-44 text-xs font-bold bg-white border-slate-200/80 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800">Harga Jual Vendor Per Email ACC:</span>
                    <p className="text-slate-500 text-[11px]">Digunakan untuk menghitung otomatis total estimasi Pemasukan kotor dari vendor.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 font-bold">Rp</span>
                    <FormattedNumberInput
                      value={vendorSalePrice}
                      onChange={(val) => handleSimVendorRateChange(val)}
                      className="w-28 h-8 text-xs font-bold bg-white border-slate-200/80 text-indigo-600 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* VENDOR PROFIT & PROJECTION SIMULATOR CARD */}
                <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl border-emerald-500/20">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                          <Sparkles className="w-5 h-5 text-indigo-600" />
                          Simulator Keuntungan & Proyeksi Profit Vendor
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">
                          Hitung estimasi pemasukan vendor, komisi pekerja, dan net profit admin berdasarkan rate dan volume harian.
                        </CardDescription>
                      </div>
                      <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold self-start sm:self-center">
                        Simulasi Real-time
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-4">
                    {/* INPUT CONTROL CONTROLS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                      {/* VENDOR RATE INPUT */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">
                          Vendor Rate per Email (Rp)
                        </Label>
                        <FormattedNumberInput
                          value={simVendorRate}
                          onChange={handleSimVendorRateChange}
                          className="h-9 text-xs font-bold bg-white border-slate-200/80 text-indigo-600 focus:border-emerald-500"
                        />
                        <div className="flex gap-1 pt-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold self-center mr-1">Preset:</span>
                          {[4000, 4500, 5000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSimVendorRateChange(preset)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                simVendorRate === preset
                                  ? "bg-indigo-50 text-indigo-600 border-indigo-200 font-bold"
                                  : "bg-white text-slate-500 border-slate-200/80 hover:text-slate-800"
                              }`}
                            >
                              Rp {preset.toLocaleString("id-ID")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* WORKER RATE INPUT */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">
                          Worker Rate Share per Email (Rp)
                        </Label>
                        <FormattedNumberInput
                          value={simWorkerRate}
                          onChange={(val) => setSimWorkerRate(val >= 0 ? val : 2800)}
                          className="h-9 text-xs font-bold bg-white border-slate-200/80 text-indigo-700 focus:border-emerald-500"
                        />
                        <div className="flex gap-1 pt-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold self-center mr-1">Preset:</span>
                          {[2800, 3000, 3500].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSimWorkerRate(preset)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                simWorkerRate === preset
                                  ? "bg-teal-500/20 text-indigo-700 border-teal-500/40 font-bold"
                                  : "bg-white text-slate-500 border-slate-200/80 hover:text-slate-800"
                              }`}
                            >
                              Rp {preset.toLocaleString("id-ID")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* DAILY VOLUME ACC INPUT */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">
                          Volume Setoran ACC / Hari (Email)
                        </Label>
                        <FormattedNumberInput
                          value={simDailyAccVolume}
                          onChange={(val) => setSimDailyAccVolume(val >= 0 ? val : 100)}
                          className="h-9 text-xs font-bold bg-white border-slate-200/80 text-slate-900 focus:border-emerald-500"
                        />
                        <div className="flex gap-1 pt-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold self-center mr-1">Preset:</span>
                          {[50, 100, 250, 500, 1000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSimDailyAccVolume(preset)}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                simDailyAccVolume === preset
                                  ? "bg-indigo-600 text-white border-slate-200 font-bold"
                                  : "bg-white text-slate-500 border-slate-200/80 hover:text-slate-800"
                              }`}
                            >
                              {preset} ACC
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* BREAKDOWN PER EMAIL ACC SUMMARY BANNER */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">Rincian Profit Margin Per Email ACC</span>
                          <p className="text-[11px] text-slate-500">Rate Vendor ({formatMoney(simVendorRate)}) - Komisi Worker ({formatMoney(simWorkerRate)})</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center px-3 py-1 bg-white rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-500 block font-medium">Worker Share</span>
                          <strong className="text-indigo-700 font-extrabold">{formatMoney(simWorkerRate)}</strong>
                        </div>
                        <span className="text-slate-600 font-mono text-sm">+</span>
                        <div className="text-center px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-200">
                          <span className="text-[10px] text-indigo-600 block font-medium">Admin Profit Share</span>
                          <strong className="text-indigo-600 font-extrabold">{formatMoney(simVendorRate - simWorkerRate)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* TIMEFRAME PROJECTION CARDS GRID (1 HARI, 7 HARI, 30 HARI, 365 HARI) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Estimasi Harian", period: "1 Hari", days: 1 },
                        { label: "Estimasi Mingguan", period: "7 Hari", days: 7 },
                        { label: "Estimasi Bulanan", period: "30 Hari", days: 30 },
                        { label: "Estimasi Tahunan", period: "365 Hari", days: 365 },
                      ].map((tf) => {
                        const accVolume = simDailyAccVolume * tf.days;
                        const vendorIncome = accVolume * simVendorRate;
                        const workerPayout = accVolume * simWorkerRate;
                        const netProfit = accVolume * (simVendorRate - simWorkerRate);

                        return (
                          <div
                            key={tf.period}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80/90 hover:border-slate-200 transition-all space-y-3"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                              <div>
                                <span className="font-bold text-xs text-slate-800">{tf.label}</span>
                                <span className="text-[11px] text-slate-500 block font-mono">({tf.period})</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] bg-white text-slate-700 border-slate-200/80 font-mono">
                                {accVolume.toLocaleString("id-ID")} ACC
                              </Badge>
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Pemasukan Vendor:</span>
                                <span className="font-semibold text-slate-800">{formatMoney(vendorIncome)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Payout Worker:</span>
                                <span className="font-semibold text-rose-700">{formatMoney(workerPayout)}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 block mb-0.5">
                                Admin Net Profit
                              </span>
                              <span className="text-lg font-black text-indigo-600">
                                {formatMoney(netProfit)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* RINGKASAN AUTOMATED FINANCIAL LEDGER CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* PEMASUKAN CARD */}
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600">Total Pemasukan (Income)</span>
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-black text-indigo-600">{formatMoney(automatedFinSummary.totalIncome)}</p>
                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-emerald-500/20">
                      <div className="flex justify-between">
                        <span>Vendor Email ({automatedFinSummary.periodApprovedAccs} ACC @ {formatMoney(vendorSalePrice)}):</span>
                        <strong className="text-indigo-700">{formatMoney(automatedFinSummary.vendorEmailIncome)}</strong>
                      </div>
                      {automatedFinSummary.manualIncome > 0 && (
                        <div className="flex justify-between">
                          <span>Pemasukan Manual:</span>
                          <strong className="text-indigo-700">{formatMoney(automatedFinSummary.manualIncome)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PENGELUARAN CARD */}
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-rose-600">Total Pengeluaran (Expense)</span>
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-black text-rose-600">{formatMoney(automatedFinSummary.totalExpense)}</p>
                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-rose-500/20">
                      <div className="flex justify-between">
                        <span>Komisi Worker ACC:</span>
                        <strong className="text-rose-700">{formatMoney(automatedFinSummary.periodWorkerCommissions)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Hadiah & Bonus (Leaderboard/Referral):</span>
                        <strong className="text-rose-700">{formatMoney(automatedFinSummary.periodRewardsExpense)}</strong>
                      </div>
                      {automatedFinSummary.manualExpense > 0 && (
                        <div className="flex justify-between">
                          <span>Pengeluaran Manual:</span>
                          <strong className="text-rose-700">{formatMoney(automatedFinSummary.manualExpense)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-rose-500/10 text-slate-500">
                        <span>Penarikan Worker (Informasional):</span>
                        <span className="font-mono">{formatMoney(automatedFinSummary.periodWithdrawalsExpense)}</span>
                      </div>
                    </div>
                  </div>

                  {/* SALDO BERSIH CARD */}
                  <div className={`p-4 rounded-xl border space-y-2 flex flex-col justify-between ${automatedFinSummary.netBalance >= 0 ? "bg-teal-950/30 border-teal-500/30 text-indigo-700" : "bg-rose-50 border-rose-500/40 text-rose-700"}`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">Saldo Bersih (Net Balance)</span>
                        <Wallet className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className={`text-2xl font-black ${automatedFinSummary.netBalance >= 0 ? "text-indigo-700" : "text-rose-600"}`}>
                        {formatMoney(automatedFinSummary.netBalance)}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                      Auto-calculated: Pemasukan - Pengeluaran ({formatMonthYear(selectedPeriod)})
                    </p>
                  </div>
                </div>

                {/* SEARCH FILTER & ACTION BUTTONS: CATAT PEMASUKAN & PENGELUARAN */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <Input
                      placeholder="Cari transaksi manual..."
                      value={finSearch}
                      onChange={(e) => setFinSearch(e.target.value)}
                      className="h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => openAddFinModal("income")}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500"
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
                {finLoading && <p className="text-sm text-slate-500 text-center py-8">Memuat laporan keuangan...</p>}
                {finError && (
                  <div className="p-6 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs text-center rounded-lg">
                    Gagal memuat laporan keuangan. Silakan coba lagi.
                  </div>
                )}
                {!finLoading && !finError && filteredFinTransactions.length === 0 && (
                  <div className="p-10 border border-dashed border-slate-200/80 text-center rounded-xl bg-slate-50 space-y-1">
                    <p className="text-sm font-semibold text-slate-700">Belum ada transaksi manual pada periode ini.</p>
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
                          className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3 hover:border-slate-200 transition-colors shadow-sm"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 break-words">{tx.description}</span>
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-semibold ${
                                  isIncome
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                                    : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                }`}
                              >
                                {isIncome ? "Pemasukan" : "Pengeluaran"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                              <span>Tanggal: {formatDate(tx.transactionDate)}</span>
                              {tx.note && <span className="italic truncate max-w-xs font-sans text-slate-500">Catatan: {tx.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-base font-black ${isIncome ? "text-indigo-600" : "text-rose-600"}`}>
                              {isIncome ? "+" : "-"} {formatMoney(tx.amount)}
                            </span>

                            <div className="flex items-center gap-1 border-l border-slate-200/80 pl-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditFinModal(tx)}
                                className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
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
                                    className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 p-4 sm:p-6">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-900">Hapus Transaksi Keuangan?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-500">
                                      Apakah Anda yakin ingin menghapus transaksi "{tx.description}" ({formatMoney(tx.amount)})?
                                      Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200">Batal</AlertDialogCancel>
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
              <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 shadow-2xl p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-slate-900">
                    {editingFinTx ? "Edit Transaksi Keuangan" : finType === "income" ? "Catat Pemasukan" : "Catat Pengeluaran"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500">
                    {editingFinTx ? "Perbarui detail transaksi keuangan." : "Masukkan detail transaksi keuangan untuk laporan bulanan."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveFinTransaction} className="space-y-4 pt-2">
                  <div>
                    <Label className="text-xs text-slate-700">Tipe Transaksi</Label>
                    <Select
                      value={finType}
                      onValueChange={(val: FinancialTransactionType) => setFinType(val)}
                    >
                      <SelectTrigger className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                        <SelectItem value="income" className="text-xs font-semibold text-indigo-600">
                          Pemasukan (+)
                        </SelectItem>
                        <SelectItem value="expense" className="text-xs font-semibold text-rose-600">
                          Pengeluaran (-)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fin-desc" className="text-xs text-slate-700">Jenis / Keterangan Transaksi *</Label>
                    <Input
                      id="fin-desc"
                      placeholder={finType === "income" ? "Contoh: Penjualan Storage Gmail" : "Contoh: Pembayaran Worker / Biaya Operasional"}
                      value={finDescription}
                      onChange={(e) => setFinDescription(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-amount" className="text-xs text-slate-700">Jumlah Nominal (Rp) *</Label>
                    <FormattedNumberInput
                      id="fin-amount"
                      value={finAmount}
                      onChange={(val) => setFinAmount(val)}
                      placeholder="Contoh: 500.000"
                      className="mt-1 h-9 text-xs font-bold bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="fin-date" className="text-xs text-slate-700">Tanggal Transaksi *</Label>
                    <Input
                      id="fin-date"
                      type="date"
                      value={finDate}
                      onChange={(e) => setFinDate(e.target.value)}
                      className="mt-1 h-9 text-xs font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      Periode otomatis ditentukan berdasarkan tanggal ({getMonthlyPeriodKey(finDate)}).
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="fin-note" className="text-xs text-slate-700">Catatan Tambahan (opsional)</Label>
                    <Input
                      id="fin-note"
                      placeholder="Contoh: Pembayaran customer via DANA / Invoice #102"
                      value={finNote}
                      onChange={(e) => setFinNote(e.target.value)}
                      className="mt-1 h-9 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFinModalOpen(false)}
                      className="text-xs h-9 border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={finSaving}
                      className={`${finType === "income" ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/20" : "bg-rose-600 hover:bg-rose-500 text-white"} font-bold text-xs h-9 gap-1.5 shadow-lg`}
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
          <TabsContent value="submissions" className="space-y-3 sm:space-y-4 w-full max-w-full overflow-x-hidden box-border">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full max-w-full">
              <Input
                placeholder="Cari email, ID pekerja, atau nama..."
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                className="text-xs min-h-[44px] flex-1 bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500 w-full"
              />
              <Select value={submissionStatusFilter} onValueChange={setSubmissionStatusFilter}>
                <SelectTrigger className="min-h-[44px] w-full sm:w-44 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                  <SelectItem value="available">Stok Tersedia / Terjual</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submissions.loading && <p className="text-sm text-slate-500 text-center py-8">Memuat…</p>}
            {!submissions.loading && filteredSubmissions.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Tidak ada data setoran / batch email.</p>
            )}
            {filteredSubmissions.map((item) => {
              const count = getItemCountOfSubmission(item);
              const workerObj = getWorkerObj(item.workerId, (item as any).workerEmail || (item as any).userEmail, item.workerName);
              const workerRegisteredEmail = workerObj?.email || (item as any).workerEmail || (item as any).userEmail;
              const subName = item.workerName || workerObj?.name;

              let displayWorkerName = workerRegisteredEmail || subName || shortId(item.workerId);
              if (subName && workerRegisteredEmail && subName.toLowerCase() !== workerRegisteredEmail.toLowerCase()) {
                displayWorkerName = `${subName} • ${workerRegisteredEmail}`;
              }

              const isFinalized = item.status !== "pending";
              const approvedCount = item.approvedItemCount ?? (item.status === "available" || item.status === "approved" || item.status === "sold" ? count : 0);
              const rejectedCount = item.rejectedItemCount ?? (item.status === "rejected" ? count : 0);

              const tierNum = item.appliedTier ?? item.currentTier ?? workerObj?.tier ?? 1;
              const tierCfg = getTierConfig(tierNum, activeTiersList);
              const pricePerItem = item.appliedPricePerItem ?? item.currentPricePerItem ?? tierCfg.pricePerItem;
              const totalVal = item.totalAmount ?? (approvedCount * pricePerItem);

              return (
                <Card key={item.id} className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-md hover:border-slate-200 transition-all w-full max-w-full overflow-x-hidden box-border">
                  <CardContent className="p-3 sm:p-5 space-y-3 w-full max-w-full overflow-x-hidden box-border">
                    {/* Top Row: Worker Name + Status Badge & ID/Date */}
                    <div className="flex items-start justify-between gap-2 w-full max-w-full">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-sm sm:text-base text-slate-900 truncate max-w-[180px] sm:max-w-xs">{displayWorkerName}</p>
                          {isFinalized && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-600 border-indigo-200 shrink-0">
                              {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-mono truncate mt-0.5">
                          #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    {/* Middle Info & Tier Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs w-full max-w-full">
                      {isFinalized ? (
                        <div className="text-xs text-slate-700 font-medium flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span>Disetujui: <strong className="text-indigo-600">{approvedCount}</strong>/{count}</span>
                          <span>·</span>
                          <span>Ditolak: <strong className="text-rose-600">{rejectedCount}</strong></span>
                          <span>·</span>
                          <span>Payout: <strong className="text-indigo-700 font-bold">{formatMoney(totalVal)}</strong></span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between w-full">
                          <p className="text-xs text-slate-700 font-medium">
                            <strong>{count} email disetorkan</strong> · Estimasi: <span className="text-indigo-600 font-bold">{formatMoney(item.totalAmount ?? (count * pricePerItem))}</span>
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-slate-500 font-medium">Tier Batch:</span>
                            <Select
                              disabled={busyId === item.id}
                              value={String(tierNum)}
                              onValueChange={(val) => handleBatchTierChange(item.id, val)}
                            >
                              <SelectTrigger className="min-h-[44px] text-xs bg-slate-50 border-indigo-200 text-indigo-600 font-bold w-full sm:w-[150px]">
                                <SelectValue placeholder="Pilih Tier" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                                {activeTiersList.map((t) => (
                                  <SelectItem key={t.tier} value={String(t.tier)} className="text-xs font-medium">
                                    {t.name} ({formatMoney(t.pricePerItem)}/item)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 w-full max-w-full">
                      {item.status !== "pending" ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="shrink-0">Stok:</span>
                          {(item.status === "available" || item.status === "approved") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === item.id}
                              onClick={() => handleStockStatusChange(item.id, "sold")}
                              className="min-h-[44px] text-xs bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                            >
                              Tandai Terjual
                            </Button>
                          )}
                          {item.status === "sold" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === item.id}
                              onClick={() => handleStockStatusChange(item.id, "available")}
                              className="min-h-[44px] text-xs bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                            >
                              Kembalikan ke Stok
                            </Button>
                          )}
                          {item.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === item.id}
                              onClick={() => handleStockStatusChange(item.id, "rejected")}
                              className="min-h-[44px] text-xs text-rose-600 hover:bg-rose-500/10"
                            >
                              Tolak Stok
                            </Button>
                          )}
                        </div>
                      ) : <div />}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetailModal(item)}
                        className="min-h-[44px] text-xs font-bold gap-1.5 border-indigo-200 bg-indigo-50 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 w-full sm:w-auto shrink-0"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        {item.status === "pending" ? "Tinjau Per Email" : "Lihat Detail Batch"}
                      </Button>
                    </div>

                    {item.reviewNote && <p className="text-xs text-slate-500 mt-1 italic">Catatan: {item.reviewNote}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* KELOLA PENARIKAN */}
          <TabsContent value="withdrawals" className="space-y-3">
            {/* ONE-TIME HISTORICAL RECONCILIATION FOR NABIL ALFIANSYAH */}
            <Card className="bg-amber-50/50 border-amber-500/40 backdrop-blur-xl text-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      Rekonsiliasi Penarikan Terdahulu (Nabil Alfiansyah)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600">
                      Penarikan Rp3.000 (18 Sep 2026) yang sudah diproses 'Berhasil' tetapi belum terpotong saldonya pada sistem lama.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    disabled={reconcilingNabil}
                    onClick={handleReconcileNabil}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 gap-1.5 shadow-md shrink-0"
                  >
                    {reconcilingNabil && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Jalankan Rekonsiliasi Nabil (Rp3.000)
                  </Button>
                </div>
              </CardHeader>
            </Card>
            {withdrawals.loading && <p className="text-sm text-slate-500 text-center py-8">Memuat…</p>}
            {!withdrawals.loading && withdrawals.data.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada penarikan.</p>
            )}
            {withdrawals.data.map((item) => {
              const holderName = item.accountHolderName ?? item.accountName ?? "Belum tersedia";
              return (
                <Card key={item.id} className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-md">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-bold text-base text-slate-900">{item.method}</p>
                        <div className="text-xs text-slate-700 mt-1 space-y-0.5">
                          <p>Pekerja: <strong className="text-slate-900">{workerName(item.workerId)}</strong></p>
                          <p>No. Rekening / Wallet: <strong className="text-slate-900 font-mono">{item.account}</strong></p>
                          <p>Atas Nama: <strong className="text-slate-900">{holderName}</strong></p>
                          <p>Jumlah: <strong className="text-indigo-600 font-bold">{formatMoney(item.amount)}</strong></p>
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
                        className="text-xs h-9 min-w-[140px] flex-1 bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
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
                        className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-1 shrink-0 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
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
                  {item.note && <p className="text-xs text-slate-500 mt-2 italic">Catatan: {item.note}</p>}
                </CardContent>
              </Card>
              );
            })}
          </TabsContent>

          {/* KELOLA PEKERJA (WITH TIER & RECOMMENDATIONS) */}
          <TabsContent value="workers" className="space-y-3">
            {/* REALTIME REGISTERED WORKERS COUNTER CARD */}
            <Card className="bg-white border border-slate-200/80 shadow-2xs text-slate-900">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-lg shadow-emerald-500/10">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Registered Workers</p>
                      <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-extrabold gap-1.5 px-2 py-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        REALTIME LIVE
                      </Badge>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                      {users.data.filter((u) => u.role !== "admin").length}{" "}
                      <span className="text-xs font-semibold text-slate-500 font-sans">Worker Terdaftar</span>
                    </p>
                  </div>
                </div>

                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500 text-xs h-9">
                      <UserPlus className="w-4 h-4" /> Tambah Pekerja
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 shadow-2xl p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="text-slate-900">Tambah Pekerja Baru</DialogTitle>
                      <DialogDescription className="text-slate-500">Akun akan langsung berstatus aktif.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddWorker} className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-700">Nama</Label>
                        <Input
                          value={newWorker.name}
                          onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))}
                          className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Email</Label>
                        <Input
                          type="email"
                          value={newWorker.email}
                          onChange={(e) => setNewWorker((p) => ({ ...p, email: e.target.value }))}
                          className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Nomor HP (opsional)</Label>
                        <Input
                          value={newWorker.phone}
                          onChange={(e) => setNewWorker((p) => ({ ...p, phone: e.target.value }))}
                          className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-700">Kata Sandi</Label>
                          <Input
                            type="password"
                            value={newWorker.password}
                            onChange={(e) => setNewWorker((p) => ({ ...p, password: e.target.value }))}
                            className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-700">Tier Awal</Label>
                          <Select value={newWorker.tier} onValueChange={(v) => setNewWorker((p) => ({ ...p, tier: v }))}>
                            <SelectTrigger className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                        <Button type="submit" disabled={addBusy} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 w-full hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20">
                          {addBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                          Buat Akun
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <div className="hidden">
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500">
                    <UserPlus className="w-4 h-4" /> Tambah Pekerja
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-slate-200/80 text-slate-900 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-900">Tambah Pekerja Baru</DialogTitle>
                    <DialogDescription className="text-slate-500">Akun akan langsung berstatus aktif.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddWorker} className="space-y-3">
                    <div>
                      <Label className="text-xs text-slate-700">Nama</Label>
                      <Input
                        value={newWorker.name}
                        onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-700">Email</Label>
                      <Input
                        type="email"
                        value={newWorker.email}
                        onChange={(e) => setNewWorker((p) => ({ ...p, email: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-700">Nomor HP (opsional)</Label>
                      <Input
                        value={newWorker.phone}
                        onChange={(e) => setNewWorker((p) => ({ ...p, phone: e.target.value }))}
                        className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-700">Kata Sandi</Label>
                        <Input
                          type="password"
                          value={newWorker.password}
                          onChange={(e) => setNewWorker((p) => ({ ...p, password: e.target.value }))}
                          className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Tier Awal</Label>
                        <Select value={newWorker.tier} onValueChange={(v) => setNewWorker((p) => ({ ...p, tier: v }))}>
                          <SelectTrigger className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                      <Button type="submit" disabled={addBusy} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 w-full hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20">
                        {addBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buat Akun
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {users.loading && <p className="text-sm text-slate-500 text-center py-8">Memuat…</p>}
            {users.data
              .filter((u) => u.role !== "admin")
              .map((u) => {
                const currentTierCfg = getTierConfig(u.tier ?? 1, activeTiersList);
                const approvedCount = workerApprovedQtyMap.get(u.uid) ?? 0;
                const recTierCfg = getRecommendedTier(approvedCount, activeTiersList);
                const needsTierChange = Number(recTierCfg.tier) !== Number(currentTierCfg.tier);

                return (
                  <Card key={u.uid} className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-md">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-slate-900">{u.name}</p>
                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">
                              {currentTierCfg.name} ({formatMoney(currentTierCfg.pricePerItem)}/item)
                            </Badge>
                            <OnlineStatusBadge lastActiveAt={u.lastActiveAt} />
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                          <div className="flex gap-3 text-xs text-slate-700 mt-1">
                            <span>Total Item Disetujui: <strong>{approvedCount} item</strong></span>
                            <span>Saldo: <strong className="text-indigo-600">{formatMoney(u.balance ?? 0)}</strong></span>
                          </div>
                        </div>
                        <StatusBadge status={u.status} />
                      </div>

                      {/* Tier Recommendation Notice */}
                      {needsTierChange && (
                        <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs text-indigo-700">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>
                              Rekomendasi Tier: <strong>{recTierCfg.name}</strong> ({formatMoney(recTierCfg.pricePerItem)}/item) berdasarkan {approvedCount} item disetujui.
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUserTier(u.uid, recTierCfg.tier)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-7 text-[11px] shrink-0"
                          >
                            Terapkan {recTierCfg.name}
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <span>Set Tier Manual:</span>
                          <Select value={String(u.tier)} onValueChange={(v) => handleUserTier(u.uid, Number(v))}>
                            <SelectTrigger className="h-8 w-36 text-xs bg-slate-50 border-slate-200/80 text-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                            <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-8">
                              Setujui
                            </Button>
                            <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "rejected")} className="bg-rose-600 hover:bg-rose-500 text-white font-bold h-8">
                              Tolak
                            </Button>
                          </>
                        )}
                        {(u.status === "approved" || u.status === "active") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "inactive")} className="h-8 border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100">
                            Nonaktifkan
                          </Button>
                        )}
                        {(u.status === "inactive" || u.status === "rejected") && (
                          <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "active")} className="h-8 border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100">
                            Aktifkan
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 gap-1 ml-auto">
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 p-4 sm:p-6">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-slate-900">Hapus data pekerja ini?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500">
                                Ini menghapus profil "{u.name}" dari Firestore.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200">Batal</AlertDialogCancel>
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
            <Card className="border-slate-200/80 bg-white backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader className="pb-4 border-b border-slate-200/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      Manajemen Leaderboard & Otomatisasi Payout Reward
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Hitung real-time top pekerja berdasarkan email ACC terverifikasi dan cairkan bonus Juara 1, 2, 3 langsung ke Wallet Balance pekerja.
                    </CardDescription>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
                    {/* WEEKLY PERIOD SELECTOR */}
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/80">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <Select value={selectedWeeklyPeriod} onValueChange={setSelectedWeeklyPeriod}>
                        <SelectTrigger className="h-7 border-0 bg-transparent text-xs font-bold text-amber-300 focus:ring-0 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                          {weeklyPeriodOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* CAIRCAN REWARD KLASEMEN MINGGUAN BUTTON */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={
                            isCurrentWeeklyPeriodActive ||
                            distributingLeaderboard ||
                            currentLeaderboardStandings.length === 0 ||
                            currentLeaderboardStandings.slice(0, 3).every((w) => {
                              const minReq = w.rank === 1 ? 200 : w.rank === 2 ? 100 : 50;
                              return w.validAccCount < minReq || paidLeaderboardSet.has(`${selectedWeeklyTimeframe.value}_rank${w.rank}_${w.workerId}`);
                            })
                          }
                          className={
                            isCurrentWeeklyPeriodActive
                              ? "bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs h-9 gap-1.5 cursor-not-allowed opacity-60"
                              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-amber-500/20"
                          }
                        >
                          {distributingLeaderboard ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Gift className="w-4 h-4" />
                          )}
                          {isCurrentWeeklyPeriodActive
                            ? "Periode Berjalan (Disabled)"
                            : "Cairkan Reward Klasemen Mingguan"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 p-4 sm:p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-amber-400 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Cairkan Reward Klasemen Mingguan ({selectedWeeklyTimeframe.value})?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-700 text-xs leading-relaxed">
                            Tindakan ini akan memverifikasi pengerjaan Top 3, mentransfer bonus secara otomatis ke Saldo Utama (balance) pemenang yang memenuhi syarat minimal ACC (Juara 1: 200, Juara 2: 100, Juara 3: 50 ACC), dan menandai status <strong className="text-amber-300">isPaid: true</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2 space-y-2 text-xs border-y border-slate-200/80 my-2">
                          <p className="font-bold text-slate-800">Daftar Calon Penerima Reward Qualified:</p>
                          {currentLeaderboardStandings.slice(0, 3).map((w) => {
                            const minReq = w.rank === 1 ? 200 : w.rank === 2 ? 100 : 50;
                            const isQualified = w.validAccCount >= minReq;
                            const isAlreadyPaid = paidLeaderboardSet.has(`${selectedWeeklyTimeframe.value}_rank${w.rank}_${w.workerId}`);
                            const rewardAmt = w.rewardAmount || (w.rank === 1 ? 50000 : w.rank === 2 ? 30000 : 15000);

                            return (
                              <div key={w.workerId} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                                <div>
                                  <p className="font-bold text-slate-900">Juara #{w.rank}: {w.workerName}</p>
                                  <p className="text-[11px] text-slate-500">Pengerjaan: {w.validAccCount} / {minReq} ACC</p>
                                </div>
                                <div className="text-right">
                                  {isAlreadyPaid ? (
                                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                      Sudah Dicairkan
                                    </Badge>
                                  ) : isQualified ? (
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                                      Lulus (+{formatMoney(rewardAmt)})
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                                      Belum Lulus Target ({w.validAccCount}/{minReq} ACC)
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200">Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDistributeLeaderboardRewards}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold"
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
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-bold text-slate-800 block">
                      Klasemen Pemenang ({selectedWeeklyTimeframe.label}):
                    </Label>
                    {isCurrentWeeklyPeriodActive && (
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        Periode Sedang Berjalan
                      </Badge>
                    )}
                  </div>
                  {currentLeaderboardStandings.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200/80 rounded-xl bg-slate-50">
                      Belum ada email ACC terverifikasi pada periode ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {currentLeaderboardStandings.slice(0, 3).map((item) => {
                        const payoutKey = `${selectedWeeklyTimeframe.value}_rank${item.rank}_${item.workerId}`;
                        const isPaid = paidLeaderboardSet.has(payoutKey);
                        const isPaying = payingIndividualWorkerId === item.workerId;
                        const minReq = item.rank === 1 ? 200 : item.rank === 2 ? 100 : 50;
                        const isQualified = item.validAccCount >= minReq;
                        const rewardAmt = item.rewardAmount || (item.rank === 1 ? 50000 : item.rank === 2 ? 30000 : 15000);

                        const userProgress = getLeaderboardUserProgress(item.validAccCount, item.rank);

                        let badgeLabel = "Target Juara #3";
                        let badgeStyle = "bg-slate-100 text-slate-600 border border-slate-200";
                        let targetAcc = userProgress.nextTarget;

                        if (item.validAccCount >= 200) {
                          badgeLabel = "Juara #1";
                          badgeStyle = "bg-amber-500 text-white";
                          targetAcc = 200;
                        } else if (item.validAccCount >= 100) {
                          badgeLabel = "Juara #2";
                          badgeStyle = "bg-slate-100 text-slate-700";
                          targetAcc = 100;
                        } else if (item.validAccCount >= 50) {
                          badgeLabel = "Juara #3";
                          badgeStyle = "bg-amber-900 text-amber-200";
                          targetAcc = 50;
                        }

                        let bonusText = "";
                        if (isQualified) {
                          bonusText = formatMoney(rewardAmt);
                        } else if (item.validAccCount < 50) {
                          bonusText = "Belum Lulus Target Juara 3 (Min 50 ACC)";
                        } else {
                          bonusText = `Belum Lulus Target (Min ${minReq} ACC)`;
                        }

                        return (
                          <div
                            key={item.workerId}
                            className={`p-3.5 rounded-xl border text-left bg-slate-50 shadow-sm space-y-2 flex flex-col justify-between ${
                              item.rank === 1 ? "border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/5" : "border-slate-200/80"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Badge
                                  className={`text-[10px] font-extrabold ${badgeStyle}`}
                                >
                                  {badgeLabel}
                                </Badge>
                                <span className="text-[11px] font-mono text-slate-500">{item.maskedName}</span>
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{item.workerName}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-amber-400 font-bold">{item.validAccCount} / {targetAcc} ACC Valid</p>
                                  <Badge className={isQualified ? "bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold" : "bg-slate-100 text-amber-400/80 border-amber-800/60 text-[10px]"}>
                                    {isQualified ? "Terkualifikasi" : "Belum Terkualifikasi"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-xs">
                                <span className="text-slate-500">Bonus Hadiah:</span>
                                <span className={isQualified ? "font-black text-amber-400" : "font-semibold text-slate-500 text-[11px]"}>
                                  {bonusText}
                                </span>
                              </div>
                            </div>

                            <div className="pt-1">
                              {isPaid ? (
                                <Button
                                  disabled
                                  size="sm"
                                  variant="outline"
                                  className="w-full text-xs h-8 bg-white border-slate-200/80 text-amber-300 font-bold gap-1 opacity-80 cursor-not-allowed"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Sudah Dicairkan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={isCurrentWeeklyPeriodActive || isPaying || !isQualified}
                                  onClick={() => handleCairkanIndividualReward(item)}
                                  className="w-full text-xs h-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-md shadow-amber-500/10 gap-1"
                                >
                                  {isPaying ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Gift className="w-3.5 h-3.5" />
                                  )}
                                  {isCurrentWeeklyPeriodActive ? "Periode Berjalan" : "Cairkan Reward"}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIWAYAT PAYOUT LEADERBOARD HISTORICAL TABLE & MOBILE CARDS */}
                <div className="pt-2 border-t border-slate-200/80">
                  <Label className="text-xs font-bold text-slate-800 mb-2 block">
                    Riwayat Pencairan Hadiah Leaderboard ({leaderboardPayouts?.data?.length || 0})
                  </Label>
                  {(!leaderboardPayouts?.data || leaderboardPayouts.data.length === 0) ? (
                    <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200/80 rounded-lg">
                      Belum ada pencairan hadiah leaderboard sebelumnya.
                    </p>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden sm:block border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 max-h-60 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-white border-b border-slate-200/80 text-slate-500 font-semibold sticky top-0 backdrop-blur-md">
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
                              <tr key={payout.id} className="hover:bg-slate-100/40 transition-colors">
                                <td className="px-3 py-2 font-mono text-slate-500">{formatDateTime(payout.paidAt)}</td>
                                <td className="px-3 py-2 font-bold text-slate-800">{payout.periodKey}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold text-[10px]">
                                    Juara #{payout.rank}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-800">{payout.workerName || workerName(payout.workerId)}</td>
                                <td className="px-3 py-2 font-black text-amber-400 text-right">{formatMoney(payout.rewardAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-2 max-h-64 overflow-y-auto">
                        {leaderboardPayouts.data.map((payout) => (
                          <div
                            key={payout.id}
                            className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{payout.workerName || workerName(payout.workerId)}</span>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold text-[10px]">
                                Juara #{payout.rank}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>Periode: <strong className="text-slate-800">{payout.periodKey}</strong></span>
                              <span className="font-black text-amber-400 text-sm">{formatMoney(payout.rewardAmount)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200/80/60">
                              Cair: {formatDateTime(payout.paidAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* PENDING MISSION CLAIMS REVIEW */}
            {pendingMissionClaims.length > 0 && (
              <Card className="border-indigo-200 bg-indigo-50/50 backdrop-blur-xl text-slate-900">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <Target className="w-5 h-5 text-indigo-600" /> Klaim Misi Menunggu Review ({pendingMissionClaims.length})
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Pekerja mengajukan klaim misi. Verifikasi dan setujui untuk mencairkan saldo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingMissionClaims.map((claim) => (
                    <div key={claim.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{claim.workerName || workerName(claim.workerId)}</p>
                        <p className="text-slate-500 mt-0.5">Misi ID: {claim.missionId} · Periode: {claim.periodKey}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={busyId === claim.id}
                          onClick={() => handleReviewMission(claim.id, "approved")}
                          className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-8 gap-1 hover:from-indigo-500 hover:to-blue-500"
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
            <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <Users className="w-5 h-5 text-indigo-600" /> Pengaturan & Data Referral
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Atur nominal komisi referral per email ACC dan lihat daftar hubungan tim referral.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleEvaluateReferrals}
                    disabled={evaluatingRefs}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs gap-1.5 shrink-0 hover:from-indigo-500 hover:to-blue-500"
                  >
                    {evaluatingRefs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Evaluasi Referral
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* FLAT REFERRAL COMMISSION CONFIGURATION */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div>
                    <Label className="text-sm font-bold text-slate-800">
                      Nominal Komisi Pasif Income Flat (Rp / Email ACC)
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Komisi otomatis per 1 email ACC yang diselesaikan oleh downline yang akan dikreditkan ke Saldo Utama pengundang.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <span className="text-xs font-bold text-slate-500">Rp</span>
                      <FormattedNumberInput
                        value={currentRefCommission}
                        onChange={(val) => setRefCommission(val)}
                        placeholder="200"
                        className="h-9 text-xs font-bold bg-white border-slate-200/80 text-indigo-600 focus:border-emerald-500"
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={savingRefCommission}
                      onClick={handleSaveRefCommission}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500 shrink-0"
                    >
                      {savingRefCommission && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Komisi Flat
                    </Button>
                  </div>
                </div>

                {/* TABLE DAFTAR REFERRAL DATA */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-bold text-slate-800">
                      Daftar Hubungan Referral ({referrals.data.length})
                    </Label>
                  </div>

                  {referrals.data.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200/80 rounded-lg">
                      Belum ada data pendaftaran referral.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {referrals.data.map((ref) => {
                        const currentAcc = ref.currentAccCount ?? 0;

                        const isPaid = ref.status === "PAID" || ref.status === "REWARDED";
                        const isQualified = ref.status === "QUALIFIED";
                        const isRejected = ref.status === "REJECTED";

                        let statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                        let statusText = "PENDING";

                        if (isPaid) {
                          statusBadgeClass = "bg-indigo-50 text-indigo-600 border-indigo-200";
                          statusText = "PAID";
                        } else if (isQualified) {
                          statusBadgeClass = "bg-sky-500/10 text-sky-400 border-sky-500/30";
                          statusText = "QUALIFIED";
                        } else if (isRejected) {
                          statusBadgeClass = "bg-rose-500/10 text-rose-600 border-rose-500/30";
                          statusText = "REJECTED";
                        }

                        return (
                          <div key={ref.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-800">
                                  Pengundang: <span className="text-indigo-600">{ref.referrerName || workerName(ref.referrerId)}</span> ({shortId(ref.referrerId)})
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="font-bold text-slate-800">
                                  Yang Diundang: <span className="text-indigo-700">{ref.referredWorkerName || workerName(ref.referredWorkerId)}</span> ({shortId(ref.referredWorkerId)})
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-slate-500 font-medium">
                                <span>Total Email ACC: <strong className="text-slate-900">{currentAcc}</strong></span>
                                <span>Total Komisi Dicairkan: <strong className="text-indigo-600">{formatMoney(ref.rewardAmount ?? (currentAcc * (rules.data.referralCommissionPerAcc || 100)))}</strong></span>
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

            {/* AUDIT LEDGER HADIAH */}
            <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">Audit Ledger Payout Hadiah</CardTitle>
                <CardDescription className="text-slate-500">
                  Rekam jejak seluruh pencairan hadiah (referral, misi, klasemen) yang transparan dan dapat diaudit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rewardLedger.data.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6">Belum ada transaksi pencairan hadiah.</p>
                )}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {rewardLedger.data.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{log.workerName || workerName(log.workerId)}</p>
                        <p className="text-slate-500 mt-0.5">{log.description}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{formatDateTime(log.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 font-bold">
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
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-900">Konfigurasi Tier Pekerja</CardTitle>
                      <CardDescription className="text-slate-500">
                        Atur rentang jumlah item dan harga per item untuk tiap tier. Sistem akan memberikan rekomendasi otomatis ke admin.
                      </CardDescription>
                    </div>
                    <Button onClick={handleAddTierConfig} variant="outline" className="gap-1 text-xs border-slate-200/80 bg-slate-50 text-indigo-600 hover:bg-slate-100">
                      <Plus className="w-3.5 h-3.5" /> Tambah Tier
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeTiers.map((t, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                      <div>
                        <Label className="text-xs text-slate-700">Nama Tier</Label>
                        <Input
                          value={t.name}
                          onChange={(e) => handleUpdateTierConfig(idx, "name", e.target.value)}
                          className="mt-1 h-8 text-xs bg-white border-slate-200/80 text-slate-900"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Min. Qty</Label>
                        <Input
                          type="number"
                          value={t.minQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "minQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs bg-white border-slate-200/80 text-slate-900"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Max. Qty</Label>
                        <Input
                          type="number"
                          value={t.maxQty}
                          onChange={(e) => handleUpdateTierConfig(idx, "maxQty", Number(e.target.value))}
                          className="mt-1 h-8 text-xs bg-white border-slate-200/80 text-slate-900"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Harga / Item (Rp)</Label>
                        <FormattedNumberInput
                          value={t.pricePerItem}
                          onChange={(val) => handleUpdateTierConfig(idx, "pricePerItem", val)}
                          className="mt-1 h-8 text-xs bg-white border-slate-200/80 text-slate-900"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTierConfig(idx)}
                          className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* PER-METHOD WITHDRAWAL FEE CONFIGURATION */}
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                        <Wallet className="w-5 h-5 text-indigo-600" /> Pengaturan Biaya Penarikan Per-Metode Pembayaran
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Konfigurasi jenis dan nilai biaya admin/layanan secara spesifik untuk setiap Bank dan E-Wallet.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleSaveWithdrawalSettings}
                      disabled={savingWithdrawalSettings}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs h-9 gap-1.5 shrink-0 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
                    >
                      {savingWithdrawalSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Simpan Konfigurasi Penarikan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Minimal Penarikan (Rp)</Label>
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
                        className="mt-1 h-9 text-xs bg-white border-slate-200/80 text-slate-900"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Maksimal Penarikan (Rp)</Label>
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
                        className="mt-1 h-9 text-xs bg-white border-slate-200/80 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-bold text-slate-800 mb-2 block">
                      Daftar Metode Pembayaran & Struktur Biaya
                    </Label>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white border-b border-slate-200/80 text-slate-500 font-semibold">
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
                            <tr key={idx} className={m.enabled ? "hover:bg-slate-100/40 transition-colors" : "bg-slate-50 opacity-50"}>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleMethodEnabled(idx, !m.enabled)}
                                  className={`text-[11px] h-7 px-2 font-bold border-slate-200/80 ${
                                    m.enabled
                                      ? "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-700"
                                  }`}
                                >
                                  {m.enabled ? "✓ Aktif" : "Nonaktif"}
                                </Button>
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{m.method}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <Select
                                  value={m.category ?? "bank"}
                                  onValueChange={(val) => handleUpdateMethodFee(idx, "category", val)}
                                >
                                  <SelectTrigger className="h-7 text-[11px] w-28 bg-white border-slate-200/80 text-slate-900">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                                  <SelectTrigger className="h-7 text-[11px] w-32 bg-white border-slate-200/80 text-slate-900">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                                    <SelectItem value="free" className="text-xs text-indigo-600 font-semibold">Bebas Biaya (Gratis)</SelectItem>
                                    <SelectItem value="fixed" className="text-xs text-sky-400 font-semibold">Biaya Tetap (Rp)</SelectItem>
                                    <SelectItem value="percentage" className="text-xs text-indigo-700 font-semibold">Persentase (%)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {m.feeType === "free" ? (
                                  <span className="text-indigo-600 font-semibold">Rp 0 (Gratis)</span>
                                ) : m.feeType === "fixed" ? (
                                  <div className="w-32">
                                    <FormattedNumberInput
                                      value={m.feeValue}
                                      onChange={(val) => handleUpdateMethodFee(idx, "feeValue", val)}
                                      className="h-7 text-xs bg-white border-slate-200/80 font-bold text-sky-400"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 w-28">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={m.feeValue}
                                      onChange={(e) => handleUpdateMethodFee(idx, "feeValue", parseFloat(e.target.value) || 0)}
                                      className="h-7 text-xs bg-white border-slate-200/80 font-bold text-indigo-700"
                                    />
                                    <span className="font-bold text-slate-500 text-xs">%</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMethod(idx)}
                                  className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3">
                      {currentMethods.map((m, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border space-y-3 ${
                            m.enabled ? "bg-slate-50 border-slate-200/80" : "bg-slate-50 border-slate-200 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">{m.method}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleMethodEnabled(idx, !m.enabled)}
                                className={`text-[11px] h-7 px-2.5 font-bold border-slate-200/80 ${
                                  m.enabled
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {m.enabled ? "✓ Aktif" : "Nonaktif"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMethod(idx)}
                                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <Label className="text-[10px] text-slate-500 font-semibold mb-1 block">Kategori</Label>
                              <Select
                                value={m.category ?? "bank"}
                                onValueChange={(val) => handleUpdateMethodFee(idx, "category", val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white border-slate-200/80 text-slate-900">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                                  <SelectItem value="bank" className="text-xs">Bank Transfer</SelectItem>
                                  <SelectItem value="ewallet" className="text-xs">E-Wallet</SelectItem>
                                  <SelectItem value="other" className="text-xs">Lainnya</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-[10px] text-slate-500 font-semibold mb-1 block">Jenis Biaya</Label>
                              <Select
                                value={m.feeType}
                                onValueChange={(val) => handleUpdateMethodFee(idx, "feeType", val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white border-slate-200/80 text-slate-900">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                                  <SelectItem value="free" className="text-xs text-indigo-600 font-semibold">Gratis</SelectItem>
                                  <SelectItem value="fixed" className="text-xs text-sky-400 font-semibold">Tetap (Rp)</SelectItem>
                                  <SelectItem value="percentage" className="text-xs text-indigo-700 font-semibold">Persentase (%)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {m.feeType !== "free" && (
                            <div>
                              <Label className="text-[10px] text-slate-500 font-semibold mb-1 block">Nilai Biaya</Label>
                              {m.feeType === "fixed" ? (
                                <FormattedNumberInput
                                  value={m.feeValue}
                                  onChange={(val) => handleUpdateMethodFee(idx, "feeValue", val)}
                                  className="h-8 text-xs bg-white border-slate-200/80 font-bold text-sky-400"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={m.feeValue}
                                    onChange={(e) => handleUpdateMethodFee(idx, "feeValue", parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs bg-white border-slate-200/80 font-bold text-indigo-700"
                                  />
                                  <span className="font-bold text-slate-500 text-xs">%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FORM TAMBAH METODE BARU */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                    <p className="text-xs font-bold text-slate-800">Tambah Metode Pembayaran Baru</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Nama Metode (contoh: Permata, LinkAja)"
                        value={newMethodName}
                        onChange={(e) => setNewMethodName(e.target.value)}
                        className="h-8 text-xs flex-1 bg-white border-slate-200/80 text-slate-900 focus:border-emerald-500"
                      />
                      <Select
                        value={newMethodCategory}
                        onValueChange={(val: "bank" | "ewallet") => setNewMethodCategory(val)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full sm:w-36 bg-white border-slate-200/80 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                          <SelectItem value="bank" className="text-xs">Bank Transfer</SelectItem>
                          <SelectItem value="ewallet" className="text-xs">E-Wallet</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleAddMethod}
                        className="h-8 text-xs bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-1 shrink-0 hover:from-indigo-500 hover:to-blue-500 shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Metode
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* GENERAL RULES & NOTES */}
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Aturan Setor Email & Instruksi Kata Sandi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-700">Aturan Setor Email & Kata Sandi (Instruksi Multiline)</Label>
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
                      className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500 leading-relaxed"
                    />
                  </div>
                  <Button onClick={handleSaveRules} disabled={savingRules} className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20">
                    {savingRules && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Pengaturan Aturan & Tier
                  </Button>
                </CardContent>
              </Card>

              {/* JAM OPERASIONAL & SUBMISSION LOCK */}
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Jam Operasional & Control Form Setoran</CardTitle>
                  <CardDescription className="text-slate-500">
                    Atur jadwal operasional harian, saklar kunci setoran manual admin, dan zona waktu platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* MANUAL SUBMISSION LOCK TOGGLE */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div>
                      <Label className="font-bold text-sm text-slate-800">Kunci Formulir Setoran Email (Manual Override)</Label>
                      <p className="text-xs text-slate-500 mt-0.5">Buka atau tutup akses formulir setoran email worker secara manual kapan saja.</p>
                    </div>
                    <Select
                      value={currentSubmissionOpen ? "OPEN" : "CLOSED"}
                      onValueChange={(val) => setSubmissionOpenState(val === "OPEN")}
                    >
                      <SelectTrigger className="w-36 text-xs h-8 font-bold bg-white border-slate-200/80 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                        <SelectItem value="OPEN" className="text-xs font-bold text-indigo-600">🟢 Buka (Terbuka)</SelectItem>
                        <SelectItem value="CLOSED" className="text-xs font-bold text-rose-600">🔴 Tutup (Kunci)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <div>
                      <Label className="font-bold text-sm text-slate-800">Status Jam Operasional Global</Label>
                      <p className="text-xs text-slate-500">Aktifkan atau nonaktifkan fitur jam operasional secara menyeluruh.</p>
                    </div>
                    <Select
                      value={currentOperatingHours.enabled ? "ON" : "OFF"}
                      onValueChange={(val) => handleUpdateGlobalOperatingHours(val === "ON")}
                    >
                      <SelectTrigger className="w-28 text-xs h-8 bg-white border-slate-200/80 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
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
                            dayConfig.enabled ? "bg-slate-50 border-slate-200/80" : "bg-slate-50 border-slate-200 text-slate-500 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-3 w-32">
                            <span className="font-bold text-sm text-slate-900">{d.label}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <Select
                              value={dayConfig.enabled ? "ON" : "OFF"}
                              onValueChange={(val) => handleUpdateDayOperatingHours(d.key, "enabled", val === "ON")}
                            >
                              <SelectTrigger className="w-24 text-xs h-8 bg-white border-slate-200/80 text-slate-900">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                                <SelectItem value="ON">ON</SelectItem>
                                <SelectItem value="OFF">OFF</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Buka:</span>
                              <Input
                                value={dayConfig.open}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "open", e.target.value)}
                                placeholder="08:00"
                                className="w-24 h-8 text-xs font-mono bg-white border-slate-200/80 text-slate-900"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Tutup:</span>
                              <Input
                                value={dayConfig.close}
                                disabled={!dayConfig.enabled}
                                onChange={(e) => handleUpdateDayOperatingHours(d.key, "close", e.target.value)}
                                placeholder="18:00"
                                className="w-24 h-8 text-xs font-mono bg-white border-slate-200/80 text-slate-900"
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
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 text-xs hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
                  >
                    {savingOperatingHours && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Jam Operasional
                  </Button>
                </CardContent>
              </Card>

              {/* TELEGRAM BOT NOTIFICATION SERVICE CONFIGURATION */}
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-indigo-600" /> Telegram Bot Notification Service
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Konfigurasi Telegram Bot untuk menerima notifikasi otomatis secara real-time saat ada Storan Email Masuk dan Request Penarikan Saldo Worker.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-700 font-semibold">Telegram Bot Token (botToken)</Label>
                    <Input
                      type="password"
                      value={currentTelegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="mt-1.5 text-xs font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Token resmi dari BotFather di Telegram.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 font-semibold">Telegram Admin Chat ID / Group ID (adminChatId)</Label>
                    <Input
                      value={currentTelegramAdminChatId}
                      onChange={(e) => setTelegramAdminChatId(e.target.value)}
                      placeholder="Contoh: 123456789 atau -100123456789"
                      className="mt-1.5 text-xs font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      ID User Admin atau ID Group Telegram tujuan pengiriman notifikasi.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 font-semibold">Status Layanan Notifikasi</Label>
                    <Select
                      value={currentTelegramEnabled ? "ON" : "OFF"}
                      onValueChange={(val) => setTelegramEnabled(val === "ON")}
                    >
                      <SelectTrigger className="mt-1.5 w-36 text-xs bg-slate-50 border-slate-200/80 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                        <SelectItem value="ON" className="text-xs font-semibold text-indigo-600">Aktif (ON)</SelectItem>
                        <SelectItem value="OFF" className="text-xs font-semibold text-slate-500">Nonaktif (OFF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestTelegramNotification}
                      disabled={testingTelegram || !currentTelegramBotToken.trim() || !currentTelegramAdminChatId.trim()}
                      className="bg-slate-50 border-slate-200/80 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-bold gap-2 text-xs h-9"
                    >
                      {testingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                      Test Kirim Notifikasi
                    </Button>

                    <Button
                      type="button"
                      onClick={handleSaveTelegramConfig}
                      disabled={savingTelegram}
                      className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 text-xs h-9 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
                    >
                      {savingTelegram && <Loader2 className="w-4 h-4 animate-spin" />}
                      Simpan Pengaturan Telegram
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* PUSAT BANTUAN / CUSTOMER SERVICE */}
              <Card className="bg-white border-slate-200/80 backdrop-blur-xl text-slate-900 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Pusat Bantuan & Komunitas</CardTitle>
                  <CardDescription className="text-slate-500">
                    Atur tautan CS Telegram dan Saluran / Grup WhatsApp yang tampil di Worker Dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-700">Nama layanan</Label>
                    <Input
                      value={currentSupportTitle}
                      onChange={(e) => setSupportTitle(e.target.value)}
                      placeholder="Customer Service"
                      className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-700">Link CS Telegram (supportTelegramLink)</Label>
                    <Input
                      value={currentSupportTelegramUrl}
                      onChange={(e) => setSupportTelegramUrl(e.target.value)}
                      placeholder="https://t.me/username"
                      className="mt-1.5 text-xs font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-700">Link Saluran / Grup WhatsApp (communityWaLink)</Label>
                    <Input
                      value={currentCommunityWaLink}
                      onChange={(e) => setCommunityWaLink(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="mt-1.5 text-xs font-mono bg-slate-50 border-slate-200/80 text-slate-900 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-700">Deskripsi Ringkas</Label>
                    <Textarea
                      rows={3}
                      value={currentSupportDescription}
                      onChange={(e) => setSupportDescription(e.target.value)}
                      placeholder="Ada kendala? Hubungi Customer Service kami melalui Telegram atau gabung Komunitas WA."
                      className="mt-1.5 text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-700">Status</Label>
                    <Select
                      value={currentSupportEnabled ? "ON" : "OFF"}
                      onValueChange={(val) => setSupportEnabled(val === "ON")}
                    >
                      <SelectTrigger className="mt-1.5 w-36 text-xs bg-slate-50 border-slate-200/80 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200/80 text-slate-900">
                        <SelectItem value="ON">ON</SelectItem>
                        <SelectItem value="OFF">OFF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveSupportConfig}
                    disabled={savingSupport}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 text-xs hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
                  >
                    {savingSupport && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB PESAN WORKER / LIVE CHAT ADMIN */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="bg-white border-slate-200 text-slate-900 shadow-2xs rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                      Pesan Worker / Live Chat
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Komunikasi privat 1-on-1 dengan pekerja terdaftar secara real-time.
                    </CardDescription>
                  </div>
                  {adminChatData.totalAdminUnread > 0 && (
                    <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs gap-1 px-3 py-1 self-start sm:self-center">
                      {adminChatData.totalAdminUnread} Pesan Belum Dibaca
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                {/* TWO-PANEL CHAT CONTAINER (Desktop: 2 Columns, Mobile: Step-by-Step Flow) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border border-slate-200 rounded-2xl bg-slate-50/50 min-h-[500px] overflow-hidden">
                  {/* WORKER LIST COLUMN */}
                  <div className={`md:col-span-5 lg:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col ${selectedWorkerUid ? "hidden md:flex" : "flex"}`}>
                    <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/50">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <Input
                          placeholder="Cari worker (nama / ID)..."
                          value={chatSearchQuery}
                          onChange={(e) => setChatSearchQuery(e.target.value)}
                          className="pl-9 text-xs h-9 bg-white border-slate-200 text-slate-900 focus:border-indigo-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Total {users.data.filter(u => u.role !== "admin").length} Pekerja Terdaftar
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[440px]">
                      {users.data.filter(u => u.role !== "admin").length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-10">Belum ada worker terdaftar.</p>
                      ) : (
                        users.data
                          .filter(u => u.role !== "admin")
                          .filter(u => {
                            const q = chatSearchQuery.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              (u.name && u.name.toLowerCase().includes(q)) ||
                              (u.email && u.email.toLowerCase().includes(q)) ||
                              u.uid.toLowerCase().includes(q)
                            );
                          })
                          .map((worker) => {
                            const conv = adminChatData.conversations.find((c: any) => c.workerId === worker.uid);
                            const unreadCount = conv?.adminUnread || 0;
                            const isSelected = selectedWorkerUid === worker.uid;

                            return (
                              <button
                                key={worker.uid}
                                type="button"
                                onClick={() => handleStartChatWithWorker(worker.uid)}
                                className={`w-full p-3 text-left transition-colors flex items-start gap-3 min-h-[60px] hover:bg-slate-50 ${
                                  isSelected ? "bg-indigo-50/80 border-l-4 border-indigo-600" : ""
                                }`}
                              >
                                <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                                  {worker.name ? worker.name.charAt(0).toUpperCase() : "W"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="font-bold text-xs text-slate-900 truncate">
                                      {worker.name || "Pekerja " + shortId(worker.uid)}
                                    </p>
                                    {conv?.lastMessageAt && (
                                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                        {formatDateTime(conv.lastMessageAt).split(" ")[1] || ""}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                                    {conv?.lastMessage || (worker.email ? worker.email : "Klik untuk mulai percakapan")}
                                  </p>
                                </div>
                                {unreadCount > 0 && (
                                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full shrink-0 shadow-2xs">
                                    {unreadCount}
                                  </span>
                                )}
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {/* ACTIVE CHAT ROOM COLUMN */}
                  <div className={`md:col-span-7 lg:col-span-8 bg-slate-50/30 flex flex-col ${selectedWorkerUid ? "flex" : "hidden md:flex"}`}>
                    {!selectedWorkerUid ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                        <MessageSquare className="w-10 h-10 text-slate-700" />
                        <p className="font-bold text-slate-700 text-sm">Pilih Pekerja untuk Memulai Chat</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Pilih pekerja dari daftar di sebelah kiri untuk melihat pesan atau memberikan arahan langsung.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* CHAT HEADER WITH BACK BUTTON FOR MOBILE */}
                        {(() => {
                          const activeWorkerObj = users.data.find(u => u.uid === selectedWorkerUid);
                          return (
                            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedWorkerUid(null)}
                                  className="md:hidden p-1.5 h-8 w-8 text-slate-600 hover:text-slate-900"
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {activeWorkerObj?.name ? activeWorkerObj.name.charAt(0).toUpperCase() : "W"}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate">
                                    {activeWorkerObj?.name || "Pekerja " + shortId(selectedWorkerUid)}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">
                                    {activeWorkerObj?.email || "ID: " + selectedWorkerUid}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shrink-0">
                                Privat Admin ↔ Worker
                              </Badge>
                            </div>
                          );
                        })()}

                        {/* MESSAGES SCROLL AREA */}
                        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 min-h-[340px] max-h-[420px]">
                          {selectedWorkerMessages.loading ? (
                            <div className="flex items-center justify-center py-10 text-xs text-slate-500 gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                              Memuat percakapan...
                            </div>
                          ) : selectedWorkerMessages.messages.length === 0 ? (
                            <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-white space-y-1">
                              <p className="text-xs font-semibold text-slate-700">Belum ada pesan dalam percakapan ini.</p>
                              <p className="text-[11px] text-slate-500">
                                Kirim pesan pertama ke pekerja untuk menginformasikan terkait setoran, rules, atau kendala akun.
                              </p>
                            </div>
                          ) : (
                          selectedWorkerMessages.messages
                            .filter((msg: any) => !(Array.isArray(msg.deletedFor) && msg.deletedFor.includes(profile.uid)))
                            .map((msg: any) => {
                              const isAdmin = msg.senderRole === "admin";
                              const isRead = !!msg.readAt;

                              const isDeleted = !!msg.deletedAt;

                              const nowMs = Date.now();
                              const expiresMs = msg.expiresAt && typeof msg.expiresAt === "object" && "toMillis" in msg.expiresAt
                                ? msg.expiresAt.toMillis()
                                : msg.expiresAt ? new Date(msg.expiresAt).getTime() : null;
                              const isExpired = expiresMs ? expiresMs <= nowMs : false;

                              return (
                                  <div
                                  key={msg.id}
                                  className={`flex flex-col group ${isAdmin ? "items-end" : "items-start"}`}
                                  >
                                  <div
                                    className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-xs space-y-1 shadow-2xs relative ${
                                      isAdmin
                                        ? "bg-indigo-600 text-white rounded-br-none"
                                        : "bg-white border border-slate-200 text-slate-900 rounded-bl-none"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 font-semibold mb-0.5">
                                      <span>{isAdmin ? "Admin" : msg.senderName || "Worker"}</span>
                                      {!isDeleted && !isExpired && (
                                        <button
                                          type="button"
                                          onClick={() => setAdminDeleteChatModalMsg(msg)}
                                          className="opacity-0 group-hover:opacity-100 hover:text-indigo-200 p-0.5 transition-opacity"
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
                                        {msg.text && (
                                          <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.text}</p>
                                          )}

                                        {msg.attachments && msg.attachments.length > 0 && (
                                          <div className="pt-1.5 space-y-1.5">
                                            {msg.attachments.length === 1 ? (
                                              <div
                                                onClick={() => setAdminPreviewImageModalUrl(msg.attachments![0].downloadUrl)}
                                                className="relative rounded-xl overflow-hidden cursor-pointer border border-black/10 group/img max-w-[240px]"
                                              >
                                                <img
                                                  src={msg.attachments[0].downloadUrl}
                                                  alt={msg.attachments[0].fileName}
                                                  className="w-full h-auto object-cover max-h-60 rounded-xl group-hover/img:scale-105 transition-transform"
                                                />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                  <Maximize2 className="w-5 h-5 drop-shadow-md" />
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-2 gap-1.5 max-w-[280px]">
                                                {msg.attachments.map((att: any, idx: number) => (
                                                  <div
                                                    key={idx}
                                                    onClick={() => setAdminPreviewImageModalUrl(att.downloadUrl)}
                                                    className="relative rounded-xl overflow-hidden cursor-pointer border border-black/10 group/img aspect-square bg-slate-900/10"
                                                  >
                                                    <img
                                                      src={att.downloadUrl}
                                                      alt={att.fileName}
                                                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                      <Maximize2 className="w-4 h-4 drop-shadow-md" />
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </>
                                      )}

                                    <div className={`flex items-center justify-end gap-1 text-[9px] font-mono mt-1 ${isAdmin ? "text-indigo-200" : "text-slate-500"}`}>
                                      {msg.disappearingTimer && msg.disappearingTimer !== "off" && (
                                        <span className="flex items-center gap-0.5 text-indigo-200" title={`Timer hapus otomatis: ${msg.disappearingTimer}`}>
                                          <Timer className="w-2.5 h-2.5" />
                                        </span>
                                      )}
                                      <span>{formatDateTime(msg.createdAt)}</span>
                                      {isAdmin && !isDeleted && !isExpired && (
                                        <span title={isRead ? "Telah dibaca Worker (2 check)" : "Terkirim (1 check)"}>
                                          {isRead ? (
                                            <CheckCheck className="w-3.5 h-3.5 text-indigo-100" />
                                          ) : (
                                            <Check className="w-3 h-3 text-indigo-300" />
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    </div>
                                  </div>
                              );
                            })
                          )}
                          <div ref={adminChatMessagesEndRef} />
                        </div>

                        {/* SELECTED IMAGE PREVIEW & UPLOAD PROGRESS BAR */}
                        {selectedAdminChatFiles.length > 0 && (
                          <div className="px-3 py-2 bg-indigo-50/50 border-t border-slate-200 shrink-0 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                {selectedAdminChatFiles.length} foto dipilih (Album)
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedAdminChatFiles([])}
                                className="text-[10px] font-semibold text-rose-600 hover:text-rose-800"
                              >
                                Batal Semua
                              </button>
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {selectedAdminChatFiles.map((file, idx) => (
                                <div key={idx} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-indigo-200 group">
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSelectedAdminFile(idx)}
                                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-rose-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {adminUploadProgress !== null && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-semibold text-indigo-900">
                                  <span>Mengunggah media...</span>
                                  <span>{adminUploadProgress}%</span>
                                </div>
                                <div className="w-full bg-indigo-200/60 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-1.5 transition-all duration-200"
                                    style={{ width: `${adminUploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* INPUT FORM BAR */}
                        <form onSubmit={handleSendAdminChat} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <input
                            type="file"
                            ref={adminFileInputRef}
                            onChange={handleSelectAdminChatImages}
                            accept="image/jpeg,image/png,image/webp,image/gif,image/jpg"
                            multiple
                            className="hidden"
                          />

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adminFileInputRef.current?.click()}
                              disabled={sendingAdminChat}
                              className="p-2 rounded-xl text-indigo-700 hover:bg-indigo-50 transition-colors border border-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Lampirkan Foto / Album (Max 5)"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>

                            <select
                              value={adminChatTimerOption}
                              onChange={(e) => setAdminChatTimerOption(e.target.value as DisappearingTimer)}
                              className="text-[11px] h-10 px-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none min-h-[44px]"
                              title="Timer Pesan Menghilang"
                            >
                              <option value="off">⏱️ Off</option>
                              <option value="24h">⏱️ 24h</option>
                              <option value="7d">⏱️ 7d</option>
                              <option value="30d">⏱️ 30d</option>
                            </select>
                          </div>

                          <Input
                            placeholder={selectedAdminChatFiles.length > 0 ? "Tambah keterangan foto (opsional)..." : "Tulis pesan untuk worker..."}
                            value={adminChatText}
                            onChange={(e) => setAdminChatText(e.target.value)}
                            disabled={sendingAdminChat}
                            className="text-xs h-10 bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500 flex-1 min-h-[44px]"
                          />

                          <Button
                            type="submit"
                            disabled={sendingAdminChat || (!adminChatText.trim() && selectedAdminChatFiles.length === 0)}
                            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-2xs shrink-0 min-h-[44px]"
                          >
                            {sendingAdminChat ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">Kirim</span>
                          </Button>
                        </form>

                        {/* HIGH-RES IMAGE PREVIEW MODAL */}
                        <Dialog open={!!adminPreviewImageModalUrl} onOpenChange={(open) => !open && setAdminPreviewImageModalUrl(null)}>
                          <DialogContent className="max-w-2xl bg-black/90 border-slate-800 text-white p-2">
                            {adminPreviewImageModalUrl && (
                              <div className="relative flex flex-col items-center justify-center p-2">
                                <img
                                  src={adminPreviewImageModalUrl}
                                  alt="Preview Foto"
                                  className="max-h-[80vh] w-auto object-contain rounded-xl"
                                />
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {/* DELETE MESSAGE CONFIRMATION DIALOG */}
                        <Dialog open={!!adminDeleteChatModalMsg} onOpenChange={(open) => !open && setAdminDeleteChatModalMsg(null)}>
                          <DialogContent className="max-w-md bg-white border-slate-200">
                            <DialogHeader>
                              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                <Trash2 className="w-4 h-4 text-rose-600" />
                                <span>Hapus Pesan</span>
                              </DialogTitle>
                              <DialogDescription className="text-xs text-slate-600">
                                Pilih opsi penghapusan untuk pesan ini.
                              </DialogDescription>
                            </DialogHeader>

                            {adminDeleteChatModalMsg && (
                              <div className="space-y-3 pt-2">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
                                  "{adminDeleteChatModalMsg.text || (adminDeleteChatModalMsg.attachments?.length ? "[Lampiran Gambar/Album]" : "Pesan")}"
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                  <Button
                                    onClick={() => handleDeleteAdminMessageForMe(adminDeleteChatModalMsg)}
                                    disabled={deletingAdminChat}
                                    variant="outline"
                                    className="w-full text-xs h-10 justify-start font-semibold border-slate-200 hover:bg-slate-50 min-h-[44px]"
                                  >
                                    <Trash2 className="w-4 h-4 text-indigo-600 mr-2" />
                                    Hapus untuk Saya (Sembunyikan hanya di perangkat Admin)
                                  </Button>

                                  <Button
                                    onClick={() => handleDeleteAdminMessageForAll(adminDeleteChatModalMsg)}
                                    disabled={deletingAdminChat}
                                    className="w-full text-xs h-10 justify-start bg-rose-600 hover:bg-rose-700 text-white font-semibold min-h-[44px]"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Hapus untuk Semua (Hapus untuk Worker & Admin)
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* DIALOG LIHAT & TINJAU DETAIL BATCH (PER EMAIL) */}
        <Dialog open={!!detailSubmission} onOpenChange={(open) => !open && setDetailSubmission(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200/80 text-slate-900 shadow-2xl p-3 sm:p-6 w-full box-border">
            <DialogHeader>
              <DialogTitle className="text-slate-900 text-base sm:text-lg">Tinjau Batch Setoran Email</DialogTitle>
              <DialogDescription className="text-slate-500 text-xs truncate">
                Pekerja: <strong className="text-slate-800">{detailSubmission?.workerName || workerName(detailSubmission?.workerId ?? "")}</strong> · <span className="font-mono">#{shortId(detailSubmission?.id ?? "")}</span>
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
                <div className="space-y-3 sm:space-y-4 pt-1 w-full max-w-full overflow-x-hidden box-border">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 sm:p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs w-full">
                    <div>
                      <span className="text-slate-500 text-[10px] sm:text-xs">Total Item:</span>
                      <p className="font-bold text-slate-900">{baseItems.length} item</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] sm:text-xs">ACC:</span>
                      <p className="font-bold text-indigo-600">{approvedCount} item</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] sm:text-xs">Ditolak:</span>
                      <p className="font-bold text-rose-600">{rejectedCount} item</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] sm:text-xs">Tier:</span>
                      <p className="font-bold text-indigo-700 truncate">{recTierCfg.name}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500 text-[10px] sm:text-xs">Total Saldo:</span>
                      <p className="font-bold text-indigo-600">{formatMoney(calcTotal)}</p>
                    </div>
                  </div>

                  {/* BULK COPY TOOLBAR */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs w-full">
                    <span className="text-slate-700 font-semibold flex items-center gap-1.5 shrink-0">
                      <Copy className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      Salin Rekap Email:
                    </span>
                    <div className="flex flex-col sm:flex-row gap-1.5 w-full sm:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyAllEmails(baseItems)}
                        className="min-h-[44px] sm:min-h-0 sm:h-8 text-xs bg-white text-slate-800 border-slate-200/80 hover:bg-slate-100 gap-1.5 font-medium w-full sm:w-auto"
                      >
                        {copiedBulkType === "emails" ? (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        Salin Semua Email
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyEmailsWithPasswords(baseItems)}
                        className="min-h-[44px] sm:min-h-0 sm:h-8 text-xs bg-white text-slate-800 border-slate-200/80 hover:bg-slate-100 gap-1.5 font-medium w-full sm:w-auto"
                      >
                        {copiedBulkType === "passwords" ? (
                          <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        Salin Email | Sandi
                      </Button>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs w-full">
                      <span className="text-slate-700 font-medium">Setujui / Tolak Semua:</span>
                      <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newMap: Record<string, "approved"> = {};
                            baseItems.forEach((_, idx) => { newMap[idx] = "approved"; });
                            setItemStatuses(newMap);
                          }}
                          className="min-h-[44px] sm:min-h-0 sm:h-8 text-xs text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-50 font-bold"
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
                          className="min-h-[44px] sm:min-h-0 sm:h-8 text-xs text-rose-600 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 font-bold"
                        >
                          Tolak Semua (X)
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="w-full">
                    <Label className="text-xs text-slate-500 mb-1.5 block">
                      Tinjau Item Email Individu ({baseItems.length} item):
                    </Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200/80 rounded-lg p-2 bg-slate-50 w-full max-w-full overflow-x-hidden box-border">
                      {baseItems.map((it, idx) => {
                        const currentSt = itemStatuses[idx] ?? "pending";
                        const isCopied = copiedSingleIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors w-full ${
                              currentSt === "approved"
                                ? "bg-indigo-50 border-indigo-200"
                                : currentSt === "rejected"
                                  ? "bg-rose-50 border-rose-500/30"
                                  : "bg-white border-slate-200/80"
                            }`}
                          >
                            <div className="min-w-0 flex-1 font-mono">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 min-w-0">
                                <span className="truncate flex-1">{idx + 1}. {it.email}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="min-h-[36px] min-w-[36px] sm:h-6 sm:w-6 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                                  title="Salin Email"
                                  onClick={() => handleCopySingleEmail(it.email, idx)}
                                >
                                  {isCopied ? (
                                    <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-indigo-600" />
                                  ) : (
                                    <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                  )}
                                </Button>
                              </div>
                              {it.password && <p className="text-[11px] text-slate-500 truncate">Sandi: {it.password}</p>}
                            </div>

                            {isReadOnly ? (
                              <Badge
                                className={`self-start sm:self-center shrink-0 ${
                                  currentSt === "approved"
                                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                                    : currentSt === "rejected"
                                      ? "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {currentSt === "approved" ? "Terjual (✓)" : currentSt === "rejected" ? "Ditolak (X)" : "Menunggu"}
                              </Badge>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-slate-200/80">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setItemStatuses((prev) => ({ ...prev, [idx]: "approved" }))}
                                  className={`min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 text-xs font-bold gap-1 ${
                                    currentSt === "approved"
                                      ? "bg-emerald-500 text-white"
                                      : "bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/80"
                                  }`}
                                >
                                  ✓ ACC
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setItemStatuses((prev) => ({ ...prev, [idx]: "rejected" }))}
                                  className={`min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 text-xs font-bold gap-1 ${
                                    currentSt === "rejected"
                                      ? "bg-rose-600 text-white"
                                      : "bg-white text-slate-500 hover:bg-rose-500/20 hover:text-rose-600 border border-slate-200/80"
                                  }`}
                                >
                                  X Tolak
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/80 w-full">
                      <div>
                        <Label htmlFor="batch-note" className="text-xs text-slate-700">Catatan Review Admin (opsional)</Label>
                        <Input
                          id="batch-note"
                          placeholder="Contoh: 3 email valid, 2 email tidak bisa login"
                          value={notes[detailSubmission.id] ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [detailSubmission.id]: e.target.value }))}
                          className="mt-1 min-h-[44px] text-xs bg-slate-50 border-slate-200/80 text-slate-900 focus:border-emerald-500"
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={busyId === detailSubmission.id || pendingCount > 0}
                        onClick={() => handleFinalizeBatchReview(detailSubmission)}
                        className="w-full min-h-[44px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-extrabold text-xs gap-2 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-500/20"
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

        {/* MOBILE STICKY BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/80 backdrop-blur-xl sm:hidden">
          <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] ${
                activeTab === "overview"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] truncate max-w-full">Home</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("submissions")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[44px] ${
                activeTab === "submissions"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-5 h-5" />
              {stats.pendingSubmissions > 0 && (
                <span className="absolute top-1.5 right-3 text-[9px] bg-emerald-500 text-white font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
                  {stats.pendingSubmissions}
                </span>
              )}
              <span className="text-[10px] truncate max-w-full">Batch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("withdrawals")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[44px] ${
                activeTab === "withdrawals"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Wallet className="w-5 h-5" />
              {stats.pendingWithdrawals > 0 && (
                <span className="absolute top-1.5 right-3 text-[9px] bg-emerald-500 text-white font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
                  {stats.pendingWithdrawals}
                </span>
              )}
              <span className="text-[10px] truncate max-w-full">Penarikan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors relative min-h-[44px] ${
                activeTab === "chat"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              {adminChatData.totalAdminUnread > 0 && (
                <span className="absolute top-1.5 right-3 text-[9px] bg-rose-500 text-white font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
                  {adminChatData.totalAdminUnread}
                </span>
              )}
              <span className="text-[10px] truncate max-w-full">Pesan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("finance")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] ${
                activeTab === "finance"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="text-[10px] truncate max-w-full">Keuangan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] ${
                activeTab === "rules"
                  ? "text-indigo-600 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] truncate max-w-full">Aturan</span>
            </button>
          </div>
        </nav>
      </main>
      </div>
    </div>
  );
}
