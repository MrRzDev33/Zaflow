import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  IconArrowRight,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconClock,
  IconKanban,
  IconLayers,
  IconPlus,
  IconRefresh,
  IconShare,
  IconSpark,
} from '../common/icons/ZaflowIcons.tsx';
import { Brand, ContentPost } from '../../types/database.ts';
import { contentService } from '../../services/database/contentService.ts';
import { StatusBadge, FormatBadge } from '../common/Badges.tsx';
import {
  currentMonthKey,
  formatMonthKey,
  resolvePostTimestamp,
  toMonthKey,
} from '../../utils/postDate.ts';

interface DashboardOverviewProps {
  brand: Brand | null;
  aiCreditsRemaining: number;
  aiCreditsTotal?: number;
  onOpenNewPost: () => void;
  onOpenNewBrand: () => void;
  onSelectTab?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  brand,
  aiCreditsRemaining,
  aiCreditsTotal = 50,
  onOpenNewPost,
  onOpenNewBrand,
  onSelectTab,
}) => {
  const [allPosts, setAllPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(currentMonthKey);

  const fetchStats = useCallback(async () => {
    if (!brand) return;
    try {
      setLoading(true);
      const posts = await contentService.getPosts(brand.id);
      setAllPosts(posts);
    } catch (err) {
      console.warn('Gagal memuat statistik dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Seluruh kartu dan panel dashboard mengikuti bulan yang dipilih.
  const monthPosts = useMemo(
    () =>
      allPosts.filter((post) => {
        const timestamp = resolvePostTimestamp(post);
        if (!timestamp) return false;
        return toMonthKey(new Date(timestamp)) === month;
      }),
    [allPosts, month]
  );

  // Perhitungan riil distribusi saluran media sosial pada bulan terpilih
  const channelBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    monthPosts.forEach((post) => {
      if (Array.isArray(post.channels)) {
        post.channels.forEach((ch) => {
          counts[ch] = (counts[ch] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);
  }, [monthPosts]);

  // Perhitungan riil status alur kerja pada bulan terpilih
  const statusBreakdown = useMemo(() => {
    return {
      idea: monthPosts.filter((p) => p.status === 'idea').length,
      draft: monthPosts.filter((p) => p.status === 'draft').length,
      in_review: monthPosts.filter((p) => p.status === 'in_review').length,
      approved: monthPosts.filter((p) => p.status === 'approved').length,
      scheduled: monthPosts.filter((p) => p.status === 'scheduled').length,
      published: monthPosts.filter((p) => p.status === 'published').length,
    };
  }, [monthPosts]);

  const pillarDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of monthPosts) {
      const pillar = post.pillar || 'Lainnya';
      counts.set(pillar, (counts.get(pillar) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([pillar, count]) => ({ pillar, count }))
      .sort((a, b) => b.count - a.count);
  }, [monthPosts]);

  const recentPosts = useMemo(
    () =>
      [...monthPosts]
        .sort((a, b) => resolvePostTimestamp(b) - resolvePostTimestamp(a))
        .slice(0, 6),
    [monthPosts]
  );

  if (!brand) {
    return (
      <div className="astra-card p-10 text-center max-w-lg mx-auto my-12 shadow-[0_20px_50px_rgba(79,70,229,0.08)]">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#93C5FD] to-[#818CF8] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <IconBuilding className="w-7 h-7" strokeWidth={1.8} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Belum Ada Workspace Brand</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          ZaFlow menggunakan arsitektur multi-brand terisolasi. Buat workspace pertama Anda untuk mulai merencanakan kalender konten dan mengelola aset tim.
        </p>
        <button
          onClick={onOpenNewBrand}
          className="mt-6 px-5 py-2.5 astra-button-primary rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <IconPlus className="w-4 h-4" strokeWidth={2} />
          <span>Buat Workspace Brand Baru</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Brand Header Bar: Menampilkan informasi riil dari brand yang aktif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 astra-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm ring-2 ring-white shrink-0"
            style={{ backgroundColor: brand.color_hex || '#2563EB' }}
          >
            {brand.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">
                {brand.name}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/70 text-slate-600 border border-white/80 shadow-2xs">
                {brand.industry || 'Workspace'}
              </span>
            </div>
            {brand.description ? (
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{brand.description}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Workspace aktif ZaFlow</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <label className="flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-2xs">
            <IconCalendar className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={1.9} />
            <span className="hidden sm:inline">Periode</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || currentMonthKey())}
              className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none"
              aria-label="Pilih bulan dashboard"
            />
          </label>
          <button
            onClick={fetchStats}
            disabled={loading}
            title="Segarkan Data Riil"
            className="p-2 text-slate-600 astra-icon-btn rounded-xl cursor-pointer"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.9} />
          </button>
          <button
            onClick={onOpenNewPost}
            className="px-4 py-2 astra-button-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <IconPlus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Buat Konten</span>
          </button>
        </div>
      </div>

      {/* Kartu Metrik Riil */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Konten */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Total Konten</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-[#2563EB]">
              <IconLayers className="w-3.5 h-3.5" strokeWidth={1.9} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {monthPosts.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Postingan {formatMonthKey(month)}
            </p>
          </div>
        </div>

        {/* Konten Terjadwal */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Terjadwal</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-[#4F46E5]">
              <IconCalendar className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {statusBreakdown.scheduled}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Siap ditayangkan bulan ini</p>
          </div>
        </div>

        {/* Perlu Review */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Perlu Review</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <IconClock className="w-3.5 h-3.5" strokeWidth={1.9} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {statusBreakdown.in_review}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Menunggu persetujuan bulan ini</p>
          </div>
        </div>

        {/* Kuota AI Riil */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Kredit AI</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <IconSpark className="w-3.5 h-3.5" strokeWidth={1.9} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {aiCreditsRemaining}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Dari {aiCreditsTotal} kuota total</p>
          </div>
        </div>
      </div>

      {/* Grid Konten Operasional Riil */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Kolom Kiri (8 cols): Antrean Konten Riil & Distribusi Pilar Riil */}
        <div className="lg:col-span-8 space-y-4">
          {/* Antrean Konten Terbaru dari Inputan Pengguna */}
          <div className="astra-card p-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-white/60 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Daftar Konten & Jadwal Publikasi
                </h3>
                <p className="text-[11px] text-slate-400">
                  Konten pada {formatMonthKey(month)}
                </p>
              </div>
              <button
                onClick={() => onSelectTab && onSelectTab('content_db')}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Lihat Koleksi</span>
                <IconArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentPosts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200/80 rounded-2xl bg-white/30">
                <IconCalendar className="w-8 h-8 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-slate-700">
                  Belum ada konten pada {formatMonthKey(month)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih bulan lain atau buat rencana konten pertama Anda
                </p>
                <button
                  onClick={onOpenNewPost}
                  className="mt-3.5 px-3.5 py-1.5 astra-button-primary rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <IconPlus className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Tambah Konten Pertama</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/60">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/40 -mx-2 px-2.5 rounded-xl transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1 truncate">
                          {post.title}
                        </span>
                        <StatusBadge status={post.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <FormatBadge format={post.format} />
                        <span className="text-slate-300">·</span>
                        <span>Pilar: <strong className="text-slate-700 font-medium">{post.pillar}</strong></span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                          <IconCalendar className="w-3 h-3 text-slate-400" strokeWidth={1.75} />
                          {post.scheduled_at
                            ? new Date(post.scheduled_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Belum terjadwal'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-start sm:self-center shrink-0">
                      {Array.isArray(post.channels) &&
                        post.channels.map((ch) => (
                          <span
                            key={ch}
                            className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-lg border border-white/80 bg-white/70 text-slate-600 shadow-2xs"
                          >
                            {ch}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distribusi Pilar Konten Riil */}
          <div className="astra-card p-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-white/60 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Proporsi Pilar Konten (Riil)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Proporsi pilar konten pada {formatMonthKey(month)}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                {monthPosts.length} Post Terdata
              </span>
            </div>

            {pillarDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Belum ada konten dengan pilar tertentu pada {formatMonthKey(month)}.
              </p>
            ) : (
              <div className="space-y-3">
                {pillarDistribution.map((item) => {
                  const percent =
                    monthPosts.length > 0
                      ? Math.round((item.count / monthPosts.length) * 100)
                      : 0;

                  return (
                    <div key={item.pillar} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.pillar}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {item.count} konten ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] rounded-full transition-all duration-300 shadow-xs"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan (4 cols): Distribusi Saluran & Ringkasan Status */}
        <div className="lg:col-span-4 space-y-4">
          {/* Distribusi Saluran Media Sosial Riil */}
          <div className="astra-card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/60 mb-3">
              <div className="flex items-center gap-2">
                <IconShare className="w-4 h-4 text-[#2563EB]" strokeWidth={1.9} />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Saluran Media Sosial
                  </h3>
                  <p className="text-[10px] text-slate-400">{formatMonthKey(month)}</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {channelBreakdown.length} Aktif
              </span>
            </div>

            {channelBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada saluran yang digunakan pada {formatMonthKey(month)}.
              </p>
            ) : (
              <div className="space-y-2">
                {channelBreakdown.map(({ channel, count }) => (
                  <div
                    key={channel}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/50 border border-white/70 text-xs"
                  >
                    <span className="font-bold text-slate-700 capitalize">{channel}</span>
                    <span className="font-mono font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                      {count} post
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rangkuman Status Alur Kerja Riil */}
          <div className="astra-card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/60 mb-3">
              <div className="flex items-center gap-2">
                <IconCheck className="w-4 h-4 text-emerald-600" strokeWidth={1.9} />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                    Status Alur Kerja
                  </h3>
                  <p className="text-[10px] text-slate-400">{formatMonthKey(month)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/70">
                <p className="text-[10px] text-slate-400">Draf</p>
                <p className="text-base font-bold text-slate-800 font-mono">{statusBreakdown.draft}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/70">
                <p className="text-[10px] text-slate-400">Review</p>
                <p className="text-base font-bold text-slate-800 font-mono">{statusBreakdown.in_review}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/70">
                <p className="text-[10px] text-slate-400">Terjadwal</p>
                <p className="text-base font-bold text-slate-800 font-mono">{statusBreakdown.scheduled}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/70">
                <p className="text-[10px] text-slate-400">Tayang</p>
                <p className="text-base font-bold text-slate-800 font-mono">{statusBreakdown.published}</p>
              </div>
            </div>
          </div>

          {/* Navigasi Cepat Antar Modul */}
          <div className="astra-card p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
              Navigasi Cepat
            </p>
            <button
              onClick={() => onSelectTab && onSelectTab('calendar')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/50 hover:bg-white/80 border border-white/70 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <IconCalendar className="w-4 h-4 text-[#2563EB]" strokeWidth={1.8} />
                <span>Buka Kalender Editorial</span>
              </div>
              <IconArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onSelectTab && onSelectTab('kanban')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/50 hover:bg-white/80 border border-white/70 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <IconKanban className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.8} />
                <span>Buka Kanban Workflow</span>
              </div>
              <IconArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
