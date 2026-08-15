import { Switch, Route } from "wouter";
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
        icon={<Loader2 className="w-8 h-8 text-amber-600 animate-spin" />}
        title="Menyiapkan Profil"
        description="Profil Anda sedang dimuat. Jika ini berlangsung lama, coba keluar dan masuk kembali."
        action={
          <Button variant="outline" onClick={() => logout()}>
            Keluar
          </Button>
        }
      />
    );
  }

  if (profile.status === "pending") {
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

  if (profile.status === "rejected" || profile.status === "inactive") {
    return (
      <FullScreenMessage
        icon={<ShieldOff className="w-8 h-8 text-red-600" />}
        title={profile.status === "rejected" ? "Pendaftaran Ditolak" : "Akun Dinonaktifkan"}
        description={
          profile.status === "rejected"
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

  if (profile.role === "admin") {
    return <AdminDashboard profile={profile} onLogout={() => logout()} />;
  }

  return <WorkerDashboard profile={profile} onLogout={() => logout()} />;
}

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={PortalGate} />
        <Route path="/dashboard" component={PortalGate} />
        <Route path="/admin" component={PortalGate} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
      <SonnerToaster />
    </>
  );
}
