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
  Sparkles,
  MessageSquare,
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
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: "home",
      label: "Dashboard",
      icon: <Home className="w-5 h-5 shrink-0" />,
    },
    {
      id: "submit",
      label: "Job Gmail",
      icon: <Send className="w-5 h-5 shrink-0" />,
      badge: "Setor",
    },
    {
      id: "checker",
      label: "Screening Email",
      icon: <SearchCheck className="w-5 h-5 shrink-0" />,
    },
    {
      id: "leaderboard",
      label: "Klasemen",
      icon: <Trophy className="w-5 h-5 shrink-0" />,
    },
    {
      id: "referral",
      label: "Referral",
      icon: <Users className="w-5 h-5 shrink-0" />,
      badge: "Pasif Income",
    },
    {
      id: "withdraw",
      label: "Tarik Saldo",
      icon: <Wallet className="w-5 h-5 shrink-0" />,
    },
    {
      id: "history",
      label: "Riwayat Job",
      icon: <History className="w-5 h-5 shrink-0" />,
    },
    {
      id: "cs",
      label: "Bantuan CS",
      icon: <HelpCircle className="w-5 h-5 shrink-0" />,
    },
    {
      id: "chat",
      label: "Pesan Admin",
      icon: <MessageSquare className="w-5 h-5 shrink-0" />,
      badge: unreadChatCount > 0 ? `${unreadChatCount} Baru` : undefined,
    },
    {
      id: "announcements",
      label: "Info Resmi",
      icon: <Megaphone className="w-5 h-5 shrink-0" />,
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
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isOpenMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* ==================== SIDEBAR CONTAINER ==================== */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen bg-white border-r border-amber-100/80 shadow-xl md:shadow-none flex flex-col justify-between transition-all duration-300 ease-in-out ${
          // Mobile state: slide in drawer (82% width, max 300px)
          isOpenMobile
            ? "translate-x-0 w-[82vw] max-w-[300px]"
            : "-translate-x-full md:translate-x-0"
        } ${
          // Desktop collapsed vs expanded width
          isCollapsedDesktop ? "md:w-16" : "md:w-64"
        }`}
      >
        {/* SIDEBAR HEADER BRANDING */}
        <div className="p-3.5 sm:p-4 border-b border-amber-100 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-orange-50/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black flex items-center justify-center text-sm shadow-sm ring-2 ring-amber-400/30 shrink-0">
              <Mail className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsedDesktop || isOpenMobile) && (
              <div className="min-w-0 flex-1">
                <h1 className="font-black text-amber-950 text-sm tracking-tight leading-none truncate">
                  GMAIL JOB ID
                </h1>
                <p className="text-[10px] text-amber-700/80 font-bold truncate mt-0.5">
                  Platform Kerja Online
                </p>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-xl text-gray-500 hover:text-amber-900 hover:bg-amber-100/60 transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapseDesktop}
            className="hidden md:flex p-1.5 rounded-xl text-gray-400 hover:text-amber-900 hover:bg-amber-100/60 transition-colors focus:outline-none"
            title={isCollapsedDesktop ? "Perluas Sidebar" : "Ciutkan Sidebar"}
          >
            {isCollapsedDesktop ? (
              <ChevronRight className="w-4 h-4 text-amber-700" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-amber-700" />
            )}
          </button>
        </div>

        {/* SIDEBAR MENU NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] group relative ${
                  isActive
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm ring-1 ring-amber-400/30"
                    : "text-gray-700 hover:text-amber-950 hover:bg-amber-50/80"
                } ${isCollapsedDesktop && !isOpenMobile ? "justify-center px-0" : ""}`}
                title={item.label}
              >
                <div
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "text-white" : "text-amber-600 group-hover:text-amber-700"
                  }`}
                >
                  {item.icon}
                </div>

                {(!isCollapsedDesktop || isOpenMobile) && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {(!isCollapsedDesktop || isOpenMobile) && item.badge && !isActive && (
                  <Badge
                    variant="outline"
                    className="text-[9px] bg-amber-50 text-amber-800 border-amber-300 font-bold px-1.5 py-0 shrink-0"
                  >
                    {item.badge}
                  </Badge>
                )}

                {/* Collapsed Tooltip Indicator */}
                {isCollapsedDesktop && !isOpenMobile && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[11px] rounded-md font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-md transition-opacity">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* USER PROFILE & LOGOUT SECTION */}
        <div className="p-3 border-t border-amber-100 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 space-y-2">
          {(!isCollapsedDesktop || isOpenMobile) ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/80 border border-amber-200/60">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 text-xs truncate leading-tight">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="font-mono truncate">
                      {isEmailVisible
                        ? displayEmail
                        : "*".repeat(Math.min(10, displayEmail.length || 8))}
                    </span>
                    <button
                      type="button"
                      onClick={onToggleEmailVisible}
                      className="text-gray-400 hover:text-amber-600 p-0.5 rounded focus:outline-none shrink-0"
                      title={isEmailVisible ? "Sembunyikan Email" : "Tampilkan Email"}
                    >
                      {isEmailVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] bg-white text-amber-900 border-amber-300 font-bold px-1 py-0">
                      Saldo: {formatMoney(profile.balance)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={onLogout}
                className="w-full h-9 min-h-[44px] sm:min-h-[36px] bg-white hover:bg-rose-50 border-gray-200 hover:border-rose-200 text-rose-600 hover:text-rose-700 font-bold text-xs gap-2 rounded-xl transition-colors shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black flex items-center justify-center text-xs shadow-2xs"
                title={`${displayName} (${formatMoney(profile.balance)})`}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                title="Keluar"
                className="w-8 h-8 min-h-[44px] min-w-[44px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
