import React from 'react';
import {
  X,
  Eye,
  Users,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MousePointer,
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
} from 'lucide-react';
import { ContentMetric, ContentPost } from '../../types/database.ts';
import { metricFormulas } from '../../services/database/metricsService.ts';
import { ContentThumbnail } from '../content/ContentThumbnail.tsx';

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

const MetricStat: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}> = ({ icon: Icon, label, value, color = 'text-slate-500' }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
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
  if (!isOpen || !post) return null;

  const latestByChannel = getLatestPerChannel(metrics);
  const latest = latestByChannel[0] || null;
  const latestEngagements = latest
    ? metricFormulas.totalEngagements(latest.likes, latest.comments, latest.shares, latest.saves)
    : 0;
  const latestEr = latest
    ? metricFormulas.engagementRate(latestEngagements, latest.reach, latest.impressions)
    : 0;

  const raw = (latest?.raw_ai_analysis || {}) as Record<string, any>;
  const watchTime = latest?.watch_time || raw.watch_time || null;
  const dropOff = latest?.drop_off_rate ?? raw.drop_off_rate ?? null;
  const reposts = latest?.reposts ?? raw.reposts ?? 0;
  const trafficSources = latest?.traffic_sources || raw.traffic_sources || null;
  const audience = latest?.audience_breakdown || raw.audience_breakdown || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <ContentThumbnail
              mediaPath={post.media_urls?.[0]}
              alt={post.title}
              className="h-16 w-16"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-900">{post.title}</h2>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Brief & caption */}
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

          {latest ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ringkasan Performa Terbaru</h3>
                  <p className="text-[10px] text-slate-400">
                    Snapshot terakhir per channel. Total {metrics.length} snapshot tersimpan.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  Update: {formatDateTime(latest.recorded_at)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricStat icon={Eye} label="Impressions" value={formatNumber(latest.impressions)} color="text-blue-600" />
                <MetricStat icon={Users} label="Reach" value={formatNumber(latest.reach)} color="text-indigo-600" />
                <MetricStat icon={TrendingUp} label="Engagement Rate" value={`${latestEr}%`} color="text-emerald-600" />
                <MetricStat icon={Heart} label="Engagements" value={formatNumber(latestEngagements)} color="text-rose-600" />
                <MetricStat icon={Heart} label="Likes" value={formatNumber(latest.likes)} color="text-rose-500" />
                <MetricStat icon={MessageSquare} label="Komentar" value={formatNumber(latest.comments)} color="text-amber-600" />
                <MetricStat icon={Share2} label="Shares" value={formatNumber(latest.shares)} color="text-sky-600" />
                <MetricStat icon={Bookmark} label="Saves" value={formatNumber(latest.saves)} color="text-violet-600" />
                <MetricStat icon={MousePointer} label="Klik Link" value={formatNumber(latest.clicks)} color="text-slate-600" />
                <MetricStat icon={Repeat} label="Reposts" value={formatNumber(Number(reposts))} color="text-teal-600" />
                <MetricStat icon={Clock} label="Watch Time" value={watchTime || '-'} color="text-orange-600" />
                <MetricStat
                  icon={TrendingUp}
                  label="Drop-off"
                  value={dropOff !== null && dropOff !== undefined ? `${Number(dropOff).toFixed(1)}%` : '-'}
                  color="text-red-500"
                />
              </div>

              {(trafficSources || audience) && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {trafficSources && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Sumber Traffic
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(trafficSources).map(([name, value]) => (
                          <div key={name} className="flex items-center gap-2 text-[11px]">
                            <span className="w-16 capitalize text-slate-500">{name}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${Math.min(100, Number(value) || 0)}%` }}
                              />
                            </div>
                            <span className="w-10 text-right font-semibold text-slate-700">
                              {Number(value) || 0}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {audience && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Komposisi Audience
                      </p>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Followers</span>
                          <span className="font-bold text-slate-800">{Number(audience.followers || 0)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Non-followers</span>
                          <span className="font-bold text-slate-800">{Number(audience.non_followers || 0)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Riwayat Snapshot Metrik</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[720px] text-left text-xs">
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
                      {metrics.map((metric) => {
                        const engagements = metricFormulas.totalEngagements(
                          metric.likes,
                          metric.comments,
                          metric.shares,
                          metric.saves
                        );
                        const er = metricFormulas.engagementRate(
                          engagements,
                          metric.reach,
                          metric.impressions
                        );
                        return (
                          <tr key={metric.id} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2.5 font-semibold capitalize text-slate-700">{metric.channel}</td>
                            <td className="px-3 py-2.5 text-slate-500">{formatDateTime(metric.recorded_at)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatNumber(metric.impressions)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatNumber(metric.reach)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{er}%</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatNumber(engagements)}</td>
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
                                    onClick={() => onEditMetric(metric)}
                                    className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                    title="Edit metrik"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteMetric(metric)}
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
              </div>
            </>
          ) : (
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
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
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
          {canEdit && latest && (
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
