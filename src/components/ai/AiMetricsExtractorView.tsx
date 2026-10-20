import React, { useState } from 'react';
import {
  ScanEye,
  UploadCloud,
  FileImage,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Save,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Brand, ContentPost } from '../../types/database.ts';
import { aiClientService, ExtractedMetricsData } from '../../services/ai/aiClientService.ts';
import { metricsService, metricFormulas } from '../../services/database/metricsService.ts';

interface AiMetricsExtractorViewProps {
  brand: Brand | null;
  posts: ContentPost[];
  aiCreditsRemaining: number;
  onRefreshLicense: () => void;
  onSavedMetrics: () => void;
}

export const AiMetricsExtractorView: React.FC<AiMetricsExtractorViewProps> = ({
  brand,
  posts,
  aiCreditsRemaining,
  onRefreshLicense,
  onSavedMetrics,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<string>('instagram');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Extracted data state for human verification & correction
  const [extractedData, setExtractedData] = useState<ExtractedMetricsData | null>(null);
  const [matchedPostId, setMatchedPostId] = useState<string>('');
  const [recordedDate, setRecordedDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (file: File) => {
    setError(null);
    setSuccessNotice(null);
    setExtractedData(null);

    let detectedType = (file.type || '').toLowerCase();
    if (detectedType === 'image/jpg' || detectedType === 'image/pjpeg') {
      detectedType = 'image/jpeg';
    }
    if (!detectedType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') detectedType = 'image/jpeg';
      else if (ext === 'png') detectedType = 'image/png';
      else if (ext === 'webp') detectedType = 'image/webp';
      else if (ext === 'mp4') detectedType = 'video/mp4';
      else if (ext === 'webm') detectedType = 'video/webm';
      else if (ext === 'mov') detectedType = 'video/quicktime';
    }

    const isVideo = detectedType.startsWith('video/') || file.type.startsWith('video/');
    const isImage = detectedType.startsWith('image/') || file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setError(`Jenis file "${file.type || file.name}" tidak diizinkan. Harap unggah gambar (JPG, PNG, WEBP) atau video rekaman layar (MP4, WEBM, MOV).`);
      return;
    }

    // Batas dibuat di bawah limit body server (12 MB) setelah base64 membengkak ~33%.
    const maxSize = isVideo ? 7 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`Ukuran file ${(file.size / (1024 * 1024)).toFixed(1)} MB melebihi batas maksimal.`);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRunAiExtraction = async () => {
    if (!brand || !fileBase64 || !selectedFile) {
      setError('Harap pilih file tangkapan layar atau video rekaman terlebih dahulu.');
      return;
    }

    if (aiCreditsRemaining <= 0) {
      setError('Kuota kredit AI Anda telah habis. Silakan periksa halaman Lisensi.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let resolvedType = (selectedFile.type || '').toLowerCase();
      if (resolvedType === 'image/jpg' || resolvedType === 'image/pjpeg') {
        resolvedType = 'image/jpeg';
      }
      if (!resolvedType) {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') resolvedType = 'image/jpeg';
        else if (ext === 'png') resolvedType = 'image/png';
        else if (ext === 'webp') resolvedType = 'image/webp';
        else if (ext === 'mp4') resolvedType = 'video/mp4';
        else if (ext === 'webm') resolvedType = 'video/webm';
        else if (ext === 'mov') resolvedType = 'video/quicktime';
      }

      const result = await aiClientService.extractMetricsFromImage(
        brand.id,
        fileBase64,
        resolvedType || 'image/jpeg',
        selectedChannel
      );

      const extracted = result.data || (result as any).metrics;
      if (!extracted) {
        throw new Error('Format data ekstraksi AI tidak valid.');
      }

      setExtractedData(extracted);
      onRefreshLicense();

      if (extracted.detected_title && posts.length > 0) {
        const query = extracted.detected_title.toLowerCase();
        const matched = posts.find((p) =>
          p.title.toLowerCase().includes(query) || query.includes(p.title.toLowerCase())
        );
        if (matched) {
          setMatchedPostId(matched.id);
        }
      }
    } catch (err: unknown) {
      onRefreshLicense();
      setError(err instanceof Error ? err.message : 'Gagal mengekstrak metrik dengan AI.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveConfirmedMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !extractedData) return;

    setIsSaving(true);
    setError(null);

    try {
      await metricsService.createMetric({
        brand_id: brand.id,
        post_id: matchedPostId || null,
        channel: extractedData.channel,
        impressions: Number(extractedData.impressions),
        reach: Number(extractedData.reach),
        likes: Number(extractedData.likes),
        comments: Number(extractedData.comments),
        shares: Number(extractedData.shares),
        saves: Number(extractedData.saves),
        clicks: Number(extractedData.clicks),
        source: selectedFile?.type.startsWith('video/') ? 'ai_video' : 'ai_screenshot',
        recorded_at: recordedDate ? new Date(recordedDate).toISOString() : new Date().toISOString(),
        watch_time: extractedData.watch_time || null,
        drop_off_rate: extractedData.drop_off_rate !== undefined ? Number(extractedData.drop_off_rate) : null,
        reposts: extractedData.reposts !== undefined ? Number(extractedData.reposts) : null,
        traffic_sources: extractedData.traffic_sources ? {
          reels: Number(extractedData.traffic_sources.reels || 0),
          feed: Number(extractedData.traffic_sources.feed || 0),
          explore: Number(extractedData.traffic_sources.explore || 0),
          profile: Number(extractedData.traffic_sources.profile || 0),
        } : null,
        audience_breakdown: extractedData.audience_breakdown ? {
          followers: Number(extractedData.audience_breakdown.followers || 0),
          non_followers: Number(extractedData.audience_breakdown.non_followers || 0),
        } : null,
        raw_ai_analysis: {
          confidence: extractedData.confidence,
          summary: extractedData.summary,
          detected_title: extractedData.detected_title,
          watch_time: extractedData.watch_time || null,
          drop_off_rate: extractedData.drop_off_rate !== undefined ? Number(extractedData.drop_off_rate) : null,
          reposts: extractedData.reposts !== undefined ? Number(extractedData.reposts) : null,
          traffic_sources: extractedData.traffic_sources || null,
          audience_breakdown: extractedData.audience_breakdown || null,
        },
      });

      setSuccessNotice('Snapshot metrik hasil verifikasi berhasil disimpan ke database!');
      onSavedMetrics();
      setExtractedData(null);
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

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto my-12">
        <ScanEye className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  const currentTotalEng = extractedData
    ? metricFormulas.totalEngagements(
        extractedData.likes,
        extractedData.comments,
        extractedData.shares,
        extractedData.saves
      )
    : 0;

  const currentER = extractedData
    ? metricFormulas.engagementRate(currentTotalEng, extractedData.reach, extractedData.impressions)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-100 text-purple-600 rounded-xl">
              <ScanEye className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">AI Metrics Extractor</h1>
            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200/60 flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-500 fill-purple-500" /> Gemini Vision Multimodal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unggah screenshot insight atau rekaman video layar (MP4, WEBM, MOV) dari media sosial untuk otomatis mengekstrak metrik menggunakan kecerdasan buatan Gemini.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Kredit AI: <span className="font-bold text-purple-600">{aiCreditsRemaining}</span> tersisa
          </div>
        </div>
      </div>

      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successNotice}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload & Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">1. Pilih Saluran & Unggah File/Video</h2>

            {/* Channel Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saluran Media Sosial Target *
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white capitalize font-medium"
              >
                <option value="instagram">Instagram (Feed / Reel / Story)</option>
                <option value="tiktok">TikTok (Video / Analytics)</option>
                <option value="linkedin">LinkedIn (Post / Article)</option>
                <option value="youtube">YouTube (Video / Shorts)</option>
                <option value="facebook">Facebook (Post / Page)</option>
              </select>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                previewUrl ? 'border-purple-300 bg-purple-50/20' : 'border-slate-300 hover:border-purple-400 bg-slate-50/50'
              }`}
            >
              {previewUrl ? (
                <div className="space-y-3">
                  {selectedFile?.type.startsWith('video/') ? (
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-64 mx-auto rounded-lg shadow-xs border border-slate-200 object-contain bg-black w-full"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Pratinjau File"
                      className="max-h-64 mx-auto rounded-lg shadow-xs border border-slate-200 object-contain"
                    />
                  )}
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                      {selectedFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setFileBase64(null);
                        setExtractedData(null);
                      }}
                      className="text-red-600 hover:underline font-medium cursor-pointer"
                    >
                      Ganti File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-purple-600 hover:text-purple-700 cursor-pointer">
                      Pilih screenshot atau video recording
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    <span className="text-xs text-slate-500"> atau seret ke sini</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mendukung Gambar (JPG, PNG, WEBP &lt;5MB) & Video Recording (MP4, WEBM, MOV &lt;7MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAiExtraction}
              disabled={isProcessing || !fileBase64 || aiCreditsRemaining <= 0}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membaca Insight dengan AI Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Ekstrak Metrik dengan AI (1 Kredit)</span>
                </>
              )}
            </button>

            {/* Disclaimer */}
            <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1 text-amber-900">
                <HelpCircle className="w-3.5 h-3.5" />
                Dukungan Gambar & Video Recording
              </p>
              <p className="text-amber-700 leading-relaxed">
                Anda dapat mengunggah screenshot analisis insight atau video rekaman layar saat menjelajahi dasbor analitik. Model Gemini Vision akan otomatis membaca dan mengekstrak metrik performa.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Human Verification & Save (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. Koreksi & Verifikasi Manusia (Human-in-the-Loop)
                </h2>
                <p className="text-xs text-slate-500">
                  Periksa keakuratan data hasil ekstraksi AI sebelum disimpan permanen ke database
                </p>
              </div>
              {extractedData?.confidence !== undefined && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                  Keyakinan AI: {extractedData.confidence}%
                </span>
              )}
            </div>

            {!extractedData ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ScanEye className="w-6 h-6" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-700">Belum ada data terekstraksi</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Unggah tangkapan layar insight atau video rekaman lalu klik tombol "Ekstrak Metrik dengan AI".
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveConfirmedMetrics} className="space-y-4 animate-in fade-in">
                {extractedData.summary && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-0.5">Ringkasan Analisis AI:</span>
                    <span>{extractedData.summary}</span>
                  </div>
                )}

                {/* Content Matching & Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cocokkan dengan Postingan Brand
                    </label>
                    <select
                      value={matchedPostId}
                      onChange={(e) => setMatchedPostId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    >
                      <option value="">-- Metrik Umum / Tanpa Post Spesifik --</option>
                      {posts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.pillar})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Saluran Platform *
                    </label>
                    <select
                      value={extractedData.channel}
                      onChange={(e) => setExtractedData({ ...extractedData, channel: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white capitalize"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                    </select>
                  </div>
                </div>

                {/* Date Snapshot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu Snapshot Data (Untuk Tren Historis)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={recordedDate}
                    onChange={(e) => setRecordedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  />
                </div>

                {/* Editable Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Impressions (Views)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.impressions}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          impressions: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Reach (Jangkauan)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.reach}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          reach: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Likes (Suka)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.likes}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          likes: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Comments
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.comments}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          comments: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Shares (Dibagikan)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.shares}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          shares: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Saves (Disimpan)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.saves}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          saves: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Clicks
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extractedData.clicks}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          clicks: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Deep Video & Channel Specific Insights Section */}
                {(() => {
                  const ch = (extractedData.channel || '').toLowerCase();
                  const isTikTok = ch === 'tiktok';
                  const isInstagram = ch === 'instagram';
                  const isYouTube = ch === 'youtube';

                  const secTitle = isTikTok
                    ? 'Metrik Mendalam Video TikTok (Hasil Deteksi AI)'
                    : isInstagram
                    ? 'Metrik Mendalam Video & Instagram Insights (Hasil Deteksi AI)'
                    : isYouTube
                    ? 'Metrik Mendalam YouTube Shorts (Hasil Deteksi AI)'
                    : `Metrik Mendalam Konten ${extractedData.channel} (Hasil Deteksi AI)`;

                  const srcLabel1 = isTikTok ? 'FYP (Untuk Anda) %' : isInstagram ? 'Tab Reels %' : isYouTube ? 'Shorts Feed %' : 'Reels / Video %';
                  const srcLabel2 = isTikTok ? 'Following (Mengikuti) %' : isInstagram ? 'Beranda (Feed) %' : isYouTube ? 'Beranda / Browse %' : 'Feed / Beranda %';
                  const srcLabel3 = isTikTok ? 'Suara / Pencarian %' : isInstagram ? 'Jelajahi (Explore) %' : isYouTube ? 'Penelusuran %' : 'Explore / Cari %';
                  const srcLabel4 = isTikTok ? 'Profil Akun %' : isInstagram ? 'Profil %' : isYouTube ? 'Halaman Channel %' : 'Profil %';

                  return (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isTikTok ? 'bg-cyan-500' : isInstagram ? 'bg-pink-500' : isYouTube ? 'bg-red-500' : 'bg-purple-500'}`} />
                          {secTitle}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Bisa disesuaikan manual jika diperlukan
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Average Watch Time
                          </label>
                          <input
                            type="text"
                            placeholder={isTikTok ? 'Contoh: 0:14 detik' : 'Contoh: 0:34 detik'}
                            value={extractedData.watch_time || ''}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                watch_time: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Drop-off / Skip Rate (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="28.4"
                            value={extractedData.drop_off_rate ?? ''}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                drop_off_rate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Reposts (Posting Ulang)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={extractedData.reposts ?? ''}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                reposts: Math.max(0, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500 bg-white"
                          />
                        </div>
                      </div>

                      {/* Traffic Sources & Audience Breakdown Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Sumber Tayangan Teratas (%)
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 text-[10px] block truncate">{srcLabel1}</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={extractedData.traffic_sources?.reels ?? 0}
                                onChange={(e) =>
                                  setExtractedData({
                                    ...extractedData,
                                    traffic_sources: {
                                      ...(extractedData.traffic_sources || {}),
                                      reels: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block truncate">{srcLabel2}</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={extractedData.traffic_sources?.feed ?? 0}
                                onChange={(e) =>
                                  setExtractedData({
                                    ...extractedData,
                                    traffic_sources: {
                                      ...(extractedData.traffic_sources || {}),
                                      feed: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block truncate">{srcLabel3}</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={extractedData.traffic_sources?.explore ?? 0}
                                onChange={(e) =>
                                  setExtractedData({
                                    ...extractedData,
                                    traffic_sources: {
                                      ...(extractedData.traffic_sources || {}),
                                      explore: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block truncate">{srcLabel4}</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={extractedData.traffic_sources?.profile ?? 0}
                                onChange={(e) =>
                                  setExtractedData({
                                    ...extractedData,
                                    traffic_sources: {
                                      ...(extractedData.traffic_sources || {}),
                                      profile: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                            </div>
                          </div>
                        </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Pemirsa (Audience Breakdown %)
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 text-[10px]">Pengikut %</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={extractedData.audience_breakdown?.followers ?? 0}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                audience_breakdown: {
                                  ...(extractedData.audience_breakdown || {}),
                                  followers: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Bukan Pengikut %</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={extractedData.audience_breakdown?.non_followers ?? 0}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                audience_breakdown: {
                                  ...(extractedData.audience_breakdown || {}),
                                  non_followers: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

                {/* Calculation Preview */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Keterlibatan</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {currentTotalEng.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Engagement Rate</span>
                    <span className="font-extrabold text-purple-700 text-sm">{currentER}%</span>
                  </div>
                </div>

                {/* Confirm & Save Button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setExtractedData(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Konfirmasi & Simpan ke Database</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
