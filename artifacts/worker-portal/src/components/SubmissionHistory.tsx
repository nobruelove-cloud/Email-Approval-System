import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  History,
  Send,
  Layers,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { EmailSubmission, PortalRules } from "@/lib/portal-types";
import { formatDateTime, formatMoney, getItemCountOfSubmission, getTierConfig, shortId } from "@/lib/portal-utils";

export interface SubmissionHistoryProps {
  submissions: EmailSubmission[];
  loading?: boolean;
  rules: PortalRules;
  userTier?: number;
  onViewDetail: (submission: EmailSubmission) => void;
  onGoToSubmit?: () => void;
}

export type StatusFilterType = "all" | "approved" | "pending" | "rejected";

export function SubmissionHistory({
  submissions,
  loading = false,
  rules,
  userTier = 1,
  onViewDetail,
  onGoToSubmit,
}: SubmissionHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpanded = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Pre-calculate submission helper stats for filtering & rendering
  const enrichedSubmissions = useMemo(() => {
    return submissions.map((item) => {
      const baseItems =
        Array.isArray(item.items) && item.items.length > 0
          ? item.items
          : item.email
          ? [
              {
                email: item.email,
                password: item.password,
                status:
                  item.status === "available" || item.status === "approved"
                    ? "approved"
                    : item.status === "rejected"
                    ? "rejected"
                    : "pending",
              },
            ]
          : [];

      const count = baseItems.length || getItemCountOfSubmission(item);
      const approvedCount =
        item.approvedItemCount ?? baseItems.filter((i) => i.status === "approved").length;
      const rejectedCount =
        item.rejectedItemCount ?? baseItems.filter((i) => i.status === "rejected").length;
      const pendingCount = count - approvedCount - rejectedCount;

      const tierNum = item.appliedTier ?? item.currentTier ?? userTier;
      const tierCfg = getTierConfig(tierNum, rules.tiers);
      const pricePerItem =
        item.appliedPricePerItem ?? item.currentPricePerItem ?? item.pricePerEmail ?? tierCfg.pricePerItem;
      const isPending = item.status === "pending" || (item.status as string) === "processing";
      const earnedAmount =
        item.totalAmount ?? (isPending ? count * pricePerItem : approvedCount * pricePerItem);

      // Grouped status category
      const isApprovedCategory =
        item.status === "approved" || item.status === "available" || item.status === "sold";
      const isPendingCategory = item.status === "pending" || (item.status as string) === "processing";
      const isRejectedCategory = item.status === "rejected";

      return {
        raw: item,
        baseItems,
        count,
        approvedCount,
        rejectedCount,
        pendingCount,
        tierCfg,
        pricePerItem,
        earnedAmount,
        isApprovedCategory,
        isPendingCategory,
        isRejectedCategory,
      };
    });
  }, [submissions, rules.tiers, userTier]);

  // Status counts for summary cards and filter pills
  const statusCounts = useMemo(() => {
    let all = enrichedSubmissions.length;
    let approved = 0;
    let pending = 0;
    let rejected = 0;

    enrichedSubmissions.forEach((s) => {
      if (s.isApprovedCategory) approved++;
      else if (s.isPendingCategory) pending++;
      else if (s.isRejectedCategory) rejected++;
    });

    return { all, approved, pending, rejected };
  }, [enrichedSubmissions]);

  // Filtered list based on search and status quick filter
  const filteredList = useMemo(() => {
    return enrichedSubmissions.filter((item) => {
      // Status filter
      if (statusFilter === "approved" && !item.isApprovedCategory) return false;
      if (statusFilter === "pending" && !item.isPendingCategory) return false;
      if (statusFilter === "rejected" && !item.isRejectedCategory) return false;

      // Search query filter (matches ID, review note, or email inside items)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = item.raw.id.toLowerCase().includes(q) || shortId(item.raw.id).toLowerCase().includes(q);
        const noteMatch = item.raw.reviewNote?.toLowerCase().includes(q);
        const emailMatch = item.baseItems.some((bi) => bi.email.toLowerCase().includes(q));

        if (!idMatch && !noteMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [enrichedSubmissions, statusFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentPaginatedItems = useMemo(() => {
    return filteredList.slice(startIndex, endIndex);
  }, [filteredList, startIndex, endIndex]);

  const handleStatusFilterChange = (filter: StatusFilterType) => {
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
    <div className="space-y-4">
      {/* 1. PAGE HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Riwayat Job
          </h2>
          <p className="text-xs text-slate-500">
            Halaman ini berisi daftar seluruh riwayat setoran batch email yang telah Anda kirimkan.
          </p>
        </div>
      </div>

      {/* 2. SUMMARY CARDS SECTION */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Job */}
        <button
          type="button"
          onClick={() => handleStatusFilterChange("all")}
          className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white text-slate-800 border-slate-200/80 hover:border-blue-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusFilter === "all" ? "text-blue-100" : "text-slate-500"}`}>
              Total Job
            </span>
            <Layers className={`w-3.5 h-3.5 ${statusFilter === "all" ? "text-blue-200" : "text-blue-600"}`} />
          </div>
          <p className="text-xl sm:text-2xl font-black">{statusCounts.all}</p>
        </button>

        {/* Berhasil / ACC */}
        <button
          type="button"
          onClick={() => handleStatusFilterChange("approved")}
          className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
            statusFilter === "approved"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
              : "bg-white text-slate-800 border-slate-200/80 hover:border-emerald-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusFilter === "approved" ? "text-emerald-100" : "text-emerald-600"}`}>
              ACC / Terjual
            </span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${statusFilter === "approved" ? "text-emerald-200" : "text-emerald-600"}`} />
          </div>
          <p className="text-xl sm:text-2xl font-black">{statusCounts.approved}</p>
        </button>

        {/* Pending / Menunggu */}
        <button
          type="button"
          onClick={() => handleStatusFilterChange("pending")}
          className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
            statusFilter === "pending"
              ? "bg-blue-500 text-white border-blue-500 shadow-xs"
              : "bg-white text-slate-800 border-slate-200/80 hover:border-blue-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusFilter === "pending" ? "text-blue-100" : "text-blue-600"}`}>
              Pending
            </span>
            <Clock className={`w-3.5 h-3.5 ${statusFilter === "pending" ? "text-blue-200" : "text-blue-500"}`} />
          </div>
          <p className="text-xl sm:text-2xl font-black">{statusCounts.pending}</p>
        </button>

        {/* Ditolak */}
        <button
          type="button"
          onClick={() => handleStatusFilterChange("rejected")}
          className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer ${
            statusFilter === "rejected"
              ? "bg-rose-600 text-white border-rose-600 shadow-xs"
              : "bg-white text-slate-800 border-slate-200/80 hover:border-rose-200 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusFilter === "rejected" ? "text-rose-100" : "text-rose-600"}`}>
              Ditolak
            </span>
            <XCircle className={`w-3.5 h-3.5 ${statusFilter === "rejected" ? "text-rose-200" : "text-rose-600"}`} />
          </div>
          <p className="text-xl sm:text-2xl font-black">{statusCounts.rejected}</p>
        </button>
      </div>

      {/* 3. MAIN CONTAINER CARD */}
      <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Riwayat Storan Email</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Cari, filter, atau kelola rincian hasil peninjauan email pekerjaan Anda.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Tampilkan:</span>
              <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                <SelectTrigger className="w-[90px] h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-semibold">
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

          {/* QUICK FILTER PILLS & SEARCH BAR */}
          <div className="pt-3 space-y-3 border-t border-slate-100 mt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* QUICK STATUS PILLS */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusFilterChange("all")}
                  className={`text-xs h-9 px-3 rounded-xl transition-all font-bold ${
                    statusFilter === "all"
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  Semua ({statusCounts.all})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusFilterChange("approved")}
                  className={`text-xs h-9 px-3 rounded-xl transition-all font-bold gap-1.5 ${
                    statusFilter === "approved"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ACC / Terjual ({statusCounts.approved})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusFilterChange("pending")}
                  className={`text-xs h-9 px-3 rounded-xl transition-all font-bold gap-1.5 ${
                    statusFilter === "pending"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Pending ({statusCounts.pending})
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusFilterChange("rejected")}
                  className={`text-xs h-9 px-3 rounded-xl transition-all font-bold gap-1.5 ${
                    statusFilter === "rejected"
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                      : "bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-200"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  Ditolak ({statusCounts.rejected})
                </Button>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative w-full sm:w-60 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Cari ID / email..."
                  className="pl-8 text-xs h-9 min-h-[36px] bg-slate-50 border-slate-200 focus-visible:ring-blue-500 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* LOADING STATE */}
          {loading && (
            <div className="py-12 text-center space-y-2">
              <Clock className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Memuat data riwayat job...</p>
            </div>
          )}

          {/* EMPTY STATE: NO SUBMISSIONS AT ALL */}
          {!loading && submissions.length === 0 && (
            <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50 my-2">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                <History className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">Belum Ada Riwayat Job</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Anda belum pernah mengirimkan setoran email job. Buka halaman Setor Email untuk mengirimkan batch email pertama Anda.
                </p>
              </div>
              {onGoToSubmit && (
                <Button
                  type="button"
                  onClick={onGoToSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-4 rounded-xl gap-2 shadow-xs min-h-[44px] active:scale-95 transition-transform mt-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Setor Email Baru</span>
                </Button>
              )}
            </div>
          )}

          {/* EMPTY STATE: FILTERED NO MATCH */}
          {!loading && submissions.length > 0 && filteredList.length === 0 && (
            <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-3 bg-slate-50/50 my-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <Filter className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">Setoran Tidak Ditemukan</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tidak ada data setoran job yang cocok dengan kriteria filter atau pencarian Anda.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs h-9 rounded-xl border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-bold min-h-[36px]"
              >
                Reset Filter
              </Button>
            </div>
          )}

          {/* HISTORY DATA PRESENTATION */}
          {!loading && currentPaginatedItems.length > 0 && (
            <>
              {/* 1. DESKTOP TABLE ARRANGEMENT (hidden on mobile md:hidden) */}
              <div className="hidden md:block border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-700 bg-slate-50 font-bold">
                      <th className="py-3 px-3.5">Tanggal & ID Batch</th>
                      <th className="py-3 px-3.5">Jumlah Email</th>
                      <th className="py-3 px-3.5">Rate Komisi</th>
                      <th className="py-3 px-3.5">Rincian Hasil</th>
                      <th className="py-3 px-3.5">Estimasi Saldo</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPaginatedItems.map(({ raw, count, approvedCount, rejectedCount, pendingCount, pricePerItem, earnedAmount }) => (
                      <tr key={raw.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <p className="font-mono font-bold text-slate-900 text-xs">#{shortId(raw.id)}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(raw.submittedAt)}</p>
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap font-bold text-slate-900">
                          {count} Email
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-blue-50 text-blue-700 border-blue-200 font-bold">
                            {formatMoney(pricePerItem)} / item
                          </Badge>
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <div className="space-y-0.5 text-[11px]">
                            <p className="text-emerald-600 font-bold">ACC: {approvedCount}</p>
                            <p className="text-rose-600 font-bold">Ditolak: {rejectedCount}</p>
                            {pendingCount > 0 && (
                              <p className="text-blue-600 font-bold">Pending: {pendingCount}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <p className="font-black text-blue-600">{formatMoney(earnedAmount)}</p>
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap">
                          <StatusBadge status={raw.status} />
                          {raw.reviewNote && (
                            <p className="text-[11px] text-slate-500 italic mt-1 max-w-[160px] truncate" title={raw.reviewNote}>
                              Catatan: {raw.reviewNote}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5 align-top whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewDetail(raw)}
                            className="text-xs h-8 gap-1.5 border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 font-bold rounded-xl min-h-[36px]"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" /> Lihat Email
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. MOBILE MODERN HISTORY CARDS (visible on mobile md:hidden) */}
              <div className="block md:hidden space-y-3">
                {currentPaginatedItems.map(({ raw, count, approvedCount, rejectedCount, pendingCount, pricePerItem, earnedAmount }) => {
                  const isExpanded = !!expandedCards[raw.id];

                  return (
                    <div
                      key={raw.id}
                      className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2.5 transition-all"
                    >
                      {/* CARD HEADER LINE */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">#{shortId(raw.id)}</span>
                            <StatusBadge status={raw.status} />
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">{formatDateTime(raw.submittedAt)}</p>
                        </div>

                        <div className="text-right flex items-center gap-1.5">
                          <div>
                            <p className="text-xs font-black text-blue-600">{formatMoney(earnedAmount)}</p>
                            <p className="text-[11px] text-slate-500 font-bold">{count} Email</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCardExpanded(raw.id)}
                            className="w-8 h-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl shrink-0 min-h-[44px] min-w-[44px]"
                            title={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* QUICK BREAKDOWN INLINE */}
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <span className="text-emerald-600">ACC: {approvedCount}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-rose-600">Ditolak: {rejectedCount}</span>
                          {pendingCount > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-blue-600">Pending: {pendingCount}</span>
                            </>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewDetail(raw)}
                          className="text-[11px] h-8 px-2.5 gap-1 border-blue-200 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-xl shrink-0 min-h-[36px]"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" /> Lihat Email
                        </Button>
                      </div>

                      {/* EXPANDABLE DETAILS */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-1">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block">Rate Komisi:</span>
                              <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-blue-50 text-blue-700 border-blue-200 font-bold mt-0.5">
                                {formatMoney(pricePerItem)} / item
                              </Badge>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block">Total Estimasi:</span>
                              <span className="font-bold text-slate-900 mt-0.5 block">{formatMoney(earnedAmount)}</span>
                            </div>
                          </div>

                          {raw.reviewNote && (
                            <div className="p-2.5 bg-blue-50/80 border border-blue-100 rounded-lg text-[11px] text-slate-800">
                              <span className="font-bold text-blue-900">Catatan Admin: </span>
                              <span className="italic">{raw.reviewNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 3. PAGINATION CONTROLS */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 font-medium">
                  Menampilkan <strong className="text-slate-900 font-bold">{startIndex + 1}–{endIndex}</strong> dari <strong className="text-slate-900 font-bold">{totalItems}</strong> setoran
                </div>

                {/* SLATE PAGINATION CONTROLS */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs h-9 px-3 rounded-xl font-bold gap-1 min-h-[36px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </Button>

                  <div data-testid="pagination-page-indicator" className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs font-bold rounded-xl">
                    Page <span className="text-blue-400">{validCurrentPage}</span> of {totalPages}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs h-9 px-3 rounded-xl font-bold gap-1 min-h-[36px]"
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
    </div>
  );
}
