import { useMemo, useState, useEffect } from "react";
import { Trophy, Medal, Award, Flame, Crown, Sparkles, CheckCircle2, User, Info, Target, HelpCircle, ShieldCheck, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCollection } from "@/hooks/use-portal";
import { type EmailSubmission, type PortalUser, type LeaderboardRewardConfig } from "@/lib/portal-types";
import {
  calculateLeaderboardStandings,
  getStartAndEndOfWeek,
  getWeeklyPeriodKey,
  formatMoney,
  getLeaderboardUserProgress,
} from "@/lib/portal-utils";

interface LeaderboardProps {
  submissions?: EmailSubmission[];
  users?: PortalUser[];
  currentUserId?: string;
  rewards?: LeaderboardRewardConfig[];
  className?: string;
}

export function Leaderboard({
  submissions: propSubmissions,
  users: propUsers = [],
  currentUserId,
  rewards = [
    { rank: 1, rewardAmount: 50000 },
    { rank: 2, rewardAmount: 30000 },
    { rank: 3, rewardAmount: 15000 },
  ],
  className = "",
}: LeaderboardProps) {
  // Real-time synchronization of all global submissions & users for global leaderboard view
  const globalUsersCollection = useCollection<PortalUser>("users");
  const users = propUsers && propUsers.length > 0 ? propUsers : globalUsersCollection.data;

  const globalSubmissions = useCollection<EmailSubmission>("emailSubmissions");
  const activeSubmissions = globalSubmissions.data.length > 0
    ? globalSubmissions.data
    : propSubmissions && propSubmissions.length > 0
      ? propSubmissions
      : [];

  const [showRulesModal, setShowRulesModal] = useState(false);

  // Calculate timeframe (strictly Weekly: Senin 00:00 WIB s/d Minggu 23:59 WIB)
  const timeFrame = useMemo(() => {
    const now = new Date();
    const { start, end } = getStartAndEndOfWeek(now);
    const key = getWeeklyPeriodKey(now);
    return {
      key,
      label: `Minggu Ini (${key})`,
      start,
      end,
    };
  }, []);

  // Real-time weekly countdown timer state to Sunday 23:59 WIB
  const [weeklyCountdown, setWeeklyCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    function calcCountdown() {
      const nowMs = Date.now();
      const endMs = timeFrame.end.getTime();
      const diffMs = Math.max(0, endMs - nowMs);

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    }

    setWeeklyCountdown(calcCountdown());
    const interval = setInterval(() => {
      setWeeklyCountdown(calcCountdown());
    }, 1000);

    return () => clearInterval(interval);
  }, [timeFrame.end]);

  // Calculate real-time standings
  const standings = useMemo(() => {
    return calculateLeaderboardStandings(
      activeSubmissions,
      users,
      timeFrame.start,
      timeFrame.end,
      rewards
    );
  }, [activeSubmissions, users, timeFrame.start, timeFrame.end, rewards]);

  // Only workers who meet the minimum qualification (ACC >= 50) and official rank slot are eligible for podium slots
  const podiumQualifiedWorkers = useMemo(() => {
    return standings.filter((s) => s.validAccCount >= 50 && s.officialRank !== null);
  }, [standings]);

  // Map podium slots for Rank 1 (Gold, >= 200 ACC), Rank 2 (Silver, >= 100 ACC), Rank 3 (Bronze, >= 50 ACC)
  const podiumSlot1 = useMemo(() => podiumQualifiedWorkers.find((w) => w.officialRank === 1) || null, [podiumQualifiedWorkers]);
  const podiumSlot2 = useMemo(() => podiumQualifiedWorkers.find((w) => w.officialRank === 2) || null, [podiumQualifiedWorkers]);
  const podiumSlot3 = useMemo(() => podiumQualifiedWorkers.find((w) => w.officialRank === 3) || null, [podiumQualifiedWorkers]);

  const hasAnyPodiumWinner = podiumSlot1 !== null || podiumSlot2 !== null || podiumSlot3 !== null;

  // Find current user position if present
  const myPosition = useMemo(() => {
    if (!currentUserId) return null;
    return standings.find((s) => s.workerId === currentUserId) || null;
  }, [standings, currentUserId]);

  // Target requirement and qualification calculation for logged-in user
  const userProgressInfo = useMemo(() => {
    const acc = myPosition ? myPosition.validAccCount : 0;
    const arrayRank = myPosition ? myPosition.rank : null;
    return getLeaderboardUserProgress(acc, arrayRank);
  }, [myPosition]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* HEADER CARD */}
      <Card className="bg-gradient-to-br from-amber-950 via-orange-950 to-amber-900 text-white border-amber-800/80 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-6 sm:p-8 space-y-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold uppercase tracking-wider">
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  Klasemen Global Real-Time
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRulesModal(true)}
                  className="bg-white/10 hover:bg-white/20 text-amber-100 border-amber-400/30 text-[11px] font-bold h-7 px-2.5 rounded-full gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                  Aturan & S&K
                </Button>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                Pahlawan Email ACC Terbanyak
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                Peringkat global tersinkronisasi real-time murni berdasarkan email ACC. Dapatkan bonus tunai mingguan dengan memenuhi target minimal ACC!
              </p>
            </div>

            {/* COUNTDOWN TIMER BADGE */}
            <div className="shrink-0 bg-[#2D1B00] px-4 py-3 rounded-2xl border border-amber-700/80 backdrop-blur-md space-y-1 text-center sm:text-right">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center sm:justify-end gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Sisa Waktu Kompetisi
              </span>
              <p className="font-mono text-sm sm:text-base font-black text-[#FFB74D] tracking-tight">
                {weeklyCountdown.days}h {weeklyCountdown.hours}j {weeklyCountdown.minutes}m {weeklyCountdown.seconds}d
              </p>
            </div>
          </div>

          {/* ACTIVE TIMEFRAME & MY POSITION BANNER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-amber-800/80 text-xs">
            <div className="flex items-center gap-2 text-amber-200 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Periode Aktif: <strong className="text-white">{timeFrame.label}</strong></span>
            </div>

            {currentUserId ? (
              <div className="inline-flex items-center gap-2 bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-400/30 text-amber-100 font-bold">
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Posisi Anda: <strong className="text-white">{userProgressInfo.positionText}</strong> ({userProgressInfo.acc} Email ACC)</span>
              </div>
            ) : (
              <span className="text-amber-300/80 italic">Setor email ACC sekarang untuk masuk ke papan klasemen global!</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STICKY "PERINGKAT ANDA" CARD */}
      {currentUserId && (
        <Card className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border-amber-500/40 shadow-md text-white sticky top-20 z-10 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm ring-2 ring-amber-400/30">
                  <Crown className="w-5 h-5 text-amber-100" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Peringkat Anda saat ini</span>
                    <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-[10px] font-bold">
                      Global Rank
                    </Badge>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {userProgressInfo.positionText}
                    <span className="text-xs text-amber-200/80 font-normal ml-2">
                      ({userProgressInfo.acc} Email ACC Terverifikasi)
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-amber-300 font-medium block">Target Berikutnya</span>
                <span className="text-sm font-bold text-white">{userProgressInfo.targetTitle}</span>
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-amber-200 font-semibold flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  Target: {userProgressInfo.acc}/{userProgressInfo.nextTarget} ACC
                </span>
                <span className="text-amber-300 font-bold">{userProgressInfo.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800/90 h-3 rounded-full overflow-hidden border border-amber-500/30 p-0.5">
                <div
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  style={{ width: `${userProgressInfo.progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-200/90 font-medium">
                {userProgressInfo.descriptionText}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REWARD PRIZE BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { rank: 1, title: "🥇 Juara 1 (Gold)", req: "Min. 200 ACC / minggu", bg: "from-amber-500 to-amber-600", border: "border-amber-400", text: "text-amber-950", icon: <Crown className="w-5 h-5 text-amber-200" /> },
          { rank: 2, title: "🥈 Juara 2 (Silver)", req: "Min. 100 ACC / minggu", bg: "from-slate-400 to-slate-500", border: "border-slate-300", text: "text-slate-950", icon: <Medal className="w-5 h-5 text-slate-100" /> },
          { rank: 3, title: "🥉 Juara 3 (Bronze)", req: "Min. 50 ACC / minggu", bg: "from-amber-700 to-orange-800", border: "border-amber-600", text: "text-amber-100", icon: <Award className="w-5 h-5 text-amber-300" /> },
        ].map((prize) => {
          const rCfg = rewards.find((r) => r.rank === prize.rank);
          const rewardAmt = rCfg ? rCfg.rewardAmount : prize.rank === 1 ? 50000 : prize.rank === 2 ? 25000 : 15000;

          return (
            <div
              key={prize.rank}
              className={`p-3.5 rounded-2xl bg-gradient-to-r ${prize.bg} text-white shadow-xs border ${prize.border} flex items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                  {prize.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-white/90">{prize.title}</p>
                  <p className="text-lg font-black tracking-tight">{formatMoney(rewardAmt)}</p>
                  <p className="text-[10px] text-white/80 font-semibold">{prize.req}</p>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-extrabold uppercase">
                Reward
              </Badge>
            </div>
          );
        })}
      </div>

      {/* TOP 3 PODIUM DISPLAY */}
      {hasAnyPodiumWinner ? (
        <Card className="bg-white border-amber-100 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              Podium Juara Paling Produktif
            </CardTitle>
            <CardDescription className="text-xs text-gray-600">
              Pekerja terkualifikasi yang berhasil mengunci tempat di podium Juara periode ini. Username disamarkan demi privasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { rankNum: 1, item: podiumSlot1, badgeLabel: "🥇 JUARA 1 GOLD", cardStyle: "border-amber-400 bg-gradient-to-b from-amber-50/90 via-orange-50/40 to-white ring-2 ring-amber-400/40 shadow-sm", badgeBg: "bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold shadow-2xs", icon: <Crown className="w-6 h-6 text-amber-500" />, minAccText: "Min. 200 ACC" },
                { rankNum: 2, item: podiumSlot2, badgeLabel: "🥈 JUARA 2 SILVER", cardStyle: "border-slate-300 bg-gradient-to-b from-slate-50/90 to-white shadow-2xs", badgeBg: "bg-slate-700 text-white font-extrabold", icon: <Medal className="w-6 h-6 text-slate-500" />, minAccText: "Min. 100 ACC" },
                { rankNum: 3, item: podiumSlot3, badgeLabel: "🥉 JUARA 3 BRONZE", cardStyle: "border-amber-300 bg-gradient-to-b from-amber-50/50 to-white shadow-2xs", badgeBg: "bg-amber-800 text-white font-extrabold", icon: <Award className="w-6 h-6 text-amber-700" />, minAccText: "Min. 50 ACC" },
              ].map(({ rankNum, item, badgeLabel, cardStyle, badgeBg, icon, minAccText }) => {
                if (!item) {
                  return (
                    <div
                      key={`empty-podium-${rankNum}`}
                      className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 text-center flex flex-col items-center justify-center gap-2 min-h-[180px]"
                    >
                      <div className="p-2 rounded-full bg-slate-200/80 text-slate-400">
                        {icon}
                      </div>
                      <Badge className="text-[10px] bg-slate-200 text-slate-600 border-0 font-bold">
                        {badgeLabel}
                      </Badge>
                      <p className="text-xs font-bold text-slate-600 mt-1">Belum Terisi</p>
                      <p className="text-[11px] text-slate-400 max-w-[180px]">
                        {minAccText} untuk mengunci slot ini
                      </p>
                    </div>
                  );
                }

                const isMe = item.workerId === currentUserId;

                return (
                  <div
                    key={item.workerId}
                    className={`p-4 rounded-2xl border text-center relative flex flex-col justify-between gap-3 transition-transform hover:-translate-y-0.5 ${cardStyle}`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-center">{icon}</div>

                      <Badge className={`mx-auto text-[10px] px-2.5 py-0.5 ${badgeBg}`}>
                        {badgeLabel}
                      </Badge>

                      <div>
                        <p className="font-extrabold text-gray-900 text-base flex items-center justify-center gap-1.5">
                          <span>{item.maskedName}</span>
                          {isMe && (
                            <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1 font-bold">
                              Anda
                            </Badge>
                          )}
                        </p>
                        <p className="text-2xl font-black text-amber-700 tracking-tight mt-1">
                          {item.validAccCount} <span className="text-xs font-bold text-gray-500">ACC</span>
                        </p>
                      </div>
                    </div>

                    {item.rewardAmount && item.rewardAmount > 0 ? (
                      <div className="p-2 rounded-xl bg-amber-100/80 border border-amber-200/80 text-center">
                        <span className="text-[10px] text-amber-900 font-bold uppercase block">Estimasi Hadiah</span>
                        <span className="font-black text-amber-800 text-sm">{formatMoney(item.rewardAmount)}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-[#2D1B00] via-[#211300] to-amber-950 text-white border-amber-800/80 shadow-md">
          <CardContent className="p-8 text-center space-y-3">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
            <div className="space-y-1">
              <h3 className="font-black text-amber-200 text-lg">Belum Ada Pekerja Terkualifikasi</h3>
              <p className="text-xs text-amber-100/80 max-w-md mx-auto">
                Minimal 50 ACC Valid untuk mengunci tempat di podium Juara 3
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Setor email sekarang & kunci Juara 3!
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COMPLETE STANDINGS TABLE */}
      <Card className="bg-white border-amber-100 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Daftar Lengkap Klasemen ({standings.length} Workers)
            </span>
            <Badge variant="outline" className="text-xs font-normal border-amber-200 text-amber-900">
              {timeFrame.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Belum ada data klasemen untuk periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-amber-100 text-amber-950 bg-amber-50/50">
                    <th className="py-2.5 px-3 font-bold w-16 text-center">Rank</th>
                    <th className="py-2.5 px-3 font-bold">Nama Pekerja</th>
                    <th className="py-2.5 px-3 font-bold text-center">Total Email ACC</th>
                    <th className="py-2.5 px-3 font-bold text-right">Potensi Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60">
                  {standings.map((item) => {
                    const isMe = item.workerId === currentUserId;
                    const isQualified = item.isQualified && item.validAccCount >= 50;
                    const officialRank = item.officialRank;

                    return (
                      <tr
                        key={item.workerId}
                        className={`transition-colors ${
                          isMe
                            ? "bg-amber-100/70 font-bold text-amber-950"
                            : isQualified
                              ? "bg-amber-50/30 hover:bg-amber-50/60"
                              : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="py-3 px-3 align-middle text-center font-black">
                          {isQualified && officialRank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white shadow-2xs font-extrabold text-xs">
                              🥇
                            </span>
                          ) : isQualified && officialRank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-500 text-white font-extrabold text-xs">
                              🥈
                            </span>
                          ) : isQualified && officialRank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-800 text-white font-extrabold text-xs">
                              🥉
                            </span>
                          ) : isQualified ? (
                            <span className="text-gray-500 font-mono text-sm">#{item.rank}</span>
                          ) : (
                            <Badge className="bg-slate-800 text-amber-200 border border-amber-900/40 text-[10px] font-bold px-2 py-0.5">
                              Belum Terkualifikasi
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 align-middle font-bold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{item.maskedName}</span>
                            {isMe && (
                              <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1 font-bold">
                                (Anda)
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-middle text-center font-black text-amber-800 text-sm">
                          {item.validAccCount} <span className="text-[11px] font-medium text-gray-500">ACC</span>
                        </td>

                        <td className="py-3 px-3 align-middle text-right font-black">
                          {isQualified && item.rewardAmount && item.rewardAmount > 0 ? (
                            <span className="text-amber-700">{formatMoney(item.rewardAmount)}</span>
                          ) : (
                            <span className="text-slate-500 font-medium text-[11px]">
                              Butuh {Math.max(0, 50 - item.validAccCount)} lagi
                            </span>
                          )}
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

      {/* RULES & TERMS DIALOG MODAL */}
      <Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Syarat & Ketentuan Klasemen Global
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Ketentuan perhitungan peringkat dan klaim bonus pahlawan email ACC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-gray-700 pt-2">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 space-y-1">
              <p className="font-bold text-amber-950 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" /> Timer Reset Peringkat Mingguan:
              </p>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Papan klasemen mingguan dihitung ulang setiap minggunya (dimulai Senin jam 00:00 WIB hingga Minggu jam 23:59 WIB).
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-gray-900">Ketentuan Minimal Target ACC untuk Bonus Admin Profit Safety:</p>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside bg-slate-50 p-3 rounded-xl border border-gray-200">
                <li>
                  <strong>Top 1 (Juara 1):</strong> Bonus Rp 50.000 (Syarat Minimal: <span className="text-amber-700 font-bold">200 Email ACC / minggu</span>)
                </li>
                <li>
                  <strong>Top 2 (Juara 2):</strong> Bonus Rp 30.000 (Syarat Minimal: <span className="text-amber-700 font-bold">100 Email ACC / minggu</span>)
                </li>
                <li>
                  <strong>Top 3 (Juara 3):</strong> Bonus Rp 15.000 (Syarat Minimal: <span className="text-amber-700 font-bold">50 Email ACC / minggu</span>)
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              * Seluruh data email ACC disinkronkan secara langsung dari database Firestore utama platform. Peringkat bersifat adil & transparan.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => setShowRulesModal(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold h-9 rounded-xl text-xs"
            >
              Saya Mengerti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
