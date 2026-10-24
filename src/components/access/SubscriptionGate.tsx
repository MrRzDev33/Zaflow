import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Ticket,
  Users,
  Zap,
} from 'lucide-react';
import { formatIDR } from '../../config/plans.ts';
import { useAppBranding } from '../../hooks/useAppBranding.ts';
import { accessService, type AccessPlan, type AccessStatus } from '../../services/access/accessService.ts';
import { getApiErrorMessage } from '../../services/http/apiClient.ts';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';

interface SubscriptionGateProps {
  status: AccessStatus;
  onContinue?: () => void;
  onRefresh: () => Promise<AccessStatus | null | void>;
  onSignOut: () => void;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  status,
  onContinue,
  onRefresh,
  onSignOut,
}) => {
  const { logoUrl } = useAppBranding();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const blocked = status.accountStatus === 'suspended' || status.accountStatus === 'pending_deletion';
  const canContinue = Boolean(status.hasAccess && onContinue);
  const isWorkspaceMember = Boolean(status.workspace) || status.reason === 'workspace';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'finish') {
      setSuccessMsg('Pembayaran diterima. Kami sedang memperbarui masa aktif akun Anda.');
      const first = window.setTimeout(() => {
        refreshRef.current();
      }, 2500);
      const second = window.setTimeout(() => {
        refreshRef.current();
      }, 8000);
      params.delete('payment');
      params.delete('order_id');
      params.delete('status_code');
      params.delete('transaction_status');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      return () => {
        window.clearTimeout(first);
        window.clearTimeout(second);
      };
    }
    if (payment === 'error') {
      setErrorMsg('Pembayaran belum selesai. Silakan coba lagi.');
      params.delete('payment');
      params.delete('order_id');
      params.delete('status_code');
      params.delete('transaction_status');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await accessService.redeemCode(code.trim());
      setCode('');
      setSuccessMsg(res.message || 'Kode aktivasi berhasil digunakan.');
      const next = await onRefresh();
      if (next?.hasAccess) onContinue?.();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Kode aktivasi belum dapat digunakan.'));
    } finally {
      setRedeeming(false);
    }
  };

  const handlePurchase = async (plan: AccessPlan) => {
    setProcessingPlan(plan.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await accessService.createPayment(plan.id);
      if (res.sandbox) {
        setSuccessMsg(res.message || `Paket ${plan.name} berhasil diaktifkan.`);
        const next = await onRefresh();
        if (next?.hasAccess) onContinue?.();
        return;
      }
      if (!res.redirectUrl) {
        throw new Error('Halaman pembayaran belum tersedia. Silakan coba lagi.');
      }
      window.location.assign(res.redirectUrl);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Pembayaran belum dapat diproses.'));
    } finally {
      setProcessingPlan(null);
    }
  };

  const whatsappUrl = status.customerService.whatsappUrl;
  const isExpired = Boolean(status.license?.is_expired);
  const isTrialLicense = Boolean(
    status.license && (status.license.plan_id === 'trial' || status.license.status === 'trialing')
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <ZaFlowLogo size="md" showText={true} theme="light" customLogoUrl={logoUrl} />
          <div className="flex items-center gap-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 sm:inline-flex"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {status.customerService.label}
              </a>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            {blocked ? 'Akun perlu perhatian' : canContinue ? (isTrialLicense ? 'Trial aktif' : 'Paket aktif') : 'Satu langkah lagi'}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {blocked
              ? 'Akun Anda sedang tidak aktif'
              : canContinue
                ? status.license
                  ? isTrialLicense
                    ? 'Trial Anda sudah aktif'
                    : `Paket ${status.license.plan_name} aktif`
                  : 'Akun admin aktif'
                : isExpired
                  ? 'Masa aktif akun telah berakhir'
                  : isWorkspaceMember
                    ? 'Akses workspace belum aktif'
                    : 'Silakan pilih paket yang mau kamu beli'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
            {blocked
              ? 'Hubungi customer service agar kami dapat membantu memulihkan akses akun Anda.'
              : canContinue
                ? status.license
                  ? isTrialLicense
                    ? 'Kode trial berhasil digunakan. Lanjutkan ke Workspace sebelum masa trial berakhir.'
                    : 'Paket Anda sudah siap. Lanjutkan ke Workspace, atau perpanjang paket dan gunakan kode aktivasi di bawah.'
                  : 'Akun admin dapat langsung masuk ke Workspace.'
                : isWorkspaceMember
                  ? 'Akses Anda mengikuti paket pemilik workspace. Hubungi pemilik workspace jika paket belum aktif.'
                  : 'Pilih salah satu paket bulanan di bawah. Mau coba trial dulu? Minta kode trial ke admin melalui tombol customer service.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mx-auto mt-6 flex max-w-3xl items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-auto mt-6 flex max-w-3xl items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {canContinue && (
          <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row">
            <p className="text-xs font-medium text-emerald-800">
              {isTrialLicense
                ? 'Trial aktif. Anda dapat langsung masuk ke Workspace sebelum masa trial berakhir.'
                : 'Paket aktif. Anda dapat langsung masuk ke Workspace.'}
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
            >
              Lanjut ke Workspace
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {blocked ? (
          <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-black/[0.06] bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              {status.accountStatus === 'pending_deletion' ? 'Akun dalam masa pemulihan' : 'Akun dinonaktifkan'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {status.accountStatus === 'pending_deletion'
                ? 'Akun ini sedang dalam proses penjadwalan penghapusan. Hubungi customer service untuk memulihkannya.'
                : 'Akses akun ini untuk sementara ditutup. Hubungi customer service jika Anda membutuhkan bantuan.'}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hubungi Customer Service
                </a>
              ) : null}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Periksa Kembali
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isWorkspaceMember && !canContinue && status.trial.available && (
              <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-[0_20px_60px_rgba(37,99,235,0.25)] sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
                      <Zap className="h-3.5 w-3.5" />
                      Trial by request
                    </div>
                    <h2 className="mt-3 text-2xl font-extrabold">Mau coba trial? Minta ke admin</h2>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100">
                      Ajukan trial {status.trial.days} hari ke admin atau customer service. Tim kami akan
                      mengirimkan kode aktivasi trial berisi {status.trial.credits} kredit AI,{' '}
                      {status.trial.maxBrands} brand, dan {status.trial.maxTeamMembers} anggota.
                    </p>
                    <p className="mt-2 max-w-md text-[11px] leading-relaxed text-blue-200">
                      Trial tidak aktif otomatis. Kode trial diberikan setelah permintaan Anda dikonfirmasi
                      oleh customer service.
                    </p>
                  </div>
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-blue-700 shadow-sm transition-transform hover:scale-[1.02]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Minta Kode Trial
                    </a>
                  ) : (
                    <div className="shrink-0 rounded-2xl bg-white/10 px-4 py-3 text-xs font-semibold text-blue-50">
                      Hubungi customer service ZaFlow untuk mengajukan trial.
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isWorkspaceMember && (
              <>
                <div className="mt-10 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Paket bulanan</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Harga jelas, bisa berhenti kapan saja. Tidak ada biaya tersembunyi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Segarkan
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
              {status.plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl border bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.05)] ${
                    plan.isPromo ? 'border-blue-300 ring-1 ring-blue-100' : 'border-black/[0.07]'
                  }`}
                >
                  {plan.isPromo && (
                    <div className="absolute -top-2.5 left-4 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {plan.promoLabel || 'Promo'}
                    </div>
                  )}
                  <h3 className="text-base font-extrabold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-slate-500">{plan.tagline}</p>
                  <div className="mt-4">
                    {plan.isPromo && (
                      <span className="text-xs font-semibold text-slate-400 line-through">
                        {formatIDR(plan.normalPrice)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {formatIDR(plan.effectivePrice)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">/bulan</span>
                    </div>
                    {plan.isPromo && plan.promoEndsAt && (
                      <p className="mt-1 text-[10px] font-medium text-blue-600">
                        Berakhir {new Date(plan.promoEndsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[11px] text-slate-600">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handlePurchase(plan)}
                    disabled={Boolean(processingPlan)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                  >
                    {processingPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {status.isRenewal ? 'Perpanjang' : 'Pilih'} {plan.name}
                  </button>
                </div>
              ))}
                </div>
              </>
            )}

            {isWorkspaceMember && (
              <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-blue-200 bg-blue-50 p-5 text-xs leading-relaxed text-blue-800">
                Paket dan kredit AI Anda mengikuti workspace yang mengundang Anda. Anda tidak perlu membayar langganan terpisah.
              </div>
            )}

            {!isWorkspaceMember && (
              <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.04)] sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900">Punya kode aktivasi?</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Masukkan kode dari tim ZaFlow untuk mengaktifkan paket. Kode trial juga dikirim oleh
                      customer service setelah permintaan trial Anda disetujui.
                    </p>
                    <form onSubmit={handleRedeem} className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.toUpperCase())}
                        placeholder="ZF-PRO-XXXXXX-XXXXXX"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                      <button
                        type="submit"
                        disabled={redeeming || !code.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                        Gunakan Kode
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {!canContinue && (status.trial.reason === 'used' || status.trial.reason === 'paid') && (
              <div className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-2 text-center text-[11px] text-slate-400">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {status.trial.reason === 'paid'
                  ? 'Trial hanya tersedia untuk akun yang belum pernah berlangganan.'
                  : 'Trial hanya dapat digunakan satu kali per akun.'}
              </div>
            )}

            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Anggota tim mengikuti paket pemilik workspace
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Masa tenggang {status.gracePeriodDays} hari untuk perpanjangan
              </span>
            </div>
          </>
        )}

        {whatsappUrl && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
            <p className="text-[11px] font-medium text-emerald-800">
              Butuh bantuan memilih paket?{' '}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="font-extrabold underline decoration-emerald-400 underline-offset-2"
              >
                Chat customer service via WhatsApp
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
