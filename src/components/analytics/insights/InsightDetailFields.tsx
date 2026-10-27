import React from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import type { ContentInsightsDetail } from '../../../types/database.ts';
import {
  AGE_RANGES,
  createEmptyInsightsDetail,
  getTrafficSourceFields,
  isVideoContentType,
  VIEW_FACTOR_CATALOG,
} from '../../../config/insights.ts';
import { DecimalInput, Field, FieldSection, IntegerInput } from './inputs.tsx';
import { formatPercent } from '../../../utils/number.ts';

interface InsightDetailFieldsProps {
  channel: string;
  contentType?: string | null;
  detail?: ContentInsightsDetail | null;
  onChange: (detail: ContentInsightsDetail) => void;
  /** Tampilkan sakelar "grafik diperkirakan AI". */
  showApproximate?: boolean;
}

/**
 * Panel input detail insight per postingan (khusus Instagram).
 * Semua field opsional: kosong berarti data belum tersedia, bukan nol.
 */
export const InsightDetailFields: React.FC<InsightDetailFieldsProps> = ({
  channel,
  contentType,
  detail,
  onChange,
  showApproximate = true,
}) => {
  const value = detail ?? createEmptyInsightsDetail();
  const audienceDetails = value.audienceDetails ?? { ages: [], countries: [], gender: null };
  const trafficFields = getTrafficSourceFields(channel);
  const showVideoFactors = isVideoContentType(contentType);

  const patch = (partial: Partial<ContentInsightsDetail>) => {
    onChange({ ...value, ...partial });
  };

  const patchAudience = (partial: Partial<ContentInsightsDetail['audience']>) => {
    patch({ audience: { ...value.audience, ...partial } });
  };

  const patchAudienceDetails = (partial: Partial<ContentInsightsDetail['audienceDetails']>) => {
    patch({ audienceDetails: { ...audienceDetails, ...partial } });
  };

  const setTraffic = (key: string, next: number) => {
    patch({ trafficSources: { ...value.trafficSources, [key]: next } });
  };

  const setFactor = (key: string, next: number) => {
    const existing = value.viewFactors?.length ? [...value.viewFactors] : [];
    const index = existing.findIndex((item) => item.key === key);
    if (index >= 0) {
      existing[index] = { ...existing[index], value: next };
    } else {
      const catalogItem = VIEW_FACTOR_CATALOG.find((item) => item.key === key);
      if (!catalogItem) return;
      existing.push({
        key,
        label: catalogItem.label,
        value: next,
        rank: existing.length + 1,
      });
    }
    // Urutan mengikuti katalog agar peringkat tetap konsisten.
    existing.sort(
      (a, b) =>
        VIEW_FACTOR_CATALOG.findIndex((item) => item.key === a.key) -
        VIEW_FACTOR_CATALOG.findIndex((item) => item.key === b.key)
    );
    patch({ viewFactors: existing.map((item, i) => ({ ...item, rank: i + 1 })) });
  };

  const getFactorValue = (key: string): number =>
    value.viewFactors?.find((item) => item.key === key)?.value ?? 0;

  const trafficTotal = trafficFields.reduce(
    (sum, field) => sum + Number(value.trafficSources?.[field.key] || 0),
    0
  );

  const setAge = (range: string, next: number) => {
    const others = (audienceDetails.ages || []).filter((item) => item.range !== range);
    const ages = next > 0 ? [...others, { range, percentage: next }] : others;
    ages.sort((a, b) => AGE_RANGES.indexOf(a.range) - AGE_RANGES.indexOf(b.range));
    patchAudienceDetails({ ages });
  };

  const getAgeValue = (range: string): number =>
    audienceDetails.ages?.find((item) => item.range === range)?.percentage ?? 0;

  const setCountry = (index: number, partial: { country?: string; percentage?: number }) => {
    const countries = (audienceDetails.countries || []).map((item, i) =>
      i === index ? { ...item, ...partial } : item
    );
    patchAudienceDetails({ countries });
  };

  return (
    <div className="space-y-3">
      <FieldSection
        title="Sumber Tayangan Teratas"
        description="Persentase asal tayangan. Isi hanya yang tampil di Instagram; kategori 0 akan disembunyikan."
        right={
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              trafficTotal > 0 && Math.abs(trafficTotal - 100) > 2
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
            title="Total persentase sebaiknya mendekati 100%"
          >
            Total {formatPercent(trafficTotal)}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {trafficFields.map((field) => (
            <Field key={field.key} label={field.label}>
              <DecimalInput
                value={Number(value.trafficSources?.[field.key] || 0)}
                onChange={(next) => setTraffic(String(field.key), next)}
                max={100}
                suffix="%"
                ariaLabel={`Sumber tayangan ${field.label}`}
              />
            </Field>
          ))}
        </div>
      </FieldSection>

      <FieldSection
        title="Pemirsa"
        description="Komposisi pengikut dan bukan pengikut pada konten ini."
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pengikut">
            <DecimalInput
              value={Number(value.audience?.followers || 0)}
              onChange={(next) => patchAudience({ followers: next })}
              max={100}
              suffix="%"
              ariaLabel="Persentase pengikut"
            />
          </Field>
          <Field label="Bukan Pengikut">
            <DecimalInput
              value={Number(value.audience?.non_followers || 0)}
              onChange={(next) => patchAudience({ non_followers: next })}
              max={100}
              suffix="%"
              ariaLabel="Persentase bukan pengikut"
            />
          </Field>
        </div>
      </FieldSection>

      {showVideoFactors && (
        <FieldSection
          title="Faktor yang Memengaruhi Tayangan"
          description="Jumlah interaksi yang dihitung Instagram, berurutan sesuai prioritas. Kosongkan jika tidak terbaca."
        >
          <div className="space-y-1.5">
            {VIEW_FACTOR_CATALOG.map((factor, index) => (
              <div key={factor.key} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                  {index + 1}
                </span>
                <span className="flex-1 text-[11px] text-slate-600">{factor.label}</span>
                <div className="w-24">
                  <IntegerInput
                    value={getFactorValue(factor.key)}
                    onChange={(next) => setFactor(factor.key, next)}
                    ariaLabel={factor.label}
                  />
                </div>
              </div>
            ))}
          </div>
        </FieldSection>
      )}

      <FieldSection
        title="Detail Pemirsa"
        description="Rincian demografi penonton. Tampilkan semua yang tersedia."
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Kelompok Usia
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AGE_RANGES.map((range) => (
                <Field key={range} label={`${range} tahun`}>
                  <DecimalInput
                    value={getAgeValue(range)}
                    onChange={(next) => setAge(range, next)}
                    max={100}
                    suffix="%"
                    ariaLabel={`Usia ${range}`}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Negara Teratas
              </p>
              <button
                type="button"
                onClick={() =>
                  patchAudienceDetails({
                    countries: [
                      ...(audienceDetails.countries || []),
                      { country: '', percentage: 0 },
                    ],
                  })
                }
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Plus className="h-3 w-3" />
                Tambah
              </button>
            </div>
            {(audienceDetails.countries || []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-400">
                Belum ada data negara.
              </p>
            ) : (
              <div className="space-y-1.5">
                {(audienceDetails.countries || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.country}
                      placeholder="Nama negara"
                      onChange={(e) => setCountry(index, { country: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="w-24 shrink-0">
                      <DecimalInput
                        value={Number(item.percentage || 0)}
                        onChange={(next) => setCountry(index, { percentage: next })}
                        max={100}
                        suffix="%"
                        ariaLabel={`Persentase negara ${item.country || index + 1}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        patchAudienceDetails({
                          countries: (audienceDetails.countries || []).filter(
                            (_, i) => i !== index
                          ),
                        })
                      }
                      className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Hapus negara"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Jenis Kelamin
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Laki-laki">
                <DecimalInput
                  value={Number(audienceDetails.gender?.male || 0)}
                  onChange={(next) =>
                    patchAudienceDetails({
                      gender: {
                        male: next,
                        female: Number(audienceDetails.gender?.female || 0),
                        other: Number(audienceDetails.gender?.other || 0),
                      },
                    })
                  }
                  max={100}
                  suffix="%"
                  ariaLabel="Pemirsa laki-laki"
                />
              </Field>
              <Field label="Perempuan">
                <DecimalInput
                  value={Number(audienceDetails.gender?.female || 0)}
                  onChange={(next) =>
                    patchAudienceDetails({
                      gender: {
                        male: Number(audienceDetails.gender?.male || 0),
                        female: next,
                        other: Number(audienceDetails.gender?.other || 0),
                      },
                    })
                  }
                  max={100}
                  suffix="%"
                  ariaLabel="Pemirsa perempuan"
                />
              </Field>
              <Field label="Lainnya">
                <DecimalInput
                  value={Number(audienceDetails.gender?.other || 0)}
                  onChange={(next) =>
                    patchAudienceDetails({
                      gender: {
                        male: Number(audienceDetails.gender?.male || 0),
                        female: Number(audienceDetails.gender?.female || 0),
                        other: next,
                      },
                    })
                  }
                  max={100}
                  suffix="%"
                  ariaLabel="Pemirsa lainnya"
                />
              </Field>
            </div>
          </div>
        </div>
      </FieldSection>

      {showApproximate && (
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <input
            type="checkbox"
            checked={Boolean(value.approximate)}
            onChange={(e) => patch({ approximate: e.target.checked })}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-[11px] leading-snug text-slate-600">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Info className="h-3 w-3" />
              Grafik diperkirakan AI
            </span>
            Aktifkan jika deret grafik hanya perkiraan dari gambar dan bukan angka pasti.
          </span>
        </label>
      )}
    </div>
  );
};
