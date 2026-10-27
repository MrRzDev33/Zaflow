import React, { useState } from 'react';
import {
  ScanEye,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Save,
  RefreshCw,
  Zap,
  UserRound,
  FileBarChart2,
} from 'lucide-react';
import {
  Brand,
  ContentInsightsDetail,
  ContentPost,
  TrafficSourceBreakdown,
} from '../../types/database.ts';
import {
  aiClientService,
  ExtractedAccountData,
  ExtractedMetricsData,
} from '../../services/ai/aiClientService.ts';
import { metricsService, metricFormulas } from '../../services/database/metricsService.ts';
import { getBrandPlatforms, getPlatformName, type PlatformId } from '../../config/platforms.ts';
import {
  CONTENT_TYPE_OPTIONS,
  createEmptyInsightsDetail,
  getTrafficSourceFields,
} from '../../config/insights.ts';
import { DecimalInput, Field, FieldSection, IntegerInput } from '../analytics/insights/inputs.tsx';
import { InsightDetailFields } from '../analytics/insights/InsightDetailFields.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface AiMetricsExtractorViewProps {
  brand: Brand | null;
  posts: ContentPost[];
  aiCreditsRemaining: number;
  initialPostId?: string | null;
  onRefreshLicense: () => void;
  onSavedMetrics: () => void;
}

type ExtractorMode = 'post' | 'account';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function buildDetailFromExtraction(data: ExtractedMetricsData): ContentInsightsDetail {
  const base = createEmptyInsightsDetail();
  const raw = data.insights_detail || {};

  return {
    ...base,
    viewFactors: raw.viewFactors?.length ? raw.viewFactors : base.viewFactors,
    trafficSources: { ...(data.traffic_sources || {}) },
    audience: {
      followers: Number(data.audience_breakdown?.followers || 0),
      non_followers: Number(data.audience_breakdown?.non_followers || 0),
    },
    audienceDetails: {
      ages: raw.audienceDetails?.ages || [],
      countries: raw.audienceDetails?.countries || [],
      gender: raw.audienceDetails?.gender || null,
    },
    series: {
      views: raw.series?.views || [],
      likes: raw.series?.likes || [],
      retention: raw.series?.retention || [],
    },
    approximate: Boolean(raw.approximate),
  };
}

export const AiMetricsExtractorView: React.FC<AiMetricsExtractorViewProps> = ({
  brand,
  posts,
  aiCreditsRemaining,
  initialPostId = null,
  onRefreshLicense,
  onSavedMetrics,
}) => {
  const availablePlatforms = getBrandPlatforms(brand);
  const [mode, setMode] = useState<ExtractorMode>('post');
  const [selectedChannel, setSelectedChannel] = useState<string>(
    availablePlatforms[0] || 'instagram'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [extractedData, setExtractedData] = useState<ExtractedMetricsData | null>(null);
  const [insightDetail, setInsightDetail] = useState<ContentInsightsDetail>(
    createEmptyInsightsDetail
  );
  const [accountData, setAccountData] = useState<ExtractedAccountData | null>(null);
  const [matchedPostId, setMatchedPostId] = useState<string>('');
  const [recordedDate, setRecordedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [isSaving, setIsSaving] = useState(false);

  const resetResults = () => {
    setExtractedData(null);
    setAccountData(null);
    setMatchedPostId('');
  };

  const handleModeChange = (next: ExtractorMode) => {
    setMode(next);
    resetResults();
    setError(null);
    setSuccessNotice(null);
  };

  const handleFileChange = (file: File) => {
    setError(null);
    setSuccessNotice(null);
    resetResults();

    let detectedType = (file.type || '').toLowerCase();
    if (detectedType === 'image/jpg' || detectedType === 'image/pjpeg') {
      detectedType = 'image/jpeg';
    }
    if (!detectedType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') detectedType = 'image/jpeg';
      else if (ext === 'png') detectedType = 'image/png';
      else if (ext === 'webp') detectedType = 'image/webp';
      else if (ext === 'gif') detectedType = 'image/gif';
      else if (ext === 'avif') detectedType = 'image/avif';
      else if (ext === 'mp4' || ext === 'm4v') detectedType = 'video/mp4';
      else if (ext === 'webm') detectedType = 'video/webm';
      else if (ext === 'mov') detectedType = 'video/quicktime';
    }

    const isVideo = detectedType.startsWith('video/') || file.type.startsWith('video/');
    const isImage = detectedType.startsWith('image/') || file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setError(
        `Jenis file "${file.type || file.name}" tidak diizinkan. Harap unggah gambar (JPG, PNG, WEBP) atau video rekaman layar (MP4, WEBM, MOV).`
      );
      return;
    }

    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(
        `Ukuran file ${(file.size / (1024 * 1024)).toFixed(1)} MB melebihi batas maksimal 3 MB.`
      );
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onloadend = () => setFileBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const resolveMimeType = (file: File): string => {
    let resolved = (file.type || '').toLowerCase();
    if (resolved === 'image/jpg' || resolved === 'image/pjpeg') resolved = 'image/jpeg';
    if (resolved) return resolved;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };
    return (ext && map[ext]) || 'image/jpeg';
  };

  const handleRunAiExtraction = async () => {
    if (!brand || !fileBase64 || !selectedFile) {
      setError('Harap pilih file tangkapan layar atau video rekaman terlebih dahulu.');
      return;
    }

    if (aiCreditsRemaining <= 0) {
      setError('Kuota kredit AI Anda telah habis. Silakan periksa halaman Paket & Kuota.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    resetResults();

    try {
      const mimeType = resolveMimeType(selectedFile);

      if (mode === 'account') {
        const result = await aiClientService.extractAccountSummary(
          brand.id,
          fileBase64,
          mimeType,
          selectedChannel
        );
        setAccountData({
          ...result.data,
          channel: result.data.channel || selectedChannel,
          period_month: result.data.period_month || currentMonth(),
        });
      } else {
        const result = await aiClientService.extractMetricsFromImage(
          brand.id,
          fileBase64,
          mimeType,
          selectedChannel
        );

        const extracted = result.data;
        if (!extracted) throw new Error('Format data ekstraksi AI tidak valid.');

        setExtractedData({
          ...extracted,
          channel: extracted.channel || selectedChannel,
        });
        setInsightDetail(buildDetailFromExtraction(extracted));

        let resolvedPostId =
          initialPostId && posts.some((p) => p.id === initialPostId) ? initialPostId : '';

        if (!resolvedPostId && extracted.detected_title && posts.length > 0) {
          const query = extracted.detected_title.toLowerCase();
          const matched = posts.find(
            (p) =>
              p.title.toLowerCase().includes(query) || query.includes(p.title.toLowerCase())
          );
          if (matched) resolvedPostId = matched.id;
        }

        if (resolvedPostId) setMatchedPostId(resolvedPostId);
      }

      onRefreshLicense();
    } catch (err: unknown) {
      onRefreshLicense();
      setError(err instanceof Error ? err.message : 'Gagal mengekstrak metrik dengan AI.');
    } finally {
      setIsProcessing(false);
    }
  };

  const patchExtracted = (partial: Partial<ExtractedMetricsData>) => {
    setExtractedData((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const patchAccount = (partial: Partial<ExtractedAccountData>) => {
    setAccountData((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleSaveConfirmedMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !extractedData) return;

    setIsSaving(true);
    setError(null);

    try {
      const isInstagram = (extractedData.channel || '').toLowerCase() === 'instagram';
      const trafficSources: TrafficSourceBreakdown | null = isInstagram
        ? insightDetail.trafficSources
        : extractedData.traffic_sources || null;
      const audienceBreakdown = isInstagram
        ? insightDetail.audience
        : extractedData.audience_breakdown
        ? {
            followers: Number(extractedData.audience_breakdown.followers || 0),
            non_followers: Number(extractedData.audience_breakdown.non_followers || 0),
          }
        : null;

      const isVideoFile =
        selectedFile?.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(selectedFile?.name || '');

      await metricsService.createMetric({
        brand_id: brand.id,
        post_id: matchedPostId || null,
        channel: extractedData.channel || selectedChannel,
        impressions: Number(extractedData.impressions) || 0,
        reach: Number(extractedData.reach) || 0,
        likes: Number(extractedData.likes) || 0,
        comments: Number(extractedData.comments) || 0,
        shares: Number(extractedData.shares) || 0,
        saves: Number(extractedData.saves) || 0,
        clicks: Number(extractedData.clicks) || 0,
        profile_visits: Number(extractedData.profile_visits) || 0,
        follows: Number(extractedData.follows) || 0,
        content_type: extractedData.content_type || null,
        source: isVideoFile ? 'ai_video' : 'ai_screenshot',
        recorded_at: recordedDate ? new Date(recordedDate).toISOString() : new Date().toISOString(),
        watch_time: extractedData.watch_time || null,
        drop_off_rate:
          extractedData.drop_off_rate !== undefined && extractedData.drop_off_rate !== null
            ? Number(extractedData.drop_off_rate)
            : null,
        reposts:
          extractedData.reposts !== undefined && extractedData.reposts !== null
            ? Number(extractedData.reposts)
            : 0,
        traffic_sources: trafficSources,
        audience_breakdown: audienceBreakdown,
        insights_detail: isInstagram ? insightDetail : null,
        raw_ai_analysis: {
          confidence: extractedData.confidence,
          summary: extractedData.summary,
          detected_title: extractedData.detected_title,
          watch_time: extractedData.watch_time || null,
          drop_off_rate: extractedData.drop_off_rate ?? null,
          reposts: extractedData.reposts ?? null,
          profile_visits: extractedData.profile_visits ?? null,
          follows: extractedData.follows ?? null,
          content_type: extractedData.content_type ?? null,
          traffic_sources: trafficSources,
          audience_breakdown: audienceBreakdown,
          insights_detail: isInstagram ? insightDetail : null,
        },
      });

      setSuccessNotice('Data metrik hasil verifikasi berhasil disimpan.');
      onSavedMetrics();
      resetResults();
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileBase64(null);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan metrik terverifikasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAccountSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !accountData) return;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(accountData.period_month || '')) {
      setError('Bulan periode wajib dipilih (format YYYY-MM).');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await metricsService.upsertAccountMetric({
        brand_id: brand.id,
        channel: accountData.channel || selectedChannel,
        period_month: accountData.period_month as string,
        views: Number(accountData.views) || 0,
        reach: Number(accountData.reach) || 0,
        interactions_total: Number(accountData.interactions_total) || 0,
        profile_visits: Number(accountData.profile_visits) || 0,
        follows: Number(accountData.follows) || 0,
        followers_total: Number(accountData.followers_total) || 0,
        traffic_sources: accountData.traffic_sources || null,
        audience_breakdown: accountData.audience_breakdown
          ? {
              followers: Number(accountData.audience_breakdown.followers || 0),
              non_followers: Number(accountData.audience_breakdown.non_followers || 0),
            }
          : null,
        raw_ai_analysis: {
          confidence: accountData.confidence,
          summary: accountData.summary,
        },
      });

      setSuccessNotice('Ringkasan akun berhasil disimpan. Data bulan yang sama akan diperbarui.');
      onSavedMetrics();
      resetResults();
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileBase64(null);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan ringkasan akun.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!brand) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ScanEye className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-800">
          Pilih atau buat brand terlebih dahulu
        </p>
      </div>
    );
  }

  const currentTotalEng = extractedData
    ? metricFormulas.totalEngagements(
        Number(extractedData.likes) || 0,
        Number(extractedData.comments) || 0,
        Number(extractedData.shares) || 0,
        Number(extractedData.saves) || 0,
        Number(extractedData.reposts) || 0
      )
    : 0;

  const currentER = extractedData
    ? metricFormulas.engagementRate(
        currentTotalEng,
        Number(extractedData.reach) || 0,
        Number(extractedData.impressions) || 0
      )
    : 0;

  const isInstagramChannel = (extractedData?.channel || selectedChannel) === 'instagram';
  const nonInstagramTrafficFields = getTrafficSourceFields(extractedData?.channel || selectedChannel);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-purple-100 p-2 text-purple-600">
              <ScanEye className="h-5 w-5" />
            </span>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              AI Metrics Extractor
            </h1>
            <span className="flex items-center gap-1 rounded-full border border-purple-200/60 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
              <Zap className="h-3 w-3 fill-purple-500 text-purple-500" /> AI Vision Multimodal
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Unggah screenshot insight atau rekaman video layar. AI akan membaca metrik, lalu Anda
            memverifikasi sebelum menyimpan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Kredit AI: <span className="font-bold text-purple-600">{aiCreditsRemaining}</span>{' '}
            tersisa
          </div>
        </div>
      </div>

      {successNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-900">1. Jenis Data yang Dibaca</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('post')}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition ${
                    mode === 'post'
                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileBarChart2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-[11px] font-bold">Per Postingan</span>
                    <span className="block text-[10px] leading-snug opacity-80">
                      Insight satu konten
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('account')}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition ${
                    mode === 'account'
                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-[11px] font-bold">Ringkasan Akun</span>
                    <span className="block text-[10px] leading-snug opacity-80">
                      Dashboard bulanan
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Saluran Media Sosial Target *
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium capitalize focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {availablePlatforms.map((platformId) => (
                  <option key={platformId} value={platformId}>
                    {getPlatformName(platformId)}
                  </option>
                ))}
              </select>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                previewUrl
                  ? 'border-purple-300 bg-purple-50/20'
                  : 'border-slate-300 bg-slate-50/50 hover:border-purple-400'
              }`}
            >
              {previewUrl ? (
                <div className="space-y-3">
                  {selectedFile?.type.startsWith('video/') ? (
                    <video
                      src={previewUrl}
                      controls
                      className="mx-auto max-h-64 w-full rounded-lg border border-slate-200 bg-black object-contain shadow-xs"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Pratinjau File"
                      className="mx-auto max-h-64 rounded-lg border border-slate-200 object-contain shadow-xs"
                    />
                  )}
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="max-w-[200px] truncate font-semibold text-slate-700">
                      {selectedFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setFileBase64(null);
                        resetResults();
                      }}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Ganti File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <label className="cursor-pointer text-xs font-bold text-purple-600 hover:text-purple-700">
                      Pilih screenshot atau video recording
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <span className="text-xs text-slate-500"> atau seret ke sini</span>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Gambar (JPG, PNG, WEBP) & video (MP4, WEBM, MOV) maksimal 3 MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleRunAiExtraction}
              disabled={isProcessing || !fileBase64 || aiCreditsRemaining <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-purple-700 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Membaca Insight dengan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Ekstrak {mode === 'account' ? 'Ringkasan Akun' : 'Metrik'} dengan AI (1 Kredit)
                  </span>
                </>
              )}
            </button>

            <div className="space-y-1 rounded-xl border border-amber-200/70 bg-amber-50 p-3 text-[11px] text-amber-800">
              <p className="flex items-center gap-1 font-semibold text-amber-900">
                <HelpCircle className="h-3.5 w-3.5" />
                Tips agar hasil akurat
              </p>
              <p className="leading-relaxed text-amber-700">
                Ambil screenshot pada halaman insight yang menampilkan angka dan grafik secara
                utuh. Jika grafik tidak terbaca, AI akan menandainya sebagai perkiraan atau
                mengosongkannya.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. Koreksi & Verifikasi Manusia
                </h2>
                <p className="text-xs text-slate-500">
                  Periksa keakuratan data hasil ekstraksi sebelum disimpan
                </p>
              </div>
              {mode === 'post' && extractedData?.confidence !== undefined && (
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  Keyakinan AI: {extractedData.confidence}%
                </span>
              )}
              {mode === 'account' && accountData?.confidence !== undefined && (
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  Keyakinan AI: {accountData.confidence}%
                </span>
              )}
            </div>

            {mode === 'post' && !extractedData && (
              <div className="space-y-3 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <ScanEye className="h-6 w-6" />
                </div>
                <div className="mx-auto max-w-xs">
                  <p className="text-xs font-bold text-slate-700">Belum ada data terekstraksi</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Unggah screenshot insight per postingan lalu klik tombol ekstrak.
                  </p>
                </div>
              </div>
            )}

            {mode === 'account' && !accountData && (
              <div className="space-y-3 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="mx-auto max-w-xs">
                  <p className="text-xs font-bold text-slate-700">Belum ada ringkasan akun</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Unggah screenshot dashboard profesional Instagram untuk membaca total bulanan.
                  </p>
                </div>
              </div>
            )}

            {mode === 'post' && extractedData && (
              <form onSubmit={handleSaveConfirmedMetrics} className="space-y-4">
                {extractedData.summary && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <span className="mb-0.5 block font-bold text-slate-900">
                      Ringkasan Analisis AI:
                    </span>
                    <span>{extractedData.summary}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Cocokkan dengan Postingan Brand">
                    <select
                      value={matchedPostId}
                      onChange={(e) => setMatchedPostId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">Snapshot umum (tanpa postingan)</option>
                      {posts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.pillar})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Saluran Platform *">
                    <select
                      value={extractedData.channel}
                      onChange={(e) => patchExtracted({ channel: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {(availablePlatforms.includes(extractedData.channel as PlatformId)
                        ? availablePlatforms
                        : [extractedData.channel, ...availablePlatforms]
                      ).map((platformId) => (
                        <option key={platformId} value={platformId}>
                          {getPlatformName(platformId)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {isInstagramChannel && (
                    <Field label="Jenis Konten">
                      <select
                        value={extractedData.content_type || ''}
                        onChange={(e) => patchExtracted({ content_type: e.target.value || null })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                    label="Waktu Snapshot Data"
                    className={isInstagramChannel ? '' : 'sm:col-span-2'}
                  >
                    <input
                      type="datetime-local"
                      required
                      value={recordedDate}
                      onChange={(e) => setRecordedDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </Field>
                </div>

                <FieldSection
                  title="Metrik Utama (Hasil Deteksi AI)"
                  description="Bisa dikoreksi manual bila ada angka yang salah baca."
                >
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <Field label="Impressions">
                      <IntegerInput
                        value={Number(extractedData.impressions) || 0}
                        onChange={(next) => patchExtracted({ impressions: next })}
                        className="font-bold"
                        ariaLabel="Impressions"
                      />
                    </Field>
                    <Field label="Reach">
                      <IntegerInput
                        value={Number(extractedData.reach) || 0}
                        onChange={(next) => patchExtracted({ reach: next })}
                        className="font-bold"
                        ariaLabel="Reach"
                      />
                    </Field>
                    <Field label="Likes">
                      <IntegerInput
                        value={Number(extractedData.likes) || 0}
                        onChange={(next) => patchExtracted({ likes: next })}
                        ariaLabel="Likes"
                      />
                    </Field>
                    <Field label="Comments">
                      <IntegerInput
                        value={Number(extractedData.comments) || 0}
                        onChange={(next) => patchExtracted({ comments: next })}
                        ariaLabel="Comments"
                      />
                    </Field>
                    <Field label="Shares">
                      <IntegerInput
                        value={Number(extractedData.shares) || 0}
                        onChange={(next) => patchExtracted({ shares: next })}
                        ariaLabel="Shares"
                      />
                    </Field>
                    <Field label="Saves">
                      <IntegerInput
                        value={Number(extractedData.saves) || 0}
                        onChange={(next) => patchExtracted({ saves: next })}
                        ariaLabel="Saves"
                      />
                    </Field>
                    <Field label="Reposts">
                      <IntegerInput
                        value={Number(extractedData.reposts) || 0}
                        onChange={(next) => patchExtracted({ reposts: next })}
                        ariaLabel="Reposts"
                      />
                    </Field>
                  </div>
                </FieldSection>

                <FieldSection
                  title="Tindakan Pengguna"
                  description="Kunjungan profil dan klik link dipisah dari interaksi konten."
                >
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <Field label="Kunjungan Profil">
                      <IntegerInput
                        value={Number(extractedData.profile_visits) || 0}
                        onChange={(next) => patchExtracted({ profile_visits: next })}
                        ariaLabel="Kunjungan profil"
                      />
                    </Field>
                    <Field label="Klik Link Eksternal">
                      <IntegerInput
                        value={Number(extractedData.clicks) || 0}
                        onChange={(next) => patchExtracted({ clicks: next })}
                        ariaLabel="Klik link eksternal"
                      />
                    </Field>
                    <Field label="Pengikut Baru (Follow)">
                      <IntegerInput
                        value={Number(extractedData.follows) || 0}
                        onChange={(next) => patchExtracted({ follows: next })}
                        ariaLabel="Pengikut baru"
                      />
                    </Field>
                  </div>
                </FieldSection>

                {isInstagramChannel ? (
                  <InsightDetailFields
                    channel={extractedData.channel}
                    contentType={extractedData.content_type}
                    detail={insightDetail}
                    onChange={setInsightDetail}
                  />
                ) : (
                  <FieldSection
                    title="Metrik Mendalam Video"
                    description={`Data tambahan ${getPlatformName(extractedData.channel)}.`}
                  >
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Field label="Average Watch Time">
                        <input
                          type="text"
                          placeholder="Contoh: 0:34 detik"
                          value={extractedData.watch_time || ''}
                          onChange={(e) => patchExtracted({ watch_time: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </Field>
                      <Field label="Drop-off / Skip Rate">
                        <DecimalInput
                          value={Number(extractedData.drop_off_rate) || 0}
                          onChange={(next) => patchExtracted({ drop_off_rate: next })}
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
                        {nonInstagramTrafficFields.map((field) => (
                          <Field key={field.key} label={field.label}>
                            <DecimalInput
                              value={Number(extractedData.traffic_sources?.[field.key] || 0)}
                              onChange={(next) =>
                                patchExtracted({
                                  traffic_sources: {
                                    ...(extractedData.traffic_sources || {}),
                                    [field.key]: next,
                                  },
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
                            value={Number(extractedData.audience_breakdown?.followers || 0)}
                            onChange={(next) =>
                              patchExtracted({
                                audience_breakdown: {
                                  ...(extractedData.audience_breakdown || {}),
                                  followers: next,
                                },
                              })
                            }
                            max={100}
                            suffix="%"
                            ariaLabel="Persentase pengikut"
                          />
                        </Field>
                        <Field label="Bukan Pengikut">
                          <DecimalInput
                            value={Number(extractedData.audience_breakdown?.non_followers || 0)}
                            onChange={(next) =>
                              patchExtracted({
                                audience_breakdown: {
                                  ...(extractedData.audience_breakdown || {}),
                                  non_followers: next,
                                },
                              })
                            }
                            max={100}
                            suffix="%"
                            ariaLabel="Persentase bukan pengikut"
                          />
                        </Field>
                      </div>
                    </div>
                  </FieldSection>
                )}

                <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-500">Total Keterlibatan</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {formatCount(currentTotalEng)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-500">Engagement Rate</span>
                    <span className="text-sm font-extrabold text-purple-700">
                      {formatPercent(currentER)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => resetResults()}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>Konfirmasi & Simpan Data</span>
                  </button>
                </div>
              </form>
            )}

            {mode === 'account' && accountData && (
              <form onSubmit={handleSaveAccountSummary} className="space-y-4">
                {accountData.summary && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <span className="mb-0.5 block font-bold text-slate-900">
                      Ringkasan Analisis AI:
                    </span>
                    <span>{accountData.summary}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Bulan Periode *"
                    hint="Satu bulan hanya punya satu ringkasan; input ulang akan memperbarui."
                  >
                    <input
                      type="month"
                      required
                      value={accountData.period_month || ''}
                      onChange={(e) => patchAccount({ period_month: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </Field>
                  <Field label="Saluran Platform *">
                    <select
                      value={accountData.channel}
                      onChange={(e) => patchAccount({ channel: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {(availablePlatforms.includes(accountData.channel as PlatformId)
                        ? availablePlatforms
                        : [accountData.channel, ...availablePlatforms]
                      ).map((platformId) => (
                        <option key={platformId} value={platformId}>
                          {getPlatformName(platformId)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <FieldSection
                  title="Angka Utama Akun"
                  description="Total bulanan dari dashboard, bukan penjumlahan per postingan."
                >
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    <Field label="Tayangan (Views)">
                      <IntegerInput
                        value={Number(accountData.views) || 0}
                        onChange={(next) => patchAccount({ views: next })}
                        className="font-bold"
                        ariaLabel="Total tayangan akun"
                      />
                    </Field>
                    <Field label="Reach">
                      <IntegerInput
                        value={Number(accountData.reach) || 0}
                        onChange={(next) => patchAccount({ reach: next })}
                        className="font-bold"
                        ariaLabel="Reach akun"
                      />
                    </Field>
                    <Field label="Total Interaksi">
                      <IntegerInput
                        value={Number(accountData.interactions_total) || 0}
                        onChange={(next) => patchAccount({ interactions_total: next })}
                        ariaLabel="Total interaksi akun"
                      />
                    </Field>
                    <Field label="Kunjungan Profil">
                      <IntegerInput
                        value={Number(accountData.profile_visits) || 0}
                        onChange={(next) => patchAccount({ profile_visits: next })}
                        ariaLabel="Kunjungan profil akun"
                      />
                    </Field>
                    <Field label="Pengikut Baru">
                      <IntegerInput
                        value={Number(accountData.follows) || 0}
                        onChange={(next) => patchAccount({ follows: next })}
                        ariaLabel="Pengikut baru akun"
                      />
                    </Field>
                    <Field label="Total Pengikut">
                      <IntegerInput
                        value={Number(accountData.followers_total) || 0}
                        onChange={(next) => patchAccount({ followers_total: next })}
                        ariaLabel="Total pengikut"
                      />
                    </Field>
                  </div>
                </FieldSection>

                <FieldSection
                  title="Sumber Tayangan Akun"
                  description="Enam kategori resmi Instagram. Kosongkan yang tidak tampil."
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {getTrafficSourceFields('instagram').map((field) => (
                      <Field key={field.key} label={field.label}>
                        <DecimalInput
                          value={Number(accountData.traffic_sources?.[field.key] || 0)}
                          onChange={(next) =>
                            patchAccount({
                              traffic_sources: {
                                ...(accountData.traffic_sources || {}),
                                [field.key]: next,
                              },
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
                        value={Number(accountData.audience_breakdown?.followers || 0)}
                        onChange={(next) =>
                          patchAccount({
                            audience_breakdown: {
                              ...(accountData.audience_breakdown || {}),
                              followers: next,
                            },
                          })
                        }
                        max={100}
                        suffix="%"
                        ariaLabel="Persentase pengikut akun"
                      />
                    </Field>
                    <Field label="Bukan Pengikut">
                      <DecimalInput
                        value={Number(accountData.audience_breakdown?.non_followers || 0)}
                        onChange={(next) =>
                          patchAccount({
                            audience_breakdown: {
                              ...(accountData.audience_breakdown || {}),
                              non_followers: next,
                            },
                          })
                        }
                        max={100}
                        suffix="%"
                        ariaLabel="Persentase bukan pengikut akun"
                      />
                    </Field>
                  </div>
                </FieldSection>

                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3 text-[11px] text-blue-800">
                  Engagement Rate akun dihitung otomatis dari Total Interaksi ÷ Reach (atau
                  Tayangan bila Reach kosong).
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => resetResults()}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>Simpan Ringkasan Akun</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-500">
            <span>Setiap ekstraksi memakai 1 kredit AI, terlepas dari jumlah data.</span>
            <button
              type="button"
              onClick={onRefreshLicense}
              className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className="h-3 w-3" />
              Segarkan kuota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
