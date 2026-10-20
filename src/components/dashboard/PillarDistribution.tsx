import React from 'react';
import { PieChart } from 'lucide-react';

interface PillarDistributionProps {
  distribution: { pillar: string; count: number }[];
  total: number;
}

export const PillarDistribution: React.FC<PillarDistributionProps> = ({ distribution, total }) => {
  const pillarColors: Record<string, string> = {
    Edukatif: 'bg-[#007AFF]',
    Promosi: 'bg-[#34C759]',
    Interaktif: 'bg-[#5856D6]',
    Inspiratif: 'bg-[#FF9500]',
    'Behind The Scenes': 'bg-[#FF2D55]',
    Hiburan: 'bg-[#AF52DE]',
    Lainnya: 'bg-slate-400',
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#5856D6]/10 text-[#5856D6] flex items-center justify-center">
            <PieChart className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Distribusi Pilar Konten</h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">{total} Total Post</span>
      </div>

      {distribution.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Belum ada postingan terdaftar. Buat konten pertama untuk melihat proporsi pilar.
        </div>
      ) : (
        <div className="space-y-3.5">
          {distribution.map((item) => {
            const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barColor = pillarColors[item.pillar] || 'bg-[#007AFF]';

            return (
              <div key={item.pillar} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.pillar}</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {item.count} post ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-black/[0.05] rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all duration-300 shadow-2xs`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
