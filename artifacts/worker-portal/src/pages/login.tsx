import { useState, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User,
  Phone,
  ShieldAlert,
  Loader2,
  Users,
  CheckCircle2,
  Zap,
  Gift,
  HelpCircle,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  LayoutDashboard,
  Wallet,
  Send,
  ChevronRight,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { createPortalUser, registerReferral, useSettings } from "@/hooks/use-portal";
import { DEFAULT_RULES, type ReferralTierConfig } from "@/lib/portal-types";
import { formatMoney } from "@/lib/portal-utils";

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

  const [showAuthForm, setShowAuthForm] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (pathname.startsWith("/register") || params.has("ref")) {
        return true;
      }
    }
    return false;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Dynamic system settings
  const rules = useSettings("rules", DEFAULT_RULES);

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

  const authSectionRef = useRef<HTMLDivElement>(null);

  const scrollToAuth = (targetMode: "login" | "register") => {
    setMode(targetMode);
    setShowAuthForm(true);
    setMobileMenuOpen(false);
    setTimeout(() => {
      if (authSectionRef.current) {
        authSectionRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

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

      try {
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
      } catch (profileErr) {
        console.error("[Auth] Profile creation failed after Auth account creation:", profileErr);
        if (createdUserCredential?.user) {
          console.warn(`[Auth] Attempting Auth cleanup for UID: ${uid}`);
          try {
            await createdUserCredential.user.delete();
            console.log("[Auth] Orphaned Auth user deleted successfully.");
          } catch (deleteErr) {
            console.error("[Auth] Could not delete Auth user, signing out to prevent unprofiled session:", deleteErr);
            try {
              await auth.signOut();
            } catch {
              // ignore signout error
            }
          }
        }
        throw profileErr;
      }

      if (cleanRef) {
        try {
          await registerReferral(cleanRef, uid, name.trim());
          console.log(`[Auth] Referral relationship stored for referredBy: ${cleanRef}`);
        } catch (refErr) {
          console.warn("[Auth] Referral registration warning:", refErr);
        }
      }

      console.log(`[Auth] Active worker profile created successfully for UID: ${uid}`);
      toast.success("Pendaftaran berhasil! Akun Anda telah aktif.");
    } catch (err) {
      console.error("[Auth] Register error:", err);

      let code = (err as { code?: string }).code ?? "";
      if (!code && err instanceof Error) {
        if (err.message.includes("permission-denied")) {
          code = "permission-denied";
        } else {
          const match = err.message.match(/auth\/[a-z0-9-]+/i);
          if (match) code = match[0];
        }
      }
      const baseMessage = code === "permission-denied"
        ? "Gagal membuat profil pengguna (permission-denied). Silakan periksa koneksi atau hubungi admin."
        : friendlyAuthError(code, "register");
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

  const referralTiers = (rules.data?.referralTiers ?? DEFAULT_RULES.referralTiers) as ReferralTierConfig[];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-neutral-900/90 border-b border-neutral-800 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-white leading-none">Portal Worker</span>
              <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase mt-0.5">Email Approval</span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-300">
            <a href="#hero" className="hover:text-amber-400 transition-colors">Beranda</a>
            <a href="#cara-kerja" className="hover:text-amber-400 transition-colors">Cara Kerja</a>
            <a href="#keuntungan" className="hover:text-amber-400 transition-colors">Keuntungan</a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => scrollToAuth("login")}
              className="text-neutral-200 hover:text-amber-400 hover:bg-neutral-800"
            >
              Masuk
            </Button>
            <Button
              onClick={() => scrollToAuth("register")}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm"
            >
              Daftar Sekarang
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              size="sm"
              onClick={() => scrollToAuth("register")}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 h-8"
            >
              Daftar
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-800 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-neutral-900 border-b border-neutral-800 px-4 pt-3 pb-5 space-y-3 shadow-md">
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium"
            >
              Beranda
            </a>
            <a
              href="#cara-kerja"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium"
            >
              Cara Kerja
            </a>
            <a
              href="#keuntungan"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium"
            >
              Keuntungan
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium"
            >
              FAQ
            </a>
            <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => scrollToAuth("login")}
                className="w-full justify-center border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-amber-400"
              >
                Masuk ke Akun
              </Button>
              <Button
                onClick={() => scrollToAuth("register")}
                className="w-full justify-center bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                Daftar Akun Baru
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section id="hero" className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        {/* Glow backdrop decorative elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Platform Kerja Sampingan Terpercaya</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Mulai Dapatkan Penghasilan dari <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">Rumah</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl mx-auto">
              Gabung sebagai worker, selesaikan pekerjaan yang tersedia, dan kelola saldo serta penghasilan Anda langsung melalui dashboard.
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => scrollToAuth("register")}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 h-12 text-base rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                <span>Daftar sebagai Worker</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToAuth("login")}
                className="w-full sm:w-auto border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-amber-400 px-7 h-12 text-base rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5 text-amber-400" />
                <span>Sudah punya akun? Masuk</span>
              </Button>
            </div>

            {/* Feature Badges */}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left border-t border-neutral-800 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs text-neutral-300 font-medium">Registrasi Cepat & Akun Instan</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 shadow-2xs">
                <Wallet className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs text-neutral-300 font-medium">Penarikan E-Wallet & Bank</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 shadow-2xs">
                <TrendingUp className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs text-neutral-300 font-medium">Sistem Bonus & Tier Transparan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Registration Guide Section */}
      <section id="cara-kerja" className="py-16 bg-neutral-900/50 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Mulai dalam 3 Langkah</h2>
            <p className="text-neutral-400 mt-2 text-sm sm:text-base">
              Proses pendaftaran yang dirancang ringkas agar Anda bisa langsung mulai bekerja tanpa penundaan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 01 */}
            <div className="bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 relative hover:border-amber-500/60 transition-all group shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-black text-amber-500 font-mono">01</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <UserPlus className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Buat Akun</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Daftarkan akun worker menggunakan data yang diperlukan.
              </p>
            </div>

            {/* Step 02 */}
            <div className="bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 relative hover:border-amber-500/60 transition-all group shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-black text-amber-500 font-mono">02</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Masuk ke Dashboard</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Setelah pendaftaran berhasil, akun worker dapat langsung digunakan.
              </p>
            </div>

            {/* Step 03 */}
            <div className="bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 relative hover:border-amber-500/60 transition-all group shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-black text-amber-500 font-mono">03</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Send className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Kerjakan Tugas</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Gunakan dashboard untuk mengirim pekerjaan dan melihat statusnya.
              </p>
            </div>

            {/* Step 04 */}
            <div className="bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 relative hover:border-amber-500/60 transition-all group shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-black text-amber-500 font-mono">04</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Kelola Penghasilan</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Pantau saldo, referral, dan ajukan penarikan melalui dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Registration & Login Highlight Section */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-amber-500/10 rounded-3xl p-8 sm:p-10 border border-neutral-800 shadow-2xs relative overflow-hidden">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Sudah siap mulai?</h2>
              <p className="text-neutral-300 text-sm sm:text-base mt-2">
                Pilih opsi di bawah ini untuk mengakses layanan platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Daftar */}
              <div className="bg-neutral-900/90 p-6 rounded-2xl border border-neutral-800 flex flex-col justify-between hover:border-amber-500/60 transition-all shadow-2xs">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Daftar Akun Baru</h3>
                  <p className="text-neutral-400 text-sm mb-6">Belum punya akun? Buat akun worker baru.</p>
                </div>
                <Button
                  onClick={() => scrollToAuth("register")}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-between"
                >
                  <span>Daftar Akun Baru</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Option 2: Masuk */}
              <div className="bg-neutral-900/90 p-6 rounded-2xl border border-neutral-800 flex flex-col justify-between hover:border-amber-500/60 transition-all shadow-2xs">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Masuk ke Akun</h3>
                  <p className="text-neutral-400 text-sm mb-6">Sudah terdaftar? Langsung masuk ke dashboard Anda.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => scrollToAuth("login")}
                  className="w-full border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-amber-400 font-bold flex items-center justify-between"
                >
                  <span>Masuk ke Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Explain What Happens After Registration */}
      <section className="py-16 bg-neutral-900/50 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Apa yang terjadi setelah mendaftar?</h2>
            <p className="text-neutral-400 text-sm sm:text-base mt-2">
              Sistem kami terintegrasi secara langsung sehingga Anda tidak perlu menunggu lama untuk beraktivitas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-neutral-900/90 p-5 rounded-2xl border border-neutral-800 flex gap-4 items-start shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Akun berhasil dibuat</h4>
                <p className="text-neutral-300 text-xs mt-1">Data kredensial dan pendaftaran Anda tersimpan secara aman.</p>
              </div>
            </div>

            <div className="bg-neutral-900/90 p-5 rounded-2xl border border-neutral-800 flex gap-4 items-start shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Profil worker dibuat otomatis</h4>
                <p className="text-neutral-300 text-xs mt-1">Profil akun worker, tier dasar, dan catatan saldo awal dikonfigurasi instan.</p>
              </div>
            </div>

            <div className="bg-neutral-900/90 p-5 rounded-2xl border border-neutral-800 flex gap-4 items-start shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Worker langsung dapat mengakses dashboard</h4>
                <p className="text-neutral-300 text-xs mt-1">Akses langsung terbuka tanpa hambatan atau penundaan.</p>
              </div>
            </div>

            <div className="bg-neutral-900/90 p-5 rounded-2xl border border-neutral-800 flex gap-4 items-start shadow-2xs">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Worker dapat mulai menggunakan fitur yang tersedia</h4>
                <p className="text-neutral-300 text-xs mt-1">Mulai menyetor pekerjaan, memantau riwayat, dan membagikan link referral.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Referral Explanation */}
      <section id="keuntungan" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-8 sm:p-10 rounded-3xl border border-neutral-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold">
                <Gift className="w-3.5 h-3.5" />
                <span>Program Kemitraan</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Bonus Referral</h2>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Undang worker baru melalui link referral Anda dan dapatkan bonus berdasarkan pencapaian ACC referral. Semakin banyak teman yang aktif dan mencapai target verifikasi email, semakin besar potensi komisi tambahan yang dapat Anda kumpulkan!
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => scrollToAuth("register")}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Dapatkan Link Referral Anda
                </Button>
              </div>
            </div>

            {/* Dynamic Referral Tiers Card */}
            <div className="lg:col-span-5 bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Tingkat Reward Referral</span>
              </h3>
              <div className="space-y-3">
                {referralTiers && referralTiers.length > 0 ? (
                  referralTiers.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-medium text-neutral-200">{t.minAcc} Email ACC Referral</span>
                      </div>
                      <span className="text-xs font-extrabold text-amber-400">{formatMoney(t.reward)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400">Reward referral dikalkulasikan sesuai aturan aktif sistem.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section id="faq" className="py-16 bg-neutral-900/50 border-t border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Pusat Bantuan</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Pertanyaan Sering Diajukan</h2>
            <p className="text-neutral-400 text-sm mt-2">Segala hal yang perlu Anda ketahui sebelum dan sesudah mendaftar.</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana cara membuat akun?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Isi formulir pendaftaran di bagian atas halaman ini dengan nama lengkap, email, dan kata sandi Anda. Proses pendaftaran selesai dalam hitungan detik.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Apakah setelah daftar saya bisa langsung masuk?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Ya, pendaftaran langsung aktif secara otomatis dan memberikan Anda akses penuh ke dashboard worker tanpa hambatan.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana cara mengirim pekerjaan?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Setelah masuk ke dashboard worker, pilih menu Setor Email, lalu salin daftar email sesuai petunjuk format. Sistem akan menyimpan dan memverifikasi pekerjaan Anda.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana sistem referral bekerja?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Bagikan link referral unik yang terdapat di dashboard Anda. Ketika teman mendaftar melalui link tersebut dan berhasil mencapai target email terverifikasi (ACC), Anda berhak mengklaim bonus referral.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana cara melakukan penarikan saldo?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Buka tab Penarikan Saldo di dashboard Anda, masukkan jumlah nominal saldo yang ingin ditarik, lalu tentukan metode pembayaran yang diinginkan seperti E-Wallet (DANA, OVO, GoPay) atau Transfer Bank.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Kenapa pencairan harus menunggu 1–2 hari kerja?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed space-y-2">
                <p>
                  Pencairan membutuhkan waktu 1–2 hari kerja karena setiap akun Gmail yang disetor perlu melalui proses pemeriksaan terlebih dahulu. Jumlah akun yang masuk cukup banyak, sehingga setiap akun harus dicek secara teliti untuk memastikan akun memenuhi prosedur dan dapat lolos ACC.
                </p>
                <p>
                  Pemeriksaan ini juga dilakukan untuk menghindari kendala saat proses ACC, seperti akun yang terkena verifikasi nomor atau masalah lain yang tidak sesuai dengan prosedur.
                </p>
                <p>
                  Setelah akun selesai diperiksa dan berhasil di-ACC, proses pencairan dana akan dilanjutkan sesuai prosedur.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Kapan dana saya dicairkan?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Dana diproses setelah akun selesai diperiksa dan berhasil di-ACC. Estimasi proses pencairan adalah 1–2 hari kerja setelah akun berhasil di-ACC.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* 8. Integrated Form Section (Shown when user clicks Masuk or Daftar) */}
      <section id="auth-section" ref={authSectionRef} className="py-16 bg-neutral-950 scroll-mt-20">
        <div className="max-w-md mx-auto px-4">
          {showAuthForm ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Akses Portal Worker</h2>
                <p className="text-sm text-neutral-400 mt-1">Masuk atau buat akun baru untuk mengelola pekerjaan Anda.</p>
              </div>

              {!firebaseConfigured && (
                <Card className="mb-4 border-amber-500/40 bg-amber-500/10 text-amber-200">
                  <CardContent className="pt-6 flex gap-3 text-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300">Firebase belum dikonfigurasi</p>
                      <p className="text-amber-200/80 mt-1 text-xs">
                        Firebase belum dikonfigurasi. Pastikan environment variables Firebase tersedia pada deployment environment.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-neutral-900 border-neutral-800 shadow-xl text-white relative">
                <CardHeader className="pb-4">
                  <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
                    <TabsList className="grid grid-cols-2 w-full bg-neutral-950 border border-neutral-800">
                      <TabsTrigger value="login" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold text-xs sm:text-sm text-neutral-400">
                        Masuk
                      </TabsTrigger>
                      <TabsTrigger value="register" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white font-semibold text-xs sm:text-sm text-neutral-400">
                        Daftar
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                <CardContent>
                  {mode === "login" ? (
                    <>
                      <CardTitle className="text-lg mb-1 text-white">Masuk ke Akun</CardTitle>
                      <CardDescription className="mb-4 text-neutral-400 text-xs">Gunakan email dan kata sandi terdaftar.</CardDescription>
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                          <Label htmlFor="login-email" className="text-neutral-300 text-xs">Email</Label>
                          <div className="relative mt-1.5">
                            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="login-email"
                              type="email"
                              required
                              disabled={!firebaseConfigured}
                              value={loginEmail}
                              onChange={(e) => setLoginEmail(e.target.value)}
                              placeholder="nama@email.com"
                              className="pl-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="login-password" className="text-neutral-300 text-xs">Kata Sandi</Label>
                          <div className="relative mt-1.5">
                            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="login-password"
                              type={showLoginPassword ? "text" : "password"}
                              required
                              disabled={!firebaseConfigured}
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder="••••••••"
                              className="pl-9 pr-10 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 focus:outline-none"
                              aria-label="Toggle login password visibility"
                            >
                              {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={resetBusy || busy || !firebaseConfigured}
                            onClick={handleForgotPassword}
                            className="text-xs text-amber-400 hover:underline disabled:opacity-50 font-medium"
                          >
                            {resetBusy ? "Mengirim tautan reset..." : "Lupa kata sandi?"}
                          </button>
                        </div>
                        <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold">
                          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Masuk ke Dashboard
                        </Button>
                      </form>
                    </>
                  ) : (
                    <>
                      <CardTitle className="text-lg mb-1 text-white">Buat Akun Baru</CardTitle>
                      <CardDescription className="mb-4 text-neutral-400 text-xs">
                        Daftar akun worker baru untuk langsung menyetor email.
                      </CardDescription>
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                          <Label htmlFor="reg-name" className="text-neutral-300 text-xs">Nama Lengkap</Label>
                          <div className="relative mt-1.5">
                            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="reg-name"
                              required
                              disabled={!firebaseConfigured}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Nama Anda"
                              className="pl-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="reg-phone" className="text-neutral-300 text-xs">Nomor HP (opsional)</Label>
                          <div className="relative mt-1.5">
                            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="reg-phone"
                              disabled={!firebaseConfigured}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="08xxxxxxxxxx"
                              className="pl-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="reg-ref" className="text-neutral-300 text-xs">Kode Referral (opsional)</Label>
                          <div className="relative mt-1.5">
                            <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="reg-ref"
                              disabled={!firebaseConfigured}
                              value={refCode}
                              onChange={(e) => setRefCode(e.target.value)}
                              placeholder="Contoh: WORKER123"
                              className="pl-9 font-mono text-xs bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="reg-email" className="text-neutral-300 text-xs">Email</Label>
                          <div className="relative mt-1.5">
                            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                            <Input
                              id="reg-email"
                              type="email"
                              required
                              disabled={!firebaseConfigured}
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="nama@email.com"
                              className="pl-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="reg-password" className="text-neutral-300 text-xs">Kata Sandi</Label>
                            <div className="relative mt-1.5">
                              <Input
                                id="reg-password"
                                type={showRegPassword ? "text" : "password"}
                                required
                                disabled={!firebaseConfigured}
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="Min. 6 karakter"
                                className="pr-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegPassword(!showRegPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 focus:outline-none"
                                aria-label="Toggle register password visibility"
                              >
                                {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="reg-confirm" className="text-neutral-300 text-xs">Ulangi Sandi</Label>
                            <div className="relative mt-1.5">
                              <Input
                                id="reg-confirm"
                                type={showRegConfirmPassword ? "text" : "password"}
                                required
                                disabled={!firebaseConfigured}
                                value={regConfirm}
                                onChange={(e) => setRegConfirm(e.target.value)}
                                placeholder="Ulangi kata sandi"
                                className="pr-9 bg-neutral-800/90 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 focus:outline-none"
                                aria-label="Toggle register confirm password visibility"
                              >
                                {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold">
                          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Daftar Akun
                        </Button>
                      </form>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-6 px-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <p className="text-neutral-300 text-sm font-medium">Siap untuk bekerja dan mengelola saldo Anda?</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  onClick={() => scrollToAuth("login")}
                  variant="outline"
                  className="border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-amber-400 font-semibold text-xs"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Masuk
                </Button>
                <Button
                  onClick={() => scrollToAuth("register")}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Daftar
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-neutral-950 border-t border-neutral-800 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} Email Approval System. All rights reserved.</p>
      </footer>
    </div>
  );
}
