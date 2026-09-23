import React, { useState } from "react";
import { toast } from "sonner";
import { Bell, Trash2, Clock, RotateCcw, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MockNotificationItem {
  id: string;
  title: string;
  content: string;
  badge?: string;
  createdAt: Date;
}

const DEFAULT_SAMPLE_NOTIFICATIONS: MockNotificationItem[] = [
  {
    id: "notif-1",
    title: "Jam Operasional Layanan Setoran Disesuaikan",
    content: "Layanan verifikasi dan setoran email beroperasi pukul 08:00 - 22:00 WIB hari ini.",
    badge: "PENTING",
    createdAt: new Date(Date.now() - 1000 * 60 * 25),
  },
  {
    id: "notif-2",
    title: "Pencairan Saldo DANA & GoPay Berhasil",
    content: "Seluruh permintaan penarikan saldo e-wallet yang diajukan pagi ini telah sukses dikirim.",
    badge: "BARU",
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "notif-3",
    title: "Bonus Komisi Referral Pasif Income Terkredit",
    content: "Komisi referral Rp 100 / ACC dari downline Anda telah otomatis masuk ke Saldo Utama.",
    badge: "INFO",
    createdAt: new Date(Date.now() - 1000 * 60 * 360),
  },
];

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export function NotificationBellDropdown() {
  const [notifications, setNotifications] = useState<MockNotificationItem[]>(DEFAULT_SAMPLE_NOTIFICATIONS);

  // Delete single notification
  function handleDeleteSingle(id: string) {
    const target = notifications.find((n) => n.id === id);
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    toast.success(`Notifikasi "${target?.title || "Pemberitahuan"}" dihapus.`);
  }

  // Clear all notifications
  function handleClearAll() {
    setNotifications([]);
    toast.success("Seluruh notifikasi berhasil dibersihkan.");
  }

  // Reset sample notifications
  function handleResetSamples() {
    setNotifications(DEFAULT_SAMPLE_NOTIFICATIONS);
    toast.success("Notifikasi sampel dimuat ulang.");
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden p-4 sm:p-6 bg-slate-50 min-h-[500px] text-slate-900">
      {/* HEADER EXPLANATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Notification Bell Dropdown Mockup
            </h2>
            <p className="text-xs text-slate-500">
              Pratinjau komponen dropdown lonceng notifikasi header dengan penghapusan individu & mass delete.
            </p>
          </div>
        </div>

        {notifications.length === 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResetSamples}
            className="text-xs font-bold gap-1.5 h-9 rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer min-h-[44px] sm:min-h-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat Ulang Sampel Notifikasi</span>
          </Button>
        )}
      </div>

      {/* MOCK HEADER BAR DEMO */}
      <Card className="bg-white border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Simulasi Header Aplikasi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Klik ikon Lonceng di kanan atas untuk membuka dropdown notifikasi.
              </CardDescription>
            </div>

            {/* HEADER RIGHT ACTIONS WITH BELL DROPDOWN */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    data-testid="mock-bell-btn"
                    className="relative p-2.5 rounded-full bg-slate-100 text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
                    title="Pengumuman & Notifikasi"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[90vw] max-w-[380px] p-0 rounded-2xl bg-white border border-slate-200/80 shadow-xl z-50">
                  {/* DROPDOWN HEADER */}
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">Pemberitahuan</h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {notifications.length > 0 ? `${notifications.length} belum dibaca` : "Tidak ada pemberitahuan baru"}
                        </p>
                      </div>
                    </div>

                    {notifications.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="mock-clear-all-btn"
                        onClick={handleClearAll}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2.5 rounded-xl gap-1 transition-colors cursor-pointer min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bersihkan Semua</span>
                      </Button>
                    )}
                  </div>

                  {/* NOTIFICATION LIST BODY */}
                  <div className="max-h-[360px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="py-8 px-4 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                          <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">Belum Ada Notifikasi</p>
                        <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                          Tidak ada notifikasi atau pengumuman baru untuk Anda saat ini.
                        </p>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const badgeUpper = item.badge?.toUpperCase().trim() || "";
                        let badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
                        if (badgeUpper === "BARU" || badgeUpper === "PENTING") {
                          badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
                        } else if (badgeUpper === "INFO") {
                          badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
                        }

                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-2.5 shadow-2xs group"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 leading-snug truncate">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 rounded-md ${badgeStyle}`}>
                                    {item.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                                {item.content}
                              </p>
                              <p className="text-[9px] font-mono text-slate-400 flex items-center gap-1 pt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{formatTimeAgo(item.createdAt)}</span>
                              </p>
                            </div>

                            {/* INDIVIDUAL TRASH DELETE ICON */}
                            <button
                              type="button"
                              data-testid={`mock-delete-notif-${item.id}`}
                              onClick={() => handleDeleteSingle(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Hapus Notifikasi Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* FOOTER SHORTCUT */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl text-center">
                    <button
                      type="button"
                      onClick={() => toast.info("Navigasi ke halaman Info Resmi.")}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline w-full py-1 min-h-[36px] inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Seluruh Info Resmi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 text-center text-slate-500 text-xs">
          Jumlah notifikasi aktif saat ini: <strong className="text-slate-900 font-bold">{notifications.length}</strong> item.
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationBellDropdown;
