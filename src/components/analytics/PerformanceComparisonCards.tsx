import React from 'react';
import {
  Eye,
  Users,
  HeartHandshake,
  TrendingUp,
  Bookmark,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { PeriodComparison } from '../../services/database/metricsService.ts';

interface PerformanceComparisonCardsProps {
  comparison: PeriodComparison;
  periodLabel: string;
}

export const PerformanceComparisonCards: React.FC<PerformanceComparisonCardsProps> = ({
  comparison,
  periodLabel,
}) => {
  const { current, changes } = comparison;

  const renderDelta = (percent: number) => {
    if (percent === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          <Minus className="w-3 h-3" />
          <span>0%</span>
        </span>
      );
    }
    const isPositive = percent > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded ${
          isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
        }`}
      >
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        <span>{isPositive ? `+${percent}%` : `${percent}%`}</span>
      </span>
    );
  };

  const cards = [
    {
      title: 'Total Tayangan (Impressions)',
      value: current.totalImpressions.toLocaleString('id-ID'),
      delta: changes.impressionsPercent,
      icon: Eye,
      iconColor: 'text-blue-600 bg-blue-50',
      subtitle: `${comparison.previous.totalImpressions.toLocaleString('id-ID')} pada periode sebelumnya`,
    },
    {
      title: 'Total Jangkauan (Reach)',
      value: current.totalReach.toLocaleString('id-ID'),
      delta: changes.reachPercent,
      icon: Users,
      iconColor: 'text-purple-600 bg-purple-50',
      subtitle: `${comparison.previous.totalReach.toLocaleString('id-ID')} pada periode sebelumnya`,
    },
    {
      title: 'Total Keterlibatan (Engagements)',
      value: current.totalEngagements.toLocaleString('id-ID'),
      delta: changes.engagementsPercent,
      icon: HeartHandshake,
      iconColor: 'text-pink-600 bg-pink-50',
      subtitle: `Suka (${current.totalLikes}), Komen (${current.totalComments})`,
    },
    {
      title: 'Engagement Rate Rata-Rata',
      value: `${current.engagementRate}%`,
      delta: changes.engagementRateDelta,
      icon: TrendingUp,
      iconColor: 'text-emerald-600 bg-emerald-50',
      subtitle: `Basis: ${current.totalReach > 0 ? 'Reach Unik' : 'Tayangan'}`,
    },
    {
      title: 'Total Disimpan (Saves)',
      value: current.totalSaves.toLocaleString('id-ID'),
      delta: changes.savesPercent,
      icon: Bookmark,
      iconColor: 'text-amber-600 bg-amber-50',
      subtitle: `Save Rate: ${current.saveRate}% dari reach`,
    },
    {
      title: 'Total Dibagikan (Shares)',
      value: current.totalShares.toLocaleString('id-ID'),
      delta: changes.sharesPercent,
      icon: Share2,
      iconColor: 'text-indigo-600 bg-indigo-50',
      subtitle: `Share Rate: ${current.shareRate}% dari reach`,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="font-semibold text-slate-700">Perbandingan Performa ({periodLabel} vs Periode Sebelumnya)</span>
        <span>Persentase kenaikan/penurunan dihitung otomatis</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {c.title}
                </span>
                <div className={`p-2 rounded-lg ${c.iconColor} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {c.value}
                  </span>
                  {renderDelta(c.delta)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{c.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
