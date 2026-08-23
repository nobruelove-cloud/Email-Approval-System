import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Loader2, Clock, ShieldOff, ShieldAlert } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { usePortalAuth } from "@/hooks/use-portal";
import LoginPage from "@/pages/login";
import WorkerDashboard from "@/pages/worker-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

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

function PortalGate() {
  const { firebaseUser, profile, loading, error, configured, logout } = usePortalAuth();

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  if (urlParams && urlParams.get("preview") === "admin") {
    const mockAdminProfile: import("@/lib/portal-types").PortalUser = {
      uid: "admin_demo",
      name: "Admin Demo",
      email: "mandarawanzz@gmail.com",
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (error) {
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
  return (
    <>
      <Switch>
        <Route path="/" component={PortalGate} />
        <Route path="/register" component={PortalGate} />
        <Route path="/dashboard" component={PortalGate} />
        <Route path="/admin" component={PortalGate} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
      <SonnerToaster />
    </>
  );
}
