import React from 'react';
import type { InsightSeriesPoint } from '../../../types/database.ts';
import { formatCount } from '../../../utils/number.ts';

interface MiniLineChartProps {
  points: InsightSeriesPoint[];
  label: string;
  color?: string;
  fill?: string;
  approximate?: boolean;
  height?: number;
}

/**
 * Grafik garis SVG sederhana tanpa library.
 * Menampilkan label awal/akhir dan nilai tertinggi.
 */
export const MiniLineChart: React.FC<MiniLineChartProps> = ({
  points,
  label,
  color = '#2563eb',
  fill = 'rgba(37, 99, 235, 0.12)',
  approximate = false,
  height = 120,
}) => {
  const valid = (points || []).filter(
    (point) => Number.isFinite(Number(point.value)) && String(point.label || '').trim() !== ''
  );

  if (valid.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-[10px] text-slate-400">
          Grafik belum tersedia. Data deret tidak terbaca dengan jelas.
        </p>
      </div>
    );
  }

  const width = 320;
  const padding = { top: 10, right: 8, bottom: 18, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = valid.map((point) => Number(point.value));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const coords = valid.map((point, index) => {
    const x = padding.left + (index / (valid.length - 1)) * innerW;
    const y = padding.top + innerH - ((Number(point.value) - min) / range) * innerH;
    return { x, y, point };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${
    padding.top + innerH
  } L${coords[0].x.toFixed(1)},${padding.top + innerH} Z`;

  const peak = coords.reduce((best, current) =>
    Number(current.point.value) > Number(best.point.value) ? current : best
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-slate-700">{label}</p>
        {approximate && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            Perkiraan AI
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}: ${valid.length} titik data`}
      >
        <path d={areaPath} fill={fill} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, index) => (
          <circle key={index} cx={c.x} cy={c.y} r={index === coords.length - 1 ? 3 : 2} fill={color} />
        ))}
        <text
          x={Math.min(width - 30, Math.max(30, peak.x))}
          y={Math.max(10, peak.y - 5)}
          textAnchor="middle"
          className="fill-slate-500"
          style={{ fontSize: 9, fontWeight: 700 }}
        >
          {formatCount(peak.point.value)}
        </text>
        <text x={padding.left} y={height - 4} className="fill-slate-400" style={{ fontSize: 8 }}>
          {valid[0].label}
        </text>
        <text
          x={width - padding.right}
          y={height - 4}
          textAnchor="end"
          className="fill-slate-400"
          style={{ fontSize: 8 }}
        >
          {valid[valid.length - 1].label}
        </text>
      </svg>
    </div>
  );
};
