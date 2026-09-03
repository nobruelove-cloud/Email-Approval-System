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
  Calculator,
  ArrowRight,
  Clock,
  Award,
  Headphones,
  Percent,
  Activity,
  Layers,
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

  // Interactive Mockup Tab State
  const [mockupTab, setMockupTab] = useState<"overview" | "submissions" | "withdraw" | "referral">("overview");

  // Earning Estimator State
  const [estDailyAcc, setEstDailyAcc] = useState<number>(30);

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
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "not-set";
      console.log(`[Stage 1: Auth Creation] Registering user: ${regEmail.trim()}, ProjectID: ${projectId}`);
      createdUserCredential = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      const uid = createdUserCredential.user.uid;
      console.log(`[Stage 1: Auth Creation] Firebase Auth account created. UID: ${uid}, Path: users/${uid}. Creating Firestore profile...`);

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
          console.log(`[Auth] Referral registration recorded for referredBy: ${cleanRef}`);
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
  const pricePerItem = rules.data?.tiers?.[0]?.pricePerItem ?? 3500;
  const estimatedDailyEarnings = estDailyAcc * pricePerItem;
  const estimatedMonthlyEarnings = estimatedDailyEarnings * 30;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-neutral-950/80 border-b border-neutral-800/80 shadow-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 fill-neutral-950" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-white leading-none tracking-tight">Portal Worker</span>
              <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase mt-0.5">Email Approval System</span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-300">
            <a href="#hero" className="hover:text-amber-400 transition-colors">Beranda</a>
            <a href="#preview" className="hover:text-amber-400 transition-colors">Dashboard Preview</a>
            <a href="#cara-kerja" className="hover:text-amber-400 transition-colors">Cara Kerja</a>
            <a href="#keuntungan" className="hover:text-amber-400 transition-colors">Keunggulan</a>
            <a href="#simulasi" className="hover:text-amber-400 transition-colors">Simulasi Saldo</a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => scrollToAuth("login")}
              className="text-neutral-300 hover:text-amber-400 hover:bg-neutral-900 border border-transparent hover:border-neutral-800"
            >
              Masuk
            </Button>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur-sm opacity-60 group-hover:opacity-100 transition duration-300" />
              <Button
                onClick={() => scrollToAuth("register")}
                className="relative bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-md px-5"
              >
                Daftar Sekarang
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              size="sm"
              onClick={() => scrollToAuth("register")}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-3 h-8 shadow-sm"
            >
              Daftar
            </Button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-300 hover:bg-neutral-900 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-neutral-950 border-b border-neutral-800 px-4 pt-3 pb-5 space-y-3 shadow-2xl">
            <a
              href="#hero"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              Beranda
            </a>
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              Dashboard Preview
            </a>
            <a
              href="#cara-kerja"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              Cara Kerja
            </a>
            <a
              href="#keuntungan"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              Keunggulan
            </a>
            <a
              href="#simulasi"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              Simulasi Penghasilan
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-neutral-300 hover:text-amber-400 font-medium text-sm"
            >
              FAQ
            </a>
            <div className="pt-3 border-t border-neutral-800/80 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => scrollToAuth("login")}
                className="w-full justify-center border-neutral-800 bg-neutral-900 text-neutral-200 hover:text-amber-400 font-semibold"
              >
                Masuk ke Akun
              </Button>
              <Button
                onClick={() => scrollToAuth("register")}
                className="w-full justify-center bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold shadow-md"
              >
                Daftar Akun Baru
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section & Dashboard Mockup Preview */}
      <section id="hero" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Glow backdrop decorative elements */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-500/20 via-orange-500/15 to-transparent blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-10 w-72 h-72 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-80 h-80 bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900/90 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase shadow-lg shadow-amber-500/5 backdrop-blur-md">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Fintech Platform Kerja Sampingan Terpercaya</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Maksimalkan Penghasilan Anda Secara <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Real-Time & Otomatis</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl mx-auto">
              Setor pekerjaan email terverifikasi, pantau saldo langsung di dashboard interaktif, dan ajukan pencairan instan ke E-Wallet atau Rekening Bank Anda kapan saja.
            </p>

            {/* CTA Buttons with Subtle Amber Glow Effect */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="relative group w-full sm:w-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-300 group-hover:blur-lg" />
                <Button
                  size="lg"
                  onClick={() => scrollToAuth("register")}
                  className="relative w-full sm:w-auto bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black px-8 h-13 text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5"
                >
                  <UserPlus className="w-5 h-5 text-neutral-950" />
                  <span>Daftar Worker Sekarang</span>
                  <ArrowRight className="w-4 h-4 text-neutral-950 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToAuth("login")}
                className="w-full sm:w-auto border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-amber-400 px-7 h-13 text-base rounded-xl transition-all flex items-center justify-center gap-2 backdrop-blur-md"
              >
                <LogIn className="w-5 h-5 text-amber-400" />
                <span>Masuk ke Dashboard</span>
              </Button>
            </div>
          </div>

          {/* Glassmorphism Worker Dashboard Mockup Preview */}
          <div id="preview" className="mt-14 max-w-5xl mx-auto scroll-mt-24">
            <div className="relative rounded-3xl p-1 bg-gradient-to-b from-amber-500/30 via-neutral-800/40 to-neutral-900/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              <div className="bg-neutral-950/90 backdrop-blur-xl rounded-[22px] border border-neutral-800/80 p-4 sm:p-6 overflow-hidden">
                {/* Mockup Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-xs font-mono text-neutral-400 border-l border-neutral-800 pl-3 hidden sm:inline">
                      https://worker-portal.app/dashboard
                    </span>
                  </div>

                  {/* Interactive Preview Tabs */}
                  <div className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 p-1 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setMockupTab("overview")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        mockupTab === "overview"
                          ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      Ringkasan Saldo
                    </button>
                    <button
                      onClick={() => setMockupTab("submissions")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        mockupTab === "submissions"
                          ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      Storan Email
                    </button>
                    <button
                      onClick={() => setMockupTab("withdraw")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        mockupTab === "withdraw"
                          ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      Penarikan
                    </button>
                    <button
                      onClick={() => setMockupTab("referral")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        mockupTab === "referral"
                          ? "bg-amber-500 text-neutral-950 font-bold shadow-sm"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      Referral
                    </button>
                  </div>
                </div>

                {/* Mockup Tab Content */}
                {mockupTab === "overview" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Saldo Highlight Card */}
                      <div className="bg-gradient-to-br from-neutral-900 via-amber-950/20 to-neutral-900 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs text-neutral-400 font-medium">Total Saldo Terseedia</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">SIAP CAIR</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          Rp 385.000
                        </p>
                        <p className="text-xs text-amber-400/90 mt-2 flex items-center gap-1 font-medium">
                          <TrendingUp className="w-3.5 h-3.5" /> +Rp 105.000 hari ini dari 30 Email ACC
                        </p>
                      </div>

                      {/* Storan Email Status */}
                      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs text-neutral-400 font-medium">Status Storan Bulan Ini</span>
                          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-white">124</span>
                          <span className="text-xs text-neutral-400">Email Setor</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-semibold">110 Terverifikasi ACC</span>
                          <span className="text-neutral-400">14 Diproses</span>
                        </div>
                      </div>

                      {/* Tier Progress */}
                      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs text-neutral-400 font-medium">Level Tier Worker</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">TIER 2</span>
                        </div>
                        <p className="text-lg font-bold text-white">Rp 3.500 / Email ACC</p>
                        <div className="w-full bg-neutral-800 h-2 rounded-full mt-3 overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full w-[75%]" />
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-2">Setor 26 email lagi untuk capai Tier 3</p>
                      </div>
                    </div>

                    {/* Quick Mockup Action Banner */}
                    <div className="flex flex-wrap items-center justify-between p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">Live Monitoring Status</p>
                          <p className="text-[11px] text-neutral-400">Pemeriksaan akun aktif 24 jam dengan pembaruan status realtime.</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => scrollToAuth("register")}
                        className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs"
                      >
                        Mulai Coba Sekarang
                      </Button>
                    </div>
                  </div>
                )}

                {mockupTab === "submissions" && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-white">Form Input Massal Storan Email</span>
                        <span className="text-[10px] text-amber-400 font-mono">Format: email|password</span>
                      </div>
                      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-300 space-y-1 opacity-90">
                        <p className="text-neutral-400"># Contoh format penyetoran:</p>
                        <p>worker.acc01@gmail.com|passSecret123</p>
                        <p>worker.acc02@gmail.com|passSecret123</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800">
                        <p className="text-neutral-400 text-[10px]">Total Storan</p>
                        <p className="font-bold text-white text-sm">150</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <p className="text-[10px]">Lolos ACC</p>
                        <p className="font-bold text-sm">135</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <p className="text-[10px]">Sedang Diperiksa</p>
                        <p className="font-bold text-sm">12</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        <p className="text-[10px]">Gagal Verifikasi</p>
                        <p className="font-bold text-sm">3</p>
                      </div>
                    </div>
                  </div>
                )}

                {mockupTab === "withdraw" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-3">
                        <span className="text-xs font-semibold text-white">Metode Pembayaran Tersedia</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-center text-xs font-bold">DANA</div>
                          <div className="p-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-center text-xs font-medium">OVO</div>
                          <div className="p-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-center text-xs font-medium">GoPay</div>
                        </div>
                        <div className="text-xs space-y-1 text-neutral-300 pt-1">
                          <p className="text-neutral-400 text-[11px]">Nominal Penarikan</p>
                          <p className="font-mono text-amber-400 font-bold text-base">Rp 250.000</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs">
                        <span className="font-semibold text-white">Riwayat Pencairan Terakhir</span>
                        <div className="flex justify-between items-center p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white">Penarikan DANA</p>
                            <p className="text-[10px] text-neutral-400">Kemarin, 14:20 WIB</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">BERHASIL</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                          <div>
                            <p className="font-bold text-white">Transfer Bank BCA</p>
                            <p className="text-[10px] text-neutral-400">3 hari lalu</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">BERHASIL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {mockupTab === "referral" && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-orange-500/10 border border-amber-500/20 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Link Referral Anda</span>
                        <p className="text-xs font-mono text-white mt-1">https://worker-portal.app/register?ref=WORKER88</p>
                      </div>
                      <Button size="sm" className="bg-amber-500 text-neutral-950 font-bold text-xs h-8">
                        Salin Link
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                        <p className="text-neutral-400 text-[10px]">Total Downline</p>
                        <p className="font-bold text-white text-sm">18 Worker</p>
                      </div>
                      <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                        <p className="text-neutral-400 text-[10px]">Total ACC Tim</p>
                        <p className="font-bold text-amber-400 text-sm">240 Email</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        <p className="text-[10px]">Bonus Tersedia Klaim</p>
                        <p className="font-bold text-sm">Rp 150.000</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Proof / Metrics Banner */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 text-center backdrop-blur-md shadow-lg shadow-black/20">
              <div className="flex justify-center mb-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">1,850+</p>
              <p className="text-xs text-neutral-400 mt-1 font-medium">Worker Aktif Terdaftar</p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 text-center backdrop-blur-md shadow-lg shadow-black/20">
              <div className="flex justify-center mb-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-400 tracking-tight">&lt; 24 Jam</p>
              <p className="text-xs text-neutral-400 mt-1 font-medium">Proses Pencairan Cepat</p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 text-center backdrop-blur-md shadow-lg shadow-black/20">
              <div className="flex justify-center mb-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">Rp 480.000.000+</p>
              <p className="text-xs text-neutral-400 mt-1 font-medium">Total Komisi Terbayar</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Step-by-Step Workflow Section */}
      <section id="cara-kerja" className="py-20 bg-neutral-900/40 border-y border-neutral-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Panduan Alur Kerja</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Mulai dalam 3 Langkah Mudah</h2>
            <p className="text-neutral-400 mt-2 text-sm sm:text-base">
              Proses kerja yang transparan dan praktis tanpa kerumitan administrasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 01 */}
            <div className="bg-neutral-900/90 rounded-2xl p-7 border border-neutral-800 relative hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 group shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <span className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-mono">01</span>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <UserPlus className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Pendaftaran Akun Instan</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Daftarkan akun worker Anda hanya dalam hitungan detik. Tanpa syarat rumit, akun langsung aktif dan siap digunakan.
              </p>
            </div>

            {/* Step 02 */}
            <div className="bg-neutral-900/90 rounded-2xl p-7 border border-neutral-800 relative hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 group shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <span className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-mono">02</span>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Send className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Setor Pekerjaan Email</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Salin dan masukkan daftar email ke dashboard. Sistem kami akan memproses dan memverifikasi kelayakan akun secara otomatis.
              </p>
            </div>

            {/* Step 03 */}
            <div className="bg-neutral-900/90 rounded-2xl p-7 border border-neutral-800 relative hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 group shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <span className="text-3xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-mono">03</span>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cairkan Saldo Langsung</h3>
              <p className="text-neutral-300 text-sm leading-relaxed">
                Setiap email yang lolos verifikasi ACC akan langsung menambahkan saldo ke akun Anda. Tarik saldo kapan saja ke DANA, OVO, atau Bank.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Why Choose Us / Benefits Grid */}
      <section id="keuntungan" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>Keunggulan Platform</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Mengapa Memilih Portal Worker?</h2>
            <p className="text-neutral-400 mt-2 text-sm sm:text-base">
              Kami menghadirkan infrastruktur finansial dan pengelolaan kerja sampingan yang adil, transparan, dan stabil.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Benefit 1 */}
            <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 hover:border-amber-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Pencairan Saldo Instan</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Penarikan diproses cepat tanpa penundaan. Dukungan lengkap untuk E-Wallet utama dan seluruh bank lokal Indonesia.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 hover:border-amber-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Sistem Multi-Tier Referral</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Undang teman untuk bergabung dan dapatkan komisi tambahan bertingkat sesuai akumulasi pencapaian tim Anda.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 hover:border-amber-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Percent className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Biaya Admin Transparan</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Rincian potongan biaya admin ditampilkan secara terbuka dan jujur sebelum Anda mengonfirmasi penarikan saldo.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 hover:border-amber-500/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Layanan Bantuan 24/7</h3>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Tim dukungan operasional siap membantu menjawab pertanyaan dan menyelesaikan kendala teknis Anda setiap hari.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Earnings Estimator ("Simulasi Penghasilan") */}
      <section id="simulasi" className="py-20 bg-neutral-900/50 border-y border-neutral-800/80 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/30 rounded-3xl p-8 sm:p-10 border border-neutral-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Left Column Controls */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Simulasi Penghasilan</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Hitung Potensi Saldo Anda</h2>
                  <p className="text-neutral-300 text-sm mt-2 leading-relaxed">
                    Gunakan kalkulator simulasi di bawah ini untuk mengestimasi pendapatan harian dan bulanan berdasarkan target penyetoran email ACC.
                  </p>
                </div>

                {/* Range Slider / Controls */}
                <div className="space-y-4 bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800">
                  <div className="flex justify-between items-center">
                    <label htmlFor="daily-acc-slider" className="text-xs font-medium text-neutral-300">Target Email ACC / Hari:</label>
                    <span className="text-lg font-black text-amber-400 font-mono">{estDailyAcc} ACC</span>
                  </div>
                  <input
                    id="daily-acc-slider"
                    type="range"
                    min={5}
                    max={150}
                    step={5}
                    value={estDailyAcc}
                    onChange={(e) => setEstDailyAcc(Number(e.target.value))}
                    className="w-full accent-amber-500 bg-neutral-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-500 font-mono">
                    <span>5 ACC/hari</span>
                    <span>50 ACC/hari</span>
                    <span>150 ACC/hari</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-neutral-800/80">
                    <span className="text-neutral-400">Rate Tier Aktif:</span>
                    <span className="text-amber-300 font-semibold">{formatMoney(pricePerItem)} / email ACC</span>
                  </div>
                </div>
              </div>

              {/* Right Column Calculated Earnings Card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-amber-500/10 via-neutral-950 to-neutral-900 p-6 rounded-2xl border border-amber-500/30 shadow-xl space-y-6">
                <div>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Estimasi Harian</span>
                  <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight mt-1">
                    {formatMoney(estimatedDailyEarnings)}
                  </p>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Estimasi Bulanan (30 Hari)</span>
                  <p className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
                    {formatMoney(estimatedMonthlyEarnings)}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-2">
                    * Belum termasuk potensi komisi tambahan dari bonus referral tim Anda.
                  </p>
                </div>

                <Button
                  onClick={() => scrollToAuth("register")}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold h-12 rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Mulai Kumpulkan Saldo Sekarang
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Referral Program Highlights */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 p-8 sm:p-12 rounded-3xl border border-neutral-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold">
                <Gift className="w-3.5 h-3.5" />
                <span>Program Kemitraan</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Bonus Komisi Referral Bertingkat</h2>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Ajak rekan atau tim Anda untuk bergabung sebagai worker. Setiap kali downline Anda mencapai target email ACC terverifikasi, Anda berhak mengeklaim bonus reward langsung ke saldo akun.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => scrollToAuth("register")}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-6 h-11 rounded-xl"
                >
                  Dapatkan Link Referral Anda
                </Button>
              </div>
            </div>

            {/* Dynamic Referral Tiers Card */}
            <div className="lg:col-span-5 bg-neutral-900/90 rounded-2xl p-6 border border-neutral-800 shadow-xl">
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Tingkat Reward Referral Aktif</span>
              </h3>
              <div className="space-y-3">
                {referralTiers && referralTiers.length > 0 ? (
                  referralTiers.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-neutral-200">{t.minAcc} Email ACC Referral</span>
                      </div>
                      <span className="text-xs font-black text-amber-400 font-mono">{formatMoney(t.reward)}</span>
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

      {/* 7. Interactive FAQ Accordion Section */}
      <section id="faq" className="py-20 bg-neutral-900/40 border-t border-neutral-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Pusat Informasi</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">Pertanyaan Sering Diajukan</h2>
            <p className="text-neutral-400 text-sm mt-2">Segala hal yang perlu Anda ketahui mengenai pendaftaran, pemeriksaan, dan pencairan saldo.</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana cara mendaftar sebagai worker?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Klik tombol Daftar di bagian atas halaman ini, isi nama lengkap, alamat email, dan kata sandi Anda. Akun worker akan langsung aktif dan bisa digunakan detik itu juga.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Berapa batas minimum penarikan saldo (withdrawal)?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Batas minimum penarikan saldo adalah fleksibel mengikuti aturan metode pembayaran aktif (seperti E-Wallet DANA, OVO, GoPay, atau Transfer Bank) yang dapat Anda periksa langsung di tab Penarikan Saldo.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Metode pembayaran apa saja yang didukung?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Platform mendukung berbagai kanal pembayaran terpopuler di Indonesia, antara lain E-Wallet (DANA, OVO, GoPay) serta rekening Transfer Bank lokal utama.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Mengapa pemeriksaan penyetoran email membutuhkan waktu 1–2 hari kerja?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed space-y-2">
                <p>
                  Pemeriksaan membutuhkan waktu 1–2 hari kerja karena setiap akun Gmail yang disetor perlu melalui verifikasi ketat terlebih dahulu.
                </p>
                <p>
                  Proses ini memastikan akun lolos prosedur kualifikasi ACC tanpa kendala seperti permintaan verifikasi nomor telepon atau masalah autentikasi lainnya.
                </p>
                <p>
                  Setelah akun terverifikasi Lolos ACC, saldo secara otomatis dikreditkan dan dapat langsung ditarik.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl px-5 py-1">
              <AccordionTrigger className="text-white hover:text-amber-400 font-semibold text-sm sm:text-base text-left">
                Bagaimana cara kerja bonus referral?
              </AccordionTrigger>
              <AccordionContent className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
                Bagikan kode/link referral unik Anda dari dashboard. Ketika teman yang Anda undang mendaftar dan menyetor email hingga mencapai ambang batas ACC, Anda dapat mengeklaim bonus reward referral langsung ke saldo.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* 8. Integrated Form Section (Shown when user clicks Masuk or Daftar) */}
      <section id="auth-section" ref={authSectionRef} className="py-20 bg-neutral-950 scroll-mt-20 border-t border-neutral-800/80">
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

              <Card className="bg-neutral-900 border-neutral-800 shadow-2xl text-white relative">
                <CardHeader className="pb-4">
                  <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
                    <TabsList className="grid grid-cols-2 w-full bg-neutral-950 border border-neutral-800">
                      <TabsTrigger value="login" className="data-[state=active]:bg-amber-500 data-[state=active]:text-neutral-950 font-bold text-xs sm:text-sm text-neutral-400">
                        Masuk
                      </TabsTrigger>
                      <TabsTrigger value="register" className="data-[state=active]:bg-amber-500 data-[state=active]:text-neutral-950 font-bold text-xs sm:text-sm text-neutral-400">
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
                        <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
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
                        <Button type="submit" disabled={busy || !firebaseConfigured} className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
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
            <div className="text-center py-6 px-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-lg">
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
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Daftar
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-neutral-950 border-t border-neutral-800/80 text-center text-xs text-neutral-500">
        <p>© {new Date().getFullYear()} Email Approval System. All rights reserved.</p>
      </footer>
    </div>
  );
}
