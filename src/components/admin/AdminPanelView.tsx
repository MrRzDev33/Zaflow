import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  Database,
  Key,
  CreditCard,
  RefreshCw,
  Upload,
  Link2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
} from 'lucide-react';
import { supabase, isConfigured } from '../../config/supabase.ts';
import { useAppBranding } from '../../hooks/useAppBranding.ts';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';

interface AdminPanelViewProps {
  currentUserEmail?: string;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = () => {
  const { logoUrl, updateLogoUrl, uploadLogoFile, resetLogo, isCustomLogo } = useAppBranding();

  const [stats, setStats] = useState<any>({
    users: [],
    brands: [],
    licenses: [],
    transactions: [],
    aiLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State untuk manajemen logo
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [inputUrl, setInputUrl] = useState(logoUrl || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl || null);
  const [logoFeedback, setLogoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview saat global logoUrl berubah
  useEffect(() => {
    setInputUrl(logoUrl || '');
    setPreviewUrl(logoUrl || null);
  }, [logoUrl]);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (!isConfigured) {
        throw new Error('Supabase belum dikonfigurasi. Hubungkan kredensial Supabase untuk memuat data admin.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Harap masuk terlebih dahulu.');

      const res = await fetch('/api/admin/overview', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Akses ditolak. Anda bukan platform admin.');
      setStats(json);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat panel admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Handler: Pilih file gambar lokal
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoFeedback({ type: 'error', message: 'Berkas harus berupa gambar (PNG, JPG, SVG, WebP).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoFeedback({ type: 'error', message: 'Ukuran berkas maksimal 2 MB agar performa tetap cepat.' });
      return;
    }

    setIsProcessingLogo(true);
    setLogoFeedback(null);
    try {
      const dataUrl = await uploadLogoFile(file);
      setPreviewUrl(dataUrl);
      setInputUrl('');
      setLogoFeedback({ type: 'success', message: 'Logo baru berhasil diunggah dan langsung aktif di seluruh aplikasi ZaFlow.' });
    } catch (err: any) {
      setLogoFeedback({ type: 'error', message: err.message || 'Gagal mengunggah logo.' });
    } finally {
      setIsProcessingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handler: Simpan logo via URL eksternal
  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) {
      setLogoFeedback({ type: 'error', message: 'Harap masukkan URL gambar logo yang valid.' });
      return;
    }

    setIsProcessingLogo(true);
    try {
      const trimmed = inputUrl.trim();
      updateLogoUrl(trimmed);
      setPreviewUrl(trimmed);
      setLogoFeedback({ type: 'success', message: 'URL logo berhasil disimpan dan langsung diterapkan ke navigasi ZaFlow.' });
    } catch (err: any) {
      setLogoFeedback({ type: 'error', message: err.message || 'Gagal menyimpan URL logo.' });
    } finally {
      setIsProcessingLogo(false);
    }
  };

  // Handler: Reset ke logo bawaan ZaFlow
  const handleResetLogo = () => {
    resetLogo();
    setInputUrl('');
    setPreviewUrl(null);
    setLogoFeedback({ type: 'success', message: 'Logo telah dikembalikan ke logo bawaan ZaFlow.' });
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-500">Memuat konsol administrator...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-3xl text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/15 flex items-center justify-center mx-auto shadow-2xs">
          <ShieldCheck className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Akses Administrator Terbatas</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
        <div className="pt-2">
          <button
            onClick={fetchAdminData}
            className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-xl text-xs font-semibold transition-all ios-button cursor-pointer shadow-[0_2px_8px_rgba(0,122,255,0.25)]"
          >
            Segarkan Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header bar: iOS Frosted Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5856D6]/10 border border-[#5856D6]/15 text-[#5856D6] rounded-xl shadow-2xs">
              <ShieldCheck className="w-4.5 h-4.5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Konsol Platform Super Admin</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengaturan identitas brand aplikasi, lisensi lifetime, dan audit ekosistem ZaFlow.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchAdminData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/[0.04] hover:bg-black/[0.08] text-slate-700 font-medium text-xs rounded-xl transition-all ios-button cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Overview Metric Cards - iOS Widget Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl p-4.5 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:bg-white/95 transition-all ios-button">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Total Pengguna</span>
            <div className="w-8 h-8 rounded-[9px] bg-[#007AFF]/10 border border-[#007AFF]/15 text-[#007AFF] flex items-center justify-center shadow-2xs">
              <Users className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{stats.users?.length || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Akun terdaftar</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-4.5 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:bg-white/95 transition-all ios-button">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Workspace Brand</span>
            <div className="w-8 h-8 rounded-[9px] bg-[#5856D6]/10 border border-[#5856D6]/15 text-[#5856D6] flex items-center justify-center shadow-2xs">
              <Database className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{stats.brands?.length || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Multi-brand workspace aktif</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-4.5 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:bg-white/95 transition-all ios-button">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Lisensi Aktif</span>
            <div className="w-8 h-8 rounded-[9px] bg-[#34C759]/10 border border-[#34C759]/15 text-[#34C759] flex items-center justify-center shadow-2xs">
              <Key className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {stats.licenses?.filter((l: any) => l.status === 'active').length || 0}
            </h3>
            <p className="text-[11px] text-[#34C759] font-medium mt-0.5">Akses lifetime terverifikasi</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-4.5 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:bg-white/95 transition-all ios-button">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Total Transaksi</span>
            <div className="w-8 h-8 rounded-[9px] bg-[#FF9500]/10 border border-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shadow-2xs">
              <CreditCard className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{stats.transactions?.length || 0}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Transaksi pembayaran sukses</p>
          </div>
        </div>
      </div>

      {/* Modul Pengaturan Logo Aplikasi (Live Preview & Dual Upload / URL) */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-xl border border-[#007AFF]/15">
                <Sliders className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">Pengaturan Logo Aplikasi</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur logo resmi aplikasi ZaFlow. Perubahan langsung tersinkronisasi ke sidebar, topbar, dan halaman login.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isCustomLogo && (
              <button
                type="button"
                onClick={handleResetLogo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/[0.04] hover:bg-black/[0.08] text-slate-700 font-medium text-xs rounded-xl transition-all ios-button cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke Default ZaFlow</span>
              </button>
            )}
          </div>
        </div>

        {logoFeedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 ${
              logoFeedback.type === 'success'
                ? 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                : 'bg-red-500/10 text-red-700 border border-red-500/20'
            }`}
          >
            {logoFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            )}
            <span>{logoFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sisi Kiri: Form Input & Unggah */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* iOS Segmented Control */}
            <div className="inline-flex p-1 bg-black/[0.05] rounded-xl gap-1 text-xs font-medium text-slate-600 border border-black/[0.04]">
              <button
                type="button"
                onClick={() => setLogoMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] transition-all ios-button cursor-pointer ${
                  logoMode === 'upload' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" strokeWidth={1.8} />
                <span>Upload File Gambar</span>
              </button>
              <button
                type="button"
                onClick={() => setLogoMode('url')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] transition-all ios-button cursor-pointer ${
                  logoMode === 'url' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                <span>Input URL Gambar</span>
              </button>
            </div>

            {/* Mode Upload File */}
            {logoMode === 'upload' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="zaflow-logo-file-input"
                />
                <label
                  htmlFor="zaflow-logo-file-input"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-black/10 hover:border-[#007AFF]/60 bg-black/[0.02] hover:bg-[#007AFF]/5 rounded-2xl cursor-pointer transition-all group ios-button"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-black/10 flex items-center justify-center text-slate-600 group-hover:text-[#007AFF] shadow-2xs mb-2.5 transition-colors">
                    <Upload className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Klik untuk memilih berkas gambar logo
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Format didukung: PNG, JPG, SVG, WebP (Rasio 1:1 direkomendasikan, maks. 2MB)
                  </p>
                </label>
              </div>
            )}

            {/* Mode URL */}
            {logoMode === 'url' && (
              <form onSubmit={handleSaveUrl} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tautan / URL Gambar Logo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://domain-anda.com/logo-zaflow.png"
                      value={inputUrl}
                      onChange={(e) => {
                        setInputUrl(e.target.value);
                        setPreviewUrl(e.target.value || null);
                      }}
                      className="flex-1 px-3.5 py-2 text-xs bg-black/[0.03] border border-black/10 rounded-xl focus:outline-none focus:bg-white focus:ring-3 focus:ring-[#007AFF]/20 focus:border-[#007AFF] font-mono transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isProcessingLogo}
                      className="px-4 py-2 bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-[0_2px_8px_rgba(0,122,255,0.25)] transition-all ios-button cursor-pointer shrink-0"
                    >
                      {isProcessingLogo ? 'Menyimpan...' : 'Terapkan URL'}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Gunakan URL publik yang dapat diakses langsung via HTTPS.
                </p>
              </form>
            )}
          </div>

          {/* Sisi Kanan: Pratinjau Langsung (Dual View: Dark Sidebar & Light Card) */}
          <div className="lg:col-span-5 bg-black/[0.02] border border-black/[0.06] rounded-2xl p-4.5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.8} />
                <span>Pratinjau Langsung (Live Preview)</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-lg bg-white border border-black/10 text-slate-600 font-medium shadow-2xs">
                {isCustomLogo ? 'Kustom' : 'Default Vektor'}
              </span>
            </div>

            {/* Pratinjau dalam mode Sidebar Gelap */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Pada Navigasi Sidebar (iPadOS Dark)
              </span>
              <div className="p-3 bg-[#18181B] border border-white/10 rounded-xl flex items-center justify-between shadow-2xs">
                <ZaFlowLogo size="md" showText={true} theme="dark" customLogoUrl={previewUrl} />
                <span className="text-[10px] text-slate-400 font-mono">v1.2</span>
              </div>
            </div>

            {/* Pratinjau dalam mode Permukaan Terang */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Pada Permukaan Terang / Header
              </span>
              <div className="p-3 bg-white/90 border border-black/10 rounded-xl flex items-center justify-between shadow-2xs">
                <ZaFlowLogo size="md" showText={true} theme="light" customLogoUrl={previewUrl} />
                <span className="text-[10px] text-slate-400 font-mono">Header View</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Tabel Data Transaksi & Pengguna */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Transactions Table */}
        <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-xs text-slate-900">Riwayat Transaksi Pembayaran</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Webhook gerbang pembayaran terverifikasi</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-black/10 bg-black/[0.02] text-slate-600">
              {stats.transactions?.length || 0} entri
            </span>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-black/[0.02] text-[10px] uppercase font-semibold text-slate-500 sticky top-0 border-b border-black/[0.06]">
                <tr>
                  <th className="px-4 py-2.5">ID Transaksi</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] font-mono text-[11px]">
                {stats.transactions?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400 font-sans">
                      Belum ada transaksi tercatat.
                    </td>
                  </tr>
                ) : (
                  stats.transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-black/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 font-medium truncate max-w-[120px]">
                        {t.id.slice(0, 10)}...
                      </td>
                      <td className="px-4 py-2.5 text-slate-900 font-semibold">
                        Rp {Number(t.amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[#34C759] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                          <span>Berhasil</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                        {new Date(t.created_at).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-xs text-slate-900">Daftar Pengguna Terdaftar</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Pengguna terdaftar di platform ZaFlow</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-black/10 bg-black/[0.02] text-slate-600">
              {stats.users?.length || 0} akun
            </span>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-black/[0.02] text-[10px] uppercase font-semibold text-slate-500 sticky top-0 border-b border-black/[0.06]">
                <tr>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Peran Sistem</th>
                  <th className="px-4 py-2.5">Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] text-xs">
                {stats.users?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      Belum ada pengguna tercatat.
                    </td>
                  </tr>
                ) : (
                  stats.users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-black/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{u.full_name || 'Tanpa Nama'}</p>
                        <p className="text-[11px] font-mono text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {u.system_role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#5856D6] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5856D6]" />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>User</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
