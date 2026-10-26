import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  Flame,
  Kanban,
  Key,
  Layers,
  LayoutGrid,
  Library,
  Lock,
  MessageCircle,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  PURCHASABLE_PLANS,
  PLAN_DURATION_DAYS,
  PLAN_DURATION_MONTHS,
  formatIDR,
  type Plan,
} from '../../config/plans.ts';
import { useAppBranding } from '../../hooks/useAppBranding.ts';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';

/**
 * Tautan produk Lynk.id bawaan. Nilai env VITE_LYNK_* tetap diprioritaskan
 * agar link bisa diganti tanpa mengubah kode.
 */
const DEFAULT_LYNK_LINKS: Record<'starter' | 'pro' | 'ultra', string> = {
  starter: 'https://lynk.id/zaaflow/qm6999vv7en5',
  pro: 'https://lynk.id/zaaflow/j2gvv38gwzv5',
  ultra: 'https://lynk.id/zaaflow/8d5qqrd203q9',
};

const LYNX_LINKS: Record<'starter' | 'pro' | 'ultra', string> = {
  starter:
    ((import.meta.env.VITE_LYNK_STARTER_URL as string | undefined) || '').trim() ||
    DEFAULT_LYNK_LINKS.starter,
  pro:
    ((import.meta.env.VITE_LYNK_PRO_URL as string | undefined) || '').trim() ||
    DEFAULT_LYNK_LINKS.pro,
  ultra:
    ((import.meta.env.VITE_LYNK_ULTRA_URL as string | undefined) || '').trim() ||
    DEFAULT_LYNK_LINKS.ultra,
};

/**
 * Kuota batch 1. Angka sisa bisa diperbarui tanpa mengubah kode lewat env
 * VITE_PROMO_SLOTS_LEFT (build-time, perlu redeploy), atau ubah nilai
 * BATCH_REMAINING_DEFAULT di bawah.
 */
const BATCH_TOTAL = 10;
const BATCH_REMAINING_DEFAULT = 10;
const BATCH_REMAINING = (() => {
  const rawValue = import.meta.env.VITE_PROMO_SLOTS_LEFT;
  if (rawValue === undefined || String(rawValue).trim() === '') return BATCH_REMAINING_DEFAULT;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return BATCH_REMAINING_DEFAULT;
  return Math.min(BATCH_TOTAL, Math.max(0, Math.floor(parsed)));
})();
const BATCH_SOLD = BATCH_TOTAL - BATCH_REMAINING;
const BATCH_FULL_PERCENT = Math.round((BATCH_SOLD / BATCH_TOTAL) * 100);
const BATCH_IS_FULL = BATCH_REMAINING === 0;

function withWhatsAppText(url: string | null, message: string): string | null {
  if (!url) return null;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}text=${encodeURIComponent(message)}`;
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Multi-brand workspace',
    description: 'Data, aset, dan anggota tiap brand terpisah. Tidak ada konten brand A nyasar ke brand B.',
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    icon: CalendarDays,
    title: 'Kalender editorial',
    description: 'Jadwal produksi dan tanggal tayang terlihat oleh seluruh tim dalam satu kalender.',
    accent: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Kanban,
    title: 'Alur kerja Kanban',
    description: 'Geser kartu dari ide, draf, review, sampai tayang. Statusnya jelas, bukan tebak-tebakan.',
    accent: 'bg-violet-50 text-violet-600',
  },
  {
    icon: Library,
    title: 'Koleksi konten',
    description: 'Hook, caption, hashtag, dan referensi tersimpan rapi dan bisa dicari kapan saja.',
    accent: 'bg-sky-50 text-sky-600',
  },
  {
    icon: BarChart3,
    title: 'Analitik & laporan',
    description: 'Lihat performa konten per periode, bandingkan pilar, lalu ekspor ke Excel atau PDF.',
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: ScanEye,
    title: 'AI Metrics Extractor',
    description: 'Unggah screenshot insight, biarkan AI membaca angka metriknya. Tidak perlu input manual.',
    accent: 'bg-purple-50 text-purple-600',
  },
  {
    icon: BrainCircuit,
    title: 'Asisten strategi AI',
    description: 'Rekomendasi pilar, hook, dan format berdasarkan data historis brand kamu sendiri.',
    accent: 'bg-fuchsia-50 text-fuchsia-600',
  },
  {
    icon: Users,
    title: 'Tim & riwayat aktivitas',
    description: 'Atur peran pemilik, admin, editor, dan anggota. Setiap perubahan tercatat.',
    accent: 'bg-amber-50 text-amber-600',
  },
];

const STEPS = [
  {
    icon: LayoutGrid,
    title: 'Pilih paket 6 bulan',
    description: 'Tentukan paket sesuai jumlah brand dan anggota tim kamu.',
  },
  {
    icon: Wallet,
    title: 'Bayar lewat Lynk.id',
    description: 'QRIS, e-wallet, atau virtual account. Pembayaran diproses aman oleh Lynk.id.',
  },
  {
    icon: Ticket,
    title: 'Terima kode aktivasi',
    description: 'Admin mengirim kode ke email pembelian setelah pembayaran terkonfirmasi.',
  },
  {
    icon: Key,
    title: 'Masukkan kode, langsung jalan',
    description: `Daftar dengan email yang sama, masukkan kode, Workspace aktif ${PLAN_DURATION_DAYS} hari.`,
  },
];

const FAQ_ITEMS = [
  {
    question: 'Apakah harga di atas per bulan?',
    answer: `Bukan. Harga tersebut adalah harga total untuk ${PLAN_DURATION_MONTHS} bulan (${PLAN_DURATION_DAYS} hari). Tidak ada tagihan bulanan dan tidak ada perpanjangan otomatis.`,
  },
  {
    question: 'Kenapa batch 1 hanya 10 slot?',
    answer: `Batch 1 dibatasi ${BATCH_TOTAL} pembeli supaya setiap pembeli dibantu sampai akunnya aktif. Jika slot habis, kamu bisa masuk daftar tunggu batch berikutnya lewat customer service.`,
  },
  {
    question: 'Bagaimana cara membayarnya?',
    answer:
      'Pembayaran dilakukan melalui Lynk.id. Kamu bisa memakai QRIS, e-wallet, atau virtual account. Setelah pembayaran masuk, admin mengirim kode aktivasi ke email pembelian.',
  },
  {
    question: 'Kapan kode aktivasi saya terima?',
    answer:
      'Setelah pembayaran terkonfirmasi, kode dikirim ke email pembelian maksimal 1×24 jam pada hari kerja. Jika belum masuk, hubungi customer service dengan menyertakan bukti pembayaran.',
  },
  {
    question: 'Kenapa email harus sama?',
    answer:
      'Kode aktivasi terikat pada satu email dan hanya bisa dipakai satu kali. Pastikan email saat membeli di Lynk.id sama dengan email yang kamu pakai untuk mendaftar di ZaFlow.',
  },
  {
    question: 'Apa yang terjadi saat masa aktif habis?',
    answer:
      'Kamu bisa memperpanjang lewat Midtrans di dalam Workspace, memakai kode aktivasi baru, atau menghubungi customer service. Kuota AI baru akan ditambahkan ke sisa kuota kamu, bukan menghapus pemakaian sebelumnya.',
  },
  {
    question: 'Bisa coba dulu sebelum membeli?',
    answer:
      'Bisa. Tersedia trial 3 hari berisi 20 kredit AI untuk 1 brand. Trial diberikan lewat kode dari customer service, bukan aktivasi otomatis.',
  },
  {
    question: 'Apakah kuota AI berlaku per bulan?',
    answer:
      'Tidak. Kuota AI adalah total selama 6 bulan. Paket Starter 300 kredit, Pro 600 kredit, dan Ultra 1.200 kredit.',
  },
];

export const LandingPage: React.FC = () => {
  const { appName } = useAppBranding();
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'ZaFlow — Kelola Konten Brand di Satu Tempat';
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';

    /*
     * index.css memakai `overflow-x: hidden` pada html & body. Itu membuat body
     * menjadi scroll container sehingga header sticky tidak menempel. `clip`
     * tetap memotong overflow horizontal tanpa membuat scroll container, dan
     * hanya diterapkan selama landing dibuka.
     */
    const rootElement = document.documentElement;
    const bodyElement = document.body;
    const previousRootOverflowX = rootElement.style.overflowX;
    const previousBodyOverflowX = bodyElement.style.overflowX;
    rootElement.style.overflowX = 'clip';
    bodyElement.style.overflowX = 'clip';

    let active = true;
    fetch('/api/public/customer-service')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.active && typeof data.whatsappUrl === 'string') {
          setWhatsappUrl(data.whatsappUrl);
        }
      })
      .catch(() => {
        // Landing tetap berfungsi tanpa tautan customer service.
      });

    return () => {
      active = false;
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      rootElement.style.overflowX = previousRootOverflowX;
      bodyElement.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  const chatUrl = useMemo(
    () => withWhatsAppText(whatsappUrl, 'Halo ZaFlow, saya ingin bertanya tentang paket dan cara aktivasi.'),
    [whatsappUrl]
  );
  const trialUrl = useMemo(
    () => withWhatsAppText(whatsappUrl, 'Halo ZaFlow, saya ingin mengajukan trial 3 hari untuk mencoba aplikasinya.'),
    [whatsappUrl]
  );
  const waitlistUrl = useMemo(
    () =>
      withWhatsAppText(
        whatsappUrl,
        'Halo ZaFlow, batch 1 sudah penuh. Saya ingin masuk daftar tunggu batch berikutnya.'
      ),
    [whatsappUrl]
  );

  const getPlanCheckoutUrl = (plan: Plan) => {
    const lynkUrl = LYNX_LINKS[plan.id as 'starter' | 'pro' | 'ultra'];
    if (lynkUrl) return lynkUrl;
    return withWhatsAppText(
      whatsappUrl,
      `Halo ZaFlow, saya ingin membeli paket ${plan.name} (${formatIDR(plan.price)} untuk ${PLAN_DURATION_MONTHS} bulan).`
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#E9F0FB] sm:bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eef2fb_45%,_#e6ecf9_100%)] flex justify-center">
      <div className="w-full max-w-[430px] bg-[#F7F9FD] sm:my-6 sm:rounded-[32px] sm:overflow-clip sm:shadow-[0_30px_80px_-25px_rgba(15,23,42,0.35)]">
        {/* Header + strip urgensi batch */}
        <div className="sticky top-0 z-30">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-[#FFFFFF] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ZaFlowLogo size="sm" showText={false} />
              <span className="text-[15px] font-extrabold tracking-tight text-slate-900">{appName}</span>
            </div>
            <a
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Masuk
            </a>
          </header>

          <div
            className={`flex items-center justify-center gap-1.5 border-b px-3 py-1.5 text-center text-[10px] font-extrabold tracking-tight ${
              BATCH_IS_FULL
                ? 'border-slate-900/20 bg-slate-800 text-white'
                : 'border-amber-500/40 bg-amber-400 text-amber-950'
            }`}
          >
            <Flame className="h-3 w-3 shrink-0" />
            {BATCH_IS_FULL ? (
              <span>Batch 1 penuh — daftar tunggu batch berikutnya dibuka</span>
            ) : (
              <span>
                Batch 1 · hanya {BATCH_TOTAL} slot
                <span className="mx-1 opacity-50">•</span>
                sisa {BATCH_REMAINING} slot
              </span>
            )}
          </div>
        </div>

        <main>
          {/* Hero */}
          <section className="relative overflow-hidden px-4 pb-8 pt-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 top-24 h-52 w-52 rounded-full bg-indigo-400/20 blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                <Sparkles className="h-3 w-3" />
                Untuk kreator, tim konten &amp; agensi
              </div>

              <h1 className="mt-3 text-[27px] font-extrabold leading-[1.15] tracking-tight text-slate-900">
                Semua konten brand kamu,
                <span className="text-blue-600"> rapi di satu tempat.</span>
              </h1>

              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                Kalender editorial, alur kerja, arsip konten, dan laporan performa jadi satu.
                Berhenti pindah-pindah spreadsheet dan chat untuk mencari versi terbaru.
              </p>

              <div className="mt-5 space-y-2.5">
                <a
                  href="#paket"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,0.85)] transition-transform active:scale-[0.99]"
                >
                  Lihat Paket &amp; Harga
                  <ArrowRight className="h-4 w-4" />
                </a>
                {trialUrl && (
                  <a
                    href={trialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-[#FFFFFF] px-5 py-3 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    Minta trial 3 hari
                  </a>
                )}
              </div>

              <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
                Sekali bayar untuk 6 bulan • Tanpa tagihan bulanan
              </p>

              {/* Mock kalender: gambaran singkat produk */}
              <div className="mt-6 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_18px_40px_-22px_rgba(37,99,235,0.5)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <p className="text-[11px] font-bold text-slate-800">Kalender Konten</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                    Oktober
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {[
                    { date: '12', title: 'Reels: 3 kesalahan caption', status: 'Terjadwal', tone: 'bg-purple-50 text-purple-700' },
                    { date: '15', title: 'Carousel tips editing', status: 'Review', tone: 'bg-rose-50 text-rose-700' },
                    { date: '18', title: 'Studi kasus klien', status: 'Tayang', tone: 'bg-emerald-50 text-emerald-700' },
                  ].map((item) => (
                    <div key={item.date} className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 px-2.5 py-2">
                      <div className="w-7 shrink-0 rounded-lg bg-white py-1 text-center shadow-sm">
                        <span className="block text-[11px] font-extrabold leading-none text-slate-800">{item.date}</span>
                      </div>
                      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700">{item.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${item.tone}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Masalah */}
          <section className="border-y border-slate-200/70 bg-white px-4 py-7">
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
              Kalau ini terasa familiar, kamu tidak sendirian.
            </h2>
            <div className="mt-4 space-y-3">
              {[
                {
                  icon: FileSpreadsheet,
                  title: 'Ide dan draf tersebar',
                  description: 'Ada di notes, Drive, dan chat. Cari versi terbaru saja butuh waktu.',
                },
                {
                  icon: CalendarDays,
                  title: 'Jadwal tayang bentrok',
                  description: 'Tidak ada satu kalender yang dilihat semua orang, jadi ada konten terlewat.',
                },
                {
                  icon: CircleAlert,
                  title: 'Laporan metrik manual',
                  description: 'Screenshot satu per satu, rekap di spreadsheet tiap minggu. Melelahkan.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Fitur */}
          <section className="px-4 py-7">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <Zap className="h-3 w-3" />
              Fitur inti
            </div>
            <h2 className="mt-3 text-lg font-extrabold leading-tight tracking-tight text-slate-900">
              Satu workspace untuk seluruh alur konten.
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              Dari ide pertama sampai laporan performa, semuanya tercatat dan bisa diakses tim.
            </p>

            <div className="mt-4 space-y-2.5">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.25)]">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feature.accent}`}>
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">{feature.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: Lock, label: 'Data per brand terpisah' },
                { icon: ShieldCheck, label: 'Peran tim jelas' },
                { icon: CheckCircle2, label: 'Riwayat tercatat' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white px-2 py-2.5 text-center">
                  <item.icon className="mx-auto h-4 w-4 text-blue-600" />
                  <p className="mt-1 text-[9.5px] font-semibold leading-tight text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Cara kerja */}
          <section className="border-y border-slate-200/70 bg-white px-4 py-7">
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
              Aktif dalam 4 langkah.
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              Tanpa proses berbelit. Setelah kode masuk, akun langsung aktif {PLAN_DURATION_DAYS} hari.
            </p>

            <ol className="mt-4 space-y-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]">
                      <step.icon className="h-4 w-4" />
                    </div>
                    {index < STEPS.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Langkah {index + 1}</p>
                    <p className="text-[13px] font-bold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Paket & harga */}
          <section id="paket" className="scroll-mt-16 px-4 py-7">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              <Ticket className="h-3 w-3" />
              Paket &amp; harga
            </div>
            <h2 className="mt-3 text-lg font-extrabold leading-tight tracking-tight text-slate-900">
              Pilih paket, langsung untuk 6 bulan.
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
              Semua paket aktif {PLAN_DURATION_DAYS} hari. Kuota AI di bawah adalah total selama {PLAN_DURATION_MONTHS} bulan, bukan per bulan.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFFFFF] text-amber-600 shadow-sm">
                  <Flame className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12.5px] font-extrabold text-amber-900">Batch 1 · {BATCH_TOTAL} slot</p>
                    <p className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                      {BATCH_IS_FULL ? 'Penuh' : `Sisa ${BATCH_REMAINING}`}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                    <div
                      className={`h-full rounded-full ${BATCH_IS_FULL ? 'bg-slate-500' : 'bg-amber-500'}`}
                      style={{ width: `${BATCH_IS_FULL ? 100 : BATCH_FULL_PERCENT}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-amber-800">
                    {BATCH_IS_FULL
                      ? 'Semua slot batch 1 sudah terisi. Hubungi customer service untuk masuk daftar tunggu batch berikutnya.'
                      : `${BATCH_SOLD} dari ${BATCH_TOTAL} slot terisi. Batch 1 dibatasi supaya setiap pembeli dibantu sampai akun aktif.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {PURCHASABLE_PLANS.map((plan) => {
                const checkoutUrl = getPlanCheckoutUrl(plan);
                const isPopular = plan.id === 'pro';
                const disabled = !checkoutUrl;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.4)] ${
                      isPopular ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-slate-200/90'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                        Paling populer
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900">{plan.name}</h3>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{plan.tagline}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-end gap-1.5">
                      <span className="text-[26px] font-extrabold leading-none tracking-tight text-slate-900">
                        {formatIDR(plan.price)}
                      </span>
                      <span className="pb-0.5 text-[11px] font-semibold text-slate-400">/ 6 bulan</span>
                    </div>

                    <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                      {[
                        `${plan.aiQuota.toLocaleString('id-ID')} kredit AI total`,
                        plan.maxBrands === 1 ? '1 brand' : `${plan.maxBrands} brand`,
                        `${plan.maxTeamMembers} anggota tim`,
                        `Aktif ${PLAN_DURATION_DAYS} hari`,
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600">
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {BATCH_IS_FULL ? (
                      waitlistUrl ? (
                        <a
                          href={waitlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-[12px] font-extrabold text-amber-900 transition-colors hover:bg-amber-200"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Batch 1 penuh — daftar tunggu
                        </a>
                      ) : (
                        <span className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-[12px] font-bold text-slate-500">
                          Batch 1 penuh
                        </span>
                      )
                    ) : disabled ? (
                      <span className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-[12px] font-bold text-slate-400">
                        Tautan pembelian belum tersedia
                      </span>
                    ) : (
                      <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12.5px] font-extrabold transition-transform active:scale-[0.99] ${
                          isPopular
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_12px_26px_-14px_rgba(37,99,235,0.9)]'
                            : 'border border-slate-200 bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                      >
                        Beli {plan.name}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                Gunakan <strong>email yang sama</strong> saat membayar dan saat mendaftar. Kode aktivasi terikat
                pada email tersebut dan hanya bisa dipakai satu kali.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="border-y border-slate-200/70 bg-white px-4 py-7">
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
              Pertanyaan yang sering ditanya.
            </h2>

            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/90">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="group bg-white open:bg-slate-50/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[12.5px] font-bold text-slate-800">
                    <span>{item.question}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-3.5 pb-3 text-[11.5px] leading-relaxed text-slate-500">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Penutup */}
          <section className="px-4 py-7">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-5 text-white shadow-[0_24px_50px_-24px_rgba(37,99,235,0.9)]">
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
                  <Flame className="h-3 w-3" />
                  {BATCH_IS_FULL ? 'Batch 1 penuh' : `Batch 1 · sisa ${BATCH_REMAINING} dari ${BATCH_TOTAL} slot`}
                </div>
                <h2 className="mt-3 text-xl font-extrabold leading-tight tracking-tight">
                  Berhenti mengelola konten dengan cara lama.
                </h2>
                <p className="mt-2 text-[12px] leading-relaxed text-blue-100">
                  Mulai hari ini, tim kamu tahu apa yang harus dikerjakan, kapan tayang, dan bagaimana hasilnya.
                </p>
                <div className="mt-4 space-y-2">
                  <a
                    href="#paket"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFFFFF] px-4 py-3 text-[12.5px] font-extrabold text-blue-700 transition-transform active:scale-[0.99]"
                  >
                    Pilih Paket Sekarang
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  {chatUrl && (
                    <a
                      href={chatUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-white/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Tanya customer service
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/70 bg-white px-4 py-5">
          <div className="flex items-center gap-2.5">
            <ZaFlowLogo size="sm" showText={false} />
            <span className="text-[15px] font-extrabold tracking-tight text-slate-900">{appName}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Platform manajemen konten dan analitik media sosial untuk kreator, tim konten, dan agensi.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500">
            <a href="/" className="hover:text-slate-800">
              Masuk ke Workspace
            </a>
            {chatUrl && (
              <a href={chatUrl} target="_blank" rel="noreferrer" className="hover:text-slate-800">
                Customer service
              </a>
            )}
          </div>
          <p className="mt-4 text-[10px] text-slate-400">
            © {new Date().getFullYear()} ZaFlow. Harga dalam Rupiah dan berlaku untuk paket 6 bulan.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
