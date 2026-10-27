import React from 'react';
import type { RetentionPoint } from '../../../types/database.ts';

interface RetentionChartProps {
  points: RetentionPoint[];
  approximate?: boolean;
}

/**
 * Kurva retensi penonton: sumbu X posisi video (0–100%), sumbu Y penonton
 * tersisa (0–100%). Hanya dirender jika ada minimal dua titik.
 */
export const RetentionChart: React.FC<RetentionChartProps> = ({ points, approximate = false }) => {
  const valid = (points || []).filter(
    (point) =>
      Number.isFinite(Number(point.percent)) && Number.isFinite(Number(point.retention))
  );

  if (valid.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center">
        <p className="text-[11px] font-semibold text-slate-500">Retensi Penonton</p>
        <p className="mt-1 text-[10px] text-slate-400">
          Kurva retensi belum tersedia. Data tidak terbaca dengan jelas.
        </p>
      </div>
    );
  }

  const width = 320;
  const height = 150;
  const padding = { top: 12, right: 10, bottom: 20, left: 26 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const sorted = [...valid].sort((a, b) => Number(a.percent) - Number(b.percent));

  const coords = sorted.map((point) => {
    const x = padding.left + (clamp(Number(point.percent)) / 100) * innerW;
    const y = padding.top + innerH - (clamp(Number(point.retention)) / 100) * innerH;
    return { x, y, point };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${
    padding.top + innerH
  } L${coords[0].x.toFixed(1)},${padding.top + innerH} Z`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-slate-700">Retensi Penonton</p>
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
        aria-label="Kurva retensi penonton"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding.top + innerH - (tick / 100) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={padding.left - 4} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 7 }}>
                {tick}%
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="rgba(16, 185, 129, 0.12)" />
        <path d={linePath} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c, index) => (
          <circle key={index} cx={c.x} cy={c.y} r="2" fill="#059669" />
        ))}

        <text x={padding.left} y={height - 5} className="fill-slate-400" style={{ fontSize: 8 }}>
          0%
        </text>
        <text
          x={width - padding.right}
          y={height - 5}
          textAnchor="end"
          className="fill-slate-400"
          style={{ fontSize: 8 }}
        >
          100% durasi
        </text>
      </svg>
    </div>
  );
};
