import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Mail,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Filter,
  CheckSquare,
  Square,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/portal-utils";

export interface EmailMessageItem {
  id: string;
  email: string;
  subject: string;
  sender: string;
  date: string | Date;
  snippet: string;
  category?: "setoran" | "notifikasi" | "admin" | "sistem";
  isRead?: boolean;
}

const DEFAULT_SAMPLE_MESSAGES: EmailMessageItem[] = [
  {
    id: "msg-1",
    email: "ahmad.worker@gmail.com",
    subject: "Konfirmasi Setoran Email Batch #B0101",
    sender: "GMAIL JOB ID System",
    date: new Date(Date.now() - 1000 * 60 * 30),
    snippet: "Setoran 10 akun Gmail Anda telah diterima dan dalam antrean verifikasi Vendor.",
    category: "setoran",
    isRead: false,
  },
  {
    id: "msg-2",
    email: "budi.prasetyo99@gmail.com",
    subject: "Penarikan Saldo Berhasil Dicairkan",
    sender: "Keuangan CS Admin",
    date: new Date(Date.now() - 1000 * 60 * 180),
    snippet: "Pencairan saldo sebesar Rp 150.000 ke DANA 08123456789 telah sukses ditransfer.",
    category: "admin",
    isRead: true,
  },
  {
    id: "msg-3",
    email: "citra.rahma@gmail.com",
    subject: "Bonus Reward Referral Terkredit",
    sender: "Sistem Referral",
    date: new Date(Date.now() - 1000 * 60 * 600),
    snippet: "Komisi referral Rp 25.000 dari downline Dedi telah otomatis dikreditkan ke Saldo Utama.",
    category: "sistem",
    isRead: true,
  },
  {
    id: "msg-4",
    email: "dedi.sutrisno88@gmail.com",
    subject: "Pemberitahuan Screening Email Master Riset",
    sender: "System Checker",
    date: new Date(Date.now() - 1000 * 60 * 1440),
    snippet: "Hasil screening 15 email awal menunjukkan 12 email Valid/Good dan 3 Invalid.",
    category: "setoran",
    isRead: false,
  },
  {
    id: "msg-5",
    email: "eka.kurnia2026@gmail.com",
    subject: "Pembaruan Jam Operasional Layanan Setoran",
    sender: "Admin Command Center",
    date: new Date(Date.now() - 1000 * 60 * 2880),
    snippet: "Jam operasional verifikasi email disesuaikan menjadi pukul 08:00 - 22:00 WIB.",
    category: "notifikasi",
    isRead: true,
  },
];

export interface MessageManagerProps {
  initialMessages?: EmailMessageItem[];
  onMessagesChange?: (messages: EmailMessageItem[]) => void;
  title?: string;
  description?: string;
}

export function MessageManager({
  initialMessages = DEFAULT_SAMPLE_MESSAGES,
  onMessagesChange,
  title = "Manajemen Pesan & Email",
  description = "Kelola, filter, dan hapus pesan atau email setoran secara individual maupun sekaligus.",
}: MessageManagerProps) {
  const [messages, setMessages] = useState<EmailMessageItem[]>(initialMessages);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");


  const notifyChange = (updated: EmailMessageItem[]) => {
    setMessages(updated);
    if (onMessagesChange) {
      onMessagesChange(updated);
    }
  };

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (categoryFilter !== "ALL" && msg.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEmail = msg.email.toLowerCase().includes(q);
        const matchSubject = msg.subject.toLowerCase().includes(q);
        const matchSender = msg.sender.toLowerCase().includes(q);
        const matchSnippet = msg.snippet.toLowerCase().includes(q);
        return matchEmail || matchSubject || matchSender || matchSnippet;
      }
      return true;
    });
  }, [messages, categoryFilter, searchQuery]);

  // Check if all filtered messages are selected
  const isAllSelected = useMemo(() => {
    if (filteredMessages.length === 0) return false;
    return filteredMessages.every((msg) => selectedIds.has(msg.id));
  }, [filteredMessages, selectedIds]);

  // Check if some (not all) filtered messages are selected
  const isSomeSelected = useMemo(() => {
    if (filteredMessages.length === 0) return false;
    const selectedCount = filteredMessages.filter((msg) => selectedIds.has(msg.id)).length;
    return selectedCount > 0 && selectedCount < filteredMessages.length;
  }, [filteredMessages, selectedIds]);

  // Toggle "Select All"
  function handleToggleSelectAll() {
    const updated = new Set(selectedIds);
    if (isAllSelected) {
      // Unselect all displayed items
      filteredMessages.forEach((msg) => updated.delete(msg.id));
    } else {
      // Select all displayed items
      filteredMessages.forEach((msg) => updated.add(msg.id));
    }
    setSelectedIds(updated);
  }

  // Toggle single item checkbox
  function handleToggleItem(id: string) {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  }

  // Delete single message item
  function handleDeleteSingle(id: string) {
    const target = messages.find((m) => m.id === id);
    const updated = messages.filter((msg) => msg.id !== id);
    notifyChange(updated);

    const updatedSelected = new Set(selectedIds);
    updatedSelected.delete(id);
    setSelectedIds(updatedSelected);

    toast.success(`Pesan "${target?.subject || "Email"}" berhasil dihapus.`);
  }

  // Mass Delete: Delete selected messages
  function handleDeleteSelected() {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal satu pesan/email untuk dihapus.");
      return;
    }

    const count = selectedIds.size;
    const updated = messages.filter((msg) => !selectedIds.has(msg.id));
    notifyChange(updated);
    setSelectedIds(new Set());

    toast.success(`${count} pesan/email berhasil dihapus dari daftar.`);
  }

  // Bersihkan Semua: Delete all messages
  function handleClearAll() {
    if (messages.length === 0) {
      toast.error("Daftar pesan/email sudah kosong.");
      return;
    }

    const totalCount = messages.length;
    notifyChange([]);
    setSelectedIds(new Set());

    toast.success(`Seluruh ${totalCount} pesan/email berhasil dibersihkan.`);
  }

  // Reset demo sample data
  function handleResetSamples() {
    notifyChange(DEFAULT_SAMPLE_MESSAGES);
    setSelectedIds(new Set());
    toast.success("Daftar pesan/email dikembalikan ke data awal.");
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>

        {messages.length === 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResetSamples}
            className="text-xs font-bold gap-1.5 h-9 rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer min-h-[44px] sm:min-h-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat Ulang Sampel Pesan</span>
          </Button>
        )}
      </div>

      {/* 2. MAIN CARD */}
      <Card className="bg-white border-slate-200/80 rounded-2xl shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* SEARCH & CATEGORY FILTER */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari email, subjek, atau isi pesan..."
                  className="pl-8 h-10 min-h-[44px] text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
                {["ALL", "setoran", "admin", "sistem", "notifikasi"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1.5 min-h-[38px] rounded-lg capitalize transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {cat === "ALL" ? "Semua" : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. BULK CONTROL BAR (SELECT ALL & MASS DELETE) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-100">
            {/* SELECT ALL CHECKBOX */}
            <div className="flex items-center gap-2.5">
              <div
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 cursor-pointer select-none py-1.5 px-2.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleToggleSelectAll}
                  id="select-all-messages"
                  className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label
                  htmlFor="select-all-messages"
                  className="text-xs font-bold text-slate-800 cursor-pointer"
                >
                  Pilih Semua ({filteredMessages.length} Pesan)
                </label>
              </div>

              {selectedIds.size > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-bold">
                  {selectedIds.size} Dipilih
                </Badge>
              )}
            </div>

            {/* ACTION BUTTONS FOR MASS DELETE & CLEAR ALL */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 min-h-[44px] px-4 rounded-xl shadow-xs gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus yang Dipilih ({selectedIds.size})</span>
                </Button>
              )}

              {messages.length > 0 && (
                <Button
                  type="button"
                  data-testid="clear-all-btn"
                  onClick={handleClearAll}
                  variant="outline"
                  className="bg-white hover:bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-300 font-bold text-xs h-10 min-h-[44px] px-3.5 rounded-xl gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Bersihkan Semua</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* 4. MESSAGES LIST */}
        <CardContent className="pt-4">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
                <Inbox className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                {messages.length === 0
                  ? "Daftar Pesan / Email Kosong"
                  : "Tidak Ada Pesan yang Sesuai Pencarian"}
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                {messages.length === 0
                  ? "Seluruh pesan telah dibersihkan atau belum ada item pesan tersimpan."
                  : "Coba ubah kata kunci atau filter kategori di atas."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map((msg) => {
                const isSelected = selectedIds.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-50/60 border-blue-300 shadow-2xs"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/30"
                    }`}
                  >
                    {/* LEFT: CHECKBOX & CONTENT */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="pt-0.5 shrink-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleItem(msg.id)}
                          className="cursor-pointer border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 min-h-[20px] min-w-[20px]"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {msg.subject}
                          </span>

                          {msg.category && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                msg.category === "setoran"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : msg.category === "admin"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : msg.category === "sistem"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {msg.category}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                          <span className="font-semibold text-slate-700">{msg.sender}</span>
                          <span>•</span>
                          <span className="truncate">{msg.email}</span>
                          <span>•</span>
                          <span>{formatDateTime(msg.date)}</span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-0.5">
                          {msg.snippet}
                        </p>
                      </div>
                    </div>

                    {/* RIGHT: INDIVIDUAL TRASH DELETE ICON */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(msg.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Hapus Pesan Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
