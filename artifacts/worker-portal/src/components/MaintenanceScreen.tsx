import { useEffect, useState } from "react";
import { Mail, Clock, RefreshCw, LogOut, Check, Settings, Send, Wrench, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaintenanceConfig } from "@/lib/portal-types";

export function MaintenanceScreen({
  maintenance,
  onLogout,
}: {
  maintenance?: Partial<MaintenanceConfig> | null;
  onLogout?: () => void;
}) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Time calculations
  const rawEndTime = maintenance?.targetEndTime;
  let targetMs = 0;
  let isValidDate = false;

  if (rawEndTime && typeof rawEndTime === "string" && rawEndTime.trim()) {
    const parsed = new Date(rawEndTime).getTime();
    if (!isNaN(parsed) && isFinite(parsed)) {
      targetMs = parsed;
      isValidDate = true;
    }
  }

  // Fallback target time if not set or invalid: 30 minutes from initial render
  const defaultDurationMs = 30 * 60 * 1000;
  const effectiveTargetMs = isValidDate && targetMs > 0 ? targetMs : now + defaultDurationMs;
  const effectiveStartMs = effectiveTargetMs - defaultDurationMs;

  const diffMs = Math.max(0, effectiveTargetMs - now);
  const totalDurationMs = Math.max(1, effectiveTargetMs - effectiveStartMs);
  const elapsedMs = Math.min(totalDurationMs, Math.max(0, now - effectiveStartMs));

  // Calculated percentage (bounded 1 to 100)
  const rawProgress = Math.round((elapsedMs / totalDurationMs) * 100);
  const progressPercent = isValidDate
    ? Math.min(100, Math.max(1, rawProgress))
    : 68; // Default 68% for display if date is invalid/not specified

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

  // Format WIB time string (e.g. "14:30 WIB")
  const formatWIB = (ms: number) => {
    try {
      const d = new Date(ms);
      const timeStr = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      });
      return `${timeStr.replace(".", ":")} WIB`;
    } catch {
      return "14:30 WIB";
    }
  };

  const estimatedWIB = formatWIB(effectiveTargetMs);
  const startTimeWIB = formatWIB(effectiveStartMs);
  const midTimeWIB = formatWIB(effectiveStartMs + totalDurationMs * 0.5);
  const nearEndTimeWIB = formatWIB(effectiveStartMs + totalDurationMs * 0.85);

  const dynamicMessage =
    maintenance?.message && maintenance.message.trim()
      ? maintenance.message.trim()
      : "Kami sedang melakukan proses pemeliharaan sistem untuk memberikan performa terbaik. Mohon tunggu beberapa saat lagi.";

  return (
    <div className="min-h-screen w-full bg-[#F0F4F9] text-slate-800 flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 font-sans select-none relative overflow-x-hidden">
      {/* Dynamic Background Glow FX */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-100/60 via-indigo-50/30 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto flex flex-col items-center space-y-6 sm:space-y-7 my-auto">
        {/* 1. Header Logo & Branding */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-4 sm:px-5 py-2.5 rounded-2xl border border-blue-100 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-none">
                Gmail Job
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-tight mt-0.5">
              PLATFORM KERJA ONLINE
            </span>
          </div>
        </div>

        {/* 2. Hero Illustration Section (Laptop with Floating Elements) */}
        <div className="relative w-full max-w-xs sm:max-w-sm my-2 flex flex-col items-center justify-center">
          {/* Ambient Screen Backdrop Glow */}
          <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse pointer-events-none" />

          {/* Floating Gear Element (Top Left) */}
          <div className="absolute -top-3 -left-2 sm:-left-4 z-20 w-11 h-11 rounded-2xl bg-white border border-blue-100 shadow-lg flex items-center justify-center text-blue-600 animate-spin" style={{ animationDuration: "10s" }}>
            <Settings className="w-6 h-6" />
          </div>

          {/* Floating Envelope/Paper Plane (Top Right) */}
          <div className="absolute -top-4 -right-2 sm:-right-4 z-20 w-11 h-11 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center animate-bounce" style={{ animationDuration: "3s" }}>
            <Send className="w-5 h-5 -rotate-12" />
          </div>

          {/* Floating Wrench Badge (Bottom Left) */}
          <div className="absolute -bottom-2 -left-3 z-20 w-9 h-9 rounded-xl bg-amber-500 text-white shadow-md flex items-center justify-center">
            <Wrench className="w-4 h-4" />
          </div>

          {/* Laptop Screen Body */}
          <div className="w-full relative z-10">
            <div className="bg-slate-900 border-4 border-slate-800 rounded-t-2xl p-4 sm:p-5 text-center relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[160px] sm:min-h-[180px]">
              {/* Laptop Screen Header Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/60 via-slate-900 to-indigo-950/80" />

              {/* Glowing Code/Grid Matrix pattern inside laptop */}
              <div className="relative z-10 space-y-3 w-full flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" style={{ animationDuration: "6s" }} />
                  Maintenance Job Gmail
                </div>

                {/* Laptop Internal Progress Display */}
                <div className="w-full max-w-[200px] space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-blue-300/80 font-bold px-1">
                    <span>System Optimizing</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-blue-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 relative"
                      style={{ width: `${progressPercent}%` }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Laptop Base Plate */}
            <div className="h-4 bg-slate-800 rounded-b-xl border-t border-slate-700 w-[110%] -ml-[5%] flex items-center justify-center relative shadow-xl">
              <div className="w-14 h-1 bg-slate-600 rounded-full" />
            </div>
          </div>
        </div>

        {/* 3. Title & Subtitle */}
        <div className="text-center space-y-2 max-w-md mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-100/80 border border-blue-200 text-blue-700 text-xs font-extrabold rounded-full mb-1">
            Sistem Sedang Dalam Perbaikan
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Job Gmail Sedang Maintenance
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            {dynamicMessage}
          </p>
        </div>

        {/* 4. Real-Time Dynamic Timer Card */}
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-700">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Estimasi Selesai:</span>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-extrabold font-mono">
              {isValidDate ? estimatedWIB : "Dalam Perbaikan"}
            </span>
          </div>

          {/* Countdown Display or Fallback Message */}
          {isValidDate ? (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Sisa Waktu
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-blue-600 shadow-2xs">
                  {pad(hours)}
                  <span className="text-[10px] text-slate-400 font-sans ml-1 font-semibold">j</span>
                </div>
                <span className="text-slate-400 font-bold">:</span>
                <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-blue-600 shadow-2xs">
                  {pad(minutes)}
                  <span className="text-[10px] text-slate-400 font-sans ml-1 font-semibold">m</span>
                </div>
                <span className="text-slate-400 font-bold">:</span>
                <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-blue-600 shadow-2xs">
                  {pad(seconds)}
                  <span className="text-[10px] text-slate-400 font-sans ml-1 font-semibold">s</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <span className="text-xs font-bold text-slate-500 block">Proses Pemeliharaan Berjalan</span>
              <span className="text-[11px] text-slate-400">Estimasi waktu pengerjaan sedang disesuaikan.</span>
            </div>
          )}
        </div>

        {/* 5. Animated Progress Bar & Interactive Timeline Steps */}
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center text-xs font-extrabold text-slate-700">
            <span>Progres Pemeliharaan</span>
            <span className="text-blue-600 font-mono text-sm">{progressPercent}%</span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Timeline Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-left">
            {/* Step 1 */}
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              progressPercent >= 1
                ? "bg-blue-50/70 border-blue-200 text-blue-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black">1% - Memulai</span>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  progressPercent >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">{startTimeWIB}</span>
            </div>

            {/* Step 2 */}
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              progressPercent >= 68
                ? "bg-blue-50/70 border-blue-200 text-blue-900"
                : progressPercent >= 20
                ? "bg-blue-50/40 border-blue-300 text-blue-900 ring-2 ring-blue-500/20"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black">68% - Dalam Proses</span>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  progressPercent >= 68
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-600 animate-spin"
                }`}>
                  {progressPercent >= 68 ? <Check className="w-2.5 h-2.5" /> : <Settings className="w-2.5 h-2.5" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">{midTimeWIB}</span>
            </div>

            {/* Step 3 */}
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              progressPercent >= 95
                ? "bg-blue-50/70 border-blue-200 text-blue-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black">100% - Hampir Selesai</span>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  progressPercent >= 95 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                }`}>
                  {progressPercent >= 95 ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">{nearEndTimeWIB}</span>
            </div>

            {/* Step 4 */}
            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
              progressPercent >= 100
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black">Selesai</span>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  progressPercent >= 100 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
                }`}>
                  <Check className="w-2.5 h-2.5" />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">{estimatedWIB}</span>
            </div>
          </div>
        </div>

        {/* 6. Info Footer Note Pill Banner */}
        <div className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50/90 border border-blue-200/80 rounded-full text-xs font-semibold text-blue-700 shadow-2xs text-center max-w-full">
          <span>ℹ️ Terima kasih atas pengertiannya. Tetap semangat! 💙</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs h-9 px-4 gap-1.5 rounded-xl shadow-2xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" /> Refresh Halaman
          </Button>
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs h-9 px-4 rounded-xl gap-1.5 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar / Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
