import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Key,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Zap,
} from 'lucide-react';
import { supabase, isConfigured } from '../../config/supabase.ts';
import { apiFetchJson, getApiErrorMessage } from '../../services/http/apiClient.ts';
import { accessService, type AccessStatus } from '../../services/access/accessService.ts';
import { formatIDR } from '../../config/plans.ts';
import { Pagination } from '../common/Pagination.tsx';
import { usePagination } from '../../hooks/usePagination.ts';

interface LicenseQuotaViewProps {
  userId?: string;
  onRefreshLicense?: () => void;
}

const statusLabel: Record<string, string> = {
  active: 'Aktif',
  trialing: 'Trial',
  past_due: 'Masa Tenggang',
  expired: 'Berakhir',
  revoked: 'Dicabut',
  canceled: 'Dibatalkan',
};

const aiActionLabel: Record<string, string> = {
  metrics_extractor: 'Ekstrak Metrik',
  strategy_assistant: 'Asisten Strategi',
  caption_writer: 'Penulisan Caption',
};

function transactionStatusLabel(status: string): string {
  if (status === 'success' || status === 'settlement') return 'Berhasil';
  if (status === 'failed') return 'Gagal';
  if (status === 'expired') return 'Kedaluwarsa';
  return 'Menunggu';
}

export const LicenseQuotaView: React.FC<LicenseQuotaViewProps> = ({ onRefreshLicense }) => {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const txPagination = usePagination(transactions, { initialPageSize: 10 });
  const aiLogPagination = usePagination(aiLogs, { initialPageSize: 10 });

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const access = await accessService.getStatus();
      setStatus(access);

      if (isConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: txData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          setTransactions(txData || []);

          const logResult = access.license?.id
            ? await supabase
                .from('ai_usage_logs')
                .select('*')
                .eq('license_id', access.license.id)
                .order('created_at', { ascending: false })
                .limit(100)
            : await supabase
                .from('ai_usage_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);
          setAiLogs(logResult.data || []);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Data paket belum dapat dimuat.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'finish') {
      setSuccessMsg('Pembayaran diterima. Status paket sedang diperbarui.');
      const timer = window.setTimeout(() => loadData(), 2500);
      return () => window.clearTimeout(timer);
    }
    if (payment === 'error') {
      setErrorMsg('Pembayaran tidak selesai atau dibatalkan. Silakan coba lagi.');
    }
  }, [loadData]);

  const handleActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setActivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetchJson<{ success: boolean; message: string }>('/api/activation/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      setSuccessMsg(res.message);
      setCode('');
      await loadData();
      onRefreshLicense?.();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Kode aktivasi belum dapat digunakan.'));
    } finally {
      setActivating(false);
    }
  };

  const handlePurchase = async (planId: string, planName: string) => {
    setProcessingPlan(planId);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await accessService.createPayment(planId);
      if (res.sandbox) {
        setSuccessMsg(res.message || `Paket ${planName} berhasil diaktifkan.`);
        await loadData();
        onRefreshLicense?.();
        return;
      }
      if (!res.redirectUrl) throw new Error('Halaman pembayaran belum tersedia.');
      window.location.assign(res.redirectUrl);
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Pembayaran belum dapat diproses.'));
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        Memuat informasi paket...
      </div>
    );
  }

  const license = status?.license;
  const total = license?.ai_quota_total || 0;
  const used = license?.ai_quota_used || 0;
  const remaining = license?.ai_quota_remaining ?? Math.max(0, total - used);
  const percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const whatsappUrl = status?.customerService.whatsappUrl;
  const isWorkspaceMember = status?.reason === 'workspace';

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-extrabold text-slate-900">Paket & Kuota AI</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola paket bulanan, masa aktif, dan kredit AI Anda. Pembayaran aman melalui QRIS, transfer bank, e-wallet, atau kartu.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Segarkan Status
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Status Paket</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              license?.status === 'active'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : license?.status === 'trialing'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}>
              {license ? statusLabel[license.status] || license.status : 'Belum aktif'}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {license?.plan_name || 'Belum berlangganan'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {license?.is_legacy_lifetime
                ? 'Akses seumur hidup aktif.'
                : license?.current_period_end
                  ? `Aktif sampai ${new Date(license.current_period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Pilih paket untuk mulai menggunakan semua fitur.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
            <div>
              <span className="text-[11px] text-slate-400 block">Siklus</span>
              <span className="text-xs font-bold text-slate-800">
                {license?.is_legacy_lifetime ? 'Seumur hidup' : 'Bulanan'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Batas Brand</span>
              <span className="text-xs font-bold text-slate-800">{license?.max_brands || status?.trial.maxBrands || 1} Brand</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Sisa Hari</span>
              <span className="text-xs font-bold text-slate-800">
                {license?.is_legacy_lifetime ? 'Tanpa batas' : (license?.days_remaining ?? '-')}
              </span>
            </div>
          </div>

          {license?.grace_ends_at && !license.is_expired && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              Masa tenggang berakhir {new Date(license.grace_ends_at).toLocaleDateString('id-ID')}. Perpanjang sekarang agar akses tidak terhenti.
            </div>
          )}
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Kredit AI</span>
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{remaining}</span>
              <span className="text-xs text-slate-400">/ {total} Kredit</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
            </div>
            <p className="text-[10px] text-slate-400">
              Terpakai {used} kredit. Kuota diperbarui setiap siklus bulanan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            Kode Aktivasi
          </h3>
          <p className="text-xs text-slate-500">
            Punya kode dari tim ZaFlow? Masukkan di bawah untuk mengaktifkan paket atau memperpanjang masa aktif.
          </p>
          <form onSubmit={handleActivate} className="space-y-3">
            <input
              type="text"
              required
              placeholder="ZF-PRO-XXXXXX-XXXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-blue-600"
            />
            <button
              type="submit"
              disabled={activating}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {activating ? 'Memproses...' : 'Gunakan Kode'}
            </button>
          </form>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Butuh bantuan? Chat customer service
            </a>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            {isWorkspaceMember ? 'Paket Workspace' : status?.isRenewal ? 'Perpanjang Paket' : 'Pilih Paket Bulanan'}
          </h3>
          {isWorkspaceMember ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-800">
              Paket dan kredit AI Anda mengikuti workspace yang mengundang Anda. Anda tidak perlu membayar langganan terpisah.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {status?.isRenewal
                  ? 'Harga perpanjangan menggunakan harga normal. Promo hanya berlaku untuk pembelian paket baru.'
                  : 'Harga promo berlaku terbatas. Setelah promo berakhir, harga kembali normal.'}
              </p>
              <div className="space-y-2">
                {(status?.plans || []).map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handlePurchase(plan.id, plan.name)}
                    disabled={Boolean(processingPlan)}
                    className="w-full flex items-center justify-between p-3 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl transition-all text-left disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">{plan.name}</span>
                      <span className="text-[11px] text-slate-500">{plan.highlights.join(' • ')}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {plan.isPromo && (
                          <span className="block text-[10px] text-slate-400 line-through">{formatIDR(plan.normalPrice)}</span>
                        )}
                        <span className="font-extrabold text-xs text-slate-900">{formatIDR(plan.effectivePrice)}</span>
                        <span className="block text-[10px] text-slate-400">/bulan</span>
                      </div>
                      {processingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Paket aktif selama 30 hari dan dapat diperpanjang kapan saja. Masa tenggang 3 hari berlaku untuk perpanjangan.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Riwayat Pembayaran</h3>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Belum ada transaksi.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {txPagination.pageItems.map((tx) => (
                <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{tx.transaction_id}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString('id-ID')}
                      {tx.is_renewal ? ' • Perpanjangan' : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">{formatIDR(Number(tx.amount) || 0)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      tx.status === 'success' || tx.status === 'settlement'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.status === 'failed' || tx.status === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {transactionStatusLabel(tx.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={txPagination.page}
            pageSize={txPagination.pageSize}
            totalItems={txPagination.totalItems}
            onPageChange={txPagination.goToPage}
            onPageSizeChange={txPagination.changePageSize}
            itemLabel="transaksi"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Riwayat Pemakaian AI</h3>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          {aiLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Belum ada pemakaian AI.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {aiLogPagination.pageItems.map((log) => (
                <div key={log.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{aiActionLabel[log.action_type] || 'Pemakaian AI'}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-xs block">{log.prompt_summary}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-red-600 block">-{log.credits_deducted} Kredit</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={aiLogPagination.page}
            pageSize={aiLogPagination.pageSize}
            totalItems={aiLogPagination.totalItems}
            onPageChange={aiLogPagination.goToPage}
            onPageSizeChange={aiLogPagination.changePageSize}
            itemLabel="pemakaian"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5" />
        Pembayaran diproses dengan aman. Tidak ada biaya tersembunyi.
      </div>
    </div>
  );
};
