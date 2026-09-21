import { useEffect, useState } from "react";
import { Wrench, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaintenanceConfig } from "@/lib/portal-types";

export function MaintenanceScreen({
  maintenance,
  onLogout,
}: {
  maintenance?: Partial<MaintenanceConfig> | null;
  onLogout?: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
    isValidDate: boolean;
  }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 0,
    isValidDate: false,
  });

  useEffect(() => {
    function calcTimeLeft() {
      try {
        const rawEndTime = maintenance?.targetEndTime;
        if (!rawEndTime || typeof rawEndTime !== "string" || !rawEndTime.trim()) {
          return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, isValidDate: false };
        }

        const parsedDate = new Date(rawEndTime);
        const targetMs = parsedDate.getTime();

        if (isNaN(targetMs) || !isFinite(targetMs)) {
          return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, isValidDate: false };
        }

        const nowMs = Date.now();
        const diffMs = targetMs - nowMs;

        if (diffMs <= 0 || isNaN(diffMs)) {
          return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, isValidDate: true };
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        return {
          hours: isNaN(hours) ? 0 : hours,
          minutes: isNaN(minutes) ? 0 : minutes,
          seconds: isNaN(seconds) ? 0 : seconds,
          totalMs: isNaN(diffMs) ? 0 : diffMs,
          isValidDate: true,
        };
      } catch (err) {
        console.error("[MaintenanceScreen] Time calculation error:", err);
        return { hours: 0, minutes: 0, seconds: 0, totalMs: 0, isValidDate: false };
      }
    }

    setTimeLeft(calcTimeLeft());

    const timer = setInterval(() => {
      const remaining = calcTimeLeft();
      setTimeLeft(remaining);
      if (remaining.isValidDate && remaining.totalMs <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [maintenance?.targetEndTime]);

  const pad = (n: number) => {
    const num = isNaN(n) ? 0 : Math.max(0, n);
    return String(num).padStart(2, "0");
  };

  const dynamicMessage =
    maintenance?.message && maintenance.message.trim()
      ? maintenance.message.trim()
      : "Sistem sedang ditingkatkan. Silakan kembali beberapa saat lagi.";

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-6 relative z-10">
        {/* Glowing Animated Indicator */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 opacity-40 blur-lg animate-pulse" />
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center shadow-2xl backdrop-blur-md relative">
            <Wrench className="w-12 h-12 text-amber-400 animate-spin" style={{ animationDuration: "8s" }} />
          </div>
          <span className="absolute -bottom-2 px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg border border-amber-300">
            Maintenance System
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Sistem Sedang Dalam Perbaikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            {dynamicMessage}
          </p>
        </div>

        {/* Real-Time Countdown Timer Display with Defensive Safeguards */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Estimasi Waktu Selesai (Countdown)
          </p>

          {timeLeft.isValidDate ? (
            <>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-center">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 block">{pad(timeLeft.hours)}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Jam</span>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-center">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 block">{pad(timeLeft.minutes)}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Menit</span>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-center">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 block">{pad(timeLeft.seconds)}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Detik</span>
                </div>
              </div>
              {timeLeft.totalMs <= 0 && (
                <p className="text-xs font-semibold text-emerald-400 animate-pulse pt-1">
                  ✓ Waktu estimasi telah selesai. Klik Refresh Halaman jika dashboard belum otomatis terbuka.
                </p>
              )}
            </>
          ) : (
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-center">
              <span className="text-sm font-bold text-amber-400 block">Dalam Perbaikan</span>
              <span className="text-[10px] text-slate-400">Estimasi waktu pengerjaan sedang disesuaikan.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 text-xs h-9 px-4 gap-1.5 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" /> Refresh Halaman
          </Button>
          {onLogout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-900 text-xs h-9 px-4 rounded-xl"
            >
              Keluar / Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
