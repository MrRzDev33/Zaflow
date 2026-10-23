import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Building2,
  RefreshCw,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  Share2,
  Zap,
  ArrowRight,
  Kanban,
  CalendarDays,
} from 'lucide-react';
import { Brand, ContentPost } from '../../types/database.ts';
import { contentService, DashboardStats } from '../../services/database/contentService.ts';
import { StatusBadge, FormatBadge } from '../common/Badges.tsx';

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
  const [stats, setStats] = useState<DashboardStats>({
    totalContent: 0,
    scheduledCount: 0,
    reviewCount: 0,
    publishedCount: 0,
    pillarDistribution: [],
    recentPosts: [],
  });
  const [allPosts, setAllPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!brand) return;
    try {
      setLoading(true);
      const [dashStats, posts] = await Promise.all([
        contentService.getDashboardStats(brand.id),
        contentService.getPosts(brand.id),
      ]);
      setStats(dashStats);
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

  // Perhitungan riil distribusi saluran media sosial dari postingan nyata
  const channelBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    allPosts.forEach((post) => {
      if (Array.isArray(post.channels)) {
        post.channels.forEach((ch) => {
          counts[ch] = (counts[ch] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count);
  }, [allPosts]);

  // Perhitungan riil status alur kerja
  const statusBreakdown = useMemo(() => {
    const draftCount = allPosts.filter((p) => p.status === 'draft').length;
    const ideaCount = allPosts.filter((p) => p.status === 'idea').length;
    const approvedCount = allPosts.filter((p) => p.status === 'approved').length;
    return {
      idea: ideaCount,
      draft: draftCount,
      in_review: stats.reviewCount,
      approved: approvedCount,
      scheduled: stats.scheduledCount,
      published: stats.publishedCount,
    };
  }, [allPosts, stats]);

  if (!brand) {
    return (
      <div className="astra-card p-10 text-center max-w-lg mx-auto my-12 shadow-[0_20px_50px_rgba(79,70,229,0.08)]">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#93C5FD] to-[#818CF8] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Building2 className="w-7 h-7" strokeWidth={1.8} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Belum Ada Workspace Brand</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          ZaFlow menggunakan arsitektur multi-brand terisolasi. Buat workspace pertama Anda untuk mulai merencanakan kalender konten dan mengelola aset tim.
        </p>
        <button
          onClick={onOpenNewBrand}
          className="mt-6 px-5 py-2.5 astra-button-primary rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchStats}
            disabled={loading}
            title="Segarkan Data Riil"
            className="p-2 text-slate-600 astra-icon-btn rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
          <button
            onClick={onOpenNewPost}
            className="px-4 py-2 astra-button-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
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
              <Layers className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {stats.totalContent}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Postingan terdata</p>
          </div>
        </div>

        {/* Konten Terjadwal */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Terjadwal</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-[#4F46E5]">
              <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {stats.scheduledCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Siap ditayangkan</p>
          </div>
        </div>

        {/* Perlu Review */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Perlu Review</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              {stats.reviewCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Menunggu persetujuan</p>
          </div>
        </div>

        {/* Kuota AI Riil */}
        <div className="astra-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700">Kredit AI</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Zap className="w-3.5 h-3.5" strokeWidth={2} />
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
                  Data konten nyata yang tersimpan di workspace ini
                </p>
              </div>
              <button
                onClick={() => onSelectTab && onSelectTab('content_db')}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Lihat Koleksi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats.recentPosts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200/80 rounded-2xl bg-white/30">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-slate-700">Belum ada konten dalam koleksi</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mulai dengan membuat draf atau rencana konten pertama Anda
                </p>
                <button
                  onClick={onOpenNewPost}
                  className="mt-3.5 px-3.5 py-1.5 astra-button-primary rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Tambah Konten Pertama</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/60">
                {stats.recentPosts.map((post) => (
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
                          <Calendar className="w-3 h-3 text-slate-400" strokeWidth={1.75} />
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
                  Dihitung otomatis dari kategori postingan Anda
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                {stats.totalContent} Post Terdata
              </span>
            </div>

            {stats.pillarDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Distribusi pilar akan tampil otomatis setelah Anda menambahkan konten dengan pilar tertentu.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.pillarDistribution.map((item) => {
                  const percent =
                    stats.totalContent > 0
                      ? Math.round((item.count / stats.totalContent) * 100)
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
                <Share2 className="w-4 h-4 text-[#2563EB]" strokeWidth={2} />
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Saluran Media Sosial
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {channelBreakdown.length} Aktif
              </span>
            </div>

            {channelBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Belum ada saluran yang digunakan.
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
                <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2} />
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Status Alur Kerja
                </h3>
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
                <CalendarDays className="w-4 h-4 text-[#2563EB]" strokeWidth={1.8} />
                <span>Buka Kalender Editorial</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onSelectTab && onSelectTab('kanban')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/50 hover:bg-white/80 border border-white/70 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Kanban className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.8} />
                <span>Buka Kanban Workflow</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
