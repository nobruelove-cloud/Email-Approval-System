import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, Lock } from 'lucide-react';
import { executeMasterReset } from '../hooks/use-portal';

interface MasterResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MasterResetModal: React.FC<MasterResetModalProps> = ({ isOpen, onClose }) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false); // Toggle Password Visibility
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setErrorMessage('Password / PIN Admin wajib diisi!');
      return;
    }

    setLoading(true);
    try {
      await executeMasterReset(cleanPin);
      alert('Master Reset Operasional Berhasil Dieksekusi!');
      setPin('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Password / PIN Admin tidak cocok. Master Reset dibatalkan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-md rounded-2xl p-6 text-white shadow-2xl relative space-y-5">

        {/* Header Modal */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-400">Konfirmasi Master Reset Operasional</h3>
            <p className="text-xs text-slate-400">Tindakan ini akan mereset data operasional sistem.</p>
          </div>
        </div>

        {/* Form Input PIN */}
        <form onSubmit={handleExecute} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Password / PIN Admin*
            </label>

            {/* Input Group + Eye Toggle Button */}
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>

              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan Password / PIN"
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
              />

              {/* Toggle Eye Button */}
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                disabled={loading}
                className="absolute right-3 p-1 text-slate-400 hover:text-amber-400 focus:outline-none transition-colors"
                title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Notification Toast */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-400 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />

              {loading ? 'Mengeksekusi...' : 'Eksekusi Master Reset'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
