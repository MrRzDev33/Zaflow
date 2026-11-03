import React, { useState } from 'react';
import { Award, Bookmark, CalendarDays, ExternalLink, Share2 } from '../common/icons/lucide-compat.tsx';
import { TopPostItem } from '../../services/database/metricsService.ts';
import { FormatBadge } from '../common/Badges.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface TopContentCardProps {
  topPosts: TopPostItem[];
  onSelectPost?: (postId: string) => void;
}

function formatScheduledAt(value: string | null): string {
  if (!value) return 'Jadwal posting belum diisi';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Jadwal posting belum diisi';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type TopContentSortKey = 'impressions' | 'er' | 'reach' | 'saves' | 'shares';

export const TopContentCard: React.FC<TopContentCardProps> = ({ topPosts, onSelectPost }) => {
  // Metrik utama = awareness (impressions). ER tetap tampil sebagai metrik pendukung.
  const [sortBy, setSortBy] = useState<TopContentSortKey>('impressions');

  const sortedPosts = [...topPosts]
    .sort((a, b) => {
      if (sortBy === 'er') return b.engagementRate - a.engagementRate;
      if (sortBy === 'reach') return b.reach - a.reach;
      if (sortBy === 'saves') return b.saves - a.saves;
      if (sortBy === 'shares') return b.shares - a.shares;
      return b.impressions - a.impressions;
    })
    .slice(0, 5);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Konten Berkinerja Terbaik (Top Content)</h2>
            <p className="text-xs text-slate-500">
              Metrik utama awareness (impressions); Engagement Rate tetap ditampilkan
            </p>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex flex-wrap items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 self-start sm:self-auto text-xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold px-1.5">Urutkan:</span>
          {[
            { id: 'impressions', label: 'Impressions' },
            { id: 'er', label: 'ER (%)' },
            { id: 'reach', label: 'Reach' },
            { id: 'saves', label: 'Saves' },
            { id: 'shares', label: 'Shares' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSortBy(tab.id as TopContentSortKey)}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                sortBy === tab.id
                  ? 'bg-white shadow-2xs font-semibold text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {sortedPosts.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Belum ada metrik pada postingan di periode ini. Catat snapshot metrik pada postingan untuk
          melihat ranking.
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedPosts.map((item, idx) => (
            <div
              key={item.post.id}
              onClick={() => onSelectPost && onSelectPost(item.post.id)}
              className="p-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 hover:border-blue-300 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                    idx === 0
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : idx === 1
                      ? 'bg-slate-200 text-slate-800'
                      : idx === 2
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectPost?.(item.post.id);
                      }}
                      className="truncate text-left font-bold text-slate-900 group-hover:text-blue-600 transition text-xs line-clamp-1"
                      title="Buka detail performa postingan"
                    >
                      {item.post.title}
                    </button>
                    {item.post.post_url && (
                      <a
                        href={item.post.post_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="shrink-0 text-emerald-500 hover:text-emerald-700"
                        title="Buka link postingan"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                    <span className="font-medium text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      {item.post.pillar || 'Tanpa pilar'}
                    </span>
                    <FormatBadge format={item.post.format} />
                    {item.channels.map((channel) => (
                      <span
                        key={channel}
                        className="uppercase text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 rounded text-slate-700"
                      >
                        {channel}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <CalendarDays className="w-3 h-3" />
                      {formatScheduledAt(item.scheduledAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metric stats pill */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 text-xs shrink-0 self-end sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 w-full sm:w-auto sm:justify-end">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Impressions (Awareness)</span>
                  <span className="font-extrabold text-blue-700 text-sm">
                    {formatCount(item.impressions)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Engagement Rate</span>
                  <span className="font-bold text-purple-700">
                    {formatPercent(item.engagementRate)}
                  </span>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-slate-400 block">Reach</span>
                  <span className="font-bold text-slate-700">{formatCount(item.reach)}</span>
                </div>

                <div className="flex items-center justify-end gap-2 text-slate-600 text-[11px] sm:pl-2 sm:border-l border-slate-200">
                  <span className="flex items-center gap-0.5" title="Saves">
                    <Bookmark className="w-3 h-3 text-amber-500" />
                    {formatCount(item.saves)}
                  </span>
                  <span className="flex items-center gap-0.5" title="Shares">
                    <Share2 className="w-3 h-3 text-indigo-500" />
                    {formatCount(item.shares)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
