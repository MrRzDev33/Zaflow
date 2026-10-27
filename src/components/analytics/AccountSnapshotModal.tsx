import React, { useEffect, useState } from 'react';
import { X, Save, Loader2, UserRound, AlertCircle, CalendarRange } from 'lucide-react';
import { AccountMetric, TrafficSourceBreakdown } from '../../types/database.ts';
import { metricsService, metricFormulas } from '../../services/database/metricsService.ts';
import { getPlatformName } from '../../config/platforms.ts';
import { getTrafficSourceFields } from '../../config/insights.ts';
import { DecimalInput, Field, FieldSection, IntegerInput } from './insights/inputs.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface AccountSnapshotModalProps {
  isOpen: boolean;
  brandId: string;
  platforms: string[];
  initialPeriodMonth?: string | null;
  initialChannel?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface AccountForm {
  views: number;
  reach: number;
  interactions: number;
  profileVisits: number;
  follows: number;
  followersTotal: number;
  trafficSources: TrafficSourceBreakdown;
  audienceFollowers: number;
  audienceNonFollowers: number;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const EMPTY_FORM: AccountForm = {
  views: 0,
  reach: 0,
  interactions: 0,
  profileVisits: 0,
  follows: 0,
  followersTotal: 0,
  trafficSources: {},
  audienceFollowers: 0,
  audienceNonFollowers: 0,
};

function toForm(metric: AccountMetric | null): AccountForm {
  if (!metric) return { ...EMPTY_FORM, trafficSources: {} };
  return {
    views: Number(metric.views) || 0,
    reach: Number(metric.reach) || 0,
    interactions: Number(metric.interactions_total) || 0,
    profileVisits: Number(metric.profile_visits) || 0,
    follows: Number(metric.follows) || 0,
    followersTotal: Number(metric.followers_total) || 0,
    trafficSources: { ...(metric.traffic_sources || {}) },
    audienceFollowers: Number(metric.audience_breakdown?.followers || 0),
    audienceNonFollowers: Number(metric.audience_breakdown?.non_followers || 0),
  };
}

/**
 * Form ringkasan akun bulanan (dashboard profesional Instagram).
 * Data disimpan terpisah dari snapshot per konten.
 */
export const AccountSnapshotModal: React.FC<AccountSnapshotModalProps> = ({
  isOpen,
  brandId,
  platforms,
  initialPeriodMonth = null,
  initialChannel,
  onClose,
  onSaved,
}) => {
  const channelOptions = platforms.length > 0 ? platforms : ['instagram'];
  const [channel, setChannel] = useState<string>(initialChannel || channelOptions[0]);
  const [periodMonth, setPeriodMonth] = useState<string>(initialPeriodMonth || currentMonth());
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<AccountMetric | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setChannel(initialChannel || channelOptions[0]);
    setPeriodMonth(initialPeriodMonth || currentMonth());
    setError(null);
    // channelOptions diturunkan dari props; cukup bergantung pada isOpen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialChannel, initialPeriodMonth]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await metricsService.getAccountMetrics(brandId, { channel });
        if (cancelled) return;
        const found = rows.find((row) => row.period_month === periodMonth) || null;
        setExisting(found);
        setForm(toForm(found));
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan akun.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, brandId, channel, periodMonth]);

  if (!isOpen) return null;

  const update = (partial: Partial<AccountForm>) => setForm((prev) => ({ ...prev, ...partial }));

  const engagementRate = metricFormulas.engagementRate(form.interactions, form.reach, form.views);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
      setError('Bulan periode wajib dipilih.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await metricsService.upsertAccountMetric({
        brand_id: brandId,
        channel,
        period_month: periodMonth,
        views: form.views,
        reach: form.reach,
        interactions_total: form.interactions,
        profile_visits: form.profileVisits,
        follows: form.follows,
        followers_total: form.followersTotal,
        traffic_sources: form.trafficSources,
        audience_breakdown: {
          followers: form.audienceFollowers,
          non_followers: form.audienceNonFollowers,
        },
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan ringkasan akun.');
    } finally {
      setSaving(false);
    }
  };

  const trafficFields = getTrafficSourceFields(channel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-pink-50 p-2 text-pink-600">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ringkasan Akun Bulanan</h2>
              <p className="text-xs text-slate-500">
                Total performa akun dari dashboard, bukan penjumlahan per postingan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bulan Periode *">
              <input
                type="month"
                required
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </Field>
            <Field label="Saluran Platform *">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(channelOptions.includes(channel) ? channelOptions : [channel, ...channelOptions]).map(
                  (platformId) => (
                    <option key={platformId} value={platformId}>
                      {getPlatformName(platformId)}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>

          {existing && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              <span>
                Data bulan ini sudah ada. Menyimpan akan <strong>memperbarui</strong> ringkasan
                tersebut.
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat data bulan ini...
            </div>
          ) : (
            <>
              <FieldSection
                title="Angka Utama Akun"
                description="Isi sesuai dashboard profesional Instagram."
              >
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Field label="Tayangan (Views)">
                    <IntegerInput
                      value={form.views}
                      onChange={(next) => update({ views: next })}
                      ariaLabel="Total tayangan akun"
                    />
                  </Field>
                  <Field label="Reach">
                    <IntegerInput
                      value={form.reach}
                      onChange={(next) => update({ reach: next })}
                      ariaLabel="Reach akun"
                    />
                  </Field>
                  <Field label="Total Interaksi">
                    <IntegerInput
                      value={form.interactions}
                      onChange={(next) => update({ interactions: next })}
                      ariaLabel="Total interaksi akun"
                    />
                  </Field>
                  <Field label="Kunjungan Profil">
                    <IntegerInput
                      value={form.profileVisits}
                      onChange={(next) => update({ profileVisits: next })}
                      ariaLabel="Kunjungan profil akun"
                    />
                  </Field>
                  <Field label="Pengikut Baru">
                    <IntegerInput
                      value={form.follows}
                      onChange={(next) => update({ follows: next })}
                      ariaLabel="Pengikut baru akun"
                    />
                  </Field>
                  <Field label="Total Pengikut">
                    <IntegerInput
                      value={form.followersTotal}
                      onChange={(next) => update({ followersTotal: next })}
                      ariaLabel="Total pengikut"
                    />
                  </Field>
                </div>
              </FieldSection>

              <FieldSection
                title="Sumber Tayangan Akun"
                description="Persentase asal tayangan. Kosongkan kategori yang tidak tampil."
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {trafficFields.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <DecimalInput
                        value={Number(form.trafficSources[field.key] || 0)}
                        onChange={(next) =>
                          update({
                            trafficSources: { ...form.trafficSources, [field.key]: next },
                          })
                        }
                        max={100}
                        suffix="%"
                        ariaLabel={`Sumber tayangan ${field.label}`}
                      />
                    </Field>
                  ))}
                </div>
              </FieldSection>

              <FieldSection title="Pemirsa Akun" description="Komposisi pengikut dan bukan pengikut.">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Pengikut">
                    <DecimalInput
                      value={form.audienceFollowers}
                      onChange={(next) => update({ audienceFollowers: next })}
                      max={100}
                      suffix="%"
                      ariaLabel="Persentase pengikut akun"
                    />
                  </Field>
                  <Field label="Bukan Pengikut">
                    <DecimalInput
                      value={form.audienceNonFollowers}
                      onChange={(next) => update({ audienceNonFollowers: next })}
                      max={100}
                      suffix="%"
                      ariaLabel="Persentase bukan pengikut akun"
                    />
                  </Field>
                </div>
              </FieldSection>

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 text-xs">
                <div className="rounded-lg border border-blue-100 bg-white p-2">
                  <span className="block text-[10px] text-slate-500">Engagement Rate Akun</span>
                  <span className="text-sm font-extrabold text-blue-700">
                    {formatPercent(engagementRate)}
                  </span>
                </div>
                <div className="rounded-lg border border-blue-100 bg-white p-2">
                  <span className="block text-[10px] text-slate-500">Total Interaksi</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatCount(form.interactions)}
                  </span>
                </div>
                <p className="col-span-2 text-[10px] leading-snug text-blue-700/80">
                  ER akun = Total Interaksi ÷ Reach (atau Tayangan bila Reach kosong). Angka ini
                  tidak digabung dengan akumulasi konten.
                </p>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{existing ? 'Perbarui Ringkasan' : 'Simpan Ringkasan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
