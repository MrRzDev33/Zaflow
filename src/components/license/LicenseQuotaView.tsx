import React, { useState, useEffect, useCallback } from 'react';
import { Key, Zap, ShieldCheck, CreditCard, CheckCircle, AlertCircle, RefreshCw, ShoppingBag, Loader2 } from 'lucide-react';
import { licenseService } from '../../services/license/licenseService.ts';
import { LicenseQuotaInfo } from '../../types/license.ts';
import { supabase, isConfigured } from '../../config/supabase.ts';
import { apiFetchJson, getApiErrorMessage } from '../../services/http/apiClient.ts';
import { PURCHASABLE_PLANS, formatIDR, Plan } from '../../config/plans.ts';

interface LicenseQuotaViewProps {
  userId?: string;
  onRefreshLicense?: () => void;
}

export const LicenseQuotaView: React.FC<LicenseQuotaViewProps> = ({ onRefreshLicense }) => {
  const [info, setInfo] = useState<LicenseQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const licInfo = await licenseService.getLicenseInfo();
      setInfo(licInfo);

      if (isConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: txData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          setTransactions(txData || []);

          const { data: logData } = await supabase
            .from('ai_usage_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
          setAiLogs(logData || []);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data lisensi.');
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
      setSuccessMsg('Pembayaran selesai. Status lisensi akan diperbarui setelah notifikasi Midtrans diterima.');
    } else if (payment === 'error') {
      setErrorMsg('Pembayaran tidak selesai atau dibatalkan. Silakan coba lagi.');
    }

    if (payment) {
      params.delete('payment');
      params.delete('order_id');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    setActivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await licenseService.activateLicense(licenseKeyInput.trim());
      setSuccessMsg(res.message);
      setLicenseKeyInput('');
      loadData();
      if (onRefreshLicense) onRefreshLicense();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengaktifkan lisensi.');
    } finally {
      setActivating(false);
    }
  };

  const handlePurchase = async (plan: Plan) => {
    setProcessingPlan(plan.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Harap masuk terlebih dahulu.');

      const json = await apiFetchJson<{
        sandbox?: boolean;
        message?: string;
        redirectUrl?: string;
      }>('/api/payments/midtrans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      if (json.sandbox) {
        setSuccessMsg(json.message || `Mode sandbox: lisensi ${plan.name} diaktifkan.`);
        await loadData();
        if (onRefreshLicense) onRefreshLicense();
        return;
      }

      if (!json.redirectUrl) {
        throw new Error('Midtrans tidak mengembalikan halaman pembayaran.');
      }

      window.location.assign(json.redirectUrl);
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Gagal melakukan pembayaran.'));
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Memuat informasi lisensi...</div>;
  }

  const license = info?.license;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Key className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-extrabold text-slate-900">Paket Berlangganan & Kuota AI</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pilih paket Starter, Pro, atau Ultra. Pembayaran aman diproses melalui Midtrans (QRIS, transfer bank, e-wallet, dan kartu).
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Segarkan Status</span>
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
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* License Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Status Lisensi Aktif</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                license?.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              {license?.status === 'active' ? 'Aktif' : 'Trial'}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {license?.plan_name || 'Trial (belum berlangganan)'}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Kunci Lisensi: {license?.license_key || 'Dibuat otomatis saat AI pertama kali dipakai'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[11px] text-slate-400 block">Hak Akses</span>
              <span className="text-xs font-bold text-slate-800">Sekali Bayar • Kredit Ditambahkan</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Batas Brand</span>
              <span className="text-xs font-bold text-slate-800">{info?.maxBrands || 1} Brand</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Tanggal Aktivasi</span>
              <span className="text-xs font-bold text-slate-800">
                {license?.activated_at ? new Date(license.activated_at).toLocaleDateString('id-ID') : 'Belum'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Quota Card */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Kuota Kredit AI</span>
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{info?.aiCreditsRemaining || 0}</span>
              <span className="text-xs text-slate-400">/ {info?.aiCreditsTotal || 0} Kredit</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${info?.percentageUsed || 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Terpakai {info?.aiCreditsUsed || 0} kredit untuk ekstraksi & strategi AI.
            </p>
          </div>
        </div>
      </div>

      {/* Activation / Checkout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Aktivasi Kunci Lisensi</span>
          </h3>
          <p className="text-xs text-slate-500">
            Jika Anda sudah memiliki kunci lisensi sekali bayar, masukkan di bawah untuk mengaktifkannya secara instan.
          </p>

          <form onSubmit={handleActivate} className="space-y-3">
            <input
              type="text"
              required
              placeholder="CONTOH: LFS-PRO-XXXX-YYYY"
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-blue-600"
            />
            <button
              type="submit"
              disabled={activating}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {activating ? 'Memproses...' : 'Aktifkan Lisensi'}
            </button>
          </form>
        </div>

        {/* Pembayaran Midtrans */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Pilih & Upgrade Paket Langganan</span>
          </h3>
          <p className="text-xs text-slate-500">
            Anda akan diarahkan ke halaman pembayaran Midtrans. Lisensi aktif otomatis setelah pembayaran terkonfirmasi.
          </p>

          <div className="space-y-2">
            {PURCHASABLE_PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handlePurchase(plan)}
                disabled={Boolean(processingPlan)}
                className="w-full flex items-center justify-between p-3 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl transition-all cursor-pointer text-left disabled:opacity-60 disabled:cursor-wait"
              >
                <div>
                  <span className="font-extrabold text-xs text-slate-900 block">
                    {plan.name} Plan
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {plan.highlights.join(' • ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-xs text-slate-900">{formatIDR(plan.price)}</span>
                  {processingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                </div>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Pembelian paket baru menambahkan kredit AI ke sisa kredit Anda dan memperbarui batas brand/anggota.
          </p>
        </div>
      </div>

      {/* Transaction & AI Ledger History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Riwayat Transaksi Pembayaran</h3>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Belum ada transaksi tercatat.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{tx.transaction_id}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">Rp {Number(tx.amount).toLocaleString('id-ID')}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        tx.status === 'success' || tx.status === 'settlement'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Ledger Penggunaan Kredit AI</h3>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          {aiLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">Belum ada pemakaian kuota AI tercatat.</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {aiLogs.map((log) => (
                <div key={log.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{log.action_type}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-xs block">{log.prompt_summary}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-red-600 block">-{log.credits_deducted} Kredit</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
