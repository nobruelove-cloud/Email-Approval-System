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
}

export type StatusFilterType = "all" | "approved" | "pending" | "rejected";

export function SubmissionHistory({
  submissions,
  loading = false,
  rules,
  userTier = 1,
  onViewDetail,
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

  // Status counts for badge indicators
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
    <Card className="bg-white border-amber-100 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
              <History className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Riwayat Storan Email</span>
            </CardTitle>
            <CardDescription className="text-xs text-gray-600 mt-0.5">
              Daftar batch email yang telah Anda kirim beserta status persetujuannya.
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
                ACC / Terjual ({statusCounts.approved})
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
                placeholder="Cari ID / email..."
                className="pl-8 text-xs h-8 bg-slate-50 border-gray-200 focus-visible:ring-amber-500 rounded-xl"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Memuat riwayat setoran...</p>
        )}

        {!loading && submissions.length === 0 && (
          <div className="p-8 border border-dashed border-amber-200 rounded-2xl text-center space-y-2 bg-amber-50/20">
            <History className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Belum Ada Storan Email</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Anda belum mengirim setoran email. Buka tab STORAN untuk mengirim batch email pertama Anda.
            </p>
          </div>
        )}

        {!loading && submissions.length > 0 && filteredList.length === 0 && (
          <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center space-y-2 bg-slate-50">
            <Filter className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-bold text-gray-800">Tidak Ada Setoran Ditemukan</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Tidak ada data setoran yang cocok dengan filter atau kata kunci pencarian Anda.
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
                    <th className="py-2.5 px-3 font-bold">Jumlah Email</th>
                    <th className="py-2.5 px-3 font-bold">Tier & Harga</th>
                    <th className="py-2.5 px-3 font-bold">Rincian Status</th>
                    <th className="py-2.5 px-3 font-bold">Total Saldo</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60">
                  {currentPaginatedItems.map(({ raw, count, approvedCount, rejectedCount, pendingCount, tierCfg, pricePerItem, earnedAmount }) => (
                    <tr key={raw.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <p className="font-bold text-gray-900">#{shortId(raw.id)}</p>
                        <p className="text-[11px] text-gray-400">{formatDateTime(raw.submittedAt)}</p>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap font-bold text-gray-900">
                        {count} Email
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px] py-0 bg-amber-50 text-amber-900 border-amber-300 font-bold">
                          {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                        </Badge>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="space-y-0.5 text-[11px]">
                          <p className="text-emerald-600 font-bold">ACC: {approvedCount}</p>
                          <p className="text-rose-600 font-bold">Ditolak: {rejectedCount}</p>
                          {pendingCount > 0 && (
                            <p className="text-amber-600 font-bold">Menunggu: {pendingCount}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <p className="font-black text-amber-700">{formatMoney(earnedAmount)}</p>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <StatusBadge status={raw.status} />
                        {raw.reviewNote && (
                          <p className="text-[11px] text-gray-500 italic mt-1 max-w-[150px] truncate" title={raw.reviewNote}>
                            Catatan: {raw.reviewNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewDetail(raw)}
                          className="text-xs h-7 gap-1 border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-amber-950 font-bold rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" /> Lihat Email
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 2. MOBILE COMPACT COLLAPSIBLE CARDS (visible on mobile md:hidden) */}
            <div className="block md:hidden space-y-3">
              {currentPaginatedItems.map(({ raw, count, approvedCount, rejectedCount, pendingCount, tierCfg, pricePerItem, earnedAmount }) => {
                const isExpanded = !!expandedCards[raw.id];

                return (
                  <div
                    key={raw.id}
                    className="p-3.5 rounded-2xl border border-amber-200/80 bg-white shadow-2xs hover:border-amber-300 transition-all space-y-2.5"
                  >
                    {/* COLLAPSED HEADER LINE */}
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-gray-900 text-xs">#{shortId(raw.id)}</span>
                          <StatusBadge status={raw.status} />
                        </div>
                        <p className="text-[11px] text-gray-500">{formatDateTime(raw.submittedAt)}</p>
                      </div>

                      <div className="text-right flex items-center gap-1.5">
                        <div>
                          <p className="text-xs font-black text-amber-700">{formatMoney(earnedAmount)}</p>
                          <p className="text-[11px] text-gray-600 font-semibold">{count} Email</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleCardExpanded(raw.id)}
                          className="w-7 h-7 p-0 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg shrink-0"
                          title={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* EXPANDABLE DETAILS */}
                    {isExpanded && (
                      <div className="pt-1 space-y-3 text-xs bg-amber-50/30 p-3 rounded-xl border border-amber-100">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 text-[11px] block">Tier & Harga:</span>
                            <Badge variant="outline" className="text-[11px] py-0 bg-amber-50 text-amber-900 border-amber-300 font-bold mt-0.5">
                              {tierCfg.name} ({formatMoney(pricePerItem)}/item)
                            </Badge>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[11px] block">Hasil Persetujuan:</span>
                            <div className="flex items-center gap-2 mt-0.5 font-bold text-[11px]">
                              <span className="text-emerald-600">ACC: {approvedCount}</span>
                              <span className="text-rose-600">Ditolak: {rejectedCount}</span>
                              {pendingCount > 0 && <span className="text-amber-600">Menunggu: {pendingCount}</span>}
                            </div>
                          </div>
                        </div>

                        {raw.reviewNote && (
                          <div className="p-2 bg-amber-100/60 rounded-lg text-[11px] text-amber-950">
                            <span className="font-bold">Catatan Admin: </span>
                            <span className="italic">{raw.reviewNote}</span>
                          </div>
                        )}

                        <div className="pt-1 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewDetail(raw)}
                            className="w-full text-xs h-8 gap-1.5 border-amber-300 bg-white hover:bg-amber-50 text-amber-950 font-bold rounded-xl shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-600" /> Lihat Email
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 3. PAGINATION CONTROLS */}
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-gray-500 font-medium">
                Menampilkan <strong className="text-gray-900 font-bold">{startIndex + 1}–{endIndex}</strong> dari <strong className="text-gray-900 font-bold">{totalItems}</strong> setoran
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
