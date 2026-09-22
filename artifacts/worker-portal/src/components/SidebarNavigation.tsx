import { useEffect } from "react";
import {
  Mail,
  Home,
  Send,
  SearchCheck,
  Trophy,
  Users,
  Wallet,
  History,
  HelpCircle,
  Megaphone,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquare,
  ChevronRight as ArrowRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type PortalUser } from "@/lib/portal-types";
import { formatMoney } from "@/lib/portal-utils";

export type DashboardView =
  | "home"
  | "submit"
  | "checker"
  | "leaderboard"
  | "referral"
  | "withdraw"
  | "history"
  | "cs"
  | "announcements"
  | "chat";

interface SidebarNavigationProps {
  activeView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  unreadChatCount?: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsedDesktop: boolean;
  onToggleCollapseDesktop: () => void;
  profile: PortalUser;
  ratePerItem?: number;
  isEmailVisible: boolean;
  onToggleEmailVisible: () => void;
  onLogout: () => void;
}

export function SidebarNavigation({
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  isCollapsedDesktop,
  onToggleCollapseDesktop,
  profile,
  ratePerItem = 3000,
  unreadChatCount = 0,
  isEmailVisible,
  onToggleEmailVisible,
  onLogout,
}: SidebarNavigationProps) {
  // Lock background scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpenMobile]);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpenMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const displayName = profile?.name && profile.name.trim() ? profile.name.trim() : "Worker";
  const displayEmail = profile?.email && profile.email.trim() ? profile.email.trim() : "-";

  const menuItems: Array<{
    id: DashboardView;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: "home",
      label: "Dashboard",
      description: "Ringkasan & Layanan Cepat",
      icon: <Home className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "submit",
      label: "Job Gmail",
      description: "Setor Akun Gmail & Komisi",
      icon: <Send className="w-5 h-5 shrink-0 text-blue-600" />,
      badge: "Setor",
    },
    {
      id: "checker",
      label: "Screening Email",
      description: "Cek Validasi Email Sebelum Setor",
      icon: <SearchCheck className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "leaderboard",
      label: "Klasemen",
      description: "Peringkat Worker & Hadiah Mingguan",
      icon: <Trophy className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "referral",
      label: "Referral",
      description: "Komisi Pasif Income Ajak Teman",
      icon: <Users className="w-5 h-5 shrink-0 text-blue-600" />,
      badge: "Pasif Income",
    },
    {
      id: "withdraw",
      label: "Tarik Saldo",
      description: "Pencairan Saldo e-Wallet / Bank",
      icon: <Wallet className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "history",
      label: "Riwayat Job",
      description: "Daftar Setoran & Status Batch",
      icon: <History className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "cs",
      label: "Bantuan CS",
      description: "Telegram & Komunitas WhatsApp",
      icon: <HelpCircle className="w-5 h-5 shrink-0 text-blue-600" />,
    },
    {
      id: "chat",
      label: "Pesan Admin",
      description: "Chat Privat 1-on-1 dengan Admin",
      icon: <MessageSquare className="w-5 h-5 shrink-0 text-blue-600" />,
      badge: unreadChatCount > 0 ? `${unreadChatCount} Baru` : undefined,
    },
    {
      id: "announcements",
      label: "Info Resmi",
      description: "Pengumuman & Update Layanan",
      icon: <Megaphone className="w-5 h-5 shrink-0 text-blue-600" />,
    },
  ];

  const handleNavClick = (view: DashboardView) => {
    onSelectView(view);
    onCloseMobile();
  };

  return (
    <>
      {/* ==================== MOBILE BACKDROP OVERLAY ==================== */}
      <div
        onClick={onCloseMobile}
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpenMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* ==================== SIDEBAR / DRAWER CONTAINER ==================== */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-[100dvh] max-h-[100dvh] flex flex-col p-0 overflow-hidden bg-[#F0F4F9] border-r border-slate-200/80 shadow-2xl md:shadow-none justify-between transition-all duration-300 ease-in-out ${
          // Mobile state: slide in drawer (88% width, max 340px)
          isOpenMobile
            ? "translate-x-0 w-[88vw] max-w-[340px]"
            : "-translate-x-full md:translate-x-0"
        } ${
          // Desktop collapsed vs expanded width
          isCollapsedDesktop ? "md:w-16" : "md:w-64"
        }`}
      >
        {/* SIDEBAR HEADER BRANDING */}
        <div className="shrink-0 p-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
              <Mail className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsedDesktop || isOpenMobile) && (
              <div className="min-w-0 flex-1">
                <h1 className="font-black text-slate-900 text-sm tracking-tight leading-none truncate">
                  GMAIL JOB ID
                </h1>
                <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                  Worker Portal
                </p>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapseDesktop}
            className="hidden md:flex p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors focus:outline-none"
            title={isCollapsedDesktop ? "Perluas Sidebar" : "Ciutkan Sidebar"}
          >
            {isCollapsedDesktop ? (
              <ChevronRight className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-blue-600" />
            )}
          </button>
        </div>

        {/* SIDEBAR MENU NAVIGATION */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-2 custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all min-h-[48px] group relative ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white border border-slate-200/80 text-slate-800 hover:border-blue-300 hover:bg-slate-50"
                } ${isCollapsedDesktop && !isOpenMobile ? "justify-center px-0 bg-transparent border-0" : ""}`}
                title={item.label}
              >
                {/* Soft Blue Icon Container */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100"
                  }`}
                >
                  {item.icon}
                </div>

                {(!isCollapsedDesktop || isOpenMobile) && (
                  <div className="min-w-0 flex-1 text-left space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-bold text-xs leading-snug">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold px-1.5 py-0 shrink-0 ${
                            isActive
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {!isCollapsedDesktop && (
                      <p
                        className={`text-[10px] truncate font-medium ${
                          isActive ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Collapsed Tooltip Indicator */}
                {isCollapsedDesktop && !isOpenMobile && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded-lg font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-md transition-opacity">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* WORKER PROFILE & LOGOUT AREA */}
        <div className="shrink-0 p-4 border-t border-slate-200/80 bg-white mt-auto space-y-2">
          {(!isCollapsedDesktop || isOpenMobile) ? (
            <div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F0F4F9] border border-slate-200/80">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-xs truncate leading-tight">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                    <span className="font-mono truncate">
                      {isEmailVisible
                        ? displayEmail
                        : "*".repeat(Math.min(10, displayEmail.length || 8))}
                    </span>
                    <button
                      type="button"
                      onClick={onToggleEmailVisible}
                      className="text-slate-400 hover:text-blue-600 p-0.5 rounded focus:outline-none shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}
                    >
                      {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] bg-white text-blue-700 border-blue-200 font-bold px-2 py-0">
                      Saldo: {formatMoney(profile.balance)}
                    </Badge>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="w-full mt-3 min-h-[44px] flex items-center justify-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium text-sm transition-colors cursor-pointer active:scale-95"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Keluar Akun</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div
                className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs shadow-2xs"
                title={`${displayName} (${formatMoney(profile.balance)})`}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                title="Keluar Akun"
                className="w-10 h-10 min-h-[44px] min-w-[44px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
