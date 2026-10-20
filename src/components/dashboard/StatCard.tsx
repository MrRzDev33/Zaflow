import React, { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  badge?: { text: string; positive?: boolean };
  icon?: ReactNode;
  chartType?: 'bars' | 'donut' | 'signal';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon,
  chartType,
}) => {
  return (
    <div className="astra-card p-4 sm:p-5 flex flex-col justify-between transition-all hover:translate-y-[-1px]">
      {/* Top Header */}
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-semibold text-slate-700 tracking-tight">{title}</span>
        {icon ? (
          <div className="text-slate-400">{icon}</div>
        ) : (
          <button className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Metric & Visual Chart */}
      <div className="flex items-end justify-between gap-3 mt-1">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {value}
            </span>
            {badge && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                badge.positive !== false
                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/20'
              }`}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[150px]">{subtitle}</p>
          )}
        </div>

        {/* Mini Astra Visual Elements */}
        {chartType === 'bars' && (
          <div className="flex items-end gap-1 h-8 shrink-0 pb-1">
            <div className="w-1.5 h-3 bg-blue-300 rounded-full" />
            <div className="w-1.5 h-5 bg-blue-400 rounded-full" />
            <div className="w-1.5 h-2 bg-blue-300 rounded-full" />
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <div className="w-1.5 h-4 bg-indigo-400 rounded-full" />
            <div className="w-1.5 h-7 bg-blue-600 rounded-full" />
          </div>
        )}

        {chartType === 'donut' && (
          /* Astra colorful Donut Ring (Cyan, Green, Yellow, Orange, Purple) */
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="4.5" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="url(#astra-donut-grad)"
                strokeWidth="4.5"
                strokeDasharray="75 100"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="astra-donut-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06B6D4" />
                  <stop offset="25%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="75%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}

        {chartType === 'signal' && (
          <div className="flex items-end gap-1 h-7 shrink-0 pb-1">
            <div className="w-1.5 h-3 bg-indigo-300 rounded-full" />
            <div className="w-1.5 h-5 bg-indigo-400 rounded-full" />
            <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};
