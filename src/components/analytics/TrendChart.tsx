import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  TrendingUp,
} from '../common/icons/lucide-compat.tsx';
import { DailyTrendPoint } from '../../services/database/metricsService.ts';
import { formatCount, formatDecimal } from '../../utils/number.ts';

interface TrendChartProps {
  data: DailyTrendPoint[];
}

const CHART_HEIGHT = 224;
const TICK_COUNT = 4;
// Nilai kecil tetap terlihat tanpa menghilangkan proporsi relatif batang.
const MIN_BAR_HEIGHT = 10;
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;

/** Membulatkan langkah sumbu Y ke angka yang mudah dibaca (1, 2, 2.5, 5, 10). */
function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return niceFraction * 10 ** exponent;
}

/** Label sumbu Y yang ringkas agar tidak memotong lebar chart. */
function formatAxisValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} jt`;
  if (absolute >= 1_000) return `${formatDecimal(value / 1_000, 1)} rb`;
  return Number.isInteger(value) ? formatCount(value) : formatDecimal(value, 1);
}

function windowSizeFor(total: number, zoom: number): number {
  if (zoom <= 1) return total;
  return Math.min(total, Math.max(4, Math.ceil(total / zoom)));
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [metricKey, setMetricKey] = useState<'impressions' | 'reach' | 'engagements'>('reach');
  const [hoveredPoint, setHoveredPoint] = useState<DailyTrendPoint | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [windowStart, setWindowStart] = useState(0);

  const metricConfigs = {
    reach: { label: 'Jangkauan (Reach)', color: 'bg-purple-600' },
    impressions: { label: 'Tayangan (Impressions)', color: 'bg-blue-600' },
    engagements: { label: 'Keterlibatan (Engagements)', color: 'bg-pink-600' },
  };

  const zoom = ZOOM_LEVELS[zoomIndex];
  const windowSize = windowSizeFor(data.length, zoom);

  // Pastikan posisi jendela zoom tetap valid saat data/zoom berubah.
  useEffect(() => {
    const maxStart = Math.max(0, data.length - windowSize);
    setWindowStart((prev) => Math.min(Math.max(0, prev), maxStart));
  }, [data.length, windowSize]);

  const visibleData = useMemo(() => {
    if (windowSize >= data.length) return data;
    return data.slice(windowStart, windowStart + windowSize);
  }, [data, windowSize, windowStart]);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const d of visibleData) {
      if (d[metricKey] > max) max = d[metricKey];
    }
    return max;
  }, [visibleData, metricKey]);

  // Skala dimulai dari 0 agar tinggi batang benar-benar proporsional terhadap nilai.
  const { niceMax, ticks } = useMemo(() => {
    const step = niceStep(Math.max(maxValue, 1) / TICK_COUNT);
    const scaleMax = step * TICK_COUNT;
    return {
      niceMax: scaleMax,
      ticks: Array.from({ length: TICK_COUNT + 1 }, (_, index) => step * index),
    };
  }, [maxValue]);

  // Total mengikuti rentang yang sedang ditampilkan agar konsisten dengan grafik.
  const total = useMemo(() => {
    return visibleData.reduce((acc, curr) => acc + (curr[metricKey] || 0), 0);
  }, [visibleData, metricKey]);

  const applyZoom = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, ZOOM_LEVELS.length - 1));
    const nextZoom = ZOOM_LEVELS[clamped];
    const nextSize = windowSizeFor(data.length, nextZoom);
    setZoomIndex(clamped);
    // Saat memperbesar, tampilkan data terbaru terlebih dahulu.
    setWindowStart(Math.max(0, data.length - nextSize));
    setHoveredPoint(null);
  };

  const panWindow = (direction: -1 | 1) => {
    if (windowSize >= data.length) return;
    const step = Math.max(1, Math.floor(windowSize / 2));
    const maxStart = Math.max(0, data.length - windowSize);
    setWindowStart((prev) => Math.min(Math.max(0, prev + direction * step), maxStart));
    setHoveredPoint(null);
  };

  const isZoomed = zoom > 1 && windowSize < data.length;
  const canPanLeft = isZoomed && windowStart > 0;
  const canPanRight = isZoomed && windowStart + windowSize < data.length;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
      {/* Chart Top Header & Metric switch */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Tren Metrik Berdasarkan Jadwal Posting</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {formatCount(total)} {metricConfigs[metricKey].label} dari{' '}
            {isZoomed ? `${visibleData.length} tanggal yang ditampilkan` : 'postingan pada periode yang dipilih'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
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

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
            <button
              type="button"
              onClick={() => panWindow(-1)}
              disabled={!canPanLeft}
              aria-label="Geser rentang ke kiri"
              title="Geser ke kiri"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyZoom(zoomIndex - 1)}
              disabled={zoomIndex === 0}
              aria-label="Perkecil zoom"
              title="Zoom out"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span
              className={`min-w-[38px] text-center text-[10px] font-bold ${
                isZoomed ? 'text-blue-600' : 'text-slate-400'
              }`}
              title="Tingkat zoom grafik"
            >
              {zoom}×
            </span>
            <button
              type="button"
              onClick={() => applyZoom(zoomIndex + 1)}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1 || data.length <= 4}
              aria-label="Perbesar zoom"
              title="Zoom in"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => panWindow(1)}
              disabled={!canPanRight}
              aria-label="Geser rentang ke kanan"
              title="Geser ke kanan"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyZoom(0)}
              disabled={!isZoomed}
              aria-label="Reset zoom"
              title="Reset zoom"
              className="ml-0.5 rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bar / Column Chart Visual */}
      {data.length === 0 || maxValue <= 0 ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Belum ada nilai {metricConfigs[metricKey].label} pada rentang tanggal ini.
        </div>
      ) : (
        <div className="relative pt-6 pb-2">
          {/* Tooltip on hover */}
          {hoveredPoint && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 pointer-events-none whitespace-nowrap">
              <span className="font-semibold">{hoveredPoint.formattedDate}:</span>
              <span className="text-blue-300 font-bold">
                {formatCount(hoveredPoint[metricKey])}
              </span>
              <span className="text-slate-400 text-[10px]">
                ({hoveredPoint.postCount} posting • Suka: {formatCount(hoveredPoint.likes)}, Simpan:{' '}
                {formatCount(hoveredPoint.saves)})
              </span>
            </div>
          )}

          <div className="flex gap-3">
            {/* Y-axis labels */}
            <div
              className="w-12 shrink-0 flex flex-col justify-between text-right text-[10px] text-slate-400"
              style={{ height: CHART_HEIGHT }}
            >
              {[...ticks].reverse().map((tick) => (
                <span key={tick} className="leading-none">
                  {formatAxisValue(tick)}
                </span>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              {/* Plot area */}
              <div
                className="relative border-b border-slate-300"
                style={{ height: CHART_HEIGHT }}
              >
                {/* Grid lines at each Y tick */}
                <div className="absolute inset-0 pointer-events-none">
                  {ticks.slice(1).map((tick) => (
                    <div
                      key={tick}
                      className="absolute inset-x-0 border-t border-dashed border-slate-200"
                      style={{ bottom: `${(tick / niceMax) * 100}%` }}
                    />
                  ))}
                </div>

                {/* Columns */}
                <div className="absolute inset-0 flex items-end gap-[3px] px-1">
                  {visibleData.map((point) => {
                    const val = point[metricKey] || 0;
                    const heightPx = (val / niceMax) * CHART_HEIGHT;
                    const isZero = val === 0;

                    return (
                      <div
                        key={point.date}
                        onMouseEnter={() => setHoveredPoint(point)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      >
                        <div
                          style={{
                            height: `${isZero ? 2 : Math.max(MIN_BAR_HEIGHT, heightPx)}px`,
                          }}
                          className={`w-full max-w-[34px] rounded-t-md transition-all duration-300 ${
                            isZero
                              ? 'bg-slate-200 group-hover:bg-slate-300'
                              : `${metricConfigs[metricKey].color} opacity-85 group-hover:opacity-100 group-hover:brightness-110`
                          }`}
                          title={`${point.formattedDate}: ${formatCount(val)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dates bottom label */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 px-1">
                <span>{visibleData[0]?.formattedDate}</span>
                <span className="hidden sm:inline-block text-slate-300">• • •</span>
                <span>{visibleData[Math.floor(visibleData.length / 2)]?.formattedDate}</span>
                <span className="hidden sm:inline-block text-slate-300">• • •</span>
                <span>{visibleData[visibleData.length - 1]?.formattedDate}</span>
              </div>

              {isZoomed && (
                <p className="mt-1 text-center text-[10px] text-slate-400">
                  Menampilkan {visibleData.length} dari {data.length} tanggal. Gunakan panah untuk
                  menggeser rentang.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
