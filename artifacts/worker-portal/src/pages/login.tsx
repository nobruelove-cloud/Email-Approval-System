import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { toast } from "sonner";
import { Mail, Lock, User, Phone, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { createPortalUser, registerReferral } from "@/hooks/use-portal";
import { Users } from "lucide-react";

function friendlyAuthError(code: string, context: "login" | "register" | "reset" = "login") {
  const map: Record<string, string> = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-disabled": "Akun ini telah dinonaktifkan.",
    "auth/user-not-found": context === "reset" ? "Email tidak terdaftar." : "Email atau kata sandi salah.",
    "auth/wrong-password": "Email atau kata sandi salah.",
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.",
    "auth/weak-password": "Kata sandi minimal 6 karakter.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
    "auth/network-request-failed": "Gagal terhubung ke server. Periksa koneksi internet Anda.",
    "auth/unauthorized-domain": "Domain ini belum diizinkan di Firebase Console (Authentication > Settings > Authorized domains).",
    "auth/operation-not-allowed": "Metode atau fitur autentikasi ini belum diaktifkan di Firebase Console.",
    "auth/missing-email": "Alamat email wajib diisi.",
  };
  return map[code] ?? "Terjadi kesalahan. Silakan coba lagi.";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">(() => {
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (pathname.startsWith("/register") || params.has("ref")) {
        return "register";
      }
    }
    return "login";
  });
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [refCode, setRefCode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("ref") || "";
    }
    return "";
  });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    try {
      console.log(`[Auth] Attempting login for email: ${loginEmail.trim()}`);
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      console.log(`[Auth] Firebase Auth login successful for: ${loginEmail.trim()}`);
    } catch (err) {
      console.error("[Auth] Login error:", err);
      const code = (err as { code?: string }).code ?? "";
      const baseMessage = friendlyAuthError(code, "login");
      toast.error(code ? `${baseMessage} (${code})` : baseMessage);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    if (regPassword !== regConfirm) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Kata sandi minimal 6 karakter.");
      return;
    }
    if (!name.trim()) {
      toast.error("Nama lengkap wajib diisi.");
      return;
    }
    setBusy(true);
    let createdUserCredential = null;
    try {
      console.log(`[Auth] Registering user: ${regEmail.trim()}`);
      createdUserCredential = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      const uid = createdUserCredential.user.uid;
      console.log(`[Auth] Firebase Auth account created. UID: ${uid}, Path: users/${uid}. Creating Firestore profile...`);

      const cleanRef = refCode.trim();
      await createPortalUser(uid, {
        name: name.trim(),
        email: regEmail.trim(),
        phone: phone.trim() || undefined,
        referredBy: cleanRef || undefined,
        role: "worker",
        status: "active",
        tier: 1,
        balance: 0,
      });

      if (cleanRef) {
        try {
          await registerReferral(cleanRef, uid, name.trim());
          console.log(`[Auth] Referral relationship stored for referredBy: ${cleanRef}`);
        } catch (refErr) {
          console.warn("[Auth] Referral registration warning:", refErr);
        }
      }

      console.log(`[Auth] Firestore profile created successfully for UID: ${uid}`);
      toast.success("Pendaftaran berhasil! Akun Anda telah aktif.");
    } catch (err) {
      console.error("[Auth] Register error:", err);

      if (createdUserCredential?.user) {
        console.warn(`[Auth] Profile creation failed after Auth creation. Attempting cleanup for UID: ${createdUserCredential.user.uid}`);
        try {
          await createdUserCredential.user.delete();
          console.log("[Auth] Orphaned Auth user deleted successfully.");
        } catch (cleanupErr) {
          console.error("[Auth] Failed to delete orphaned Auth user:", cleanupErr);
          try {
            await auth.signOut();
          } catch {
            // ignore signout error
          }
        }
      }

      const code = (err as { code?: string }).code ?? "";
      const baseMessage = friendlyAuthError(code, "register");
      toast.error(code ? `${baseMessage} (${code})` : baseMessage);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!auth) {
      toast.error("Firebase belum dikonfigurasi.");
      return;
    }
    const email = loginEmail.trim();
    if (!email) {
      toast.error("Masukkan email Anda terlebih dahulu, lalu klik lupa kata sandi.");
      return;
    }

    setResetBusy(true);
    console.log(`[ForgotPassword] Sending reset email request for: ${email}`);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log(`[ForgotPassword] Password reset email successfully sent for: ${email}`);
      toast.success("Tautan reset kata sandi telah dikirim ke email Anda. Periksa kotak masuk / folder Spam.");
    } catch (err) {
      console.error("[ForgotPassword] Error sending password reset email:", err);
      const code = (err as { code?: string }).code ?? "";
      const baseMessage = friendlyAuthError(code, "reset");
      toast.error(code ? `${baseMessage} (${code})` : baseMessage);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Portal Setor Email</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk atau daftar untuk mulai menyetor email.</p>
        </div>

        {!firebaseConfigured && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="pt-6 flex gap-3 text-red-700 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Firebase belum dikonfigurasi</p>
                <p className="text-red-600 mt-1">
                  Firebase belum dikonfigurasi. Pastikan environment variables Firebase tersedia pada deployment environment.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="register">Daftar</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <>
                <CardTitle className="text-lg mb-1">Masuk ke Akun</CardTitle>
                <CardDescription className="mb-4">Gunakan email dan kata sandi terdaftar.</CardDescription>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        required
                        disabled={!firebaseConfigured}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="login-password">Kata Sandi</Label>
                    <div className="relative mt-1.5">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="login-password"
                        type="password"
                        required
                        disabled={!firebaseConfigured}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={resetBusy || busy || !firebaseConfigured}
                    onClick={handleForgotPassword}
                    className="text-xs text-amber-700 hover:underline disabled:opacity-50"
                  >
                    {resetBusy ? "Mengirim tautan reset..." : "Lupa kata sandi?"}
                  </button>
                  <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-600 hover:bg-amber-700">
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Masuk
                  </Button>
                </form>
              </>
            ) : (
              <>
                <CardTitle className="text-lg mb-1">Buat Akun Baru</CardTitle>
                <CardDescription className="mb-4">
                  Daftar akun pekerja baru untuk langsung menyetor email.
                </CardDescription>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="reg-name">Nama Lengkap</Label>
                    <div className="relative mt-1.5">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="reg-name"
                        required
                        disabled={!firebaseConfigured}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama Anda"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-phone">Nomor HP (opsional)</Label>
                    <div className="relative mt-1.5">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="reg-phone"
                        disabled={!firebaseConfigured}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-ref">Kode Referral (opsional)</Label>
                    <div className="relative mt-1.5">
                      <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="reg-ref"
                        disabled={!firebaseConfigured}
                        value={refCode}
                        onChange={(e) => setRefCode(e.target.value)}
                        placeholder="Contoh: WORKER123"
                        className="pl-9 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative mt-1.5">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="reg-email"
                        type="email"
                        required
                        disabled={!firebaseConfigured}
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="reg-password">Kata Sandi</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        required
                        disabled={!firebaseConfigured}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reg-confirm">Ulangi Sandi</Label>
                      <Input
                        id="reg-confirm"
                        type="password"
                        required
                        disabled={!firebaseConfigured}
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        placeholder="Ulangi kata sandi"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-600 hover:bg-amber-700">
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Daftar
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
