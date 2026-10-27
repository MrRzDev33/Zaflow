import React, { useEffect, useState } from 'react';
import {
  X,
  Save,
  Loader2,
  BarChart2,
  Calculator,
  AlertCircle,
  Video,
  MousePointerClick,
} from 'lucide-react';
import {
  ContentInsightsDetail,
  ContentMetric,
  ContentPost,
  TrafficSourceBreakdown,
} from '../../types/database.ts';
import {
  metricsService,
  metricFormulas,
  CreateMetricInput,
  UpdateMetricInput,
} from '../../services/database/metricsService.ts';
import { PLATFORM_ORDER, getPlatformName } from '../../config/platforms.ts';
import {
  CONTENT_TYPE_OPTIONS,
  createEmptyInsightsDetail,
  getTrafficSourceFields,
} from '../../config/insights.ts';
import { DecimalInput, Field, FieldSection, IntegerInput } from './insights/inputs.tsx';
import { InsightDetailFields } from './insights/InsightDetailFields.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface MetricInputModalProps {
  isOpen: boolean;
  brandId: string;
  posts: ContentPost[];
  platforms?: string[];
  initialMetric?: ContentMetric | null;
  initialPostId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  postId: string;
  channel: string;
  contentType: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reposts: number;
  profileVisits: number;
  externalClicks: number;
  follows: number;
  recordedAt: string;
  watchTime: string;
  dropOffRate: number;
  trafficSources: TrafficSourceBreakdown;
  audienceFollowers: number;
  audienceNonFollowers: number;
  insightsDetail: ContentInsightsDetail;
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 16);
  try {
    const d = new Date(value);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

/** Menggabungkan detail insight tersimpan dengan kolom top-level lama. */
function buildInsightsDetail(metric: ContentMetric | null): ContentInsightsDetail {
  const base = createEmptyInsightsDetail();
  if (!metric) return base;

  const raw = (metric.insights_detail || {}) as Partial<ContentInsightsDetail>;
  const traffic = raw.trafficSources || metric.traffic_sources || {};
  const audience = raw.audience || metric.audience_breakdown || {};
  const details = raw.audienceDetails || base.audienceDetails;

  return {
    ...base,
    ...raw,
    trafficSources: { ...traffic },
    audience: {
      followers: Number(audience.followers || 0),
      non_followers: Number(audience.non_followers || 0),
    },
    audienceDetails: {
      ages: details?.ages || [],
      countries: details?.countries || [],
      gender: details?.gender || null,
    },
    viewFactors: raw.viewFactors?.length ? raw.viewFactors : base.viewFactors,
    series: raw.series || base.series,
    approximate: Boolean(raw.approximate),
  };
}

function createEmptyForm(channel: string, postId: string): FormState {
  return {
    postId,
    channel,
    contentType: '',
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    reposts: 0,
    profileVisits: 0,
    externalClicks: 0,
    follows: 0,
    recordedAt: new Date().toISOString().slice(0, 16),
    watchTime: '',
    dropOffRate: 0,
    trafficSources: {},
    audienceFollowers: 0,
    audienceNonFollowers: 0,
    insightsDetail: createEmptyInsightsDetail(),
  };
}

export const MetricInputModal: React.FC<MetricInputModalProps> = ({
  isOpen,
  brandId,
  posts,
  platforms,
  initialMetric,
  initialPostId = null,
  onClose,
  onSaved,
}) => {
  const defaultChannel = platforms?.[0] || PLATFORM_ORDER[0];
  const [form, setForm] = useState<FormState>(() => createEmptyForm(defaultChannel, ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialMetric) {
      const raw = (initialMetric.raw_ai_analysis || {}) as Record<string, unknown>;
      const detail = buildInsightsDetail(initialMetric);
      setForm({
        postId: initialMetric.post_id || '',
        channel: initialMetric.channel || 'instagram',
        contentType: initialMetric.content_type || '',
        impressions: Number(initialMetric.impressions) || 0,
        reach: Number(initialMetric.reach) || 0,
        likes: Number(initialMetric.likes) || 0,
        comments: Number(initialMetric.comments) || 0,
        shares: Number(initialMetric.shares) || 0,
        saves: Number(initialMetric.saves) || 0,
        reposts: Number(initialMetric.reposts ?? raw.reposts ?? 0) || 0,
        profileVisits: Number(initialMetric.profile_visits ?? raw.profile_visits ?? 0) || 0,
        externalClicks: Number(initialMetric.clicks) || 0,
        follows: Number(initialMetric.follows ?? raw.follows ?? 0) || 0,
        recordedAt: toLocalDateTime(initialMetric.recorded_at),
        watchTime: String(initialMetric.watch_time || raw.watch_time || ''),
        dropOffRate: Number(initialMetric.drop_off_rate ?? raw.drop_off_rate ?? 0) || 0,
        trafficSources: { ...(detail.trafficSources || {}) },
        audienceFollowers: Number(detail.audience.followers || 0),
        audienceNonFollowers: Number(detail.audience.non_followers || 0),
        insightsDetail: detail,
      });
    } else {
      const preferredPostId =
        initialPostId && posts.some((post) => post.id === initialPostId)
          ? initialPostId
          : posts[0]?.id || '';
      setForm(createEmptyForm(defaultChannel, preferredPostId));
    }
    setError(null);
  }, [isOpen, initialMetric, initialPostId, posts, defaultChannel]);

  if (!isOpen) return null;

  const activePlatforms = platforms && platforms.length > 0 ? platforms : PLATFORM_ORDER;
  const channelOptions = activePlatforms.includes(form.channel)
    ? activePlatforms
    : [form.channel, ...activePlatforms];
  const isInstagram = form.channel === 'instagram';

  const update = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

  const totalEng = metricFormulas.totalEngagements(
    form.likes,
    form.comments,
    form.shares,
    form.saves,
    form.reposts
  );
  const previewER = metricFormulas.engagementRate(totalEng, form.reach, form.impressions);
  const previewSaveRate = metricFormulas.saveRate(form.saves, form.reach);
  const previewShareRate = metricFormulas.shareRate(form.shares, form.reach);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const recordedISO = form.recordedAt
        ? new Date(form.recordedAt).toISOString()
        : new Date().toISOString();

      const detail: ContentInsightsDetail = {
        ...form.insightsDetail,
        trafficSources: isInstagram
          ? form.insightsDetail.trafficSources
          : form.trafficSources,
        audience: isInstagram
          ? form.insightsDetail.audience
          : {
              followers: form.audienceFollowers,
              non_followers: form.audienceNonFollowers,
            },
      };

      const deepFields = {
        watch_time: form.watchTime.trim() ? form.watchTime.trim() : null,
        drop_off_rate: form.dropOffRate || null,
        reposts: form.reposts,
        profile_visits: form.profileVisits,
        follows: form.follows,
        content_type: form.contentType || null,
        traffic_sources: isInstagram ? detail.trafficSources : form.trafficSources,
        audience_breakdown: detail.audience,
        insights_detail: isInstagram ? detail : null,
      };

      if (initialMetric) {
        const updatePayload: UpdateMetricInput = {
          channel: form.channel,
          impressions: form.impressions,
          reach: form.reach,
          likes: form.likes,
          comments: form.comments,
          shares: form.shares,
          saves: form.saves,
          clicks: form.externalClicks,
          recorded_at: recordedISO,
          ...deepFields,
        };
        await metricsService.updateMetric(initialMetric.id, updatePayload);
      } else {
        const createPayload: CreateMetricInput = {
          brand_id: brandId,
          post_id: form.postId || null,
          channel: form.channel,
          impressions: form.impressions,
          reach: form.reach,
          likes: form.likes,
          comments: form.comments,
          shares: form.shares,
          saves: form.saves,
          clicks: form.externalClicks,
          source: 'manual',
          recorded_at: recordedISO,
          ...deepFields,
        };
        await metricsService.createMetric(createPayload);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan metrik.');
    } finally {
      setLoading(false);
    }
  };

  const trafficFields = getTrafficSourceFields(form.channel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialMetric ? 'Edit Snapshot Metrik' : 'Catat Snapshot Metrik Konten'}
              </h2>
              <p className="text-xs text-slate-500">
                Satu snapshot per waktu pengamatan, untuk melacak tren historis.
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
            <Field label="Tautkan ke Postingan">
              <select
                value={form.postId}
                onChange={(e) => update({ postId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Snapshot umum (tanpa postingan)</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.pillar})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Saluran Media Sosial *">
              <select
                value={form.channel}
                onChange={(e) => update({ channel: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {channelOptions.map((platformId) => (
                  <option key={platformId} value={platformId}>
                    {getPlatformName(platformId)}
                  </option>
                ))}
              </select>
            </Field>

            {isInstagram && (
              <Field
                label="Jenis Konten"
                hint="Menentukan apakah faktor tayangan dan metrik video ditampilkan."
              >
                <select
                  value={form.contentType}
                  onChange={(e) => update({ contentType: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Deteksi otomatis</option>
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field
              label="Tanggal & Waktu Snapshot *"
              className={isInstagram ? '' : 'sm:col-span-2'}
            >
              <input
                type="datetime-local"
                required
                value={form.recordedAt}
                onChange={(e) => update({ recordedAt: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </Field>
          </div>

          <FieldSection
            title="Metrik Utama"
            description="Angka utama performa konten. Reposts ikut dihitung sebagai interaksi."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Field label="Impressions">
                <IntegerInput
                  value={form.impressions}
                  onChange={(next) => update({ impressions: next })}
                  ariaLabel="Impressions"
                />
              </Field>
              <Field label="Reach">
                <IntegerInput
                  value={form.reach}
                  onChange={(next) => update({ reach: next })}
                  ariaLabel="Reach"
                />
              </Field>
              <Field label="Likes">
                <IntegerInput
                  value={form.likes}
                  onChange={(next) => update({ likes: next })}
                  ariaLabel="Likes"
                />
              </Field>
              <Field label="Comments">
                <IntegerInput
                  value={form.comments}
                  onChange={(next) => update({ comments: next })}
                  ariaLabel="Comments"
                />
              </Field>
              <Field label="Shares">
                <IntegerInput
                  value={form.shares}
                  onChange={(next) => update({ shares: next })}
                  ariaLabel="Shares"
                />
              </Field>
              <Field label="Saves">
                <IntegerInput
                  value={form.saves}
                  onChange={(next) => update({ saves: next })}
                  ariaLabel="Saves"
                />
              </Field>
              <Field label="Reposts">
                <IntegerInput
                  value={form.reposts}
                  onChange={(next) => update({ reposts: next })}
                  ariaLabel="Reposts"
                />
              </Field>
            </div>
          </FieldSection>

          <FieldSection
            title="Tindakan Pengguna"
            description="Kunjungan profil dan klik link dicatat terpisah dari interaksi konten."
            right={
              <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                <MousePointerClick className="h-3 w-3" />
                Konversi
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Field label="Kunjungan Profil">
                <IntegerInput
                  value={form.profileVisits}
                  onChange={(next) => update({ profileVisits: next })}
                  ariaLabel="Kunjungan profil"
                />
              </Field>
              <Field label="Klik Link Eksternal">
                <IntegerInput
                  value={form.externalClicks}
                  onChange={(next) => update({ externalClicks: next })}
                  ariaLabel="Klik link eksternal"
                />
              </Field>
              <Field label="Pengikut Baru (Follow)">
                <IntegerInput
                  value={form.follows}
                  onChange={(next) => update({ follows: next })}
                  ariaLabel="Pengikut baru"
                />
              </Field>
            </div>
          </FieldSection>

          {isInstagram ? (
            <>
              <div className="flex items-center gap-2 pt-1">
                <Video className="h-4 w-4 text-pink-600" />
                <h3 className="text-xs font-bold text-slate-800">Detail Insight Instagram</h3>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                  Opsional
                </span>
              </div>
              <InsightDetailFields
                channel={form.channel}
                contentType={form.contentType}
                detail={form.insightsDetail}
                onChange={(detail) => update({ insightsDetail: detail })}
              />
            </>
          ) : (
            <FieldSection
              title="Metrik Mendalam Video"
              description={`Data tambahan untuk ${getPlatformName(form.channel)}. Semua opsional.`}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label="Rata-rata Watch Time">
                  <input
                    type="text"
                    placeholder="Contoh: 0:34 atau 34s"
                    value={form.watchTime}
                    onChange={(e) => update({ watchTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Drop-off / Skip Rate">
                  <DecimalInput
                    value={form.dropOffRate}
                    onChange={(next) => update({ dropOffRate: next })}
                    max={100}
                    suffix="%"
                    ariaLabel="Drop-off rate"
                  />
                </Field>
              </div>

              <div className="mt-3 border-t border-slate-200/70 pt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sumber Tayangan Teratas
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              </div>

              <div className="mt-3 border-t border-slate-200/70 pt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Pemirsa
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Pengikut">
                    <DecimalInput
                      value={form.audienceFollowers}
                      onChange={(next) => update({ audienceFollowers: next })}
                      max={100}
                      suffix="%"
                      ariaLabel="Persentase pengikut"
                    />
                  </Field>
                  <Field label="Bukan Pengikut">
                    <DecimalInput
                      value={form.audienceNonFollowers}
                      onChange={(next) => update({ audienceNonFollowers: next })}
                      max={100}
                      suffix="%"
                      ariaLabel="Persentase bukan pengikut"
                    />
                  </Field>
                </div>
              </div>
            </FieldSection>
          )}

          <div className="space-y-2 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Calculator className="h-3.5 w-3.5 text-blue-600" />
              <span>Kalkulasi Otomatis (Real-Time)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-blue-100 bg-white p-2">
                <span className="block text-[10px] text-slate-500">Total Engagements</span>
                <span className="text-sm font-extrabold text-blue-700">{formatCount(totalEng)}</span>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-2">
                <span className="block text-[10px] text-slate-500">Engagement Rate</span>
                <span className="text-sm font-extrabold text-purple-700">{formatPercent(previewER)}</span>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-2">
                <span className="block text-[10px] text-slate-500">Save Rate</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {formatPercent(previewSaveRate)}
                </span>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-2">
                <span className="block text-[10px] text-slate-500">Share Rate</span>
                <span className="text-sm font-extrabold text-amber-700">
                  {formatPercent(previewShareRate)}
                </span>
              </div>
            </div>
            <p className="text-[10px] leading-snug text-blue-700/80">
              Total Engagements = Likes + Comments + Shares + Saves + Reposts. Engagement Rate
              memakai Reach, atau Impressions bila Reach belum diisi.
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{initialMetric ? 'Perbarui Metrik' : 'Simpan Snapshot'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
