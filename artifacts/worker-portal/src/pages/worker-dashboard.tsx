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
  createSubmission,
  createWithdrawal,
} from "@/hooks/use-portal";
import { DEFAULT_RULES, type EmailSubmission, type PortalUser } from "@/lib/portal-types";
import {
  formatDateTime,
  formatMoney,
  getItemCountOfSubmission,
  getTierConfig,
  shortId,
  validatePasswordAgainstRules,
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

  // Engagement UI States
  const [copiedLink, setCopiedLink] = useState(false);

  const referralCode = profile.uid;
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${referralCode}` : `/register?ref=${referralCode}`;

  function handleCopyReferralLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.success("Tautan referral berhasil disalin!");
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // Calculate Engagement Stats
  const refStats = useMemo(() => {
    const total = engagement.referrals.data.length;
    const pending = engagement.referrals.data.filter((r) => r.status === "PENDING").length;
    const qualified = engagement.referrals.data.filter((r) => r.status === "QUALIFIED" || r.status === "REWARDED").length;
    const earnings = engagement.rewardLedger.data
      .filter((l) => l.rewardType === "referral")
      .reduce((sum, item) => sum + item.amount, 0);
    return { total, pending, qualified, earnings };
  }, [engagement.referrals.data, engagement.rewardLedger.data]);

  // Active Tier configuration
  const currentTierConfig = useMemo(() => {
    return getTierConfig(profile.tier ?? 1, rules.data.tiers);
  }, [profile.tier, rules.data.tiers]);

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
  const [method, setMethod] = useState(rules.data.paymentMethods[0] ?? "DANA");
  const [account, setAccount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const value = amount;
    if (!value || value <= 0) {
      toast.error("Masukkan jumlah penarikan yang valid.");
      return;
    }
    if (value < rules.data.minWithdraw) {
      toast.error(`Minimal penarikan adalah ${formatMoney(rules.data.minWithdraw)}.`);
      return;
    }
    if (value > rules.data.maxWithdraw) {
      toast.error(`Maksimal penarikan adalah ${formatMoney(rules.data.maxWithdraw)}.`);
      return;
    }
    if (value > profile.balance) {
      toast.error("Saldo Anda tidak mencukupi.");
      return;
    }
    if (!account.trim()) {
      toast.error("Nomor tujuan wajib diisi.");
      return;
    }

    setWithdrawing(true);
    try {
      await createWithdrawal({ workerId: profile.uid, amount: value, method, account: account.trim() });
      toast.success("Permintaan penarikan berhasil dikirim!");
      setAmount(0);
      setAccount("");
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

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Tabs defaultValue="submit">
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="submit" className="gap-1 text-xs">
              <Send className="w-3.5 h-3.5" /> Setor
            </TabsTrigger>
            <TabsTrigger value="referral" className="gap-1 text-xs">
              <Users className="w-3.5 h-3.5" /> Referral
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-1 text-xs">
              <Wallet className="w-3.5 h-3.5" /> Tarik
            </TabsTrigger>
          </TabsList>

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

            {/* RIWAYAT SETORAN (GROUPED BY BATCH WITH PER-ITEM STATS) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  Riwayat Setoran Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {submissions.loading && <p className="text-sm text-gray-400 text-center py-6">Memuat…</p>}
                {!submissions.loading && submissions.data.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Belum ada batch setoran email.</p>
                )}
                {submissions.data.map((item) => {
                  const baseItems = Array.isArray(item.items) && item.items.length > 0
                    ? item.items
                    : item.email
                      ? [{ email: item.email, password: item.password, status: item.status === "available" || item.status === "approved" ? "approved" : item.status === "rejected" ? "rejected" : "pending" }]
                      : [];

                  const count = baseItems.length || getItemCountOfSubmission(item);
                  const approvedCount = item.approvedItemCount ?? baseItems.filter((i) => i.status === "approved").length;
                  const rejectedCount = item.rejectedItemCount ?? baseItems.filter((i) => i.status === "rejected").length;
                  const pendingCount = count - approvedCount - rejectedCount;

                  const tierNum = item.appliedTier ?? item.currentTier ?? profile.tier;
                  const tierCfg = getTierConfig(tierNum, rules.data.tiers);
                  const pricePerItem = item.appliedPricePerItem ?? item.currentPricePerItem ?? tierCfg.pricePerItem;
                  const earnedAmount = item.totalAmount ?? (approvedCount * pricePerItem);

                  return (
                    <Card key={item.id} className="border-gray-200">
                      <CardContent className="pt-4 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{count} Total Email</span>
                            <Badge variant="outline" className="text-[11px] py-0 bg-amber-50 text-amber-800 border-amber-200">
                              {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-medium">
                            <span className="text-green-600">Disetujui: {approvedCount}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-red-600">Ditolak: {rejectedCount}</span>
                            {pendingCount > 0 && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span className="text-amber-600">Menunggu: {pendingCount}</span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-amber-700 font-bold">
                            Total Saldo Didapat: {formatMoney(earnedAmount)}
                          </p>
                          <p className="text-xs text-gray-400">
                            #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                          </p>
                          {item.reviewNote && (
                            <p className="text-xs text-gray-500 italic">Catatan: {item.reviewNote}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusBadge status={item.status} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailSubmission(item)}
                            className="text-xs h-7 gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Lihat Email
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REFERRAL SYSTEM */}
          <TabsContent value="referral" className="space-y-4">
            <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" /> Tautan & Kode Referral
                </CardTitle>
                <CardDescription>
                  Bagikan tautan ini ke teman atau pekerja lain. Dapatkan bonus saldo untuk setiap referral qualified.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-600">Tautan Referral Anda</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input readOnly value={referralLink} className="font-mono text-xs bg-white" />
                    <Button onClick={handleCopyReferralLink} className="bg-amber-600 hover:bg-amber-700 shrink-0 gap-1.5">
                      {copiedLink ? <Check className="w-4 h-4 text-green-200" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? "Tersalin!" : "Salin Link"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                    <p className="text-[11px] text-gray-500">Total Referral</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{refStats.total}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                    <p className="text-[11px] text-gray-500">Menunggu (Pending)</p>
                    <p className="text-lg font-bold text-amber-700 mt-0.5">{refStats.pending}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                    <p className="text-[11px] text-gray-500">Qualified (ACC)</p>
                    <p className="text-lg font-bold text-green-700 mt-0.5">{refStats.qualified}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                    <p className="text-[11px] text-gray-500">Total Bonus Didapat</p>
                    <p className="text-lg font-bold text-amber-700 mt-0.5">{formatMoney(refStats.earnings)}</p>
                  </div>
                </div>

                <div className="p-3 bg-white/80 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Ketentuan Kualifikasi Referral:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                    <li>Pendaftaran akun baru saja TIDAK langsung memberikan bonus.</li>
                    <li>Pekerja yang diundang harus mencapai minimal <strong>{rules.data.referralMinAcc ?? 5} email ACC</strong> disetujui admin.</li>
                    <li>Bonus referral hanya diberikan 1 kali per pekerja qualified: <strong>{formatMoney(rules.data.referralReward ?? 10000)}</strong>.</li>
                  </ul>
                </div>

                {engagement.referrals.data.length > 0 && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-2 block">Daftar Pekerja Terdaftar Via Referral Anda:</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                      {engagement.referrals.data.map((ref) => (
                        <div key={ref.id} className="p-2.5 rounded-md border flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-gray-900">{ref.referredWorkerName || shortId(ref.referredWorkerId)}</p>
                            <p className="text-[11px] text-gray-400">{formatDateTime(ref.createdAt)}</p>
                          </div>
                          <Badge className={ref.status === "REWARDED" || ref.status === "QUALIFIED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                            {ref.status === "REWARDED" ? "Diberikan Hadiah" : ref.status === "QUALIFIED" ? "Qualified" : "Pending (Belum Cukup ACC)"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TARIK SALDO */}
          <TabsContent value="withdraw" className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 flex items-start gap-2 text-xs text-blue-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Saldo tersedia: <strong>{formatMoney(profile.balance)}</strong>. Minimal penarikan{" "}
                  {formatMoney(rules.data.minWithdraw)}, maksimal {formatMoney(rules.data.maxWithdraw)}.
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tarik Saldo</CardTitle>
                <CardDescription>Pilih metode pembayaran dan masukkan nomor tujuan.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div>
                    <Label htmlFor="amount">Jumlah Penarikan (Rp)</Label>
                    <FormattedNumberInput
                      id="amount"
                      value={amount}
                      onChange={(val) => setAmount(val)}
                      placeholder="Contoh: 100.000"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label>Metode Pembayaran</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Pilih metode" />
                      </SelectTrigger>
                      <SelectContent>
                        {rules.data.paymentMethods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="account">Nomor Tujuan</Label>
                    <Input
                      id="account"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder={`Nomor HP ${method} / Rekening`}
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Ajukan Penarikan
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RIWAYAT PENARIKAN */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  Riwayat Penarikan Saldo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {withdrawals.loading && <p className="text-sm text-gray-400 text-center py-6">Memuat…</p>}
                {!withdrawals.loading && withdrawals.data.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Belum ada penarikan.</p>
                )}
                {withdrawals.data.map((item) => (
                  <Card key={item.id} className="border-gray-200">
                    <CardContent className="pt-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{formatMoney(item.amount)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.method} · {item.account}
                        </p>
                        <p className="text-xs text-gray-400">
                          #{shortId(item.id)} · {formatDateTime(item.requestedAt)}
                        </p>
                        {item.note && <p className="text-xs text-gray-500 mt-1 italic">Catatan: {item.note}</p>}
                      </div>
                      <StatusBadge status={item.status} />
                    </CardContent>
                  </Card>
                ))}
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
