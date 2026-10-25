import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Copy, Loader2, Calendar, Video, AlertCircle, FileText, ImagePlus, Link2 } from 'lucide-react';
import { ContentPost, ContentFormat, ContentStatus, Brand, WorkflowStatusConfig } from '../../types/database.ts';
import { contentService, UpdatePostInput } from '../../services/database/contentService.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';
import { mediaService } from '../../services/storage/mediaService.ts';
import { formatFileSize } from '../../services/storage/imageCompression.ts';
import { ContentThumbnail } from './ContentThumbnail.tsx';
import {
  PLATFORM_CATALOG,
  getBrandPlatforms,
  type PlatformId,
} from '../../config/platforms.ts';

interface EditPostModalProps {
  isOpen: boolean;
  post: ContentPost | null;
  brand: Brand | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
  onDuplicated?: (newPost: ContentPost) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  post,
  brand,
  onClose,
  onUpdated,
  onDeleted,
  onDuplicated,
}) => {
  const availablePlatforms = getBrandPlatforms(brand);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [brief, setBrief] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [postedAt, setPostedAt] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [hashtagsText, setHashtagsText] = useState('');
  const [pillar, setPillar] = useState('Edukatif');
  const [format, setFormat] = useState<ContentFormat>('carousel');
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [channels, setChannels] = useState<string[]>(['instagram']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [availablePillars, setAvailablePillars] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<WorkflowStatusConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post) {
      const platforms = getBrandPlatforms(brand);
      setAvailablePillars(workflowSettingsService.getPillars(brand));
      setAvailableStatuses(workflowSettingsService.getWorkflowStatuses(brand));

      setTitle(post.title || '');
      setCaption(post.caption || '');
      setBrief(post.brief || '');
      setPostUrl(post.post_url || '');
      setMediaUrls([...(post.media_urls || [])]);
      setHashtagsText((post.hashtags || []).join(' '));
      setPillar(post.pillar || 'Edukatif');
      setFormat(post.format || 'single_image');
      setStatus(post.status || 'draft');
      const selectedChannels = (post.channels || []).filter((channel) => platforms.includes(channel as PlatformId));
      setChannels(selectedChannels.length > 0 ? selectedChannels : [platforms[0] || 'instagram']);

      if (post.scheduled_at) {
        try {
          const d = new Date(post.scheduled_at);
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setScheduledAt(localISOTime);
        } catch {
          setScheduledAt('');
        }
      } else {
        setScheduledAt('');
      }

      if (post.production_date) {
        try {
          const d = new Date(post.production_date);
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
          setProductionDate(localISOTime);
        } catch {
          setProductionDate('');
        }
      } else {
        setProductionDate('');
      }

      if (post.posted_at) {
        try {
          const d = new Date(post.posted_at);
          const tzOffset = d.getTimezoneOffset() * 60000;
          setPostedAt(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
        } catch {
          setPostedAt('');
        }
      } else {
        setPostedAt('');
      }

      setUploadingMedia(false);
      setUploadNotice(null);
      setError(null);
    }
  }, [post, brand]);

  if (!isOpen || !post) return null;

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
        const result = await mediaService.uploadContentImageDetailed(file, post.brand_id);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul konten tidak boleh kosong.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const hashtags = hashtagsText
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      const updates: UpdatePostInput = {
        title: title.trim(),
        caption: caption.trim() || null,
        brief: brief.trim() || null,
        hashtags,
        channels: channels.filter((channel): channel is PlatformId => availablePlatforms.includes(channel as PlatformId)),
        format,
        pillar,
        status,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ...(postedAt
          ? { posted_at: new Date(postedAt).toISOString() }
          : post.posted_at
          ? { posted_at: post.posted_at }
          : {}),
        production_date: productionDate ? new Date(productionDate).toISOString() : null,
        post_url: postUrl.trim() || null,
        media_urls: mediaUrls,
      };

      await contentService.updatePost(post.id, updates);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui postingan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus konten "${post.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await contentService.deletePost(post.id);
      if (onDeleted) onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus postingan.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    setError(null);
    try {
      const cloned = await contentService.duplicatePost(post.id);
      if (onDuplicated) onDuplicated(cloned);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menduplikasi postingan.');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Rencana Konten</h2>
            <p className="text-xs text-slate-500">Perbarui detail, status alur kerja, atau jadwal tayang</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Konten / Hook Postingan *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul atau hook utama postingan"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className={`px-3 py-1 text-xs rounded-md font-medium border transition-colors cursor-pointer ${
                      channels.includes(platformId)
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
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
              Caption / Salinan Teks
            </label>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tuliskan draf teks postingan lengkap, hook pembuka, call-to-action (CTA)..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Script / Brief Produksi</span>
            </label>
            <textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Script, arahan visual, urutan shot, atau brief untuk tim produksi..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5 text-pink-600" />
              <span>Gambar Konten</span>
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
                <span>{uploadingMedia ? 'Mengoptimalkan & mengunggah...' : 'Tambah Gambar (maks. 1 MB)'}</span>
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
                Maksimal 5 gambar per konten, masing-masing 1 MB. Gambar dioptimalkan otomatis.
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
              Tombol lihat postingan muncul di halaman Konten Post saat status sudah tayang.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hashtags (Pisahkan dengan spasi atau koma)
            </label>
            <input
              type="text"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              placeholder="#bisnisonline #marketingtips #sosialmedia"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
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

          {/* Tanggal Produksi, Jadwal Tayang & Tanggal Posting Aktual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tanggal Produksi / Shooting</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                />
                {productionDate && (
                  <button
                    type="button"
                    onClick={() => setProductionDate('')}
                    className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                    title="Kosongkan Tanggal Produksi"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Kapan konten diproduksi</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Rencana Tanggal Tayang</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                />
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setScheduledAt('')}
                    className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                    title="Kosongkan Jadwal"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Jadwal publikasi postingan</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tanggal Posting Aktual</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={postedAt}
                  onChange={(e) => setPostedAt(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                />
                {postedAt && (
                  <button
                    type="button"
                    onClick={() => setPostedAt('')}
                    className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                    title="Kosongkan Tanggal Posting"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Dipakai untuk filter histori Konten Post</span>
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Hapus</span>
              </button>

              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Duplikasi</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
