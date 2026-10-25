import React, { useState, useEffect } from 'react';
import { Layers, Calendar, BarChart3, Users, Info } from 'lucide-react';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';
import { ConfigNotice } from '../common/ConfigNotice.tsx';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';
import { teamService } from '../../services/database/teamService.ts';

interface AuthPageProps {
  /** Pesan status dari tautan email (konfirmasi akun / reset kata sandi). */
  notice?: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ notice }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<{
    brand_name?: string;
    role?: string;
    email_masked?: string;
    is_expired?: boolean;
  } | null>(null);

  const inviteRoleLabel = invitePreview?.role === 'admin'
    ? 'Admin'
    : invitePreview?.role === 'editor'
      ? 'Editor'
      : invitePreview?.role === 'viewer'
        ? 'Anggota'
        : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('invite_token');
    const tokenFromStorage = localStorage.getItem('zaflow_pending_invite_token');
    const token = tokenFromUrl || tokenFromStorage;

    if (token) {
      setPendingToken(token);
      localStorage.setItem('zaflow_pending_invite_token', token);
      teamService.getInvitationPreview(token).then((info) => {
        if (info) setInvitePreview(info);
      }).catch(() => {});
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-[#F2F2F7] flex flex-col justify-between text-[#1C1C1E] font-sans overflow-hidden">
      {/* iOS Ambient Blur Liquid Shapes */}
      <div className="fixed -top-32 -left-20 w-[500px] h-[500px] bg-[#007AFF]/15 rounded-full blur-[100px] pointer-events-none -z-0" />
      <div className="fixed top-1/4 -right-32 w-[450px] h-[450px] bg-[#5856D6]/15 rounded-full blur-[100px] pointer-events-none -z-0" />
      <div className="fixed -bottom-28 left-1/3 w-[550px] h-[550px] bg-[#34C759]/12 rounded-full blur-[110px] pointer-events-none -z-0" />

      {/* Banner konfigurasi Supabase jika belum terisi */}
      <ConfigNotice />

      <div className="flex-1 flex items-center justify-center py-6 sm:py-10 px-3 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-14 items-center">
          {/* Kolom Kiri: Brand Identity & Fitur ZaFlow */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            <div className="space-y-4">
              <ZaFlowLogo size="xl" showText={true} theme="light" />
              <div>
                <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Manajemen Konten & Kalender Media Sosial Terpadu
                </h1>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-lg">
                  Arsitektur multi-brand terisolasi, alur kerja editorial terstruktur, dan analitik performa metrik untuk agensi dan tim profesional.
                </p>
              </div>
            </div>

            {/* Feature Highlights Grid: iOS Frosted Glass Cards (disembunyikan di HP agar form langsung terlihat) */}
            <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="p-4 bg-white/70 backdrop-blur-xl border border-black/[0.06] rounded-2xl space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:bg-white/90 transition-all ios-button">
                <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-xs">
                  <div className="w-7 h-7 rounded-xl bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/15 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <span>Multi-Brand Workspace</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-9.5">
                  Pemisahan aset dan izin akses tim secara terisolasi per brand.
                </p>
              </div>

              <div className="p-4 bg-white/70 backdrop-blur-xl border border-black/[0.06] rounded-2xl space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:bg-white/90 transition-all ios-button">
                <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-xs">
                  <div className="w-7 h-7 rounded-xl bg-[#5856D6]/10 text-[#5856D6] border border-[#5856D6]/15 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <span>Kalender & Kanban</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-9.5">
                  Visualisasi jadwal tayang dan status konten dari draft hingga publish.
                </p>
              </div>

              <div className="p-4 bg-white/70 backdrop-blur-xl border border-black/[0.06] rounded-2xl space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:bg-white/90 transition-all ios-button">
                <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-xs">
                  <div className="w-7 h-7 rounded-xl bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/15 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <span>Analitik & Pelaporan</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-9.5">
                  Ekstraksi metrik otomatis, visualisasi rasio engagement, dan export laporan.
                </p>
              </div>

              <div className="p-4 bg-white/70 backdrop-blur-xl border border-black/[0.06] rounded-2xl space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:bg-white/90 transition-all ios-button">
                <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-xs">
                  <div className="w-7 h-7 rounded-xl bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/15 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <span>Kolaborasi & Hak Akses</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal pl-9.5">
                  Undang anggota tim dengan sistem peran aman (Pemilik, Admin, Editor).
                </p>
              </div>
            </div>


          </div>

          {/* Kolom Kanan: Card Form Login / Register - iOS Frosted Glass Sheet */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <div className="bg-white/85 backdrop-blur-2xl border border-black/[0.08] rounded-3xl p-4 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-white/50">
              {notice && (
                <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#007AFF]/20 bg-[#007AFF]/10 p-3.5 text-xs leading-relaxed text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#007AFF]" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Info Undangan Tim jika ada token di URL */}
              {invitePreview && (
                <div className="mb-5 p-3.5 rounded-2xl bg-[#007AFF]/10 border border-[#007AFF]/15 text-xs">
                  <p className="font-semibold text-slate-900">
                    Undangan ke workspace &ldquo;{invitePreview.brand_name || 'Brand'}&rdquo;
                  </p>
                  <p className="text-slate-600 mt-0.5 text-[11px]">
                    Masuk atau buat akun baru untuk menerima peran{' '}
                    <strong className="text-slate-800">{inviteRoleLabel || 'Anggota'}</strong>.
                  </p>
                  {invitePreview.email_masked && (
                    <p className="text-slate-500 mt-1 text-[10px]">
                      Undangan untuk {invitePreview.email_masked}
                    </p>
                  )}
                </div>
              )}

              {/* iOS Segmented Control: Masuk vs Daftar */}
              <div className="flex p-1 bg-black/[0.06] rounded-xl mb-5 border border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-[9px] transition-all ios-button cursor-pointer ${
                    activeTab === 'login'
                      ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-[9px] transition-all ios-button cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Daftar Akun Baru
                </button>
              </div>

              {activeTab === 'login' ? (
                <LoginForm onSwitchToRegister={() => setActiveTab('register')} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setActiveTab('login')} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer minimalis */}
      <footer className="py-4 border-t border-black/[0.06] text-center text-xs text-slate-400 relative z-10">
        <p>&copy; {new Date().getFullYear()} ZaFlow Platform. Semua hak cipta dilindungi.</p>
      </footer>
    </div>
  );
};
