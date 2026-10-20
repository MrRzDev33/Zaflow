import React, { useState } from 'react';
import { UserPlus, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/auth/authService.ts';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage('Kata sandi minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.signUp({
        email,
        password,
        fullName,
      });

      setSuccessMessage(
        result.session
          ? 'Pendaftaran berhasil! Akun Anda langsung aktif. Silakan masuk untuk mulai mengelola konten.'
          : 'Pendaftaran berhasil! Kami sudah mengirim email verifikasi. Buka tautan di email tersebut, lalu masuk ke ZaFlow.'
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Terjadi kesalahan saat mendaftar. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-[#34C759]/10 border border-[#34C759]/20 rounded-2xl flex items-start gap-2.5 text-xs text-[#34C759] leading-relaxed">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34C759] mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900">{successMessage}</p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-2 text-xs text-[#007AFF] underline font-semibold cursor-pointer"
            >
              Buka Form Masuk Sekarang &rarr;
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Nama Lengkap
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Budi Pratama"
          className="w-full px-3.5 py-2.5 text-xs bg-black/[0.03] border border-black/10 rounded-xl focus:outline-none focus:bg-white focus:ring-3 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-slate-900 transition-all"
        />
      </div>

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

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Kata Sandi (Minimal 8 karakter)
        </label>
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
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Ulangi Kata Sandi
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-black/[0.03] border border-black/10 rounded-xl focus:outline-none focus:bg-white focus:ring-3 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-slate-900 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
            title={showConfirmPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'}
          >
            {showConfirmPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,122,255,0.25)] transition-all ios-button cursor-pointer mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Mendaftarkan Akun...</span>
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" strokeWidth={2} />
            <span>Buat Akun Tim Baru</span>
          </>
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-xs text-slate-500">
          Sudah memiliki akun?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-[#007AFF] hover:underline font-semibold cursor-pointer"
          >
            Masuk di sini
          </button>
        </p>
      </div>
    </form>
  );
};
