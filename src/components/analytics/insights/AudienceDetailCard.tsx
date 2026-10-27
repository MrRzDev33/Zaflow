import React from 'react';
import { Users, MapPin } from 'lucide-react';
import type { AudienceDetails } from '../../../types/database.ts';
import { formatPercent } from '../../../utils/number.ts';

interface AudienceDetailCardProps {
  details: AudienceDetails | null | undefined;
  approximate?: boolean;
}

/** Rincian demografi pemirsa: usia, negara, dan jenis kelamin. */
export const AudienceDetailCard: React.FC<AudienceDetailCardProps> = ({
  details,
  approximate = false,
}) => {
  const ages = (details?.ages || []).filter((item) => Number(item.percentage) > 0);
  const countries = (details?.countries || []).filter((item) => Number(item.percentage) > 0);
  const gender = details?.gender;

  const hasGender =
    gender && (Number(gender.male) > 0 || Number(gender.female) > 0 || Number(gender.other) > 0);
  const hasAny = ages.length > 0 || countries.length > 0 || Boolean(hasGender);

  if (!hasAny) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[11px] text-slate-400">
        Detail pemirsa belum tersedia pada snapshot ini.
      </p>
    );
  }

  const maxAge = Math.max(...ages.map((item) => Number(item.percentage)), 1);

  return (
    <div className="space-y-4">
      {approximate && (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
          Sebagian data diperkirakan AI
        </span>
      )}

      {ages.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Users className="h-3 w-3" />
            Kelompok Usia
          </p>
          <div className="space-y-1.5">
            {ages.map((item) => (
              <div key={item.range} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-semibold text-slate-600">
                  {item.range}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(Number(item.percentage) / maxAge) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[10px] font-bold text-slate-800">
                  {formatPercent(item.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {countries.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <MapPin className="h-3 w-3" />
            Negara Teratas
          </p>
          <div className="space-y-1">
            {countries.map((item, index) => (
              <div
                key={`${item.country}-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
              >
                <span className="truncate font-medium text-slate-700">{item.country || '-'}</span>
                <span className="ml-2 shrink-0 font-bold text-slate-900">
                  {formatPercent(item.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasGender && gender && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Jenis Kelamin
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="bg-blue-500" style={{ width: `${Number(gender.male)}%` }} title="Laki-laki" />
            <div className="bg-pink-500" style={{ width: `${Number(gender.female)}%` }} title="Perempuan" />
            <div className="bg-slate-400" style={{ width: `${Number(gender.other)}%` }} title="Lainnya" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Laki-laki {formatPercent(gender.male)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              Perempuan {formatPercent(gender.female)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Lainnya {formatPercent(gender.other)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
