import React, { useMemo, useState } from 'react';
import {
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
// Tinggi minimum agar nilai kecil tetap terlihat.
const MIN_BAR_HEIGHT = 4;

/**
 * Tingkat skala vertikal. Nilai > 1 memakai skala pangkat (gamma < 1) sehingga
 * batang bernilai kecil mendapat porsi tinggi lebih besar dan grafik tidak
 * terlalu jomplang saat ada satu nilai yang jauh lebih tinggi.
 */
const SCALE_LEVELS = [1, 1.5, 2, 3] as const;

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

/**
 * Mengubah nilai menjadi rasio tinggi 0..1. Dengan skala 1 hasilnya linear.
 * Dengan skala > 1, nilai kecil dinaikkan porsinya secara non-linear.
 */
function heightRatio(value: number, max: number, gamma: number): number {
  if (max <= 0 || value <= 0) return 0;
  const normalized = Math.min(1, value / max);
  return Math.pow(normalized, gamma);
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [metricKey, setMetricKey] = useState<'impressions' | 'reach' | 'engagements'>('reach');
  const [hoveredPoint, setHoveredPoint] = useState<DailyTrendPoint | null>(null);
  const [scaleIndex, setScaleIndex] = useState(0);

  const metricConfigs = {
    reach: { label: 'Jangkauan (Reach)', color: 'bg-purple-600' },
    impressions: { label: 'Tayangan (Impressions)', color: 'bg-blue-600' },
    engagements: { label: 'Keterlibatan (Engagements)', color: 'bg-pink-600' },
  };

  const scaleMultiplier = SCALE_LEVELS[scaleIndex];
  // Skala 2× setara akar kuadrat; nilai kecil naik lebih banyak daripada nilai besar.
  const gamma = 1 / scaleMultiplier;

  const maxValue = useMemo(() => {
    let max = 0;
    for (const d of data) {
      if (d[metricKey] > max) max = d[metricKey];
    }
    return max;
  }, [data, metricKey]);

  // Skala dimulai dari 0 agar tinggi batang tetap proporsional.
  const { niceMax, ticks } = useMemo(() => {
    const step = niceStep(Math.max(maxValue, 1) / TICK_COUNT);
    const scaleMax = step * TICK_COUNT;
    return {
      niceMax: scaleMax,
      ticks: Array.from({ length: TICK_COUNT + 1 }, (_, index) => step * index),
    };
  }, [maxValue]);

  const total = useMemo(() => {
    return data.reduce((acc, curr) => acc + (curr[metricKey] || 0), 0);
  }, [data, metricKey]);

  const setScale = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, SCALE_LEVELS.length - 1));
    setScaleIndex(clamped);
    setHoveredPoint(null);
  };

  const bottomPercent = (value: number) => heightRatio(value, niceMax, gamma) * 100;
  const isScaled = scaleIndex > 0;

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
            {data.length} tanggal pada periode yang dipilih
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

          {/* Skala vertikal: menaikkan porsi tinggi nilai kecil, bukan menggeser tanggal */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
            <span className="px-1 text-[10px] font-semibold text-slate-500">Skala</span>
            <button
              type="button"
              onClick={() => setScale(scaleIndex - 1)}
              disabled={scaleIndex === 0}
              aria-label="Kurangi skala vertikal"
              title="Kurangi skala vertikal"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span
              className={`min-w-[38px] text-center text-[10px] font-bold ${
                isScaled ? 'text-blue-600' : 'text-slate-400'
              }`}
              title="Skala vertikal grafik"
            >
              {scaleMultiplier}×
            </span>
            <button
              type="button"
              onClick={() => setScale(scaleIndex + 1)}
              disabled={scaleIndex === SCALE_LEVELS.length - 1}
              aria-label="Perbesar nilai kecil"
              title="Perbesar nilai kecil"
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale(0)}
              disabled={!isScaled}
              aria-label="Reset skala vertikal"
              title="Reset skala vertikal"
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
            {/* Y-axis labels: posisi mengikuti skala vertikal yang dipilih */}
            <div
              className="relative w-12 shrink-0 text-right text-[10px] text-slate-400"
              style={{ height: CHART_HEIGHT }}
            >
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-0 leading-none"
                  style={{
                    bottom: `${bottomPercent(tick)}%`,
                    transform: 'translateY(50%)',
                  }}
                >
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
                {/* Grid lines mengikuti posisi skala vertikal */}
                <div className="absolute inset-0 pointer-events-none">
                  {ticks.slice(1).map((tick) => (
                    <div
                      key={tick}
                      className="absolute inset-x-0 border-t border-dashed border-slate-200"
                      style={{ bottom: `${bottomPercent(tick)}%` }}
                    />
                  ))}
                </div>

                {/* Columns */}
                <div className="absolute inset-0 flex items-end gap-[2px] px-1">
                  {data.map((point) => {
                    const val = point[metricKey] || 0;
                    const heightPx = heightRatio(val, niceMax, gamma) * CHART_HEIGHT;
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
                <span>{data[0]?.formattedDate}</span>
                <span className="hidden sm:inline-block text-slate-300">• • •</span>
                <span>{data[Math.floor(data.length / 2)]?.formattedDate}</span>
                <span className="hidden sm:inline-block text-slate-300">• • •</span>
                <span>{data[data.length - 1]?.formattedDate}</span>
              </div>

              {isScaled && (
                <p className="mt-1 text-center text-[10px] text-slate-400">
                  Skala vertikal {scaleMultiplier}×: nilai kecil ditinggikan agar perbedaan tidak
                  terlalu jomplang. Tanggal yang ditampilkan tetap semua.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
