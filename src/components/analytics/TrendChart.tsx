import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { DailyTrendPoint } from '../../services/database/metricsService.ts';

interface TrendChartProps {
  data: DailyTrendPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [metricKey, setMetricKey] = useState<'impressions' | 'reach' | 'engagements'>('reach');
  const [hoveredPoint, setHoveredPoint] = useState<DailyTrendPoint | null>(null);

  const metricConfigs = {
    reach: { label: 'Jangkauan (Reach)', color: 'bg-purple-600', stroke: '#9333ea', bgHex: '#f3e8ff' },
    impressions: { label: 'Tayangan (Impressions)', color: 'bg-blue-600', stroke: '#2563eb', bgHex: '#dbeafe' },
    engagements: { label: 'Keterlibatan (Engagements)', color: 'bg-pink-600', stroke: '#db2777', bgHex: '#fce7f3' },
  };

  const maxValue = useMemo(() => {
    let max = 0;
    for (const d of data) {
      if (d[metricKey] > max) max = d[metricKey];
    }
    return max > 0 ? max : 100;
  }, [data, metricKey]);

  // Aggregate total for the selected metric
  const total = useMemo(() => {
    return data.reduce((acc, curr) => acc + (curr[metricKey] || 0), 0);
  }, [data, metricKey]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
      {/* Chart Top Header & Metric switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Tren Metrik Historis Berdasarkan Tanggal Snapshot</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {total.toLocaleString('id-ID')} {metricConfigs[metricKey].label} dalam periode yang dipilih
          </p>
        </div>

        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 self-start sm:self-auto text-xs">
          {(['reach', 'impressions', 'engagements'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setMetricKey(key)}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer capitalize ${
                metricKey === key
                  ? 'bg-white shadow-2xs font-semibold text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {key === 'reach' ? 'Reach' : key === 'impressions' ? 'Impressions' : 'Engagements'}
            </button>
          ))}
        </div>
      </div>

      {/* Bar / Column Chart Visual */}
      {data.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Belum ada data snapshot metrik pada rentang tanggal ini.
        </div>
      ) : (
        <div className="relative pt-6 pb-2">
          {/* Tooltip on hover */}
          {hoveredPoint && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 pointer-events-none">
              <span className="font-semibold">{hoveredPoint.formattedDate}:</span>
              <span className="text-blue-300 font-bold">{hoveredPoint[metricKey].toLocaleString('id-ID')}</span>
              <span className="text-slate-400 text-[10px]">
                (Suka: {hoveredPoint.likes}, Simpan: {hoveredPoint.saves})
              </span>
            </div>
          )}

          {/* Columns Grid */}
          <div className="h-44 flex items-end gap-1.5 sm:gap-2 px-1 border-b border-slate-200">
            {data.map((point) => {
              const val = point[metricKey] || 0;
              const heightPercent = maxValue > 0 ? Math.max(4, Math.round((val / maxValue) * 100)) : 4;
              const isZero = val === 0;

              return (
                <div
                  key={point.date}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                      isZero
                        ? 'bg-slate-100 hover:bg-slate-200'
                        : `${metricConfigs[metricKey].color} opacity-85 group-hover:opacity-100 group-hover:brightness-110`
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Dates bottom label */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 px-1">
            <span>{data[0]?.formattedDate}</span>
            <span className="hidden sm:inline-block text-slate-300">• • •</span>
            <span>{data[Math.floor(data.length / 2)]?.formattedDate}</span>
            <span className="hidden sm:inline-block text-slate-300">• • •</span>
            <span>{data[data.length - 1]?.formattedDate}</span>
          </div>
        </div>
      )}
    </div>
  );
};
