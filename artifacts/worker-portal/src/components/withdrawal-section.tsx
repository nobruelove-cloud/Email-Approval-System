import React, { useState, useMemo } from "react";
import {
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Building2,
  Smartphone,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { formatMoney } from "@/lib/portal-utils";

export interface WithdrawalSectionProps {
  balance: number;
  minWithdraw: number;
  maxWithdraw: number;
  paymentMethods: string[];
  onSubmitWithdrawal: (params: {
    amount: number;
    method: string;
    account: string;
    accountHolderName: string;
  }) => Promise<void>;
  onNavigateToReferral?: () => void;
  isSubmitting?: boolean;
}

interface ProviderOption {
  id: string;
  name: string;
  type: "ewallet" | "bank";
  badge: string;
  colorClass: string;
  bgLightClass: string;
  borderActiveClass: string;
  logoSvg?: React.ReactNode;
}

const PROVIDERS: ProviderOption[] = [
  // E-Wallets
  {
    id: "DANA",
    name: "DANA",
    type: "ewallet",
    badge: "Instan",
    colorClass: "text-blue-600",
    bgLightClass: "bg-blue-50/80 hover:bg-blue-100/60",
    borderActiveClass: "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/90",
  },
  {
    id: "OVO",
    name: "OVO",
    type: "ewallet",
    badge: "Populer",
    colorClass: "text-purple-600",
    bgLightClass: "bg-purple-50/80 hover:bg-purple-100/60",
    borderActiveClass: "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/90",
  },
  {
    id: "GoPay",
    name: "GoPay",
    type: "ewallet",
    badge: "Cepat",
    colorClass: "text-emerald-600",
    bgLightClass: "bg-emerald-50/80 hover:bg-emerald-100/60",
    borderActiveClass: "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/90",
  },
  {
    id: "ShopeePay",
    name: "ShopeePay",
    type: "ewallet",
    badge: "Praktis",
    colorClass: "text-orange-600",
    bgLightClass: "bg-orange-50/80 hover:bg-orange-100/60",
    borderActiveClass: "border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/90",
  },
  // Banks
  {
    id: "BCA",
    name: "Bank BCA",
    type: "bank",
    badge: "Transfer Bank",
    colorClass: "text-blue-700",
    bgLightClass: "bg-slate-50 hover:bg-slate-100",
    borderActiveClass: "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/70",
  },
  {
    id: "Mandiri",
    name: "Bank Mandiri",
    type: "bank",
    badge: "Transfer Bank",
    colorClass: "text-amber-700",
    bgLightClass: "bg-slate-50 hover:bg-slate-100",
    borderActiveClass: "border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/70",
  },
  {
    id: "BRI",
    name: "Bank BRI",
    type: "bank",
    badge: "Transfer Bank",
    colorClass: "text-blue-800",
    bgLightClass: "bg-slate-50 hover:bg-slate-100",
    borderActiveClass: "border-blue-700 ring-2 ring-blue-700/20 bg-blue-50/70",
  },
  {
    id: "BNI",
    name: "Bank BNI",
    type: "bank",
    badge: "Transfer Bank",
    colorClass: "text-orange-700",
    bgLightClass: "bg-slate-50 hover:bg-slate-100",
    borderActiveClass: "border-orange-600 ring-2 ring-orange-600/20 bg-orange-50/70",
  },
];

export function WithdrawalSection({
  balance,
  minWithdraw,
  maxWithdraw,
  paymentMethods,
  onSubmitWithdrawal,
  onNavigateToReferral,
  isSubmitting = false,
}: WithdrawalSectionProps) {
  // Method category filter: 'ewallet' | 'bank'
  const [categoryFilter, setCategoryFilter] = useState<"ewallet" | "bank">("ewallet");

  // Selected method
  const initialMethod = paymentMethods.length > 0 ? paymentMethods[0] : "DANA";
  const [selectedMethod, setSelectedMethod] = useState<string>(initialMethod);

  // Form states
  const [amount, setAmount] = useState<number>(0);
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountHolderName, setAccountHolderName] = useState<string>("");

  // Determine available providers matching paymentMethods prop from settings
  const availableProviders = useMemo(() => {
    // If paymentMethods specifies explicit methods, filter/map them
    if (paymentMethods && paymentMethods.length > 0) {
      const knownIds = new Set(paymentMethods.map((m) => m.toLowerCase()));
      const filtered = PROVIDERS.filter((p) => knownIds.has(p.id.toLowerCase()));
      if (filtered.length > 0) return filtered;
    }
    return PROVIDERS;
  }, [paymentMethods]);

  // Providers filtered by current category tab
  const categoryProviders = useMemo(() => {
    const list = availableProviders.filter((p) => p.type === categoryFilter);
    return list.length > 0 ? list : availableProviders;
  }, [availableProviders, categoryFilter]);

  // Quick preset chips
  const presets = useMemo(() => {
    const defaultChips = [25000, 50000, 100000];
    const chips = defaultChips.filter((chip) => chip >= minWithdraw && chip <= balance);
    return chips;
  }, [minWithdraw, balance]);

  // Validation logic
  const isBelowMin = amount > 0 && amount < minWithdraw;
  const isExceedsBalance = amount > balance;
  const isExceedsMax = amount > maxWithdraw;
  const isAmountValid = amount >= minWithdraw && amount <= maxWithdraw && amount <= balance;
  const isAccountValid = accountNumber.trim().length >= 4;
  const isNameValid = accountHolderName.trim().length >= 2;

  const canSubmit = isAmountValid && isAccountValid && isNameValid && !isSubmitting;

  // Handle preset click
  const handleSelectPreset = (value: number) => {
    setAmount(value);
  };

  const handleSelectMax = () => {
    const maxPossible = Math.min(balance, maxWithdraw);
    setAmount(maxPossible > 0 ? maxPossible : 0);
  };

  // Auto clean phone/account number input (digits only)
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, "");
    setAccountNumber(cleaned);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    await onSubmitWithdrawal({
      amount,
      method: selectedMethod,
      account: accountNumber.trim(),
      accountHolderName: accountHolderName.trim(),
    });

    // Reset inputs on success
    setAmount(0);
    setAccountNumber("");
    setAccountHolderName("");
  };

  return (
    <div className="space-y-6">
      {/* 1. BALANCE HIGHLIGHT CARD (Glassmorphic Modern Card) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 p-6 text-white shadow-xl shadow-amber-500/20 border border-amber-400/30">
        {/* Background glow accents */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-900/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-amber-100 text-xs font-semibold uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-amber-200" />
              <span>Saldo Utama Tersedia</span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {formatMoney(balance)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-amber-100/90 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-200 shrink-0" />
              <span>
                Minimal penarikan: <strong className="text-white">{formatMoney(minWithdraw)}</strong> · Maksimal: <strong className="text-white">{formatMoney(maxWithdraw)}</strong>
              </span>
            </div>
          </div>

          {onNavigateToReferral && (
            <div className="shrink-0 pt-2 md:pt-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onNavigateToReferral}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-md font-semibold text-xs gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                <span>Cek Bonus Referral</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN WITHDRAWAL FORM CARD */}
      <Card className="border-gray-200 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* 2. METHOD & PROVIDER GRID SELECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>1. Pilih Metode Penarikan</span>
              </Label>
              <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium gap-1">
                <Zap className="w-3 h-3 text-emerald-600" />
                Proses Diproses 1x24 Jam
              </Badge>
            </div>

            {/* Category Pill Switcher */}
            <div className="inline-flex p-1 bg-gray-100/90 rounded-xl gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("ewallet");
                  const firstEwallet = availableProviders.find((p) => p.type === "ewallet");
                  if (firstEwallet) setSelectedMethod(firstEwallet.id);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  categoryFilter === "ewallet"
                    ? "bg-white text-gray-900 shadow-sm font-extrabold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                E-Wallet (Instant)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("bank");
                  const firstBank = availableProviders.find((p) => p.type === "bank");
                  if (firstBank) setSelectedMethod(firstBank.id);
                }}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  categoryFilter === "bank"
                    ? "bg-white text-gray-900 shadow-sm font-extrabold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Transfer Bank
              </button>
            </div>

            {/* Provider Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {categoryProviders.map((provider) => {
                const isSelected = selectedMethod.toLowerCase() === provider.id.toLowerCase();

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedMethod(provider.id)}
                    className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-22 ${
                      isSelected
                        ? provider.borderActiveClass + " shadow-md"
                        : `${provider.bgLightClass} border-gray-200 hover:border-gray-300`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`font-extrabold text-sm sm:text-base tracking-tight ${provider.colorClass}`}>
                        {provider.name}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-medium">{provider.badge}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Bebas Biaya</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 my-4" />

          {/* 3. INTERACTIVE AMOUNT SELECTOR WITH PRESET CHIPS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount-input" className="text-sm font-bold text-gray-900">
                2. Jumlah Penarikan
              </Label>
              <span className="text-xs text-gray-500">
                Saldo: <strong className="text-amber-700 font-semibold">{formatMoney(balance)}</strong>
              </span>
            </div>

            {/* Amount Input with Prefix */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-gray-500 text-sm select-none">
                Rp
              </span>
              <FormattedNumberInput
                id="amount-input"
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0"
                className={`pl-10 text-lg font-bold text-gray-900 h-12 rounded-xl border ${
                  isBelowMin || isExceedsBalance || isExceedsMax
                    ? "border-red-400 focus-visible:ring-red-400 bg-red-50/20"
                    : "border-gray-200 focus-visible:ring-amber-500"
                }`}
              />
            </div>

            {/* Quick-Select Preset Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-gray-400 font-medium mr-1">Nominal Cepat:</span>
              {presets.map((presetVal) => (
                <button
                  key={presetVal}
                  type="button"
                  onClick={() => handleSelectPreset(presetVal)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    amount === presetVal
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {formatMoney(presetVal)}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSelectMax}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  amount === Math.min(balance, maxWithdraw) && amount > 0
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                }`}
              >
                Maksimal ({formatMoney(Math.min(balance, maxWithdraw))})
              </button>
            </div>

            {/* Real-time Validation Warning */}
            {isBelowMin && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Jumlah penarikan kurang dari batas minimal ({formatMoney(minWithdraw)}).</span>
              </div>
            )}
            {isExceedsBalance && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Jumlah penarikan melebihi saldo utama Anda ({formatMoney(balance)}).</span>
              </div>
            )}
            {isExceedsMax && !isExceedsBalance && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Jumlah penarikan melebihi batas maksimal per transaksi ({formatMoney(maxWithdraw)}).</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 my-4" />

          {/* 4. ACCOUNT DETAILS FORM */}
          <div className="space-y-4">
            <Label className="text-sm font-bold text-gray-900 block">
              3. Data Rekening / Tujuan Penarikan
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="account-number-input" className="text-xs text-gray-700 font-semibold mb-1.5 block">
                  Nomor Rekening / HP {selectedMethod}
                </Label>
                <Input
                  id="account-number-input"
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={handleAccountChange}
                  placeholder={
                    categoryFilter === "ewallet"
                      ? "Contoh: 081234567890"
                      : "Contoh: 1234567890"
                  }
                  className="font-mono text-sm h-10 border-gray-200 focus-visible:ring-amber-500"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {categoryFilter === "ewallet"
                    ? "Masukkan nomor HP terdaftar e-wallet tanpa karakter unik."
                    : "Masukkan nomor rekening bank tujuan."}
                </p>
              </div>

              <div>
                <Label htmlFor="account-holder-input" className="text-xs text-gray-700 font-semibold mb-1.5 block">
                  Nama Pemilik Rekening / E-Wallet (a.n.)
                </Label>
                <Input
                  id="account-holder-input"
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Masukkan nama sesuai akun/rekening"
                  className="text-sm h-10 border-gray-200 focus-visible:ring-amber-500"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Pastikan nama pemilik sesuai agar proses transfer berjalan lancar.
                </p>
              </div>
            </div>
          </div>

          {/* 5. FEE & SUMMARY NOTICE WIDGET */}
          <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Jumlah Penarikan Requested:</span>
              <span className="font-bold text-gray-900">{formatMoney(amount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Estimasi Biaya Layanan / Admin:</span>
              <span className="font-semibold text-emerald-600">Gratis (Rp 0)</span>
            </div>
            <div className="border-t border-gray-200/70 pt-2 flex items-center justify-between text-sm">
              <span className="font-bold text-gray-900">Net Saldo Diterima:</span>
              <span className="font-extrabold text-amber-700 text-base">{formatMoney(amount)}</span>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-200/50 flex items-start gap-2 text-[11px] text-gray-500">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Penarikan ke <strong>{selectedMethod}</strong> diproses sesuai urutan antrean.
                Pastikan data nomor dan atas nama akun sudah benar.
              </span>
            </div>
          </div>

          {/* 6. SUBMIT ACTION BUTTON */}
          <form onSubmit={handleSubmit}>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold h-12 text-sm sm:text-base rounded-xl shadow-md shadow-amber-600/20 transition-all gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses Pengajuan...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  <span>Kirim Pengajuan Withdraw</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
