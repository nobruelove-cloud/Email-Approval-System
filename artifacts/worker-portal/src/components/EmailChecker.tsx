import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  Filter,
  Sliders,
  Sparkles,
  Info,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const [filterTab, setFilterTab] = useState<"ALL" | "GOOD" | "BAD" | "ACTIVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

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

  function handleCopyGoodEmails() {
    const goodText = formatGoodEmailsForCopy(checkResult.items, true, masterPasswordInput);
    if (!goodText) {
      toast.error("Tidak ada email berstatus Active / Good yang dapat disalin.");
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(goodText);
      setCopied(true);
      toast.success(`${checkResult.goodCount} Email Valid (Active / Good) berhasil disalin ke clipboard!`);
      setTimeout(() => setCopied(false), 2500);
    }
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
    <div className="space-y-4 sm:space-y-6">
      {/* 1. DISCLAIMER BANNER (WORKER & ADMIN) */}
      {!isAdminView && (
        <Card className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-amber-300/80 shadow-xs">
          <CardContent className="p-3 sm:p-5 flex items-start gap-2.5 sm:gap-3.5">
            <div className="p-2 rounded-lg sm:rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 mt-0.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <h4 className="font-extrabold text-amber-950 text-xs sm:text-sm tracking-tight uppercase flex items-center gap-1.5">
                <span>CATATAN PENTING (DISCLAIMER)</span>
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-900 leading-relaxed font-medium">
                Tools Checker ini berfungsi sebagai alat bantu screening awal (Format Rules & Status Aktif). Hasil di Checker <strong>TIDAK MENJAMIN 100%</strong> email pasti di-ACC oleh Vendor. Keputusan akhir ACC dan pencairan saldo tetap sepenuhnya mengikuti verifikasi akhir sistem Vendor.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADMIN RULE CONFIGURATOR CARD */}
      {isAdminView && (
        <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl backdrop-blur-xl">
          <CardHeader className="p-3.5 sm:p-6 pb-2.5 sm:pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Pengaturan Rules Screening Master Riset / Checker
              </CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] sm:text-xs">
                Sync Real-time ke Worker
              </Badge>
            </div>
            <CardDescription className="text-[11px] sm:text-xs text-slate-400">
              Konfigurasi parameter penyaringan otomatis email untuk seluruh worker di Worker Portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-3 sm:pt-4">
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
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-955 font-bold h-10 text-xs shadow-lg shadow-emerald-500/20"
              >
                {savingAdminRules ? "Memproses..." : "Simpan Aturan Rules Screening"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 2. BULK TEXTAREA INPUT & CHECKER PANEL */}
      <Card className={isAdminView ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl" : "bg-white border-amber-100 shadow-xs"}>
        <CardHeader className="p-3.5 sm:p-6 pb-2.5 sm:pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isAdminView ? "text-slate-100" : "text-gray-900"}`}>
                <ShieldCheck className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isAdminView ? "text-emerald-400" : "text-amber-600"}`} />
                Input Massal Checker Status & Screening Format
              </CardTitle>
              <CardDescription className={`text-[11px] sm:text-xs ${isAdminView ? "text-slate-400" : "text-gray-600"}`}>
                Masukkan multi-line email. Dukungan format: <code className="font-mono bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-[10px] sm:text-[11px]">email|password</code>, <code className="font-mono bg-slate-800 text-slate-200 px-1 py-0.5 rounded text-[10px] sm:text-[11px]">email:password</code>, atau pemisah spasi.
              </CardDescription>
            </div>
            <Badge variant="outline" className={isAdminView ? "bg-slate-800 text-slate-300 border-slate-700 font-mono text-[10px] sm:text-xs" : "bg-amber-50 text-amber-900 border-amber-300 font-bold text-[10px] sm:text-xs"}>
              Rules: {activeConfigToUse.minBirthYear}-{activeConfigToUse.maxBirthYear} · Digit ≤ {activeConfigToUse.maxUsernameDigits}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 pt-0">
          {/* DEDICATED MASTER PASSWORD INPUT FIELD */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            isAdminView ? "bg-slate-955 border-slate-800" : "bg-amber-50/60 border-amber-200/80"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className={`text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                isAdminView ? "text-emerald-400" : "text-amber-950"
              }`}>
                <span>Master Password Setoran</span>
              </Label>
              {/* STATUS BADGES FOR MASTER PASSWORD MATCHING RULES */}
              {activeConfigToUse.requiredPassword && activeConfigToUse.requiredPassword.trim() ? (
                masterPasswordInput.trim() === activeConfigToUse.requiredPassword.trim() ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sesuai Rules Sandi Wajib ({activeConfigToUse.requiredPassword})
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] font-bold gap-1">
                    <XCircle className="w-3 h-3" /> Tidak Sesuai Rules Sandi Wajib ({activeConfigToUse.requiredPassword})
                  </Badge>
                )
              ) : activeConfigToUse.requirePasswordLowercaseOnly && /[A-Z]/.test(masterPasswordInput) ? (
                <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] font-bold gap-1">
                  <XCircle className="w-3 h-3" /> Sandi Mengandung Huruf Kapital
                </Badge>
              ) : masterPasswordInput.trim() ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Master Password Aktif
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400 text-[10px]">
                  Master Password Kosong (Gunakan password di baris/inline)
                </Badge>
              )}
            </div>
            <Input
              type="text"
              value={masterPasswordInput}
              onChange={(e) => setMasterPasswordInput(e.target.value)}
              placeholder="Masukkan Master Password Setoran (contoh: sandiwajib123)"
              className={`font-mono text-xs h-9 rounded-lg ${
                isAdminView
                  ? "bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500"
                  : "bg-white border-gray-200 text-gray-900 focus-visible:ring-amber-500"
              }`}
            />
            <p className={`text-[11px] ${isAdminView ? "text-slate-400" : "text-gray-500"}`}>
              Jika baris email hanya berisi alamat email tanpa sandi (contoh: <code className="font-mono text-[10px]">user@gmail.com</code>), Master Password ini akan digunakan secara otomatis.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className={`font-bold ${isAdminView ? "text-slate-300" : "text-gray-800"}`}>
                Daftar Baris Email ({checkResult.total} Baris)
              </Label>
              {rawText.trim() && (
                <button
                  type="button"
                  onClick={() => setRawText("")}
                  className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" /> Bersihkan Input
                </button>
              )}
            </div>
            <Textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"ahmad1992|sandi123\nbudi1995:rahasia456\ndedi1997 rahasia789\neka2005|SandiKapital (Akan BAD)"}
              className={`font-mono text-xs rounded-xl ${
                isAdminView
                  ? "bg-slate-955/90 border-slate-800 text-slate-100 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                  : "bg-white border-gray-200 text-gray-900 focus-visible:ring-amber-500 focus-visible:border-amber-500"
              }`}
            />
          </div>

          {/* SUMMARY STATS & ONE-CLICK COPY CTA */}
          {checkResult.total > 0 && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isAdminView ? "bg-slate-955 border-slate-800" : "bg-gradient-to-r from-amber-50 to-orange-50/60 border-amber-200/80"
            }`}>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Total Parse</span>
                  <span className="font-black text-sm text-gray-900 dark:text-slate-100">{checkResult.total} Item</span>
                </div>
                <div>
                  <span className="text-emerald-600 block text-[10px] uppercase font-bold">Active / Good</span>
                  <span className="font-black text-sm text-emerald-600">{checkResult.goodCount} Item</span>
                </div>
                <div>
                  <span className="text-rose-600 block text-[10px] uppercase font-bold">Bad / Dead</span>
                  <span className="font-black text-sm text-rose-600">{checkResult.badCount} Item</span>
                </div>
              </div>

              <Button
                onClick={handleCopyGoodEmails}
                disabled={checkResult.goodCount === 0}
                className={`font-bold text-xs h-10 px-4 rounded-xl shrink-0 gap-1.5 shadow-sm active:scale-95 transition-transform ${
                  isAdminView
                    ? "bg-emerald-500 hover:bg-emerald-600 text-slate-955"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Tersalin!" : `Copy Active / Good Emails (${checkResult.goodCount})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. INTERACTIVE FILTER TABS & RESULTS TABLE */}
      {checkResult.total > 0 && (
        <Card className={isAdminView ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl" : "bg-white border-amber-100 shadow-xs"}>
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* FILTER PILLS */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-955 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterTab === "ALL"
                      ? isAdminView
                        ? "bg-emerald-500 text-slate-955 shadow-xs"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  All ({checkResult.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("GOOD")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    filterTab === "GOOD" || filterTab === "ACTIVE"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active / Good ({checkResult.goodCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("BAD")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    filterTab === "BAD"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Bad / Dead ({checkResult.badCount})
                </button>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari email / username..."
                  className={`pl-8 h-8 text-xs rounded-lg ${
                    isAdminView
                      ? "bg-slate-955 border-slate-800 text-slate-100"
                      : "bg-gray-50 border-gray-200 text-gray-900"
                  }`}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {displayedItems.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                Tidak ada item yang sesuai dengan filter.
              </p>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className={`border-b font-bold ${
                        isAdminView ? "bg-slate-955 border-slate-800 text-slate-300" : "bg-amber-50/80 border-amber-200 text-amber-950"
                      }`}>
                        <tr>
                          <th className="px-3.5 py-2.5">#</th>
                          <th className="px-3.5 py-2.5">Email & Sandi</th>
                          <th className="px-3.5 py-2.5">Username Screening</th>
                          <th className="px-3.5 py-2.5 text-center">Status</th>
                          <th className="px-3.5 py-2.5">Keterangan / Alasan Bad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                        {displayedItems.map((item, idx) => (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              item.status === "GOOD"
                                ? "bg-emerald-50/30 dark:bg-emerald-500/5 hover:bg-emerald-50/60"
                                : "bg-rose-50/30 dark:bg-rose-500/5 hover:bg-rose-50/60"
                            }`}
                          >
                            <td className="px-3.5 py-2.5 text-gray-400 dark:text-slate-500 font-sans">{idx + 1}</td>
                            <td className="px-3.5 py-2.5">
                              <p className="font-bold text-gray-900 dark:text-slate-100">{item.email}</p>
                              {item.password && (
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 font-sans">Sandi: {item.password}</p>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-gray-700 dark:text-slate-300">
                              <span>{item.username}</span>
                              <div className="text-[10px] text-gray-400 dark:text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                <span>Digits: {item.digitCountDetected}</span>
                                {item.birthYearDetected && <span>· Thn: {item.birthYearDetected}</span>}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-sans">
                              {item.status === "GOOD" ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold text-[10px] gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> ACTIVE / GOOD
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 font-bold text-[10px] gap-1">
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3 font-mono">
                  {displayedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                        item.status === "GOOD"
                          ? "bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-500/30"
                          : "bg-rose-50/30 dark:bg-rose-500/5 border-rose-500/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">{idx + 1}. {item.email}</p>
                          {item.password && (
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-sans">Sandi: {item.password}</p>
                          )}
                        </div>
                        {item.status === "GOOD" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold text-[10px] gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> GOOD
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 font-bold text-[10px] gap-1 shrink-0">
                            <XCircle className="w-3 h-3" /> BAD
                          </Badge>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-600 dark:text-slate-400 font-sans flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-800">
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
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
