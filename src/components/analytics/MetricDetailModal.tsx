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
  BarChart2,
} from 'lucide-react';
import { ContentMetric, ContentPost } from '../../types/database.ts';
import { metricFormulas } from '../../services/database/metricsService.ts';

interface MetricDetailModalProps {
  isOpen: boolean;
  metric: (ContentMetric & { post?: ContentPost | null }) | null;
  onClose: () => void;
  onEdit?: (metric: ContentMetric) => void;
  onDelete?: (metricId: string) => void;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
  isOpen,
  metric,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !metric) return null;

  const raw = (metric.raw_ai_analysis || {}) as Record<string, any>;
  const totalEng = metricFormulas.totalEngagements(
    metric.likes,
    metric.comments,
    metric.shares,
    metric.saves
  );
  const er = metric.engagement_rate || metricFormulas.engagementRate(totalEng, metric.reach, metric.impressions);
  const saveRate = metricFormulas.saveRate(metric.saves, metric.reach);
  const shareRate = metricFormulas.shareRate(metric.shares, metric.reach);

  const watchTime = metric.watch_time || raw.watch_time;
  const dropOffRate = metric.drop_off_rate ?? raw.drop_off_rate;
  const reposts = metric.reposts ?? raw.reposts;
  const traffic = metric.traffic_sources || raw.traffic_sources;
  const audience = metric.audience_breakdown || raw.audience_breakdown;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const channelColor = (ch: string) => {
    switch (ch.toLowerCase()) {
      case 'instagram':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'tiktok':
        return 'bg-slate-900 text-cyan-300 border-slate-700';
      case 'youtube':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const isTikTok = metric.channel.toLowerCase() === 'tiktok';
  const isInstagram = metric.channel.toLowerCase() === 'instagram';
  const isYouTube = metric.channel.toLowerCase() === 'youtube';

  const trafficLabel1 = isTikTok ? 'Untuk Anda (FYP)' : isInstagram ? 'Tab Reels' : isYouTube ? 'Shorts Feed' : 'Reels / Video';
  const trafficLabel2 = isTikTok ? 'Mengikuti (Following)' : isInstagram ? 'Beranda (Feed)' : isYouTube ? 'Beranda / Browse' : 'Feed / Beranda';
  const trafficLabel3 = isTikTok ? 'Suara / Pencarian' : isInstagram ? 'Jelajahi (Explore)' : isYouTube ? 'Penelusuran' : 'Explore / Cari';
  const trafficLabel4 = isTikTok ? 'Profil Akun' : isInstagram ? 'Profil' : isYouTube ? 'Halaman Channel' : 'Profil';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs px-2.5 py-1 font-bold rounded-lg uppercase tracking-wider border ${channelColor(
                metric.channel
              )}`}
            >
              {metric.channel}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 line-clamp-1">
                {metric.post?.title || 'Metrik Akun / Saluran Utama'}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatDate(metric.recorded_at)}</span>
                {metric.source && (
                  <span className="bg-slate-200/60 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-medium">
                    Sumber: {metric.source === 'ai_screenshot' ? 'AI Extractor' : 'Manual Input'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Post Information if linked */}
          {metric.post && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Postingan Terkait
                </span>
                {metric.post.pillar && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Pilar: {metric.post.pillar}
                  </span>
                )}
              </div>
              <p className="font-semibold text-slate-800">{metric.post.title}</p>
              {metric.post.caption && (
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{metric.post.caption}</p>
              )}
            </div>
          )}

          {/* AI Extracted Summary Notice if available */}
          {raw.summary && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-1 text-xs text-purple-950">
              <div className="flex items-center gap-1.5 font-bold text-purple-800">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Ringkasan Analisis AI</span>
                {raw.confidence && (
                  <span className="text-[10px] font-semibold bg-purple-200/60 px-1.5 py-0.2 rounded text-purple-800 ml-auto">
                    Akurasi AI: {raw.confidence}%
                  </span>
                )}
              </div>
              <p className="text-purple-900 leading-relaxed text-[11px]">{raw.summary}</p>
            </div>
          )}

          {/* Core Metrics Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Metrik Utama & Engagement</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <Eye className="w-3 h-3 text-blue-500" />
                  <span>Impressions</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.impressions || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <Users className="w-3 h-3 text-purple-500" />
                  <span>Reach (Jangkauan)</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.reach || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-purple-50 border border-purple-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-purple-700 mb-1">
                  <TrendingUp className="w-3 h-3 text-purple-600" />
                  <span>Engagement Rate</span>
                </div>
                <span className="text-sm font-extrabold text-purple-700 block">{er}%</span>
                <span className="text-[9px] text-purple-600">Total: {totalEng.toLocaleString('id-ID')}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <Heart className="w-3 h-3 text-rose-500" />
                  <span>Likes (Suka)</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.likes || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <MessageSquare className="w-3 h-3 text-blue-500" />
                  <span>Comments</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.comments || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <Share2 className="w-3 h-3 text-emerald-500" />
                  <span>Shares</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.shares || 0).toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-slate-500">Rate: {shareRate}%</span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <Bookmark className="w-3 h-3 text-amber-500" />
                  <span>Saves</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.saves || 0).toLocaleString('id-ID')}
                </span>
                <span className="text-[9px] text-slate-500">Rate: {saveRate}%</span>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                  <MousePointer className="w-3 h-3 text-indigo-500" />
                  <span>Link Clicks</span>
                </div>
                <span className="text-sm font-extrabold text-slate-900 block">
                  {(metric.clicks || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Deep Video & Insight Breakdown */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-pink-600" />
              <span>Metrik Mendalam Video & Distribusi Trafik</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block mb-0.5">Average Watch Time</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {watchTime ? String(watchTime) : 'Tidak dicatat'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block mb-0.5">Drop-off / Skip Rate</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {dropOffRate !== undefined && dropOffRate !== null ? `${dropOffRate}%` : 'Tidak dicatat'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block mb-0.5">Reposts (Posting Ulang)</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {reposts !== undefined && reposts !== null ? Number(reposts).toLocaleString('id-ID') : '0'}
                </span>
              </div>
            </div>

            {/* Traffic Sources */}
            {traffic && (
              <div className="pt-2 border-t border-slate-200/70 text-xs">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Sumber Penayangan Teratas (%)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{trafficLabel1}</span>
                    <span className="font-bold text-slate-800">{traffic.reels || 0}%</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{trafficLabel2}</span>
                    <span className="font-bold text-slate-800">{traffic.feed || 0}%</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{trafficLabel3}</span>
                    <span className="font-bold text-slate-800">{traffic.explore || 0}%</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{trafficLabel4}</span>
                    <span className="font-bold text-slate-800">{traffic.profile || 0}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Audience Demographics */}
            {audience && (
              <div className="pt-2 border-t border-slate-200/70 text-xs">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Demografi Pemirsa (%)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Pengikut (Followers)</span>
                    <span className="font-extrabold text-indigo-700 text-sm">
                      {audience.followers || 0}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Bukan Pengikut (Non-followers)</span>
                    <span className="font-extrabold text-purple-700 text-sm">
                      {audience.non_followers || 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => {
                  if (window.confirm('Hapus snapshot metrik ini?')) {
                    onDelete(metric.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Snapshot</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(metric);
                }}
                className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-blue-200"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Metrik</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
