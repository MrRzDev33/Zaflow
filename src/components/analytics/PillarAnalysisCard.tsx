import React from 'react';
import { PieChart } from 'lucide-react';
import { PillarPerformance } from '../../services/database/metricsService.ts';

interface PillarAnalysisCardProps {
  pillars: PillarPerformance[];
}

export const PillarAnalysisCard: React.FC<PillarAnalysisCardProps> = ({ pillars }) => {
  const maxReach = Math.max(...pillars.map((p) => p.totalReach), 100);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Perbandingan Performa per Pilar Konten</h2>
        </div>
        <span className="text-xs text-slate-500">{pillars.length} Pilar Aktif</span>
      </div>

      {pillars.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Belum ada data pilar yang tercatat pada periode ini.
        </div>
      ) : (
        <div className="space-y-3">
          {pillars.map((item) => {
            const reachPercent = Math.max(5, Math.round((item.totalReach / maxReach) * 100));

            return (
              <div key={item.pillar} className="space-y-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.pillar}</span>
                    <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      {item.postCount} post
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <span className="font-semibold text-slate-700">
                      Reach: {item.totalReach.toLocaleString('id-ID')}
                    </span>
                    <span className="font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                      ER: {item.averageER}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${reachPercent}%` }}
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
