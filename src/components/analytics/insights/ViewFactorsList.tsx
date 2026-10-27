import React from 'react';
import type { ViewFactorItem } from '../../../types/database.ts';
import { VIEW_FACTOR_CATALOG } from '../../../config/insights.ts';
import { formatCount } from '../../../utils/number.ts';

interface ViewFactorsListProps {
  factors: ViewFactorItem[];
}

const FACTOR_HINTS: Record<string, string> = {
  skip: 'Semakin sedikit yang melewati, semakin baik.',
  share: 'Bagikan menandakan konten layak diteruskan.',
  like: 'Suka adalah sinyal relevansi utama.',
  save: 'Simpan menandakan nilai jangka panjang.',
  repost: 'Posting ulang memperluas jangkauan organik.',
  comment: 'Komentar menandakan percakapan aktif.',
};

/**
 * Faktor yang memengaruhi tayangan, berurutan sesuai prioritas Instagram.
 * Nilai 0 tetap ditampilkan agar urutan prioritas tetap terlihat.
 */
export const ViewFactorsList: React.FC<ViewFactorsListProps> = ({ factors }) => {
  const ordered = [...(factors || [])].sort((a, b) => {
    const indexA = VIEW_FACTOR_CATALOG.findIndex((item) => item.key === a.key);
    const indexB = VIEW_FACTOR_CATALOG.findIndex((item) => item.key === b.key);
    return (indexA < 0 ? 99 : indexA) - (indexB < 0 ? 99 : indexB);
  });

  const max = Math.max(...ordered.map((item) => Number(item.value) || 0), 1);

  if (ordered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
        Faktor tayangan tidak tersedia pada snapshot ini.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((factor, index) => (
        <div key={factor.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                {factor.rank || index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-700">{factor.label}</p>
                <p className="text-[10px] leading-snug text-slate-400">
                  {FACTOR_HINTS[factor.key] || 'Sinyal interaksi yang dihitung Instagram.'}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-extrabold text-slate-900">
              {formatCount(factor.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.max(2, (Number(factor.value) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
