import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Eye,
  Users,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MousePointerClick,
  Clock,
  TrendingUp,
  Repeat,
  Sparkles,
  Edit,
  Trash2,
  Calendar,
  ExternalLink,
  BarChart2,
  FileText,
  UserPlus,
  History,
  Activity,
  PlayCircle,
  ChevronDown,
} from 'lucide-react';
import { ContentMetric, ContentPost } from '../../types/database.ts';
import { metricFormulas } from '../../services/database/metricsService.ts';
import { ContentThumbnail } from '../content/ContentThumbnail.tsx';
import {
  buildTrafficSourceItems,
  isVideoContentType,
  CONTENT_TYPE_LABELS,
} from '../../config/insights.ts';
import { TrafficSourceBars } from './insights/TrafficSourceBars.tsx';
import { ViewFactorsList } from './insights/ViewFactorsList.tsx';
import { MiniLineChart } from './insights/MiniLineChart.tsx';
import { RetentionChart } from './insights/RetentionChart.tsx';
import { AudienceDetailCard } from './insights/AudienceDetailCard.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface ContentPostPerformanceModalProps {
  isOpen: boolean;
  post: ContentPost | null;
  metrics: ContentMetric[];
  canEdit?: boolean;
  onClose: () => void;
  onEditPost: (post: ContentPost) => void;
  onAddMetric: (postId: string) => void;
  onEditMetric: (metric: ContentMetric) => void;
  onDeleteMetric: (metric: ContentMetric) => void;
  onOpenAiExtractor: (postId: string) => void;
}

type TabKey = 'ringkasan' | 'tayangan' | 'interaksi' | 'pemirsa' | 'riwayat';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'ringkasan', label: 'Ringkasan', icon: Activity },
  { key: 'tayangan', label: 'Tayangan', icon: Eye },
  { key: 'interaksi', label: 'Interaksi', icon: Heart },
  { key: 'pemirsa', label: 'Pemirsa', icon: Users },
  { key: 'riwayat', label: 'Riwayat', icon: History },
];

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

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function sortByNewest(metrics: ContentMetric[]): ContentMetric[] {
  return [...metrics].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
}

const MetricStat: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}> = ({ icon: Icon, label, value, color = 'text-slate-500' }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
    <div className={`flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
  </div>
);

export const ContentPostPerformanceModal: React.FC<ContentPostPerformanceModalProps> = ({
  isOpen,
  post,
  metrics,
  canEdit = true,
  onClose,
  onEditPost,
  onAddMetric,
  onEditMetric,
  onDeleteMetric,
  onOpenAiExtractor,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('ringkasan');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');

  const sortedMetrics = useMemo(() => sortByNewest(metrics), [metrics]);

  useEffect(() => {
    setActiveTab('ringkasan');
    setSelectedMetricId(sortedMetrics[0]?.id || '');
    // Reset hanya saat postingan berubah, bukan setiap snapshot diperbarui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  useEffect(() => {
    if (!sortedMetrics.some((metric) => metric.id === selectedMetricId)) {
      setSelectedMetricId(sortedMetrics[0]?.id || '');
    }
  }, [sortedMetrics, selectedMetricId]);

  if (!isOpen || !post) return null;

  const selected = sortedMetrics.find((metric) => metric.id === selectedMetricId) || sortedMetrics[0] || null;
  const selectedEngagements = selected
    ? metricFormulas.totalEngagements(
        selected.likes,
        selected.comments,
        selected.shares,
        selected.saves,
        Number(selected.reposts) || 0
      )
    : 0;
  const selectedEr = selected
    ? metricFormulas.engagementRate(selectedEngagements, selected.reach, selected.impressions)
    : 0;

  const detail = selected?.insights_detail || null;
  const trafficItems = buildTrafficSourceItems(detail?.trafficSources || selected?.traffic_sources);
  const audience = detail?.audience || selected?.audience_breakdown || null;
  const audienceDetails = detail?.audienceDetails || null;
  const contentType = selected?.content_type || '';
  const isVideo = isVideoContentType(contentType) || Boolean(detail?.viewFactors?.length);
  const watchTime = selected?.watch_time || null;
  const dropOff = selected?.drop_off_rate ?? null;
  const approximate = Boolean(detail?.approximate);

  const seriesViews = detail?.series?.views || [];
  const seriesLikes = detail?.series?.likes || [];
  const retention = detail?.series?.retention || [];

  const followers = Number(audience?.followers || 0);
  const nonFollowers = Number(audience?.non_followers || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[94vh] w-full min-w-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <ContentThumbnail
              mediaPath={post.media_urls?.[0]}
              alt={post.title}
              className="h-14 w-14 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{post.title}</h2>
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-emerald-600 hover:text-emerald-700"
                    title="Buka postingan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.posted_at || post.scheduled_at)}
                </span>
                {(post.channels || []).map((channel) => (
                  <span
                    key={channel}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    {channel}
                  </span>
                ))}
                {contentType && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600">
                    {CONTENT_TYPE_LABELS[contentType] || contentType}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {selected ? (
          <>
            {/* Pemilih snapshot (sticky) */}
            <div className="sticky top-0 z-10 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:inline">
                  Snapshot
                </span>
                <div className="relative min-w-0">
                  <select
                    value={selected.id}
                    onChange={(e) => setSelectedMetricId(e.target.value)}
                    className="w-full max-w-[280px] appearance-none rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {sortedMetrics.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {formatDateTime(metric.recorded_at)} • {metric.channel}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                {sortedMetrics.length} snapshot tersimpan
              </span>
            </div>

            {/* Tabs */}
            <div className="w-full min-w-0 shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-2 sm:px-4">
              <div className="flex min-w-max gap-0.5">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-semibold transition ${
                        activeTab === tab.key
                          ? 'border-blue-600 text-blue-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'ringkasan' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetricStat icon={Eye} label="Impressions" value={formatCount(selected.impressions)} color="text-blue-600" />
                    <MetricStat icon={Users} label="Reach" value={formatCount(selected.reach)} color="text-indigo-600" />
                    <MetricStat icon={TrendingUp} label="Engagement Rate" value={formatPercent(selectedEr)} color="text-emerald-600" />
                    <MetricStat icon={Heart} label="Engagements" value={formatCount(selectedEngagements)} color="text-rose-600" />
                    <MetricStat icon={Heart} label="Likes" value={formatCount(selected.likes)} color="text-rose-500" />
                    <MetricStat icon={MessageSquare} label="Komentar" value={formatCount(selected.comments)} color="text-amber-600" />
                    <MetricStat icon={Share2} label="Shares" value={formatCount(selected.shares)} color="text-sky-600" />
                    <MetricStat icon={Bookmark} label="Saves" value={formatCount(selected.saves)} color="text-violet-600" />
                    <MetricStat icon={Repeat} label="Reposts" value={formatCount(Number(selected.reposts))} color="text-teal-600" />
                    <MetricStat
                      icon={MousePointerClick}
                      label="Kunjungan Profil"
                      value={formatCount(selected.profile_visits)}
                      color="text-orange-600"
                    />
                    <MetricStat icon={ExternalLink} label="Klik Link" value={formatCount(selected.clicks)} color="text-slate-600" />
                    <MetricStat icon={UserPlus} label="Follow" value={formatCount(selected.follows)} color="text-emerald-700" />
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Script / Brief</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                        {post.brief || 'Belum ada brief produksi.'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                        <BarChart2 className="h-3.5 w-3.5" />
                        <span>Caption / Catatan</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                        {post.caption || 'Belum ada caption.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Rata-rata Watch Time
                        </span>
                        <p className="mt-1 text-sm font-bold text-slate-900">{watchTime || 'Belum dicatat'}</p>
                      </div>
                      <Clock className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Drop-off / Skip Rate
                        </span>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {dropOff !== null && dropOff !== undefined ? formatPercent(dropOff) : 'Belum dicatat'}
                        </p>
                      </div>
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    </div>
                  </div>

                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] leading-snug text-slate-500">
                    Total Engagements = Likes + Comments + Shares + Saves + Reposts. Engagement Rate
                    memakai Reach, atau Impressions bila Reach belum diisi.
                  </p>
                </div>
              )}

              {activeTab === 'tayangan' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetricStat icon={Eye} label="Tayangan" value={formatCount(selected.impressions)} color="text-blue-600" />
                    <MetricStat icon={Users} label="Reach" value={formatCount(selected.reach)} color="text-indigo-600" />
                    <MetricStat
                      icon={Repeat}
                      label="Reposts"
                      value={formatCount(Number(selected.reposts))}
                      color="text-teal-600"
                    />
                    <MetricStat
                      icon={Sparkles}
                      label="Jenis Konten"
                      value={CONTENT_TYPE_LABELS[contentType] || contentType || '-'}
                      color="text-purple-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Sumber Tayangan Teratas
                      </h3>
                      <TrafficSourceBars
                        items={trafficItems}
                        emptyText="Sumber tayangan belum dicatat pada snapshot ini."
                      />
                    </div>
                    <div className="space-y-3">
                      {seriesViews.length > 0 && (
                        <MiniLineChart
                          points={seriesViews}
                          label="Tayangan dari Waktu ke Waktu"
                          color="#2563eb"
                          fill="rgba(37, 99, 235, 0.12)"
                          approximate={approximate}
                        />
                      )}
                      {isVideo && retention.length > 0 && (
                        <RetentionChart points={retention} approximate={approximate} />
                      )}
                    </div>
                  </div>

                  {isVideo && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <PlayCircle className="h-3.5 w-3.5" />
                        Faktor yang Memengaruhi Tayangan
                      </h3>
                      <ViewFactorsList factors={detail?.viewFactors || []} />
                    </div>
                  )}

                  {!isVideo && seriesViews.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
                      Grafik dan faktor tayangan hanya tersedia untuk konten video/Reels dengan data
                      insight yang lengkap.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'interaksi' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetricStat icon={Heart} label="Likes" value={formatCount(selected.likes)} color="text-rose-500" />
                    <MetricStat icon={MessageSquare} label="Komentar" value={formatCount(selected.comments)} color="text-amber-600" />
                    <MetricStat icon={Share2} label="Shares" value={formatCount(selected.shares)} color="text-sky-600" />
                    <MetricStat icon={Bookmark} label="Saves" value={formatCount(selected.saves)} color="text-violet-600" />
                    <MetricStat icon={Repeat} label="Reposts" value={formatCount(Number(selected.reposts))} color="text-teal-600" />
                    <MetricStat icon={Heart} label="Total Engagements" value={formatCount(selectedEngagements)} color="text-rose-600" />
                    <MetricStat icon={MousePointerClick} label="Kunjungan Profil" value={formatCount(selected.profile_visits)} color="text-orange-600" />
                    <MetricStat icon={UserPlus} label="Follow" value={formatCount(selected.follows)} color="text-emerald-700" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Kontribusi Interaksi
                      </h3>
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        {[
                          { label: 'Likes', value: Number(selected.likes) || 0, color: 'bg-rose-500' },
                          { label: 'Komentar', value: Number(selected.comments) || 0, color: 'bg-amber-500' },
                          { label: 'Shares', value: Number(selected.shares) || 0, color: 'bg-sky-500' },
                          { label: 'Saves', value: Number(selected.saves) || 0, color: 'bg-violet-500' },
                          { label: 'Reposts', value: Number(selected.reposts) || 0, color: 'bg-teal-500' },
                        ].map((item) => {
                          const max = Math.max(
                            Number(selected.likes) || 0,
                            Number(selected.comments) || 0,
                            Number(selected.shares) || 0,
                            Number(selected.saves) || 0,
                            Number(selected.reposts) || 0,
                            1
                          );
                          return (
                            <div key={item.label} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-semibold text-slate-600">{item.label}</span>
                                <span className="font-bold text-slate-800">{formatCount(item.value)}</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${item.color}`}
                                  style={{ width: `${(item.value / max) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {seriesLikes.length > 0 ? (
                        <MiniLineChart
                          points={seriesLikes}
                          label="Likes dari Waktu ke Waktu"
                          color="#e11d48"
                          fill="rgba(225, 29, 72, 0.12)"
                          approximate={approximate}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
                          <p className="text-[11px] font-semibold text-slate-500">Grafik Interaksi</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Deret grafik belum tersedia pada snapshot ini.
                          </p>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Tindakan Pengguna
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <span className="block text-[9px] text-slate-500">Kunjungan Profil</span>
                            <span className="font-bold text-slate-800">{formatCount(selected.profile_visits)}</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <span className="block text-[9px] text-slate-500">Klik Link Eksternal</span>
                            <span className="font-bold text-slate-800">{formatCount(selected.clicks)}</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <span className="block text-[9px] text-slate-500">Pengikut Baru</span>
                            <span className="font-bold text-slate-800">{formatCount(selected.follows)}</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <span className="block text-[9px] text-slate-500">Save Rate</span>
                            <span className="font-bold text-slate-800">
                              {formatPercent(metricFormulas.saveRate(selected.saves, selected.reach))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pemirsa' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <span>Pengikut {formatPercent(followers)}</span>
                      <span>Bukan Pengikut {formatPercent(nonFollowers)}</span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="bg-indigo-600"
                        style={{ width: `${Math.min(100, Math.max(0, followers))}%` }}
                        title="Pengikut"
                      />
                      <div
                        className="bg-purple-500"
                        style={{ width: `${Math.min(100, Math.max(0, nonFollowers))}%` }}
                        title="Bukan Pengikut"
                      />
                    </div>
                    <p className="mt-2 text-[10px] leading-snug text-slate-500">
                      Komposisi pemirsa konten ini berdasarkan data insight yang tersimpan.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <Users className="h-3.5 w-3.5" />
                      Detail Pemirsa
                    </h3>
                    <AudienceDetailCard details={audienceDetails} approximate={approximate} />
                  </div>
                </div>
              )}

              {activeTab === 'riwayat' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5">Channel</th>
                        <th className="px-3 py-2.5">Waktu Catat</th>
                        <th className="px-3 py-2.5 text-right">Impressions</th>
                        <th className="px-3 py-2.5 text-right">Reach</th>
                        <th className="px-3 py-2.5 text-right">ER</th>
                        <th className="px-3 py-2.5 text-right">Engagement</th>
                        <th className="px-3 py-2.5">Sumber</th>
                        {canEdit && <th className="px-3 py-2.5 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedMetrics.map((metric) => {
                        const engagements = metricFormulas.totalEngagements(
                          metric.likes,
                          metric.comments,
                          metric.shares,
                          metric.saves,
                          Number(metric.reposts) || 0
                        );
                        const er = metricFormulas.engagementRate(
                          engagements,
                          metric.reach,
                          metric.impressions
                        );
                        return (
                          <tr
                            key={metric.id}
                            className={`cursor-pointer hover:bg-slate-50/70 ${
                              metric.id === selected.id ? 'bg-blue-50/50' : ''
                            }`}
                            onClick={() => setSelectedMetricId(metric.id)}
                          >
                            <td className="px-3 py-2.5 font-semibold capitalize text-slate-700">
                              {metric.channel}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{formatDateTime(metric.recorded_at)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatCount(metric.impressions)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatCount(metric.reach)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">
                              {formatPercent(er)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatCount(engagements)}</td>
                            <td className="px-3 py-2.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                                {metric.source === 'ai_video'
                                  ? 'AI Video'
                                  : metric.source === 'ai_screenshot'
                                  ? 'AI Screenshot'
                                  : 'Manual'}
                              </span>
                            </td>
                            {canEdit && (
                              <td className="px-3 py-2.5">
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditMetric(metric);
                                    }}
                                    className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                    title="Edit metrik"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteMetric(metric);
                                    }}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    title="Hapus metrik"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <BarChart2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Belum ada metrik untuk konten ini</p>
              <p className="mt-1 text-xs text-slate-500">
                Tambahkan metrik secara manual atau ekstrak otomatis dari screenshot insight.
              </p>
              {canEdit && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddMetric(post.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    Catat Metrik
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAiExtractor(post.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ekstrak AI
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEditPost(post)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit Konten
            </button>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Lihat Postingan
              </a>
            )}
          </div>
          {canEdit && selected && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAddMetric(post.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Snapshot Baru
              </button>
              <button
                type="button"
                onClick={() => onOpenAiExtractor(post.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ekstrak AI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
