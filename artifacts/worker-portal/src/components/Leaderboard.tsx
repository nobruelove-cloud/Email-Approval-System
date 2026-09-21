import { useMemo, useState, useEffect } from "react";
import { Trophy, Medal, Award, Crown, Sparkles, HelpCircle, ShieldCheck, Clock, Flame, Users } from "lucide-react";
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
    <div className={`space-y-4 ${className}`}>
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Klasemen
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRulesModal(true)}
                className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold h-7 px-2.5 rounded-xl gap-1 shrink-0 min-h-[32px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                Aturan & S&K
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Peringkat global tersinkronisasi real-time murni berdasarkan jumlah email ACC valid mingguan.
            </p>
          </div>
        </div>

        {/* COUNTDOWN TIMER BADGE */}
        <div className="shrink-0 bg-white px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between sm:justify-end gap-3 text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Sisa Waktu:
          </span>
          <span className="font-mono text-xs sm:text-sm font-black text-blue-700 tracking-tight">
            {weeklyCountdown.days}d {weeklyCountdown.hours}j {weeklyCountdown.minutes}m {weeklyCountdown.seconds}s
          </span>
        </div>
      </div>

      {/* COMPACT PERSONAL RANKING CARD (PRESERVED EXACTLY AS CURRENTLY IMPLEMENTED) */}
      {currentUserId && (
        <Card className="bg-white border border-blue-100 shadow-xs rounded-2xl sticky top-20 z-10 backdrop-blur-md">
          <CardContent className="p-3 sm:p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Peringkat Anda</span>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold px-1.5 py-0 h-4">
                      Global Rank
                    </Badge>
                  </div>
                  <p className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-none mt-0.5">
                    {userProgressInfo.positionText}{" "}
                    <span className="text-xs font-semibold text-blue-600">
                      ({userProgressInfo.acc} ACC)
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-gray-500 font-medium block">Target Berikutnya</span>
                <span className="text-xs font-bold text-gray-900">{userProgressInfo.targetTitle}</span>
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-600 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  Progress: {userProgressInfo.acc}/{userProgressInfo.nextTarget} ACC
                </span>
                <span className="text-blue-600 font-bold">{userProgressInfo.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${userProgressInfo.progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 font-medium truncate">
                {userProgressInfo.descriptionText}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REWARD PRIZE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[
          { rank: 1, title: "Juara 1 (Gold)", req: "Min. 200 ACC / minggu", icon: "🥇" },
          { rank: 2, title: "Juara 2 (Silver)", req: "Min. 100 ACC / minggu", icon: "🥈" },
          { rank: 3, title: "Juara 3 (Bronze)", req: "Min. 50 ACC / minggu", icon: "🥉" },
        ].map((prize) => {
          const rCfg = rewards.find((r) => r.rank === prize.rank);
          const rewardAmt = rCfg ? rCfg.rewardAmount : prize.rank === 1 ? 50000 : prize.rank === 2 ? 30000 : 15000;

          return (
            <div
              key={prize.rank}
              className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-lg shrink-0 font-bold">
                  {prize.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{prize.title}</p>
                  <p className="text-lg font-black text-blue-600 tracking-tight leading-snug">{formatMoney(rewardAmt)}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{prize.req}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-extrabold uppercase shrink-0">
                Reward
              </Badge>
            </div>
          );
        })}
      </div>

      {/* TOP 3 PODIUM DISPLAY */}
      {hasAnyPodiumWinner ? (
        <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Podium Juara Paling Produktif</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Pekerja terkualifikasi yang berhasil mengunci tempat di podium Juara periode ini. Username disamarkan demi privasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { rankNum: 1, item: podiumSlot1, badgeLabel: "🥇 JUARA 1 GOLD", minAccText: "Min. 200 ACC", icon: "🥇" },
                { rankNum: 2, item: podiumSlot2, badgeLabel: "🥈 JUARA 2 SILVER", minAccText: "Min. 100 ACC", icon: "🥈" },
                { rankNum: 3, item: podiumSlot3, badgeLabel: "🥉 JUARA 3 BRONZE", minAccText: "Min. 50 ACC", icon: "🥉" },
              ].map(({ rankNum, item, badgeLabel, minAccText, icon }) => {
                if (!item) {
                  return (
                    <div
                      key={`empty-podium-${rankNum}`}
                      className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center flex flex-col items-center justify-center gap-2 min-h-[160px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-500 flex items-center justify-center text-lg font-bold">
                        {icon}
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 font-bold">
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
                    className={`p-4 rounded-2xl border text-center relative flex flex-col justify-between gap-3 transition-all ${
                      isMe
                        ? "bg-blue-50/70 border-blue-300 shadow-xs"
                        : "bg-white border-slate-200/80 shadow-2xs hover:border-blue-200"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-lg font-bold mx-auto">
                        {icon}
                      </div>

                      <Badge className="mx-auto text-[10px] px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-extrabold">
                        {badgeLabel}
                      </Badge>

                      <div>
                        <p className="font-extrabold text-slate-900 text-base flex items-center justify-center gap-1.5">
                          <span>{item.maskedName}</span>
                          {isMe && (
                            <Badge className="bg-blue-600 text-white text-[10px] py-0 px-1 font-bold">
                              Anda
                            </Badge>
                          )}
                        </p>
                        <p className="text-2xl font-black text-blue-600 tracking-tight mt-1">
                          {item.validAccCount} <span className="text-xs font-bold text-slate-500">ACC</span>
                        </p>
                      </div>
                    </div>

                    {item.rewardAmount && item.rewardAmount > 0 ? (
                      <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Estimasi Hadiah</span>
                        <span className="font-black text-blue-700 text-sm">{formatMoney(item.rewardAmount)}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <CardContent className="p-6 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Belum Ada Pekerja Terkualifikasi</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Minimal 50 ACC Valid untuk mengunci tempat di podium Juara 3
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN KLASEMEN LIST CARD */}
      <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Daftar Lengkap Klasemen ({standings.length} Worker)</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs font-bold border-blue-200 bg-blue-50 text-blue-700 shrink-0">
              {timeFrame.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50 my-1">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Trophy className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Belum ada data klasemen untuk periode ini.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE (hidden on mobile md:hidden) */}
              <div className="hidden md:block border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-700 bg-slate-50 font-bold">
                      <th className="py-3 px-3.5 w-16 text-center">Rank</th>
                      <th className="py-3 px-3.5">Nama Pekerja</th>
                      <th className="py-3 px-3.5 text-center">Total Email ACC</th>
                      <th className="py-3 px-3.5 text-right">Potensi Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {standings.map((item) => {
                      const isMe = item.workerId === currentUserId;
                      const isQualified = item.isQualified && item.validAccCount >= 50;
                      const officialRank = item.officialRank;

                      return (
                        <tr
                          key={item.workerId}
                          className={`transition-colors ${
                            isMe
                              ? "bg-blue-50/80 font-bold text-slate-900"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="py-3 px-3.5 align-middle text-center font-black">
                            {isQualified && officialRank === 1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white shadow-2xs font-extrabold text-xs">
                                🥇
                              </span>
                            ) : isQualified && officialRank === 2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-600 text-white font-extrabold text-xs">
                                🥈
                              </span>
                            ) : isQualified && officialRank === 3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-800 text-white font-extrabold text-xs">
                                🥉
                              </span>
                            ) : isQualified ? (
                              <span className="text-slate-600 font-mono text-xs font-bold">#{item.rank}</span>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold px-2 py-0.5">
                                Belum Terkualifikasi
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-3.5 align-middle font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{item.maskedName}</span>
                              {isMe && (
                                <Badge className="bg-blue-600 text-white text-[10px] py-0 px-1 font-bold">
                                  Anda
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 align-middle text-center font-black text-blue-600 text-sm">
                            {item.validAccCount} <span className="text-[11px] font-medium text-slate-500">ACC</span>
                          </td>

                          <td className="py-3 px-3.5 align-middle text-right font-black">
                            {isQualified && item.rewardAmount && item.rewardAmount > 0 ? (
                              <span className="text-blue-600">{formatMoney(item.rewardAmount)}</span>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">
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

              {/* MOBILE COMPACT STACKED CARDS (visible on mobile md:hidden) */}
              <div className="block md:hidden space-y-2">
                {standings.map((item) => {
                  const isMe = item.workerId === currentUserId;
                  const isQualified = item.isQualified && item.validAccCount >= 50;
                  const officialRank = item.officialRank;

                  return (
                    <div
                      key={item.workerId}
                      className={`p-3 rounded-2xl border text-xs transition-all flex items-center justify-between gap-2.5 ${
                        isMe
                          ? "bg-blue-50/80 border-blue-300 shadow-2xs"
                          : "bg-white border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* RANK BADGE / ICON */}
                        <div className="shrink-0 text-center min-w-[32px]">
                          {isQualified && officialRank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white shadow-2xs font-extrabold text-xs">
                              🥇
                            </span>
                          ) : isQualified && officialRank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-600 text-white font-extrabold text-xs">
                              🥈
                            </span>
                          ) : isQualified && officialRank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-800 text-white font-extrabold text-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs font-extrabold">
                              #{item.rank}
                            </span>
                          )}
                        </div>

                        {/* WORKER DETAILS */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">{item.maskedName}</span>
                            {isMe && (
                              <Badge className="bg-blue-600 text-white text-[9px] py-0 px-1 font-bold h-4">
                                Anda
                              </Badge>
                            )}
                          </div>
                          {!isQualified && (
                            <span className="text-[10px] text-slate-400 block font-medium">
                              Butuh {Math.max(0, 50 - item.validAccCount)} ACC lagi
                            </span>
                          )}
                          {isQualified && item.rewardAmount && item.rewardAmount > 0 && (
                            <span className="text-[10px] text-blue-600 font-bold block">
                              Potensi: {formatMoney(item.rewardAmount)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ACC COUNT RIGHT SIDE */}
                      <div className="text-right shrink-0">
                        <span className="font-black text-blue-600 text-sm block leading-none">
                          {item.validAccCount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">ACC</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* RULES & TERMS DIALOG MODAL */}
      <Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200 rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <span>Syarat & Ketentuan Klasemen Global</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Ketentuan perhitungan peringkat dan klaim bonus pahlawan email ACC.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-700 pt-2">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1">
              <p className="font-bold text-blue-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-blue-600" /> Reset Peringkat Mingguan:
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Papan klasemen mingguan dihitung ulang setiap minggunya (dimulai Senin jam 00:00 WIB hingga Minggu jam 23:59 WIB).
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-900">Ketentuan Minimal Target ACC:</p>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside bg-slate-50 p-3 rounded-xl border border-slate-200">
                <li>
                  <strong>Top 1 (Juara 1):</strong> Bonus Rp 50.000 (Minimal <span className="text-blue-600 font-bold">200 Email ACC / minggu</span>)
                </li>
                <li>
                  <strong>Top 2 (Juara 2):</strong> Bonus Rp 30.000 (Minimal <span className="text-blue-600 font-bold">100 Email ACC / minggu</span>)
                </li>
                <li>
                  <strong>Top 3 (Juara 3):</strong> Bonus Rp 15.000 (Minimal <span className="text-blue-600 font-bold">50 Email ACC / minggu</span>)
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * Seluruh data email ACC disinkronkan secara langsung dari database Firestore utama platform. Peringkat bersifat adil & transparan.
            </p>
          </div>

          <div className="pt-3">
            <Button
              onClick={() => setShowRulesModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl text-xs min-h-[44px] active:scale-95 transition-transform"
            >
              Saya Mengerti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
