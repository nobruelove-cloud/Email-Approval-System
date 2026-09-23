import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  Sliders,
  Info,
  ShieldCheck,
  RotateCcw,
  SearchCheck,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettings, saveSettings } from "@/hooks/use-portal";
import { DEFAULT_RULES, DEFAULT_CHECKER_RULES, type CheckerRulesConfig } from "@/lib/portal-types";
import { bulkCheckEmails, formatGoodEmailsForCopy } from "@/lib/portal-utils";

export interface EmailCheckerProps {
  isAdminView?: boolean;
}

export function EmailChecker({ isAdminView = false }: EmailCheckerProps) {
  const rulesHook = useSettings("rules", DEFAULT_RULES);
  const currentRules = rulesHook.data ?? DEFAULT_RULES;
  const checkerRulesConfig = currentRules.checkerRules ?? DEFAULT_CHECKER_RULES;

  const activeRequiredPassword = checkerRulesConfig.requiredPassword ?? currentRules.requiredPassword ?? "";

  const [rawText, setRawText] = useState("");
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>(activeRequiredPassword);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "GOOD" | "BAD" | "ACTIVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<Set<number>>(new Set());

  // Sync masterPasswordInput when remote requiredPassword changes unless user edited it
  React.useEffect(() => {
    setMasterPasswordInput(activeRequiredPassword);
  }, [activeRequiredPassword]);

  // Admin Configurator State
  const [adminRules, setAdminRules] = useState<CheckerRulesConfig>(checkerRulesConfig);
  const [savingAdminRules, setSavingAdminRules] = useState(false);

  // String state for input fields to allow empty string during editing without defaulting immediately to 0
  const [minBirthYearStr, setMinBirthYearStr] = useState<string>(
    String(checkerRulesConfig.minBirthYear ?? DEFAULT_CHECKER_RULES.minBirthYear)
  );
  const [maxBirthYearStr, setMaxBirthYearStr] = useState<string>(
    String(checkerRulesConfig.maxBirthYear ?? DEFAULT_CHECKER_RULES.maxBirthYear)
  );
  const [maxUsernameDigitsStr, setMaxUsernameDigitsStr] = useState<string>(
    String(checkerRulesConfig.maxUsernameDigits ?? DEFAULT_CHECKER_RULES.maxUsernameDigits)
  );

  // Keep admin local rules updated if remote changes
  React.useEffect(() => {
    if (currentRules.checkerRules) {
      setAdminRules(currentRules.checkerRules);
      setMinBirthYearStr(String(currentRules.checkerRules.minBirthYear ?? DEFAULT_CHECKER_RULES.minBirthYear));
      setMaxBirthYearStr(String(currentRules.checkerRules.maxBirthYear ?? DEFAULT_CHECKER_RULES.maxBirthYear));
      setMaxUsernameDigitsStr(String(currentRules.checkerRules.maxUsernameDigits ?? DEFAULT_CHECKER_RULES.maxUsernameDigits));
    }
  }, [currentRules.checkerRules]);

  const handleMinBirthYearChange = (valStr: string) => {
    setMinBirthYearStr(valStr);
    const parsed = parseInt(valStr, 10);
    setAdminRules((prev) => ({
      ...prev,
      minBirthYear: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handleMinBirthYearBlur = () => {
    const parsed = parseInt(minBirthYearStr, 10);
    if (isNaN(parsed) || minBirthYearStr.trim() === "") {
      const fallback = DEFAULT_CHECKER_RULES.minBirthYear;
      setMinBirthYearStr(String(fallback));
      setAdminRules((prev) => ({ ...prev, minBirthYear: fallback }));
    } else {
      setMinBirthYearStr(String(parsed));
      setAdminRules((prev) => ({ ...prev, minBirthYear: parsed }));
    }
  };

  const handleMaxBirthYearChange = (valStr: string) => {
    setMaxBirthYearStr(valStr);
    const parsed = parseInt(valStr, 10);
    setAdminRules((prev) => ({
      ...prev,
      maxBirthYear: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handleMaxBirthYearBlur = () => {
    const parsed = parseInt(maxBirthYearStr, 10);
    if (isNaN(parsed) || maxBirthYearStr.trim() === "") {
      const fallback = DEFAULT_CHECKER_RULES.maxBirthYear;
      setMaxBirthYearStr(String(fallback));
      setAdminRules((prev) => ({ ...prev, maxBirthYear: fallback }));
    } else {
      setMaxBirthYearStr(String(parsed));
      setAdminRules((prev) => ({ ...prev, maxBirthYear: parsed }));
    }
  };

  const handleMaxUsernameDigitsChange = (valStr: string) => {
    setMaxUsernameDigitsStr(valStr);
    const parsed = parseInt(valStr, 10);
    setAdminRules((prev) => ({
      ...prev,
      maxUsernameDigits: isNaN(parsed) ? 0 : parsed,
    }));
  };

  const handleMaxUsernameDigitsBlur = () => {
    const parsed = parseInt(maxUsernameDigitsStr, 10);
    if (isNaN(parsed) || maxUsernameDigitsStr.trim() === "") {
      const fallback = DEFAULT_CHECKER_RULES.maxUsernameDigits;
      setMaxUsernameDigitsStr(String(fallback));
      setAdminRules((prev) => ({ ...prev, maxUsernameDigits: fallback }));
    } else {
      setMaxUsernameDigitsStr(String(parsed));
      setAdminRules((prev) => ({ ...prev, maxUsernameDigits: parsed }));
    }
  };

  // Execute Line-by-Line Screening Logic using active rules
  const activeConfigToUse = isAdminView ? adminRules : checkerRulesConfig;
  const checkResult = useMemo(() => {
    return bulkCheckEmails(rawText, activeConfigToUse, masterPasswordInput);
  }, [rawText, activeConfigToUse, masterPasswordInput]);

  // Filtered list based on tab & search query
  const displayedItems = useMemo(() => {
    return checkResult.items.filter((item) => {
      if ((filterTab === "GOOD" || filterTab === "ACTIVE") && item.status !== "GOOD") return false;
      if (filterTab === "BAD" && item.status !== "BAD") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEmail = item.email.toLowerCase().includes(q);
        const matchUser = item.username.toLowerCase().includes(q);
        const matchReason = item.reasons.some((r) => r.toLowerCase().includes(q));
        return matchEmail || matchUser || matchReason;
      }
      return true;
    });
  }, [checkResult.items, filterTab, searchQuery]);

  // Selection state helpers
  const isAllSelected = useMemo(() => {
    if (displayedItems.length === 0) return false;
    return displayedItems.every((item) => selectedLineIndexes.has(item.lineIndex));
  }, [displayedItems, selectedLineIndexes]);

  function handleToggleSelectAll() {
    const updated = new Set(selectedLineIndexes);
    if (isAllSelected) {
      displayedItems.forEach((item) => updated.delete(item.lineIndex));
    } else {
      displayedItems.forEach((item) => updated.add(item.lineIndex));
    }
    setSelectedLineIndexes(updated);
  }

  function handleToggleLine(lineIndex: number) {
    const updated = new Set(selectedLineIndexes);
    if (updated.has(lineIndex)) {
      updated.delete(lineIndex);
    } else {
      updated.add(lineIndex);
    }
    setSelectedLineIndexes(updated);
  }

  // Individual item delete
  function handleDeleteSingleLine(lineIndex: number) {
    const lines = rawText.split("\n");
    const targetEmail = checkResult.items.find((it) => it.lineIndex === lineIndex)?.email || "Email";
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines.splice(lineIndex, 1);
      const newText = lines.join("\n");
      setRawText(newText);

      const updatedSelected = new Set(selectedLineIndexes);
      updatedSelected.delete(lineIndex);
      setSelectedLineIndexes(updatedSelected);

      toast.success(`Baris email "${targetEmail}" berhasil dihapus.`);
    }
  }

  // Mass Delete selected
  function handleDeleteSelectedLines() {
    if (selectedLineIndexes.size === 0) {
      toast.error("Pilih minimal satu email untuk dihapus.");
      return;
    }

    const lines = rawText.split("\n");
    const count = selectedLineIndexes.size;
    const remainingLines = lines.filter((_, idx) => !selectedLineIndexes.has(idx));

    setRawText(remainingLines.join("\n"));
    setSelectedLineIndexes(new Set());
    toast.success(`${count} baris email berhasil dihapus dari daftar.`);
  }

  // Clear All lines
  function handleClearAllLines() {
    if (!rawText.trim()) {
      toast.error("Daftar email sudah kosong.");
      return;
    }
    setRawText("");
    setSelectedLineIndexes(new Set());
    toast.success("Seluruh daftar baris email berhasil dibersihkan.");
  }

  function handleCopyGoodEmails() {
    const goodText = formatGoodEmailsForCopy(checkResult.items, true, masterPasswordInput);
    if (!goodText) {
      toast.error("Tidak ada email berstatus Valid / Good yang dapat disalin.");
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(goodText);
      setCopied(true);
      toast.success(`${checkResult.goodCount} Email Valid (Active / Good) berhasil disalin ke clipboard!`);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleTriggerScreening() {
    if (!rawText.trim()) {
      toast.error("Masukkan daftar email terlebih dahulu untuk melakukan screening.");
      return;
    }
    toast.success(`Screening selesai! Ditemukan ${checkResult.goodCount} email Valid / Good dan ${checkResult.badCount} Invalid / Bad.`);
  }

  async function handleSaveAdminRules(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdminRules(true);

    const parsedMin = parseInt(minBirthYearStr, 10);
    const parsedMax = parseInt(maxBirthYearStr, 10);
    const parsedDigits = parseInt(maxUsernameDigitsStr, 10);

    const updatedRules: CheckerRulesConfig = {
      ...adminRules,
      minBirthYear: isNaN(parsedMin) ? DEFAULT_CHECKER_RULES.minBirthYear : parsedMin,
      maxBirthYear: isNaN(parsedMax) ? DEFAULT_CHECKER_RULES.maxBirthYear : parsedMax,
      maxUsernameDigits: isNaN(parsedDigits) ? DEFAULT_CHECKER_RULES.maxUsernameDigits : parsedDigits,
    };

    try {
      await saveSettings("rules", {
        ...currentRules,
        checkerRules: updatedRules,
      });
      setAdminRules(updatedRules);
      setMinBirthYearStr(String(updatedRules.minBirthYear));
      setMaxBirthYearStr(String(updatedRules.maxBirthYear));
      setMaxUsernameDigitsStr(String(updatedRules.maxUsernameDigits));
      toast.success("Aturan Screening Checker Email berhasil diperbarui!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan aturan checker.");
    } finally {
      setSavingAdminRules(false);
    }
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* 1. PAGE HEADER (WORKER VIEW) */}
      {!isAdminView && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <SearchCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Screening Email
            </h2>
            <p className="text-xs text-slate-500">
              Cek format dan kesesuaian email berdasarkan aturan sistem sebelum disetor ke Job Gmail.
            </p>
          </div>
        </div>
      )}

      {/* 2. INFORMATION / DISCLAIMER CARD (WORKER VIEW) */}
      {!isAdminView && (
        <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Informasi & Panduan Screening Email
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Gunakan Screening Email sebelum setor untuk mengecek email berdasarkan aturan sistem.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-blue-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Catatan Penting (Disclaimer)
              </p>
              <p className="text-slate-600 leading-relaxed text-xs">
                Hasil screening merupakan pengecekan berdasarkan aturan sistem dan bukan jaminan email akan diterima/ACC. Keputusan akhir ACC tetap mengikuti verifikasi sistem Vendor.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADMIN RULE CONFIGURATOR CARD (ADMIN VIEW ONLY) */}
      {isAdminView && (
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl backdrop-blur-xl rounded-2xl">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-bold text-emerald-400 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Pengaturan Rules Screening Master Riset / Checker
              </CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                Sync Real-time ke Worker
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Konfigurasi parameter penyaringan otomatis email untuk seluruh worker di Worker Portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSaveAdminRules} className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-955 border border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-200">Aktifkan Screening Otomatis</Label>
                  <p className="text-[11px] text-slate-400">Jalankan filter rules otomatis saat worker memuat baris email.</p>
                </div>
                <Switch
                  checked={adminRules.enabled}
                  onCheckedChange={(val) => setAdminRules({ ...adminRules, enabled: val })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-955 border border-slate-800">
                  <Label className="text-xs font-bold text-slate-300">Min. Tahun Lahir</Label>
                  <Input
                    type="number"
                    value={minBirthYearStr}
                    onChange={(e) => handleMinBirthYearChange(e.target.value)}
                    onBlur={handleMinBirthYearBlur}
                    className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono h-9"
                  />
                  <p className="text-[10px] text-slate-400">Contoh: 1990</p>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-slate-955 border border-slate-800">
                  <Label className="text-xs font-bold text-slate-300">Maks. Tahun Lahir</Label>
                  <Input
                    type="number"
                    value={maxBirthYearStr}
                    onChange={(e) => handleMaxBirthYearChange(e.target.value)}
                    onBlur={handleMaxBirthYearBlur}
                    className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono h-9"
                  />
                  <p className="text-[10px] text-slate-400">Contoh: 1998</p>
                </div>

                <div className="space-y-1.5 p-3 rounded-xl bg-slate-955 border border-slate-800">
                  <Label className="text-xs font-bold text-slate-300">Maks. Digit Angka Username</Label>
                  <Input
                    type="number"
                    value={maxUsernameDigitsStr}
                    onChange={(e) => handleMaxUsernameDigitsChange(e.target.value)}
                    onBlur={handleMaxUsernameDigitsBlur}
                    className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono h-9"
                  />
                  <p className="text-[10px] text-slate-400">Maksimal digit (Contoh: 3)</p>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-slate-955 border border-slate-800">
                <Label className="text-xs font-bold text-slate-300">Password Wajib / Master Setoran (Rules Required Password)</Label>
                <Input
                  type="text"
                  value={adminRules.requiredPassword ?? ""}
                  onChange={(e) => setAdminRules({ ...adminRules, requiredPassword: e.target.value })}
                  placeholder="Contoh: sandiwajib123"
                  className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono h-9"
                />
                <p className="text-[10px] text-slate-400">Jika diisi, seluruh email yang disetor wajib menggunakan kata sandi ini.</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-955 border border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-200">Wajib Password Huruf Kecil Sahaja</Label>
                  <p className="text-[11px] text-slate-400">Tolak password jika mengandung huruf kapital (A-Z).</p>
                </div>
                <Switch
                  checked={adminRules.requirePasswordLowercaseOnly}
                  onCheckedChange={(val) => setAdminRules({ ...adminRules, requirePasswordLowercaseOnly: val })}
                />
              </div>

              <Button
                type="submit"
                disabled={savingAdminRules}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs rounded-xl shadow-xs"
              >
                {savingAdminRules ? "Memproses..." : "Simpan Aturan Rules Screening"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 3. BULK TEXTAREA INPUT & MASTER PASSWORD CARD */}
      <Card className={isAdminView ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl rounded-2xl" : "bg-white border-slate-200/80 rounded-2xl shadow-xs"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className={`text-sm font-bold flex items-center gap-2 ${isAdminView ? "text-slate-100" : "text-slate-900"}`}>
                <ShieldCheck className={`w-4 h-4 ${isAdminView ? "text-emerald-400" : "text-blue-600"}`} />
                Input Baris Email & Master Password
              </CardTitle>
              <CardDescription className={`text-xs ${isAdminView ? "text-slate-400" : "text-slate-500"}`}>
                Dukungan format input: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">email|password</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">email:password</code>, atau spasi.
              </CardDescription>
            </div>
            <Badge variant="outline" className={isAdminView ? "bg-slate-800 text-slate-300 border-slate-700 font-mono text-xs" : "bg-blue-50 text-blue-700 border-blue-200 font-bold text-xs"}>
              Rules: Thn {activeConfigToUse.minBirthYear}-{activeConfigToUse.maxBirthYear} · Digit ≤ {activeConfigToUse.maxUsernameDigits}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MASTER PASSWORD INPUT FIELD */}
          <div className={`p-3.5 rounded-xl border space-y-2 ${
            isAdminView ? "bg-slate-955 border-slate-800" : "bg-slate-50 border-slate-200/80"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isAdminView ? "text-emerald-400" : "text-slate-800"
              }`}>
                <span>Master Password Setoran</span>
              </Label>
              {/* STATUS BADGES FOR MASTER PASSWORD MATCHING RULES */}
              {activeConfigToUse.requiredPassword && activeConfigToUse.requiredPassword.trim() ? (
                masterPasswordInput.trim() === activeConfigToUse.requiredPassword.trim() ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sesuai Rules Sandi Wajib ({activeConfigToUse.requiredPassword})
                  </Badge>
                ) : (
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold gap-1">
                    <XCircle className="w-3 h-3" /> Tidak Sesuai Rules Sandi Wajib ({activeConfigToUse.requiredPassword})
                  </Badge>
                )
              ) : activeConfigToUse.requirePasswordLowercaseOnly && /[A-Z]/.test(masterPasswordInput) ? (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold gap-1">
                  <XCircle className="w-3 h-3" /> Sandi Mengandung Huruf Kapital
                </Badge>
              ) : masterPasswordInput.trim() ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Master Password Aktif
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500 text-[10px] bg-white border-slate-200">
                  Master Password Kosong (Gunakan password di baris/inline)
                </Badge>
              )}
            </div>

            <div className="relative">
              <Input
                type={showMasterPassword ? "text" : "password"}
                value={masterPasswordInput}
                onChange={(e) => setMasterPasswordInput(e.target.value)}
                placeholder="Masukkan Master Password Setoran (contoh: sandiwajib123)"
                className={`font-mono text-xs h-11 min-h-[44px] rounded-xl pr-10 ${
                  isAdminView
                    ? "bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500"
                    : "bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowMasterPassword(!showMasterPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showMasterPassword ? "Sembunyikan Master Password" : "Tampilkan Master Password"}
              >
                {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className={`text-[11px] ${isAdminView ? "text-slate-400" : "text-slate-500"}`}>
              Jika baris email hanya berisi alamat email tanpa sandi (contoh: <code className="font-mono text-[10px]">user@gmail.com</code>), Master Password ini akan digunakan secara otomatis.
            </p>
          </div>

          {/* EMAIL TEXTAREA INPUT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className={`font-bold ${isAdminView ? "text-slate-300" : "text-slate-800"}`}>
                Daftar Baris Email ({checkResult.total} Baris)
              </Label>
              {rawText.trim() && (
                <button
                  type="button"
                  onClick={handleClearAllLines}
                  className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-1 font-semibold min-h-[44px] py-2 px-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Bersihkan Input
                </button>
              )}
            </div>
            <Textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"ahmad1992|sandi123\nbudi1995:rahasia456\ndedi1997 rahasia789\neka2005|SandiKapital (Akan BAD)"}
              className={`font-mono text-xs rounded-xl p-3 ${
                isAdminView
                  ? "bg-slate-955/90 border-slate-800 text-slate-100 focus-visible:ring-emerald-500"
                  : "bg-slate-50/50 border-slate-200 text-slate-900 focus-visible:ring-blue-500"
              }`}
            />
          </div>

          {/* SCREENING ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={handleTriggerScreening}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 min-h-[44px] px-5 rounded-xl shadow-xs gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <SearchCheck className="w-4 h-4" />
              <span>Jalankan Screening Email</span>
            </Button>

            {checkResult.goodCount > 0 && (
              <Button
                type="button"
                onClick={handleCopyGoodEmails}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 min-h-[44px] px-5 rounded-xl shadow-xs gap-2 cursor-pointer active:scale-95 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Tersalin!" : `Salin Email Valid / Good (${checkResult.goodCount})`}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. EMPTY STATE CARD (BEFORE SCREENING / NO INPUT) */}
      {checkResult.total === 0 && !rawText.trim() && (
        <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
            <SearchCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900">Belum Ada Email Discreening</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Masukkan daftar alamat email pada kolom input di atas, lalu klik tombol <strong className="text-slate-800">Jalankan Screening Email</strong> untuk memeriksa format dan aturan sistem sebelum disetor.
            </p>
          </div>
        </Card>
      )}

      {/* 5. SUMMARY STATS CHIPS, FILTER CONTROLS & MASS DELETE BAR */}
      {checkResult.total > 0 && (
        <Card className={isAdminView ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl rounded-2xl" : "bg-white border-slate-200/80 rounded-2xl shadow-xs"}>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            {/* Metric Summary Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Email</span>
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">{checkResult.total} Item</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-center space-y-0.5">
                <span className="text-emerald-700 dark:text-emerald-400 block text-[10px] uppercase font-bold">Valid / Good</span>
                <span className="font-extrabold text-sm sm:text-base text-emerald-700 dark:text-emerald-400">{checkResult.goodCount} Item</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-center space-y-0.5">
                <span className="text-rose-700 dark:text-rose-400 block text-[10px] uppercase font-bold">Invalid / Bad</span>
                <span className="font-extrabold text-sm sm:text-base text-rose-700 dark:text-rose-400">{checkResult.badCount} Item</span>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setFilterTab("ALL")}
                  className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                    filterTab === "ALL"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Semua ({checkResult.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("GOOD")}
                  className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] inline-flex items-center justify-center gap-1 rounded-lg transition-all cursor-pointer ${
                    filterTab === "GOOD" || filterTab === "ACTIVE"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Valid ({checkResult.goodCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("BAD")}
                  className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] inline-flex items-center justify-center gap-1 rounded-lg transition-all cursor-pointer ${
                    filterTab === "BAD"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-rose-700 dark:text-rose-400 hover:bg-rose-50"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Invalid ({checkResult.badCount})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari email / username..."
                  className={`pl-8 h-11 min-h-[44px] text-xs rounded-xl ${
                    isAdminView
                      ? "bg-slate-955 border-slate-800 text-slate-100"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            {/* MASS DELETE & SELECT ALL CONTROL TOOLBAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 cursor-pointer select-none py-1.5 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                    id="select-all-emails"
                    className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label
                    htmlFor="select-all-emails"
                    className={`text-xs font-bold cursor-pointer pointer-events-none ${
                      isAdminView ? "text-slate-200" : "text-slate-800"
                    }`}
                  >
                    Select All / Pilih Semua ({displayedItems.length})
                  </label>
                </div>

                {selectedLineIndexes.size > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                    {selectedLineIndexes.size} Dipilih
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedLineIndexes.size > 0 && (
                  <Button
                    type="button"
                    onClick={handleDeleteSelectedLines}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 min-h-[44px] px-4 rounded-xl shadow-xs gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus yang Dipilih ({selectedLineIndexes.size})</span>
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleClearAllLines}
                  variant="outline"
                  className="bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-600 border-rose-200 font-bold text-xs h-10 min-h-[44px] px-3.5 rounded-xl gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Bersihkan Semua</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* 6. RESULTS LIST / TABLE WITH INDIVIDUAL DELETE TRASH ICONS */}
          <CardContent className="pt-4">
            {displayedItems.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Tidak ada email yang sesuai dengan filter pencarian.
              </p>
            ) : (
              <>
                {/* Desktop Table (hidden sm:block) */}
                <div className="hidden sm:block border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className={`border-b font-bold ${
                        isAdminView ? "bg-slate-955 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}>
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleToggleSelectAll}
                              className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </th>
                          <th className="px-3.5 py-2.5">#</th>
                          <th className="px-3.5 py-2.5">Alamat Email</th>
                          <th className="px-3.5 py-2.5">Username</th>
                          <th className="px-3.5 py-2.5 text-center">Detail Rules</th>
                          <th className="px-3.5 py-2.5 text-center">Status</th>
                          <th className="px-3.5 py-2.5">Keterangan / Catatan</th>
                          <th className="px-3.5 py-2.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {displayedItems.map((item, idx) => {
                          const isSelected = selectedLineIndexes.has(item.lineIndex);

                          return (
                            <tr
                              key={item.lineIndex}
                              className={`transition-colors ${
                                isSelected
                                  ? "bg-blue-50/60 dark:bg-blue-900/20"
                                  : item.status === "GOOD"
                                  ? "bg-emerald-50/20 dark:bg-emerald-500/5 hover:bg-emerald-50/40"
                                  : "bg-rose-50/20 dark:bg-rose-500/5 hover:bg-rose-50/40"
                              }`}
                            >
                              <td className="px-3 py-2.5 text-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleLine(item.lineIndex)}
                                  className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-400 font-sans">{idx + 1}</td>
                              <td className="px-3.5 py-2.5">
                                <p className="font-bold text-slate-900 dark:text-slate-100">{item.email}</p>
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                                <span>{item.username}</span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-sans text-[11px] text-slate-500">
                                <span>Digits: {item.digitCountDetected}{item.birthYearDetected ? ` · Thn: ${item.birthYearDetected}` : ""}</span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-sans">
                                {item.status === "GOOD" ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> ACTIVE / GOOD
                                  </Badge>
                                ) : (
                                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] gap-1">
                                    <XCircle className="w-3 h-3" /> BAD / DEAD
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 font-sans">
                                {item.status === "GOOD" ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                                    ✓ Lolos rules screening awal
                                  </span>
                                ) : (
                                  <div className="space-y-0.5 text-xs text-rose-700 dark:text-rose-400">
                                    {item.reasons.map((r, rIdx) => (
                                      <p key={rIdx}>• {r}</p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleLine(item.lineIndex)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center min-h-[36px] min-w-[36px]"
                                  title="Hapus Baris Email Ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards (sm:hidden) */}
                <div className="sm:hidden space-y-2.5 font-mono">
                  {displayedItems.map((item, idx) => {
                    const isSelected = selectedLineIndexes.has(item.lineIndex);

                    return (
                      <div
                        key={item.lineIndex}
                        className={`p-3.5 rounded-xl border space-y-2 text-xs transition-colors ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-300"
                            : item.status === "GOOD"
                            ? "bg-emerald-50/20 border-emerald-200"
                            : "bg-rose-50/20 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleLine(item.lineIndex)}
                              className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shrink-0 min-h-[20px] min-w-[20px]"
                            />
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                              {idx + 1}. {item.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {item.status === "GOOD" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> GOOD
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] gap-1">
                                <XCircle className="w-3 h-3" /> BAD
                              </Badge>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteSingleLine(item.lineIndex)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Hapus Baris Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 font-sans flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span>User: {item.username}</span>
                          <span>Digits: {item.digitCountDetected}{item.birthYearDetected ? ` · Thn: ${item.birthYearDetected}` : ""}</span>
                        </div>

                        <div className="pt-1 font-sans text-xs">
                          {item.status === "GOOD" ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              ✓ Lolos rules screening awal
                            </span>
                          ) : (
                            <div className="space-y-0.5 text-rose-700 dark:text-rose-400">
                              {item.reasons.map((r, rIdx) => (
                                <p key={rIdx}>• {r}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
