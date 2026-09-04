import { useState, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/pages/worker-dashboard";
import { formatDateTime, formatMoney, shortId } from "@/lib/portal-utils";

export interface TransactionItem {
  id: string;
  date: unknown;
  type: string;
  description: string;
  amount: number;
  isCredit: boolean;
  status: string;
  note?: string;
}

export interface TransactionHistoryProps {
  transactions: TransactionItem[];
  loading?: boolean;
}

export type TransactionStatusFilter = "all" | "approved" | "pending" | "rejected";

export function TransactionHistory({
  transactions,
  loading = false,
}: TransactionHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Helper for status classification
  const enrichedTransactions = useMemo(() => {
    return transactions.map((tx) => {
      const st = (tx.status || "").toLowerCase();
      const isApproved = st === "approved" || st === "success" || st === "completed" || st === "paid";
      const isPending = st === "pending" || st === "processing";
      const isRejected = st === "rejected" || st === "failed" || st === "cancelled";

      return {
        raw: tx,
        isApproved,
        isPending,
        isRejected,
      };
    });
  }, [transactions]);

  // Counts for status pills
  const statusCounts = useMemo(() => {
    let all = enrichedTransactions.length;
    let approved = 0;
    let pending = 0;
    let rejected = 0;

    enrichedTransactions.forEach((tx) => {
      if (tx.isApproved) approved++;
      else if (tx.isPending) pending++;
      else if (tx.isRejected) rejected++;
    });

    return { all, approved, pending, rejected };
  }, [enrichedTransactions]);

  // Filtered transactions list
  const filteredList = useMemo(() => {
    return enrichedTransactions.filter((item) => {
      // Status filter
      if (statusFilter === "approved" && !item.isApproved) return false;
      if (statusFilter === "pending" && !item.isPending) return false;
      if (statusFilter === "rejected" && !item.isRejected) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch =
          item.raw.id.toLowerCase().includes(q) ||
          shortId(item.raw.id).toLowerCase().includes(q);
        const descMatch = item.raw.description.toLowerCase().includes(q);
        const typeMatch = item.raw.type.toLowerCase().includes(q);
        const noteMatch = item.raw.note?.toLowerCase().includes(q);

        if (!idMatch && !descMatch && !typeMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [enrichedTransactions, statusFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentPaginatedItems = useMemo(() => {
    return filteredList.slice(startIndex, endIndex);
  }, [filteredList, startIndex, endIndex]);

  const handleStatusFilterChange = (filter: TransactionStatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (val: string) => {
    const num = Number(val) || 10;
    setItemsPerPage(num);
    setCurrentPage(1);
  };

  return (
    <Card className="bg-white border-amber-100 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
              <Wallet className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Riwayat Transaksi</span>
            </CardTitle>
            <CardDescription className="text-xs text-gray-600 mt-0.5">
              Riwayat penarikan saldo dan penerimaan bonus reward Anda.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Tampilkan:</span>
            <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-[85px] h-8 text-xs bg-slate-50 border-gray-200">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 item</SelectItem>
                <SelectItem value="10">10 item</SelectItem>
                <SelectItem value="20">20 item</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* QUICK STATUS FILTER BAR & SEARCH INPUT */}
        <div className="pt-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* QUICK STATUS PILLS */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleStatusFilterChange("all")}
                className={`text-xs h-8 px-3 rounded-xl transition-colors font-semibold ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 shadow-xs"
                    : "bg-slate-50 text-gray-700 hover:bg-slate-100 border-gray-200"
                }`}
              >
                Semua ({statusCounts.all})
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleStatusFilterChange("approved")}
                className={`text-xs h-8 px-3 rounded-xl transition-colors font-semibold gap-1.5 ${
                  statusFilter === "approved"
                    ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-xs"
                    : "bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 border-emerald-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Berhasil ({statusCounts.approved})
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleStatusFilterChange("pending")}
                className={`text-xs h-8 px-3 rounded-xl transition-colors font-semibold gap-1.5 ${
                  statusFilter === "pending"
                    ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-xs"
                    : "bg-amber-50/80 text-amber-800 hover:bg-amber-100 border-amber-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Pending ({statusCounts.pending})
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleStatusFilterChange("rejected")}
                className={`text-xs h-8 px-3 rounded-xl transition-colors font-semibold gap-1.5 ${
                  statusFilter === "rejected"
                    ? "bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-xs"
                    : "bg-rose-50/80 text-rose-800 hover:bg-rose-100 border-rose-200"
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Ditolak ({statusCounts.rejected})
              </Button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari transaksi / ID..."
                className="pl-8 text-xs h-8 bg-slate-50 border-gray-200 focus-visible:ring-amber-500 rounded-xl"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Memuat riwayat transaksi...</p>
        )}

        {!loading && transactions.length === 0 && (
          <div className="p-8 border border-dashed border-amber-200 rounded-2xl text-center space-y-2 bg-amber-50/20">
            <Wallet className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Belum Ada Riwayat Transaksi</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Anda belum memiliki riwayat penarikan saldo atau penerimaan bonus reward.
            </p>
          </div>
        )}

        {!loading && transactions.length > 0 && filteredList.length === 0 && (
          <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center space-y-2 bg-slate-50">
            <Filter className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Tidak Ada Transaksi Ditemukan</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Tidak ada data transaksi yang cocok dengan filter atau kata kunci pencarian Anda.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="text-xs h-8 mt-2 rounded-xl border-amber-200 hover:bg-amber-50 text-amber-950 font-bold"
            >
              Reset Filter
            </Button>
          </div>
        )}

        {!loading && currentPaginatedItems.length > 0 && (
          <>
            {/* 1. DESKTOP TABLE VIEW (hidden on mobile md:hidden) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-amber-100 text-amber-950 bg-amber-50/50">
                    <th className="py-2.5 px-3 font-bold">Tanggal & ID</th>
                    <th className="py-2.5 px-3 font-bold">Jenis Transaksi</th>
                    <th className="py-2.5 px-3 font-bold">Keterangan</th>
                    <th className="py-2.5 px-3 font-bold">Nominal</th>
                    <th className="py-2.5 px-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60">
                  {currentPaginatedItems.map(({ raw }) => (
                    <tr key={raw.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <p className="font-bold text-gray-900">#{shortId(raw.id)}</p>
                        <p className="text-[11px] text-gray-400">{formatDateTime(raw.date)}</p>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          {raw.isCredit ? (
                            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span>{raw.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <p className="text-gray-800 font-medium">{raw.description}</p>
                        {raw.note && (
                          <p className="text-[11px] text-gray-400 italic mt-0.5">
                            Catatan: {raw.note}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap font-black text-sm">
                        <span className={raw.isCredit ? "text-emerald-600" : "text-rose-600"}>
                          {raw.isCredit ? "+" : "-"} {formatMoney(raw.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
                        <StatusBadge status={raw.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 2. MOBILE COMPACT CARDS (visible on mobile md:hidden) */}
            <div className="block md:hidden space-y-3">
              {currentPaginatedItems.map(({ raw }) => (
                <div
                  key={raw.id}
                  className="p-3.5 rounded-2xl border border-amber-200/80 bg-white shadow-2xs hover:border-amber-300 transition-all space-y-2"
                >
                  {/* TOP ROW: TYPE BADGE & STATUS */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {raw.isCredit ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className="font-bold text-gray-900 text-xs">{raw.type}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">{formatDateTime(raw.date)}</p>
                    </div>

                    <div className="text-right">
                      <StatusBadge status={raw.status} />
                    </div>
                  </div>

                  {/* MIDDLE ROW: DESCRIPTION & NOTE */}
                  <div className="space-y-1 pt-0.5">
                    <p className="text-xs text-gray-800 font-medium leading-relaxed">
                      {raw.description}
                    </p>
                    {raw.note && (
                      <p className="text-[11px] text-gray-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                        Catatan: {raw.note}
                      </p>
                    )}
                  </div>

                  {/* BOTTOM ROW: ID & AMOUNT */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100/80">
                    <span className="font-mono text-[11px] text-gray-400">
                      #{shortId(raw.id)}
                    </span>
                    <p className="font-black text-xs">
                      <span className={raw.isCredit ? "text-emerald-600" : "text-rose-600"}>
                        {raw.isCredit ? "+" : "-"} {formatMoney(raw.amount)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. PAGINATION CONTROLS */}
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-gray-500 font-medium">
                Menampilkan <strong className="text-gray-900 font-bold">{startIndex + 1}–{endIndex}</strong> dari <strong className="text-gray-900 font-bold">{totalItems}</strong> transaksi
              </div>

              {/* DARK SLATE PAGINATION CONTROLS */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs h-8 px-3 rounded-xl font-bold gap-1 shadow-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>

                <div data-testid="pagination-page-indicator" className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs font-bold rounded-xl shadow-2xs">
                  Page <span className="text-amber-400">{validCurrentPage}</span> of {totalPages}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs h-8 px-3 rounded-xl font-bold gap-1 shadow-xs"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
