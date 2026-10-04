import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}
import { Loader2, Clock, ShieldOff, ShieldAlert } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { usePortalAuth, useSettings } from "@/hooks/use-portal";
import { DEFAULT_MAINTENANCE } from "@/lib/portal-types";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { AutoUpdateBanner } from "@/components/AutoUpdateBanner";
import { MessageManager } from "@/components/MessageManager";
import { ViewModeProvider, ViewModeToggle } from "@/components/ViewModeContext";
import LoginPage from "@/pages/login";
import WorkerDashboard from "@/pages/worker-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

function MessageManagerPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#F0F4F9] p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-xs font-bold text-blue-700 hover:bg-blue-50"
          >
            ← Kembali ke Dashboard
          </Button>
          <ViewModeToggle />
        </div>
        <MessageManager />
      </div>
    </div>
  );
}

function FullScreenMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          {icon}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-2 mb-6">{description}</p>
        {action}
      </div>
    </div>
  );
}

export function PortalGate() {
  const { firebaseUser, profile, loading, isReady, error, configured, logout } = usePortalAuth();
  const maintenanceHook = useSettings("maintenance", DEFAULT_MAINTENANCE);
  const maintenance = maintenanceHook.data ?? DEFAULT_MAINTENANCE;

  useEffect(() => {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
    console.log(`[Stage 5: PortalGate] Auth UID: ${firebaseUser?.uid ?? 'none'}, Profile UID: ${profile?.uid ?? 'none'}, Role: ${profile?.role ?? 'none'}, Status: ${profile?.status ?? 'none'}, Loading: ${loading}, IsReady: ${isReady}, Error: ${error || 'none'}, ProjectID: ${projectId}`);
  }, [firebaseUser, profile, loading, isReady, error]);

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  if (urlParams && urlParams.get("preview") === "admin") {
    const mockAdminProfile: import("@/lib/portal-types").PortalUser = {
      uid: "admin_demo",
      name: "Admin Demo",
      email: "admin@example.com",
      role: "admin",
      status: "active",
      tier: 1,
      balance: 0,
    };
    return <AdminDashboard profile={mockAdminProfile} onLogout={() => {}} />;
  }
  if (urlParams && urlParams.get("preview") === "worker") {
    const mockWorkerProfile: import("@/lib/portal-types").PortalUser = {
      uid: "worker_demo",
      name: "Ahmad Worker",
      email: "worker@example.com",
      role: "worker",
      status: "active",
      tier: 1,
      balance: 125000,
    };
    return <WorkerDashboard profile={mockWorkerProfile} onLogout={() => {}} />;
  }
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!profile) return;
    const userRole = typeof profile.role === "string" ? profile.role.trim().toLowerCase() : profile.role;
    if (userRole === "admin" && location === "/dashboard") {
      setLocation("/admin");
    } else if (userRole === "worker" && location === "/admin") {
      setLocation("/dashboard");
    }
  }, [profile, location, setLocation]);

  if (!configured) {
    return <LoginPage />;
  }

  if (!firebaseUser) {
    return <LoginPage />;
  }

  if (loading || isReady === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 data-testid="portal-loader" className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <FullScreenMessage
        icon={<ShieldAlert className="w-8 h-8 text-red-600" />}
        title="Terjadi Kesalahan"
        description={error}
        action={
          <Button variant="outline" onClick={() => logout()}>
            Keluar
          </Button>
        }
      />
    );
  }

  if (!profile) {
    return (
      <FullScreenMessage
        icon={<ShieldAlert className="w-8 h-8 text-amber-600" />}
        title="Profil Tidak Ditemukan"
        description="Data profil pengguna tidak ditemukan di database Firestore. Silakan hubungi admin atau keluar dan coba masuk kembali."
        action={
          <Button variant="outline" onClick={() => logout()}>
            Keluar
          </Button>
        }
      />
    );
  }

  const userRole = typeof profile.role === "string" ? profile.role.trim().toLowerCase() : profile.role;
  const userStatus = typeof profile.status === "string" ? profile.status.trim().toLowerCase() : profile.status;

  // ROOT-LEVEL MAINTENANCE GUARD:
  // Intercept any non-admin user when maintenance mode is active before rendering worker dashboard
  if (maintenance?.enabled && userRole !== "admin") {
    return <MaintenanceScreen maintenance={maintenance} onLogout={() => logout()} />;
  }

  if (userStatus === "pending") {
    if (userRole === "worker") {
      // Self-registered workers enter WorkerDashboard immediately without waiting for admin approval
      return <WorkerDashboard profile={{ ...profile, status: "active" }} onLogout={() => logout()} />;
    }
    return (
      <FullScreenMessage
        icon={<Clock className="w-8 h-8 text-amber-600" />}
        title="Menunggu Persetujuan Admin"
        description="Akun Anda sudah terdaftar dan sedang menunggu persetujuan admin. Silakan cek kembali nanti."
        action={
          <Button variant="outline" onClick={() => logout()}>
            Keluar
          </Button>
        }
      />
    );
  }

  if (userStatus === "rejected" || userStatus === "inactive") {
    return (
      <FullScreenMessage
        icon={<ShieldOff className="w-8 h-8 text-red-600" />}
        title={userStatus === "rejected" ? "Pendaftaran Ditolak" : "Akun Dinonaktifkan"}
        description={
          userStatus === "rejected"
            ? "Maaf, pendaftaran Anda tidak disetujui oleh admin. Hubungi admin untuk informasi lebih lanjut."
            : "Akun Anda saat ini dinonaktifkan. Hubungi admin untuk mengaktifkan kembali."
        }
        action={
          <Button variant="outline" onClick={() => logout()}>
            Keluar
          </Button>
        }
      />
    );
  }

  if (userRole === "admin") {
    return <AdminDashboard profile={profile} onLogout={() => logout()} />;
  }

  if (userRole === "worker") {
    return <WorkerDashboard profile={profile} onLogout={() => logout()} />;
  }

  return (
    <FullScreenMessage
      icon={<ShieldAlert className="w-8 h-8 text-red-600" />}
      title="Peran Akun Tidak Valid"
      description="Peran akun Anda tidak dikenal oleh sistem. Silakan hubungi administrator."
      action={
        <Button variant="outline" onClick={() => logout()}>
          Keluar
        </Button>
      }
    />
  );
}

export default function App() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    try {
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === "accepted") {
        console.log("User accepted the install prompt");
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }
    setDeferredPrompt(null);
  };

  return (
    <ViewModeProvider>
      <AutoUpdateBanner />
      {deferredPrompt && (
        <div className="bg-blue-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between z-50 sticky top-0">
          <div className="flex items-center space-x-2 text-sm font-medium">
            <span>Pasang aplikasi di perangkat Anda untuk akses lebih cepat</span>
          </div>
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold border-0 shadow-sm min-h-[44px] px-4 rounded-xl text-sm transition-colors cursor-pointer shrink-0"
          >
            📲 Install Aplikasi Gmail Job ID
          </Button>
        </div>
      )}
      <Switch>
        <Route path="/" component={PortalGate} />
        <Route path="/login" component={PortalGate} />
        <Route path="/register" component={PortalGate} />
        <Route path="/messages" component={MessageManagerPage} />
        <Route path="/dashboard" component={PortalGate} />
        <Route path="/admin" component={PortalGate} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
      <SonnerToaster />
    </ViewModeProvider>
  );
}
