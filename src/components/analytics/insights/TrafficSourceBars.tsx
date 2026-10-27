import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { TrafficSourceItem } from '../../../config/insights.ts';
import { formatPercent } from '../../../utils/number.ts';

interface TrafficSourceBarsProps {
  items: TrafficSourceItem[];
  emptyText?: string;
  compact?: boolean;
}

const BAR_COLORS: Record<string, string> = {
  stories: 'bg-amber-500',
  profile: 'bg-emerald-600',
  feed: 'bg-purple-600',
  reels: 'bg-pink-600',
  explore: 'bg-blue-600',
  other: 'bg-slate-500',
};

/** Daftar sumber tayangan, diurutkan dari persentase terbesar. */
export const TrafficSourceBars: React.FC<TrafficSourceBarsProps> = ({
  items,
  emptyText = 'Belum ada data sumber tayangan.',
  compact = false,
}) => {
  if (!items || items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
        {emptyText}
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {items.map((item) => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-700">
              <BarChart3 className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-bold text-slate-900">
              {formatPercent(item.percentage)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${BAR_COLORS[item.key] || 'bg-slate-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
