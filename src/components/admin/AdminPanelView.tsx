import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Copy,
  CreditCard,
  Key,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  ShieldCheck,
  Tag,
  Ticket,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../config/supabase.ts';
import { apiFetchJson, getApiErrorMessage } from '../../services/http/apiClient.ts';
import { PURCHASABLE_PLANS, formatIDR, isPromoWindowActive } from '../../config/plans.ts';
import { AdminBrandingPanel } from './AdminBrandingPanel.tsx';

interface AdminPanelViewProps {
  currentUserEmail?: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  system_role: 'user' | 'super_admin';
  status?: string;
  deleted_at?: string | null;
  trial_used_at?: string | null;
  created_at: string;
  license?: any;
}

interface AdminStats {
  users: AdminUser[];
  brands: any[];
  licenses: any[];
  transactions: any[];
  aiLogs: any[];
  activationCodes: any[];
  auditLogs: any[];
  pricing: any;
  customerService: any;
  summary?: any;
}

type TabId = 'overview' | 'users' | 'subscriptions' | 'codes' | 'pricing' | 'support' | 'transactions' | 'audit' | 'settings';

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Ringkasan', icon: ShieldCheck },
  { id: 'users', label: 'Pengguna', icon: Users },
  { id: 'subscriptions', label: 'Langganan', icon: Key },
  { id: 'codes', label: 'Kode Aktivasi', icon: Ticket },
  { id: 'pricing', label: 'Harga & Promo', icon: Tag },
  { id: 'support', label: 'Customer Service', icon: MessageCircle },
  { id: 'transactions', label: 'Transaksi', icon: CreditCard },
  { id: 'audit', label: 'Riwayat Admin', icon: ScrollText },
  { id: 'settings', label: 'Pengaturan Aplikasi', icon: UserCog },
];

const licenseStatusLabel: Record<string, string> = {
  active: 'Aktif',
  trialing: 'Trial',
  past_due: 'Masa Tenggang',
  expired: 'Berakhir',
  revoked: 'Dicabut',
  canceled: 'Dibatalkan',
};

const accountStatusLabel: Record<string, string> = {
  active: 'Aktif',
  suspended: 'Dinonaktifkan',
  pending_deletion: 'Menunggu Dihapus',
};

const txStatusLabel: Record<string, string> = {
  pending: 'Menunggu',
  success: 'Berhasil',
  settlement: 'Berhasil',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
};

const auditActionLabel: Record<string, string> = {
  update_user: 'Ubah akun',
  reset_password: 'Kirim reset kata sandi',
  suspend_user: 'Nonaktifkan akun',
  reactivate_user: 'Aktifkan akun',
  soft_delete_user: 'Jadwalkan hapus akun',
  restore_user: 'Pulihkan akun',
  delete_user: 'Hapus permanen akun',
  cleanup_deleted_users: 'Bersihkan akun terjadwal',
  update_pricing: 'Ubah harga & promo',
  update_customer_service: 'Ubah customer service',
  create_activation_codes: 'Buat kode aktivasi',
  revoke_activation_code: 'Cabut kode aktivasi',
  extend_subscription: 'Perpanjang langganan',
  update_subscription: 'Ubah langganan',
};

const auditTargetLabel: Record<string, string> = {
  user: 'Akun',
  system: 'Sistem',
  settings: 'Pengaturan',
  subscription: 'Langganan',
  activation_code: 'Kode aktivasi',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

function toLocalInput(value?: string | null): string {
  if (!value) return '';
  // Nilai dari input datetime-local sudah berupa waktu lokal. Jangan
  // menggesernya lagi agar tanggal promo tidak terlihat berubah sendiri.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function localDateTimeAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isFutureDateTime(value: string | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = () => {
  const [tab, setTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<AdminStats>({
    users: [],
    brands: [],
    licenses: [],
    transactions: [],
    aiLogs: [],
    activationCodes: [],
    auditLogs: [],
    pricing: null,
    customerService: null,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({ full_name: '', email: '', system_role: 'user', status: 'active' });

  const [pricingDraft, setPricingDraft] = useState<any>(null);
  const [supportDraft, setSupportDraft] = useState({ whatsapp: '', label: '', message: '', active: false });
  const [codeForm, setCodeForm] = useState({
    planId: 'starter',
    durationDays: 30,
    assignedEmail: '',
    expiresInDays: 30,
    quantity: 1,
  });

  const emailById = useMemo(() => {
    const map = new Map<string, string>();
    stats.users.forEach((user) => map.set(user.id, user.email));
    return map;
  }, [stats.users]);

  const request = useCallback(async (path: string, options?: { method?: string; body?: unknown }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
    return apiFetchJson(path, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await request('/api/admin/overview');
      setStats(data);
      setPricingDraft(data.pricing || null);
      setSupportDraft({
        whatsapp: data.customerService?.whatsapp || '',
        label: data.customerService?.label || 'Bantuan ZaFlow',
        message: data.customerService?.message || 'Halo, saya ingin bertanya tentang ZaFlow.',
        active: Boolean(data.customerService?.active),
      });
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, 'Panel admin belum dapat dimuat.'));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success: string): Promise<boolean> => {
    setBusy(key);
    setFlash(null);
    try {
      await action();
      setFlash({ type: 'success', message: success });
      await load();
      return true;
    } catch (err: unknown) {
      setFlash({ type: 'error', message: getApiErrorMessage(err, 'Tindakan belum dapat diproses.') });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      system_role: user.system_role || 'user',
      status: user.status || 'active',
    });
  };

  const handleReactivateUser = (user: AdminUser) => {
    const license = user.license;
    const hasUsableLicense = Boolean(
      license
      && !license.is_expired
      && (license.status === 'active' || license.status === 'trialing')
    );

    if (hasUsableLicense) {
      const confirmed = window.confirm(
        `Akun ini masih memiliki paket ${license.plan_name || 'aktif'}. Mengaktifkan akun akan memulihkan akses ke paket tersebut. Jika akses tidak boleh dipulihkan, cabut paketnya terlebih dahulu di bagian Langganan. Lanjutkan?`
      );
      if (!confirmed) return;
    }

    run(
      `activate-${user.id}`,
      () => request(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' }),
      'Akun berhasil diaktifkan. Akses mengikuti paket yang masih tersisa.'
    );
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    const saved = await run(
      `user-${editingUser.id}`,
      () => request(`/api/admin/users/${editingUser.id}`, { method: 'PATCH', body: userForm }),
      'Data akun berhasil diperbarui.'
    );
    if (saved) setEditingUser(null);
  };

  const handleGenerateCodes = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(
      'create-codes',
      () => request('/api/admin/activation-codes', { method: 'POST', body: codeForm }),
      'Kode aktivasi berhasil dibuat.'
    );
  };

  const handlePermanentDelete = (user: AdminUser) => {
    const ownedBrands = stats.brands.filter((brand) => brand.created_by === user.id).length;
    if (!window.confirm(`Hapus permanen akun ${user.email || user.full_name}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    let force = false;
    if (ownedBrands > 0) {
      if (!window.confirm(`Akun ini memiliki ${ownedBrands} brand. Semua brand dan kontennya akan ikut dihapus. Lanjutkan?`)) {
        return;
      }
      force = true;
    }

    run(
      `delete-${user.id}`,
      () => request(`/api/admin/users/${user.id}`, { method: 'DELETE', body: { force } }),
      'Akun dihapus permanen.'
    );
  };

  const handleCleanup = () => {
    if (!window.confirm('Bersihkan semua akun yang sudah melewati masa simpan 7 hari? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    run(
      'cleanup-users',
      () => request('/api/admin/users/cleanup', { method: 'POST' }),
      'Pembersihan akun selesai.'
    );
  };

  const handleTogglePromo = (planId: 'starter' | 'pro' | 'ultra', active: boolean) => {
    if (!pricingDraft?.plans?.[planId]) return;
    const plan = pricingDraft.plans[planId];
    const nextPlan = active
      ? {
          ...plan,
          promoActive: true,
          promoStartsAt: plan.promoStartsAt || localDateTimeAfterDays(0),
          // Promo wajib punya batas waktu. Isi otomatis 30 hari agar promo
          // tidak tampak aktif tetapi langsung dianggap berakhir.
          promoEndsAt: isFutureDateTime(plan.promoEndsAt)
            ? plan.promoEndsAt
            : localDateTimeAfterDays(30),
        }
      : { ...plan, promoActive: false };

    setPricingDraft({
      ...pricingDraft,
      plans: { ...pricingDraft.plans, [planId]: nextPlan },
    });
  };

  const handleSavePricing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pricingDraft) return;
    const payload = {
      pricing: {
        currency: 'IDR',
        plans: {
          starter: {
            ...pricingDraft.plans.starter,
            promoStartsAt: fromLocalInput(pricingDraft.plans.starter.promoStartsAt || ''),
            promoEndsAt: fromLocalInput(pricingDraft.plans.starter.promoEndsAt || ''),
          },
          pro: {
            ...pricingDraft.plans.pro,
            promoStartsAt: fromLocalInput(pricingDraft.plans.pro.promoStartsAt || ''),
            promoEndsAt: fromLocalInput(pricingDraft.plans.pro.promoEndsAt || ''),
          },
          ultra: {
            ...pricingDraft.plans.ultra,
            promoStartsAt: fromLocalInput(pricingDraft.plans.ultra.promoStartsAt || ''),
            promoEndsAt: fromLocalInput(pricingDraft.plans.ultra.promoEndsAt || ''),
          },
        },
      },
    };
    await run('save-pricing', () => request('/api/admin/pricing', { method: 'PUT', body: payload }), 'Harga dan promo berhasil disimpan.');
  };

  const handleSaveSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(
      'save-support',
      () => request('/api/admin/customer-service', { method: 'PUT', body: supportDraft }),
      'Kontak customer service berhasil disimpan.'
    );
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFlash({ type: 'success', message: 'Kode disalin.' });
    } catch {
      setFlash({ type: 'error', message: 'Kode belum dapat disalin.' });
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-500">Memuat panel admin...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl text-center shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Panel Admin Belum Dapat Dibuka</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
        <button
          onClick={load}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const summary = stats.summary || {
    users: stats.users.length,
    activeSubscriptions: stats.licenses.filter((l) => l.status === 'active').length,
    trials: stats.licenses.filter((l) => l.status === 'trialing').length,
    pendingDeletion: stats.users.filter((u) => u.status === 'pending_deletion').length,
    transactions: stats.transactions.length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Panel Admin ZaFlow</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Kelola akun, langganan, kode aktivasi, harga, dan layanan pelanggan.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Segarkan Data
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-sm">
        <div className="flex min-w-max gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {flash && (
        <div className={`flex items-start gap-2 rounded-2xl border p-3.5 text-xs ${
          flash.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{flash.message}</span>
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Pengguna', value: summary.users, note: 'Akun terdaftar', color: 'blue' },
              { label: 'Langganan Aktif', value: summary.activeSubscriptions, note: 'Paket berbayar aktif', color: 'emerald' },
              { label: 'Trial Aktif', value: summary.trials, note: 'Sedang mencoba', color: 'indigo' },
              { label: 'Menunggu Dihapus', value: summary.pendingDeletion, note: 'Dalam 7 hari', color: 'amber' },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-1 text-[10px] text-slate-400">{card.note}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Akses Cepat</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setTab('users')} className="rounded-xl border border-slate-200 p-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Kelola Pengguna</button>
                <button onClick={() => setTab('codes')} className="rounded-xl border border-slate-200 p-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Buat Kode Aktivasi</button>
                <button onClick={() => setTab('pricing')} className="rounded-xl border border-slate-200 p-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Atur Harga Promo</button>
                <button onClick={() => setTab('support')} className="rounded-xl border border-slate-200 p-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">Kontak WhatsApp</button>
              </div>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Status Layanan</h2>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <p className="flex items-center justify-between"><span>Kontak customer service</span><span className={stats.customerService?.active ? 'font-bold text-emerald-600' : 'font-bold text-slate-400'}>{stats.customerService?.active ? 'Aktif' : 'Belum aktif'}</span></p>
                <p className="flex items-center justify-between"><span>Promo berjalan</span><span className="font-bold text-slate-800">{['starter', 'pro', 'ultra'].filter((id) => isPromoWindowActive(stats.pricing?.plans?.[id] || {})).length} paket</span></p>
                <p className="flex items-center justify-between"><span>Pemilik akses lama</span><span className="font-bold text-slate-800">{stats.licenses.filter((l) => l.is_legacy_lifetime).length} akun</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daftar Pengguna</h2>
              <p className="text-[11px] text-slate-400">Edit akun, atur akses, nonaktifkan, atau jadwalkan penghapusan.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">{stats.users.length} akun</span>
              <button
                type="button"
                onClick={handleCleanup}
                disabled={busy === 'cleanup-users'}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === 'cleanup-users' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Bersihkan Terjadwal
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-black/[0.06] bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Akses</th>
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{user.full_name || 'Tanpa Nama'}</p>
                      <p className="text-[10px] text-slate-400">{user.email || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.system_role === 'super_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {user.system_role === 'super_admin' ? 'Admin' : 'Pengguna'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.license ? (
                        <div>
                          <p className="font-semibold text-slate-700">{user.license.plan_name}</p>
                          <p className="text-[10px] text-slate-400">{licenseStatusLabel[user.license.status] || user.license.status}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum ada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.status === 'active' || !user.status ? 'bg-emerald-100 text-emerald-700'
                          : user.status === 'suspended' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {accountStatusLabel[user.status || 'active']}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button title="Edit akun" onClick={() => handleEditUser(user)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                        <button title="Kirim tautan reset kata sandi" onClick={() => run(`reset-${user.id}`, () => request(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' }), 'Tautan reset kata sandi telah dikirim.')} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"><Mail className="h-3.5 w-3.5" /></button>
                        {user.status === 'pending_deletion' ? (
                          <>
                            <button title="Pulihkan akun" onClick={() => run(`restore-${user.id}`, () => request(`/api/admin/users/${user.id}/restore`, { method: 'POST' }), 'Akun berhasil dipulihkan.')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"><RotateCcw className="h-3.5 w-3.5" /></button>
                            <button title="Hapus permanen" onClick={() => handlePermanentDelete(user)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        ) : user.status === 'suspended' ? (
                          <button title="Aktifkan akun (akses mengikuti paket tersisa)" onClick={() => handleReactivateUser(user)} className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"><RotateCcw className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button title="Nonaktifkan akun" onClick={() => run(`suspend-${user.id}`, () => request(`/api/admin/users/${user.id}/suspend`, { method: 'POST' }), 'Akun berhasil dinonaktifkan.')} className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600 hover:bg-amber-100"><Ban className="h-3.5 w-3.5" /></button>
                        )}
                        {user.status !== 'pending_deletion' && (
                          <button title="Jadwalkan hapus 7 hari" onClick={() => { if (window.confirm(`Jadwalkan penghapusan akun ${user.email || user.full_name}? Akun akan dihapus permanen setelah 7 hari.`)) run(`soft-${user.id}`, () => request(`/api/admin/users/${user.id}/soft-delete`, { method: 'POST' }), 'Akun dijadwalkan terhapus dalam 7 hari.'); }} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Langganan Pengguna</h2>
              <p className="text-[11px] text-slate-400">Perpanjang, ubah paket, atau hentikan akses.</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{stats.licenses.length} data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-black/[0.06] bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Aktif Sampai</th>
                  <th className="px-4 py-2.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.users.filter((user) => user.license).map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{user.full_name || 'Tanpa Nama'}</p>
                      <p className="text-[10px] text-slate-400">{user.email || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {user.license.is_legacy_lifetime ? (
                        <span className="font-semibold text-slate-700">{user.license.plan_name}</span>
                      ) : (
                        <select
                          value={user.license.plan_id === 'trial' ? 'trial' : user.license.plan_id}
                          onChange={(event) => run(`plan-${user.id}`, () => request(`/api/admin/subscriptions/${user.id}`, { method: 'PATCH', body: { planId: event.target.value } }), 'Paket berhasil diubah.')}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                        >
                          <option value="trial" disabled>Trial</option>
                          {PURCHASABLE_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.license.status === 'active' ? 'bg-emerald-100 text-emerald-700' : user.license.status === 'trialing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {licenseStatusLabel[user.license.status] || user.license.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {user.license.is_legacy_lifetime ? 'Seumur hidup' : formatDate(user.license.current_period_end)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {!user.license.is_legacy_lifetime && (
                          <button onClick={() => run(`extend-${user.id}`, () => request(`/api/admin/subscriptions/${user.id}/extend`, { method: 'POST', body: { days: 30 } }), 'Langganan diperpanjang 30 hari.')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><CalendarPlus className="h-3 w-3" />+30 hari</button>
                        )}
                        <button onClick={() => { if (window.confirm('Hentikan akses langganan akun ini?')) run(`revoke-${user.id}`, () => request(`/api/admin/subscriptions/${user.id}`, { method: 'PATCH', body: { status: 'revoked' } }), 'Langganan dihentikan.'); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"><Ban className="h-3 w-3" />Hentikan</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {stats.users.filter((user) => user.license).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada langganan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'codes' && (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <form onSubmit={handleGenerateCodes} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Buat Kode Aktivasi</h2>
            </div>
            <label className="block text-[11px] font-semibold text-slate-600">Paket
              <select value={codeForm.planId} onChange={(event) => setCodeForm({ ...codeForm, planId: event.target.value, durationDays: event.target.value === 'trial' ? 3 : 30 })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <option value="trial">Trial 3 hari</option>
                {PURCHASABLE_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-semibold text-slate-600">Masa aktif (hari)
                <input type="number" min={1} max={3650} disabled={codeForm.planId === 'trial'} value={codeForm.durationDays} onChange={(event) => setCodeForm({ ...codeForm, durationDays: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs disabled:text-slate-400" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Jumlah kode
                <input type="number" min={1} max={50} value={codeForm.quantity} onChange={(event) => setCodeForm({ ...codeForm, quantity: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
              </label>
            </div>
            <label className="block text-[11px] font-semibold text-slate-600">Kunci email (opsional)
              <input type="email" value={codeForm.assignedEmail} onChange={(event) => setCodeForm({ ...codeForm, assignedEmail: event.target.value })} placeholder="nama@email.com" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Kedaluwarsa kode (hari)
              <input type="number" min={0} max={3650} value={codeForm.expiresInDays} onChange={(event) => setCodeForm({ ...codeForm, expiresInDays: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">Isi 0 jika kode tidak perlu kedaluwarsa.</span>
            </label>
            <button type="submit" disabled={busy === 'create-codes'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {busy === 'create-codes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Buat Kode
            </button>
            <p className="text-[10px] leading-relaxed text-slate-400">Kode sekali pakai. Bisa dibatasi untuk email tertentu dan dicabut kapan saja.</p>
          </form>

          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
            <div className="border-b border-black/[0.06] px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">Daftar Kode</h2>
              <p className="text-[11px] text-slate-400">Pantau pemakaian dan cabut kode yang masih aktif.</p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-black/[0.06] bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Kode</th>
                    <th className="px-4 py-2.5">Paket</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Kedaluwarsa</th>
                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.activationCodes.map((code) => {
                    const isExpired = code.status === 'active' && code.expires_at && new Date(code.expires_at).getTime() < Date.now();
                    const effectiveStatus = isExpired ? 'expired' : code.status;
                    return (
                      <tr key={code.id}>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => copyText(code.code)}
                            disabled={effectiveStatus !== 'active'}
                            title={effectiveStatus === 'active' ? 'Salin kode' : 'Kode sudah tidak berlaku'}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-800 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400"
                          >
                            {code.code}
                            <Copy className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{code.plan_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${effectiveStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : effectiveStatus === 'revoked' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {effectiveStatus === 'active' ? 'Aktif' : effectiveStatus === 'used' ? 'Terpakai' : effectiveStatus === 'revoked' ? 'Dicabut' : 'Kedaluwarsa'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{code.assigned_email || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDate(code.expires_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {effectiveStatus === 'active' && (
                            <button onClick={() => run(`revoke-code-${code.id}`, () => request(`/api/admin/activation-codes/${code.id}/revoke`, { method: 'PATCH' }), 'Kode berhasil dicabut.')} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100">Cabut</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {stats.activationCodes.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada kode aktivasi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'pricing' && pricingDraft && (
        <form onSubmit={handleSavePricing} className="space-y-5">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Harga & Promo</h2>
                <p className="mt-1 text-[11px] text-slate-500">Promo hanya berlaku untuk pembelian paket baru, bukan perpanjangan.</p>
              </div>
              <button type="submit" disabled={busy === 'save-pricing'} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy === 'save-pricing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Harga
              </button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(['starter', 'pro', 'ultra'] as const).map((planId) => {
              const plan = pricingDraft.plans[planId];
              return (
                <div key={planId} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{planId.charAt(0).toUpperCase() + planId.slice(1)}</h3>
                    <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <input type="checkbox" checked={Boolean(plan.promoActive)} onChange={(event) => handleTogglePromo(planId, event.target.checked)} />
                      Promo aktif
                    </label>
                  </div>
                  <label className="block text-[11px] font-semibold text-slate-600">Harga normal
                    <input type="number" min={0} value={plan.normalPrice} onChange={(event) => setPricingDraft({ ...pricingDraft, plans: { ...pricingDraft.plans, [planId]: { ...plan, normalPrice: Number(event.target.value) } } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600">Harga promo
                    <input type="number" min={0} value={plan.promoPrice} onChange={(event) => setPricingDraft({ ...pricingDraft, plans: { ...pricingDraft.plans, [planId]: { ...plan, promoPrice: Number(event.target.value) } } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600">Label promo
                    <input value={plan.promoLabel || ''} onChange={(event) => setPricingDraft({ ...pricingDraft, plans: { ...pricingDraft.plans, [planId]: { ...plan, promoLabel: event.target.value } } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600">Mulai promo
                    <input type="datetime-local" value={toLocalInput(plan.promoStartsAt)} onChange={(event) => setPricingDraft({ ...pricingDraft, plans: { ...pricingDraft.plans, [planId]: { ...plan, promoStartsAt: event.target.value } } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-600">Akhir promo
                    <input type="datetime-local" value={toLocalInput(plan.promoEndsAt)} onChange={(event) => setPricingDraft({ ...pricingDraft, plans: { ...pricingDraft.plans, [planId]: { ...plan, promoEndsAt: event.target.value } } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
                  </label>
                  <p className="rounded-xl bg-slate-50 p-2 text-[10px] text-slate-500">
                    Harga berlaku: <strong>{formatIDR(isPromoWindowActive(plan) ? plan.promoPrice : plan.normalPrice)}</strong> / bulan
                  </p>
                  {plan.promoActive && !isPromoWindowActive(plan) && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-medium text-amber-700">
                      Promo aktif, tetapi jadwalnya belum berjalan atau sudah berakhir. Periksa tanggal mulai dan akhir promo.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </form>
      )}

      {tab === 'support' && (
        <form onSubmit={handleSaveSupport} className="max-w-2xl rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Kontak Customer Service</h2>
              <p className="text-[11px] text-slate-500">Satu nomor WhatsApp untuk bantuan pengguna.</p>
            </div>
          </div>
          <label className="block text-[11px] font-semibold text-slate-600">Nomor WhatsApp
            <input value={supportDraft.whatsapp} onChange={(event) => setSupportDraft({ ...supportDraft, whatsapp: event.target.value })} placeholder="0812xxxxxxx atau 62812xxxxxxx" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600">Nama layanan
            <input value={supportDraft.label} onChange={(event) => setSupportDraft({ ...supportDraft, label: event.target.value })} placeholder="Bantuan ZaFlow" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          </label>
          <label className="block text-[11px] font-semibold text-slate-600">Pesan pembuka
            <textarea rows={3} value={supportDraft.message} onChange={(event) => setSupportDraft({ ...supportDraft, message: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={supportDraft.active} onChange={(event) => setSupportDraft({ ...supportDraft, active: event.target.checked })} />
            Tampilkan tombol WhatsApp di aplikasi
          </label>
          <div>
            <button type="submit" disabled={busy === 'save-support'} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy === 'save-support' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Kontak
            </button>
          </div>
        </form>
      )}

      {tab === 'transactions' && (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Transaksi</h2>
            <p className="text-[11px] text-slate-400">Pembayaran paket baru dan perpanjangan.</p>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-black/[0.06] bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Transaksi</th>
                  <th className="px-4 py-2.5">Pengguna</th>
                  <th className="px-4 py-2.5">Paket</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-slate-600">{tx.transaction_id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{emailById.get(tx.user_id) || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{tx.plan_id || '-'}{tx.is_renewal ? ' • perpanjangan' : ''}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{formatIDR(Number(tx.amount) || 0)}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tx.status === 'success' || tx.status === 'settlement' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{txStatusLabel[tx.status] || tx.status}</span></td>
                    <td className="px-4 py-2.5 text-slate-400">{formatDateTime(tx.created_at)}</td>
                  </tr>
                ))}
                {stats.transactions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada transaksi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Admin</h2>
            <p className="text-[11px] text-slate-400">Catatan tindakan admin pada akun, langganan, dan pengaturan.</p>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-black/[0.06] bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Waktu</th>
                  <th className="px-4 py-2.5">Admin</th>
                  <th className="px-4 py-2.5">Tindakan</th>
                  <th className="px-4 py-2.5">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 text-slate-400">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{emailById.get(log.admin_id) || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{auditActionLabel[log.action] || log.action}</td>
                    <td className="px-4 py-2.5 text-slate-500">{auditTargetLabel[log.target_type] || log.target_type}{log.target_id ? ` • ${String(log.target_id).slice(0, 16)}` : ''}</td>
                  </tr>
                ))}
                {stats.auditLogs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Belum ada catatan audit.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && <AdminBrandingPanel />}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveUser} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Edit Akun</h2>
                <p className="text-[11px] text-slate-400">Perbarui data dan status akses pengguna.</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-slate-600">Nama lengkap
              <input value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Email
              <input type="email" readOnly value={userForm.email} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-semibold text-slate-600">Peran
                <select value={userForm.system_role} onChange={(event) => setUserForm({ ...userForm, system_role: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <option value="user">Pengguna</option>
                  <option value="super_admin">Admin</option>
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Status
                <select value={userForm.status} onChange={(event) => setUserForm({ ...userForm, status: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <option value="active">Aktif</option>
                  <option value="suspended">Dinonaktifkan</option>
                  <option value="pending_deletion">Menunggu Dihapus</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
              <button type="submit" disabled={busy === `user-${editingUser.id}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy === `user-${editingUser.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
