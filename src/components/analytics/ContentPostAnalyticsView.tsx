import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  Eye,
  ExternalLink,
  Filter,
  Heart,
  Image as ImageIcon,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  BarChart2,
  AlertCircle,
} from 'lucide-react';
import { Brand, ContentMetric, ContentPost } from '../../types/database.ts';
import { isPublishedStatus } from '../../services/database/contentService.ts';
import { metricsService, metricFormulas } from '../../services/database/metricsService.ts';
import { ContentThumbnail } from '../content/ContentThumbnail.tsx';
import { EditPostModal } from '../content/EditPostModal.tsx';
import { StatusBadge } from '../common/Badges.tsx';
import { MetricInputModal } from './MetricInputModal.tsx';
import { ContentPostPerformanceModal } from './ContentPostPerformanceModal.tsx';
import { getBrandPlatforms } from '../../config/platforms.ts';
import { Pagination } from '../common/Pagination.tsx';
import { usePagination } from '../../hooks/usePagination.ts';

interface ContentPostAnalyticsViewProps {
  brand: Brand | null;
  posts: ContentPost[];
  canEdit?: boolean;
  onRefreshPosts: () => void;
  onOpenAiExtractor: (postId: string) => void;
}

type RangeMode = 'month' | 'custom';

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('id-ID').format(Math.max(0, Number(value) || 0));
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPostDate(post: ContentPost): string | null {
  return post.posted_at || post.scheduled_at || post.updated_at || post.created_at || null;
}

function getPostTimestamp(post: ContentPost): number {
  const value = getPostDate(post);
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getLatestPerChannel(metrics: ContentMetric[]): ContentMetric[] {
  const map = new Map<string, ContentMetric>();
  for (const metric of metrics) {
    const key = metric.channel || 'lainnya';
    const existing = map.get(key);
    if (!existing || new Date(metric.recorded_at).getTime() > new Date(existing.recorded_at).getTime()) {
      map.set(key, metric);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
}

const SummaryCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  color: string;
}> = ({ icon: Icon, label, value, hint, color }) => (
  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
    <div className="flex items-center justify-between gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
    </div>
    <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
    {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

export const ContentPostAnalyticsView: React.FC<ContentPostAnalyticsViewProps> = ({
  brand,
  posts,
  canEdit = true,
  onRefreshPosts,
  onOpenAiExtractor,
}) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [month, setMonth] = useState(currentMonthValue);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');

  const [metrics, setMetrics] = useState<ContentMetric[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailPost, setDetailPost] = useState<ContentPost | null>(null);
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null);
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [metricToEdit, setMetricToEdit] = useState<ContentMetric | null>(null);
  const [metricPostId, setMetricPostId] = useState<string | null>(null);

  const resolvedRange = useMemo(() => {
    if (rangeMode === 'month') {
      const [yearText, monthText] = month.split('-');
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
        return { start: 0, end: Number.MAX_SAFE_INTEGER };
      }
      return {
        start: new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime(),
        end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999).getTime(),
      };
    }

    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER;
    return {
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : Number.MAX_SAFE_INTEGER,
    };
  }, [rangeMode, month, startDate, endDate]);

  const channelOptions = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.channels || []))).sort(),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts
      .filter((post) => isPublishedStatus(post.status))
      .filter((post) => {
        const timestamp = getPostTimestamp(post);
        return timestamp > 0 && timestamp >= resolvedRange.start && timestamp <= resolvedRange.end;
      })
      .filter((post) => channel === 'all' || (post.channels || []).includes(channel))
      .filter((post) => {
        if (!query) return true;
        return (
          post.title?.toLowerCase().includes(query) ||
          post.brief?.toLowerCase().includes(query) ||
          post.caption?.toLowerCase().includes(query) ||
          post.pillar?.toLowerCase().includes(query) ||
          post.hashtags?.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
  }, [posts, resolvedRange, channel, search]);

  const {
    page: postsPage,
    pageSize: postsPageSize,
    totalItems: totalFilteredPosts,
    pageItems: paginatedPosts,
    goToPage: goToPostsPage,
    changePageSize: changePostsPageSize,
  } = usePagination(filteredPosts, {
    initialPageSize: 10,
    resetKey: `${rangeMode}|${month}|${startDate}|${endDate}|${channel}|${search}`,
  });

  const postIdsKey = useMemo(
    () => filteredPosts.map((post) => post.id).sort().join(','),
    [filteredPosts]
  );

  const loadMetrics = useCallback(async () => {
    if (!brand || !postIdsKey) {
      setMetrics([]);
      setError(null);
      return;
    }

    setLoadingMetrics(true);
    setError(null);
    try {
      const postIds = postIdsKey.split(',');
      const rows = await metricsService.getMetrics(brand.id, { postIds });
      setMetrics(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data performa konten.');
      setMetrics([]);
    } finally {
      setLoadingMetrics(false);
    }
  }, [brand, postIdsKey]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (detailPost && !filteredPosts.some((post) => post.id === detailPost.id)) {
      setDetailPost(null);
    }
  }, [filteredPosts, detailPost]);

  const metricsByPost = useMemo(() => {
    const map = new Map<string, ContentMetric[]>();
    for (const metric of metrics) {
      if (!metric.post_id) continue;
      const list = map.get(metric.post_id) || [];
      list.push(metric);
      map.set(metric.post_id, list);
    }
    for (const [postId, list] of map.entries()) {
      list.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      map.set(postId, list);
    }
    return map;
  }, [metrics]);

  const latestMetrics = useMemo(() => {
    const all: ContentMetric[] = [];
    for (const list of metricsByPost.values()) {
      all.push(...getLatestPerChannel(list));
    }
    return all;
  }, [metricsByPost]);

  const summary = useMemo(() => {
    const impressions = latestMetrics.reduce((total, item) => total + (item.impressions || 0), 0);
    const reach = latestMetrics.reduce((total, item) => total + (item.reach || 0), 0);
    const engagements = latestMetrics.reduce(
      (total, item) =>
        total + metricFormulas.totalEngagements(item.likes, item.comments, item.shares, item.saves),
      0
    );
    const likes = latestMetrics.reduce((total, item) => total + (item.likes || 0), 0);
    const saves = latestMetrics.reduce((total, item) => total + (item.saves || 0), 0);
    const base = latestMetrics.reduce(
      (total, item) => total + (item.reach > 0 ? item.reach : item.impressions || 0),
      0
    );
    const averageEr = base > 0 ? Number(((engagements / base) * 100).toFixed(2)) : 0;
    return { impressions, reach, engagements, likes, saves, averageEr };
  }, [latestMetrics]);

  const openAddMetric = (postId: string) => {
    setDetailPost(null);
    setMetricToEdit(null);
    setMetricPostId(postId);
    setMetricModalOpen(true);
  };

  const openEditMetric = (metric: ContentMetric) => {
    setDetailPost(null);
    setMetricToEdit(metric);
    setMetricPostId(metric.post_id || null);
    setMetricModalOpen(true);
  };

  const handleDeleteMetric = async (metric: ContentMetric) => {
    if (!window.confirm('Hapus snapshot metrik ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await metricsService.deleteMetric(metric.id);
      await loadMetrics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus metrik.');
    }
  };

  const handleSelectMode = (mode: RangeMode) => {
    if (mode === 'custom' && rangeMode === 'month') {
      const [yearText, monthText] = month.split('-');
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      setStartDate(toDateInputValue(new Date(year, monthIndex, 1)));
      setEndDate(toDateInputValue(new Date(year, monthIndex + 1, 0)));
    }
    setRangeMode(mode);
  };

  const detailMetrics = detailPost ? metricsByPost.get(detailPost.id) || [] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Konten Post</h1>
              <p className="text-xs text-slate-500">
                Histori konten tayang, gambar, link posting, dan performa lengkap per konten.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadMetrics();
            onRefreshPosts();
          }}
          disabled={loadingMetrics}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Filter Tanggal
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectMode('month')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    rangeMode === 'month'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMode('custom')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    rangeMode === 'custom'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {rangeMode === 'month' ? (
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Bulan
                </label>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Dari
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Sampai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Channel
              </label>
              <div className="relative">
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">Semua Channel</option>
                  {channelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="relative w-full xl:w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari judul, brief, atau hashtag..."
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
          <Filter className="h-3 w-3" />
          <span>
            {formatNumber(filteredPosts.length)} konten tayang pada periode ini. Hanya konten berstatus
            published/tayang yang ditampilkan.
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard
          icon={ImageIcon}
          label="Konten"
          value={formatNumber(filteredPosts.length)}
          hint="Konten tayang"
          color="bg-blue-50 text-blue-600"
        />
        <SummaryCard
          icon={Eye}
          label="Impressions"
          value={formatNumber(summary.impressions)}
          hint="Snapshot terbaru"
          color="bg-indigo-50 text-indigo-600"
        />
        <SummaryCard
          icon={Users}
          label="Reach"
          value={formatNumber(summary.reach)}
          hint="Snapshot terbaru"
          color="bg-violet-50 text-violet-600"
        />
        <SummaryCard
          icon={Heart}
          label="Engagement"
          value={formatNumber(summary.engagements)}
          hint={`${formatNumber(summary.likes)} likes • ${formatNumber(summary.saves)} saves`}
          color="bg-rose-50 text-rose-600"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Rata-rata ER"
          value={`${summary.averageEr}%`}
          hint="Berbobot reach"
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        {loadingMetrics ? (
          <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Memuat performa konten...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Belum ada konten tayang pada periode ini</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              Ubah filter bulan/rentang tanggal, atau ubah status konten menjadi published setelah konten
              benar-benar diposting.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Konten</th>
                  <th className="px-4 py-3">Tanggal Posting</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3 text-right">Reach</th>
                  <th className="px-4 py-3 text-right">ER</th>
                  <th className="px-4 py-3 text-right">Engagement</th>
                  <th className="px-4 py-3 text-right">Snapshot</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPosts.map((post) => {
                  const postMetrics = metricsByPost.get(post.id) || [];
                  const latest = getLatestPerChannel(postMetrics)[0] || null;
                  const engagements = latest
                    ? metricFormulas.totalEngagements(
                        latest.likes,
                        latest.comments,
                        latest.shares,
                        latest.saves
                      )
                    : 0;
                  const er = latest
                    ? metricFormulas.engagementRate(engagements, latest.reach, latest.impressions)
                    : 0;

                  return (
                    <tr key={post.id} className="group hover:bg-slate-50/70">
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ContentThumbnail
                            mediaPath={post.media_urls?.[0]}
                            alt={post.title}
                            className="h-12 w-12"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailPost(post)}
                                className="truncate text-left text-xs font-bold text-slate-900 hover:text-blue-600"
                              >
                                {post.title}
                              </button>
                              {post.post_url && (
                                <a
                                  href={post.post_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-emerald-500 hover:text-emerald-700"
                                  title="Buka link postingan"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            {post.brief && (
                              <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-indigo-600">
                                {post.brief}
                              </p>
                            )}
                            {post.caption && (
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                                {post.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formatDate(post.posted_at || post.scheduled_at)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <StatusBadge status={post.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(post.channels || []).map((item) => (
                            <span
                              key={item}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {latest ? formatNumber(latest.reach) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {latest ? `${er}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {latest ? formatNumber(engagements) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {postMetrics.length > 0 ? `${postMetrics.length}x` : 'Belum ada'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailPost(post)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                            title="Lihat detail performa"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingPost(post)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                                title="Edit konten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openAddMetric(post.id)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                                title="Catat / edit metrik"
                              >
                                <BarChart2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenAiExtractor(post.id)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                                title="Ekstrak metrik dengan AI"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {post.post_url && (
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                              title="Lihat postingan"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingMetrics && totalFilteredPosts > 0 && (
          <Pagination
            page={postsPage}
            pageSize={postsPageSize}
            totalItems={totalFilteredPosts}
            onPageChange={goToPostsPage}
            onPageSizeChange={changePostsPageSize}
            itemLabel="konten"
          />
        )}
      </div>

      <ContentPostPerformanceModal
        isOpen={Boolean(detailPost)}
        post={detailPost}
        metrics={detailMetrics}
        canEdit={canEdit}
        onClose={() => setDetailPost(null)}
        onEditPost={(post) => {
          setDetailPost(null);
          setEditingPost(post);
        }}
        onAddMetric={openAddMetric}
        onEditMetric={openEditMetric}
        onDeleteMetric={handleDeleteMetric}
        onOpenAiExtractor={(postId) => {
          setDetailPost(null);
          onOpenAiExtractor(postId);
        }}
      />

      <EditPostModal
        isOpen={Boolean(editingPost)}
        post={editingPost}
        brand={brand}
        onClose={() => setEditingPost(null)}
        onUpdated={() => {
          setEditingPost(null);
          onRefreshPosts();
          void loadMetrics();
        }}
        onDeleted={() => {
          setEditingPost(null);
          onRefreshPosts();
          void loadMetrics();
        }}
        onDuplicated={() => {
          setEditingPost(null);
          onRefreshPosts();
          void loadMetrics();
        }}
      />

      {brand && (
        <MetricInputModal
          isOpen={metricModalOpen}
          brandId={brand.id}
          posts={filteredPosts}
          platforms={getBrandPlatforms(brand)}
          initialMetric={metricToEdit}
          initialPostId={metricPostId}
          onClose={() => {
            setMetricModalOpen(false);
            setMetricToEdit(null);
            setMetricPostId(null);
          }}
          onSaved={() => {
            setMetricModalOpen(false);
            setMetricToEdit(null);
            setMetricPostId(null);
            void loadMetrics();
          }}
        />
      )}
    </div>
  );
};
