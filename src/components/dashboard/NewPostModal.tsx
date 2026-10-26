import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Loader2, Calendar, Video, ImagePlus, Link2, Trash2, FileText } from 'lucide-react';
import { CreatePostInput } from '../../services/database/contentService.ts';
import { ContentFormat, ContentStatus, Brand, WorkflowStatusConfig } from '../../types/database.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';
import { mediaService } from '../../services/storage/mediaService.ts';
import { formatFileSize } from '../../services/storage/imageCompression.ts';
import { ContentThumbnail } from '../content/ContentThumbnail.tsx';
import { parseHashtags } from '../../utils/hashtags.ts';
import {
  PLATFORM_CATALOG,
  getBrandPlatforms,
  type PlatformId,
} from '../../config/platforms.ts';

interface NewPostModalProps {
  isOpen: boolean;
  brand: Brand;
  initialTitle?: string;
  initialPillar?: string;
  initialFormat?: ContentFormat;
  initialCaption?: string;
  initialStatus?: ContentStatus;
  onClose: () => void;
  onSubmit: (input: CreatePostInput) => Promise<unknown>;
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  isOpen,
  brand,
  initialTitle = '',
  initialPillar = '',
  initialFormat = 'carousel',
  initialCaption = '',
  initialStatus,
  onClose,
  onSubmit,
}) => {
  const brandId = brand.id;
  const availablePlatforms = getBrandPlatforms(brand);
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
  const [brief, setBrief] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [pillar, setPillar] = useState(initialPillar);
  const [format, setFormat] = useState<ContentFormat>(initialFormat);
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [channels, setChannels] = useState<string[]>(['instagram']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [availablePillars, setAvailablePillars] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<WorkflowStatusConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadedPillars = workflowSettingsService.getPillars(brand);
      const loadedStatuses = workflowSettingsService.getWorkflowStatuses(brand);
      const platforms = getBrandPlatforms(brand);
      setAvailablePillars(loadedPillars);
      setAvailableStatuses(loadedStatuses);

      setTitle(initialTitle);
      setPillar(initialPillar || (loadedPillars[0] || 'Edukatif'));
      setFormat(initialFormat);
      setCaption(initialCaption);
      setBrief('');
      setPostUrl('');
      setHashtagsText('');
      setMediaUrls([]);
      setUploadingMedia(false);
      setUploadNotice(null);
      setStatus(initialStatus || loadedStatuses[0]?.id || 'idea');
      setChannels([platforms[0] || 'instagram']);
      setScheduledAt('');
      setProductionDate('');
      setError(null);
    }
  }, [isOpen, initialTitle, initialPillar, initialFormat, initialCaption, initialStatus, brand]);

  if (!isOpen) return null;

  const pillarOptions = availablePillars.includes(pillar)
    ? availablePillars
    : [pillar, ...availablePillars].filter(Boolean);

  const statusOptions: WorkflowStatusConfig[] = availableStatuses.some((statusConfig) => statusConfig.id === status)
    ? availableStatuses
    : [
        {
          id: status,
          title: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
          dotColor: 'bg-slate-400',
          headerBg: 'bg-slate-100',
        },
        ...availableStatuses,
      ];

  const parsedHashtags = parseHashtags(hashtagsText);

  const handleChannelToggle = (channel: string) => {
    if (channels.includes(channel)) {
      if (channels.length > 1) {
        setChannels(channels.filter((c) => c !== channel));
      }
    } else {
      setChannels([...channels, channel]);
    }
  };

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    setError(null);

    try {
      const uploaded: string[] = [];
      let originalBytes = 0;
      let uploadedBytes = 0;
      let compressedCount = 0;
      for (const file of Array.from(files).slice(0, 5)) {
        const result = await mediaService.uploadContentImageDetailed(file, brandId);
        uploaded.push(result.path);
        originalBytes += result.originalBytes;
        uploadedBytes += result.uploadedBytes;
        if (result.wasCompressed) compressedCount += 1;
      }
      setMediaUrls((prev) => [...prev, ...uploaded].slice(0, 5));
      if (compressedCount > 0) {
        setUploadNotice(
          `${compressedCount} gambar dioptimalkan otomatis: ${formatFileSize(originalBytes)} menjadi ${formatFileSize(uploadedBytes)}.`
        );
      } else {
        setUploadNotice(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar konten.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (path: string) => {
    setMediaUrls((prev) => prev.filter((item) => item !== path));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await onSubmit({
        brand_id: brandId,
        title: title.trim(),
        caption: caption.trim() || undefined,
        brief: brief.trim() || undefined,
        hashtags: parsedHashtags,
        pillar: pillar || availablePillars[0] || 'Edukatif',
        format,
        status,
        channels: channels.filter((channel): channel is PlatformId => availablePlatforms.includes(channel as PlatformId)),
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        production_date: productionDate ? new Date(productionDate).toISOString() : null,
        post_url: postUrl.trim() || undefined,
        media_urls: mediaUrls,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan postingan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Rencanakan Konten Baru</h2>
              <p className="text-xs text-slate-500">Catat ide, jadwal produksi, draf caption, atau tanggal tayang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Konten / Hook *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: 5 Kesalahan Fatal Saat Menjalankan Iklan TikTok"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilar Konten
              </label>
              <select
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              >
                {pillarOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Format Konten
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentFormat)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              >
                <option value="carousel">Carousel Slide</option>
                <option value="single_image">Gambar Tunggal</option>
                <option value="reel_short">Reels / TikTok Short</option>
                <option value="video">Video Panjang</option>
                <option value="story">Story</option>
                <option value="text_thread">Thread / Teks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Saluran Publikasi
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platformId) => {
                const platform = PLATFORM_CATALOG[platformId];
                return (
                  <button
                    key={platformId}
                    type="button"
                    onClick={() => handleChannelToggle(platformId)}
                    className={`px-3 py-1 text-xs rounded-md font-medium border transition-colors ${
                      channels.includes(platformId)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Draf Caption / Catatan Ide
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tuliskan draf teks postingan atau instruksi untuk tim desainer..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Script / Brief Produksi</span>
            </label>
            <textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Tuliskan script, arahan visual, urutan shot, atau brief untuk tim produksi..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5 text-pink-600" />
              <span>
                Gambar Konten <span className="font-normal text-slate-400">(Opsional)</span>
              </span>
            </label>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 space-y-3">
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {mediaUrls.map((path, index) => (
                    <div key={path} className="relative group">
                      <ContentThumbnail
                        mediaPath={path}
                        alt={`Gambar konten ${index + 1}`}
                        className="w-full aspect-square"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(path)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="Hapus gambar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition">
                {uploadingMedia ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-pink-600" />
                )}
                <span>{uploadingMedia ? 'Mengoptimalkan & mengunggah...' : 'Pilih Gambar (maks. 1 MB)'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  multiple
                  className="hidden"
                  disabled={uploadingMedia || mediaUrls.length >= 5}
                  onChange={(e) => {
                    handleMediaUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {uploadNotice && (
                <p className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  {uploadNotice}
                </p>
              )}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Gambar dioptimalkan otomatis agar ringan. Maksimal 5 gambar per konten, masing-masing 1 MB.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Link Postingan</span>
            </label>
            <input
              type="text"
              inputMode="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Opsional. Link akan ditampilkan sebagai tombol jika status konten sudah tayang.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hashtags <span className="font-normal text-slate-400">(Opsional)</span>
            </label>
            <input
              type="text"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              placeholder="#bisnisonline #marketingtips #sosialmedia"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            <div className="mt-1.5 flex min-h-[20px] flex-wrap gap-1">
              {parsedHashtags.length > 0 ? (
                parsedHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-400">
                  Pisahkan dengan spasi atau koma. Tanda # ditambahkan otomatis.
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status Alur Kerja (Workflow)
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
            >
              {statusOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Jadwal Produksi & Jadwal Tayang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tanggal Produksi / Shooting</span>
              </label>
              <input
                type="datetime-local"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Kapan konten diproduksi</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Rencana Tanggal Tayang</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Jadwal publikasi postingan</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Konten</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
