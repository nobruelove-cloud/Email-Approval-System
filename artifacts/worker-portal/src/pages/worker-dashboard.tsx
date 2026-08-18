import { useMemo, useState, type ReactNode } from "react";
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
import { useWorkerData, useSettings, createSubmission, createWithdrawal } from "@/hooks/use-portal";
import { DEFAULT_RULES, type PortalUser } from "@/lib/portal-types";
import { formatDateTime, formatMoney, shortId, validatePasswordAgainstRules } from "@/lib/portal-utils";

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
  const rules = useSettings("rules", DEFAULT_RULES);

  // --- Submit emails ---
  const [emailsText, setEmailsText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      await Promise.all(
        emailList.map((email) =>
          createSubmission({
            workerId: profile.uid,
            email,
            password: password.trim(),
          }),
        ),
      );
      toast.success(`Berhasil mengirim ${emailList.length} email untuk ditinjau admin!`);
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
            <p className="font-bold text-gray-900">{profile.name}</p>
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
          <TabsList className="grid grid-cols-4 w-full mb-6">
            <TabsTrigger value="submit" className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Setor
            </TabsTrigger>
            <TabsTrigger value="submit-history" className="gap-1.5">
              <History className="w-3.5 h-3.5" /> Riwayat
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Tarik
            </TabsTrigger>
            <TabsTrigger value="withdraw-history" className="gap-1.5">
              <History className="w-3.5 h-3.5" /> Riwayat
            </TabsTrigger>
          </TabsList>

          {/* SETOR EMAIL */}
          <TabsContent value="submit" className="space-y-4">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  Aturan Setor Email
                </div>
                <ul className="space-y-1 text-xs text-amber-800 list-disc list-inside whitespace-pre-wrap">
                  {rules.data.submissionNotes.map((note, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">{note}</li>
                  ))}
                  <li>Harga per email disetujui: {formatMoney(rules.data.pricePerEmail)}</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detail Akun Setoran</CardTitle>
                <CardDescription>Masukkan satu atau banyak email sekaligus, satu per baris.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitEmails} className="space-y-4">
                  <div>
                    <Label htmlFor="emails">Daftar Alamat Email ({emailList.length} email)</Label>
                    <Textarea
                      id="emails"
                      rows={6}
                      value={emailsText}
                      onChange={(e) => setEmailsText(e.target.value)}
                      placeholder={"worker1@example.com\nworker2@example.com\nworker3@example.com"}
                      className="mt-1.5 font-mono text-sm"
                      required
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Pisahkan setiap email dengan baris baru atau koma.
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
                  <Button type="submit" disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Kirim untuk Ditinjau
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RIWAYAT SETORAN */}
          <TabsContent value="submit-history" className="space-y-3">
            {submissions.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!submissions.loading && submissions.data.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada setoran email.</p>
            )}
            {submissions.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{item.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                    </p>
                    {item.reviewNote && (
                      <p className="text-xs text-gray-500 mt-1 italic">Catatan: {item.reviewNote}</p>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </CardContent>
              </Card>
            ))}
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
          </TabsContent>

          {/* RIWAYAT PENARIKAN */}
          <TabsContent value="withdraw-history" className="space-y-3">
            {withdrawals.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!withdrawals.loading && withdrawals.data.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada penarikan.</p>
            )}
            {withdrawals.data.map((item) => (
              <Card key={item.id}>
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
