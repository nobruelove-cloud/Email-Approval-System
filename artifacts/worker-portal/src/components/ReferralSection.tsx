import React, { useState } from 'react';
import { usePortal } from '../hooks/use-portal';

export const ReferralSection: React.FC = () => {
  const { currentUser, bindReferralCode } = usePortal();
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State untuk Kalkulator Simulasi Pasif Income (Rp100/ACC)
  const [downlineCount, setDownlineCount] = useState(1);
  const [emailPerDay, setEmailPerDay] = useState(1);

  // Rumus Kalkulator: Jumlah Worker x Jumlah Email x Rp100
  const estimasiHarian = downlineCount * emailPerDay * 100;
  const estimasiBulanan = estimasiHarian * 20; // Asumsi 20 hari kerja/bulan

  const handleBind = async () => {
    if (!inputCode.trim()) {
      setMessage({ type: 'error', text: 'Masukkan kode referral terlebih dahulu!' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await bindReferralCode(inputCode.trim());
      setMessage({ type: 'success', text: 'Berhasil terhubung dengan partner referral!' });
      setInputCode('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Gagal menghubungkan kode referral.' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link/Kode referral berhasil disalin!');
  };

  return (
    <div className="referral-container space-y-6">
      {/* 1. Header & Banner Informasi */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-950 p-6 rounded-2xl text-white">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-medium">
            PROGRAM PASIF INCOME KERJA
          </span>
          <span className="text-xs bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full">
            Flat: Rp 100 / ACC
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Pasif Income Tanpa Batas</h2>
        <p className="text-sm text-amber-200/80">
          Ajak rekan kerja Anda bergabung. Setiap kali partner Anda menyetor email dan disetujui (ACC) oleh admin, komisi referal otomatis <b>Rp 100</b> LANGSUNG masuk ke Saldo Utama Anda tanpa perlu penarikan terpisah!
        </p>
      </div>

      {/* 2. Kalkulator Simulasi Pasif Income */}
      <div className="bg-amber-950/40 border border-amber-900/50 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-amber-100 flex items-center gap-2">
            📊 Kalkulator Simulasi Profit Income
          </h3>
          <span className="text-xs text-amber-400 bg-amber-900/60 px-2.5 py-1 rounded-lg">
            Flat: Rp 100 / ACC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-amber-200/70 block mb-1">
              JUMLAH DOWNLINE: <span className="text-amber-400 font-bold">{downlineCount} Orang</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={downlineCount}
              onChange={(e) => setDownlineCount(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-amber-200/70 block mb-1">
              EMAIL ACC / DOWNLINE / HARI: <span className="text-amber-400 font-bold">{emailPerDay} Email</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={emailPerDay}
              onChange={(e) => setEmailPerDay(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-amber-900/40">
          <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-800/30">
            <span className="text-xs text-amber-300/70 block">ESTIMASI / HARI</span>
            <span className="text-lg font-bold text-amber-400">Rp {estimasiHarian.toLocaleString('id-ID')}</span>
          </div>
          <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-800/30">
            <span className="text-xs text-amber-300/70 block">ESTIMASI / BULAN (20 HARI)</span>
            <span className="text-lg font-bold text-amber-400">Rp {estimasiBulanan.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* 3. Input Kode Upline (Saling Sambung 1-on-1) */}
      <div className="bg-amber-950/30 border border-amber-900/40 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-amber-200">🔗 Tautan Referral Saya</h3>

        {/* Input Upline / Binding */}
        <div>
          <label className="text-xs text-amber-300/70 block mb-1.5">
            Jika Anda belum memiliki pengundang, masukkan kode pengundang / partner di bawah:
          </label>

          {currentUser?.hasUsedReferral || currentUser?.referredBy ? (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-400 font-medium">
              ✓ Akun Anda sudah terhubung secara permanen dengan Partner Upline.
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Masukkan Kode Upline"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                disabled={loading}
                className="flex-1 bg-amber-900/20 border border-amber-800/50 rounded-xl px-4 py-2 text-sm text-amber-100 placeholder-amber-700 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleBind}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-800 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition-all"
              >
                {loading ? 'Proses...' : 'Hubungkan'}
              </button>
            </div>
          )}

          {message && (
            <p className={`text-xs mt-2 ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Kode / Link Referral Milik Sendiri */}
        <div className="pt-2 space-y-3">
          <div>
            <label className="text-xs text-amber-300/70 block mb-1">Kode Referral Unik Anda:</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={currentUser?.referralCode || currentUser?.uid || ''}
                className="flex-1 bg-amber-900/30 border border-amber-800/40 rounded-xl px-4 py-2 text-sm font-mono text-amber-300"
              />
              <button
                onClick={() => copyToClipboard(currentUser?.referralCode || currentUser?.uid || '')}
                className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-600/40 px-4 py-2 rounded-xl text-xs font-medium"
              >
                Salin Kode
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
