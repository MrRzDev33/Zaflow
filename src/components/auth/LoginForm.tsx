import React, { useState } from 'react';
import { LogIn, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/auth/authService.ts';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Masukkan email akun Anda terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
      setResetSent(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await authService.signIn({ email, password });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage(
            'Email atau kata sandi tidak cocok. Jika Anda baru pertama kali menghubungkan database Supabase di Vercel/Local, silakan klik tab "Daftar Baru" untuk membuat akun pertama Anda.'
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Terjadi kesalahan saat masuk. Periksa email & kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={resetMode ? handleResetPassword : handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-semibold">{errorMessage}</p>
          </div>
        </div>
      )}

      {resetSent && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-800 leading-relaxed">
          Tautan reset sudah dikirim ke <strong>{email}</strong>. Periksa kotak masuk dan folder spam Anda.
        </div>
      )}

      {resetMode && (
        <p className="text-xs text-slate-600 leading-relaxed">
          Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.
        </p>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Alamat Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@perusahaan.com"
          className="w-full px-3.5 py-2.5 text-xs bg-black/[0.03] border border-black/10 rounded-xl focus:outline-none focus:bg-white focus:ring-3 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-slate-900 transition-all"
        />
      </div>

      {!resetMode && <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Kata Sandi
          </label>
          <button
            type="button"
            onClick={() => {
              setResetMode(true);
              setErrorMessage(null);
              setResetSent(false);
            }}
            className="text-[11px] text-[#007AFF] hover:underline font-semibold cursor-pointer"
          >
            Lupa kata sandi?
          </button>
        </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-black/[0.03] border border-black/10 rounded-xl focus:outline-none focus:bg-white focus:ring-3 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-slate-900 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
            title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>}

      <button
        type="submit"
        disabled={loading || (resetMode && resetSent)}
        className="w-full py-2.5 px-4 bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,122,255,0.25)] transition-all ios-button cursor-pointer mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{resetMode ? 'Mengirim Tautan...' : 'Memverifikasi Akun...'}</span>
          </>
        ) : (
          <>
            <LogIn className="w-4 h-4" strokeWidth={2} />
            <span>{resetMode ? 'Kirim Tautan Reset' : 'Masuk ke ZaFlow'}</span>
          </>
        )}
      </button>

      <div className="text-center pt-2">
        {resetMode ? (
          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
              setErrorMessage(null);
            }}
            className="text-xs text-[#007AFF] hover:underline font-semibold cursor-pointer"
          >
            &larr; Kembali ke halaman masuk
          </button>
        ) : (
          <p className="text-xs text-slate-500">
            Belum punya akun tim?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-[#007AFF] hover:underline font-semibold cursor-pointer"
            >
              Daftar baru di sini
            </button>
          </p>
        )}
      </div>
    </form>
  );
};
