import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  useSettings,
  reviewSubmission,
  reviewWithdrawal,
  updatePortalUser,
  deletePortalUser,
  createWorkerAccount,
  saveSettings,
} from "@/hooks/use-portal";
import { DEFAULT_RULES, type PortalUser, type UserStatus, type UserTier } from "@/lib/portal-types";
import { formatDateTime, formatMoney, shortId } from "@/lib/portal-utils";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    processing: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    success: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    pending: "Menunggu",
    processing: "Diproses",
    approved: "Disetujui",
    success: "Berhasil",
    rejected: "Ditolak",
    inactive: "Nonaktif",
  };
  return <Badge className={variants[status] ?? variants.pending}>{labels[status] ?? status}</Badge>;
}

export default function AdminDashboard({ profile, onLogout }: { profile: PortalUser; onLogout: () => void }) {
  const { users, submissions, withdrawals } = useAdminData();
  const rules = useSettings("rules", DEFAULT_RULES);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const workerMap = useMemo(() => {
    const map = new Map<string, PortalUser>();
    users.data.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users.data]);

  const workerName = (id: string) => workerMap.get(id)?.name ?? shortId(id);

  const stats = useMemo(() => {
    const activeWorkers = users.data.filter((u) => u.role === "worker" && u.status === "approved").length;
    const totalBalance = users.data.reduce((sum, u) => sum + (u.balance ?? 0), 0);
    const pendingSubmissions = submissions.data.filter((s) => s.status === "pending").length;
    const pendingWithdrawals = withdrawals.data.filter((w) => w.status === "pending" || w.status === "processing").length;
    const approvedEmails = submissions.data.filter((s) => s.status === "approved").length;
    const totalPaidOut = withdrawals.data
      .filter((w) => w.status === "success")
      .reduce((sum, w) => sum + w.amount, 0);
    return { activeWorkers, totalBalance, pendingSubmissions, pendingWithdrawals, approvedEmails, totalPaidOut };
  }, [users.data, submissions.data, withdrawals.data]);

  async function handleSubmissionDecision(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    try {
      await reviewSubmission(id, decision, notes[id] ?? "", rules.data.pricePerEmail);
      toast.success(decision === "approved" ? "Setoran disetujui, saldo pekerja bertambah." : "Setoran ditolak.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses setoran.");
    } finally {
      setBusyId(null);
    }
  }

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
      toast.success("Tier pekerja diperbarui.");
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
        tier: Number(newWorker.tier) as UserTier,
        status: "approved",
        balance: 0,
      });
      toast.success("Akun pekerja berhasil dibuat.");
      setNewWorker({ name: "", email: "", phone: "", password: "", tier: "1" });
      setAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat akun pekerja.");
    } finally {
      setAddBusy(false);
    }
  }

  // --- Rules editor ---
  const [rulesDraft, setRulesDraft] = useState<typeof rules.data | null>(null);
  const activeRules = rulesDraft ?? rules.data;
  const [savingRules, setSavingRules] = useState(false);

  async function handleSaveRules() {
    setSavingRules(true);
    try {
      await saveSettings("rules", activeRules);
      toast.success("Aturan berhasil diperbarui dan langsung berlaku untuk semua pekerja.");
      setRulesDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan aturan.");
    } finally {
      setSavingRules(false);
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
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1">
              <FileText className="w-3.5 h-3.5" />
              {stats.pendingSubmissions > 0 && (
                <span className="ml-0.5 text-[10px] bg-red-500 text-white rounded-full px-1.5">{stats.pendingSubmissions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {stats.pendingWithdrawals > 0 && (
                <span className="ml-0.5 text-[10px] bg-red-500 text-white rounded-full px-1.5">{stats.pendingWithdrawals}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="workers">
              <Users className="w-3.5 h-3.5" />
            </TabsTrigger>
            <TabsTrigger value="rules">
              <SettingsIcon className="w-3.5 h-3.5" />
            </TabsTrigger>
          </TabsList>

          {/* RINGKASAN */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Pekerja Aktif", value: stats.activeWorkers },
                { label: "Total Saldo Beredar", value: formatMoney(stats.totalBalance) },
                { label: "Setoran Menunggu", value: stats.pendingSubmissions },
                { label: "Penarikan Menunggu", value: stats.pendingWithdrawals },
                { label: "Email Disetujui", value: stats.approvedEmails },
                { label: "Total Sudah Dicairkan", value: formatMoney(stats.totalPaidOut) },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-6">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* KELOLA SETORAN */}
          <TabsContent value="submissions" className="space-y-3">
            {submissions.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!submissions.loading && submissions.data.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada setoran.</p>
            )}
            {submissions.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{item.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {workerName(item.workerId)} · #{shortId(item.id)} · {formatDateTime(item.submittedAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Input
                        placeholder="Catatan (opsional)"
                        value={notes[item.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="text-xs h-9"
                      />
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => handleSubmissionDecision(item.id, "approved")}
                        className="bg-green-600 hover:bg-green-700 gap-1 shrink-0"
                      >
                        {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === item.id}
                        onClick={() => handleSubmissionDecision(item.id, "rejected")}
                        className="gap-1 shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </Button>
                    </div>
                  )}
                  {item.reviewNote && <p className="text-xs text-gray-500 mt-2 italic">Catatan: {item.reviewNote}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* KELOLA PENARIKAN */}
          <TabsContent value="withdrawals" className="space-y-3">
            {withdrawals.loading && <p className="text-sm text-gray-400 text-center py-8">Memuat…</p>}
            {!withdrawals.loading && withdrawals.data.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada penarikan.</p>
            )}
            {withdrawals.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{formatMoney(item.amount)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {workerName(item.workerId)} · {item.method} · {item.account}
                      </p>
                      <p className="text-xs text-gray-400">
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
            ))}
          </TabsContent>

          {/* KELOLA PEKERJA */}
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
                    <DialogDescription>Akun akan langsung berstatus disetujui.</DialogDescription>
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
                        <Label>Tier</Label>
                        <Select value={newWorker.tier} onValueChange={(v) => setNewWorker((p) => ({ ...p, tier: v }))}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Tier 1</SelectItem>
                            <SelectItem value="2">Tier 2</SelectItem>
                            <SelectItem value="3">Tier 3</SelectItem>
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
              .map((u) => (
                <Card key={u.uid}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Saldo: {formatMoney(u.balance ?? 0)}</p>
                      </div>
                      <StatusBadge status={u.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={String(u.tier)} onValueChange={(v) => handleUserTier(u.uid, Number(v) as UserTier)}>
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Tier 1</SelectItem>
                          <SelectItem value="2">Tier 2</SelectItem>
                          <SelectItem value="3">Tier 3</SelectItem>
                        </SelectContent>
                      </Select>
                      {u.status === "pending" && (
                        <>
                          <Button size="sm" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "approved")} className="bg-green-600 hover:bg-green-700 h-8">
                            Setujui
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "rejected")} className="h-8">
                            Tolak
                          </Button>
                        </>
                      )}
                      {u.status === "approved" && (
                        <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "inactive")} className="h-8">
                          Nonaktifkan
                        </Button>
                      )}
                      {(u.status === "inactive" || u.status === "rejected") && (
                        <Button size="sm" variant="outline" disabled={busyId === u.uid} onClick={() => handleUserStatus(u.uid, "approved")} className="h-8">
                          Aktifkan
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus data pekerja ini?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Ini menghapus profil "{u.name}" dari Firestore. Akun login (Firebase Authentication)
                              tidak ikut terhapus otomatis — hapus manual dari Firebase Console jika perlu.
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
              ))}
          </TabsContent>

          {/* ATURAN DINAMIS */}
          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Aturan & Harga (Dinamis)</CardTitle>
                <CardDescription>
                  Perubahan di sini tersimpan di Firestore (settings/rules) dan langsung berlaku untuk semua
                  pekerja tanpa perlu deploy ulang.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Harga per Email (Rp)</Label>
                    <Input
                      type="number"
                      value={activeRules.pricePerEmail}
                      onChange={(e) => setRulesDraft({ ...activeRules, pricePerEmail: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Biaya Penarikan (%)</Label>
                    <Input
                      type="number"
                      value={activeRules.withdrawFeePercent}
                      onChange={(e) => setRulesDraft({ ...activeRules, withdrawFeePercent: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Minimal Penarikan (Rp)</Label>
                    <Input
                      type="number"
                      value={activeRules.minWithdraw}
                      onChange={(e) => setRulesDraft({ ...activeRules, minWithdraw: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Maksimal Penarikan (Rp)</Label>
                    <Input
                      type="number"
                      value={activeRules.maxWithdraw}
                      onChange={(e) => setRulesDraft({ ...activeRules, maxWithdraw: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label>Metode Pembayaran (pisahkan dengan koma)</Label>
                  <Input
                    value={activeRules.paymentMethods.join(", ")}
                    onChange={(e) =>
                      setRulesDraft({
                        ...activeRules,
                        paymentMethods: e.target.value.split(",").map((m) => m.trim()).filter(Boolean),
                      })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Aturan Setor Email (satu aturan per baris)</Label>
                  <Textarea
                    rows={4}
                    value={activeRules.submissionNotes.join("\n")}
                    onChange={(e) =>
                      setRulesDraft({
                        ...activeRules,
                        submissionNotes: e.target.value.split("\n").map((n) => n.trim()).filter(Boolean),
                      })
                    }
                    className="mt-1.5"
                  />
                </div>
                <Button onClick={handleSaveRules} disabled={savingRules} className="bg-amber-600 hover:bg-amber-700 gap-2">
                  {savingRules && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Aturan
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
