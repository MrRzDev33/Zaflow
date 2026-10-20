import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Loader2, Calendar, Video } from 'lucide-react';
import { CreatePostInput } from '../../services/database/contentService.ts';
import { ContentFormat, ContentStatus, Brand, WorkflowStatusConfig } from '../../types/database.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';

interface NewPostModalProps {
  isOpen: boolean;
  brandId: string;
  initialTitle?: string;
  initialPillar?: string;
  initialFormat?: ContentFormat;
  initialCaption?: string;
  onClose: () => void;
  onSubmit: (input: CreatePostInput) => Promise<unknown>;
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  isOpen,
  brandId,
  initialTitle = '',
  initialPillar = '',
  initialFormat = 'carousel',
  initialCaption = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [caption, setCaption] = useState(initialCaption);
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
      const mockBrand = { id: brandId } as Brand;
      const loadedPillars = workflowSettingsService.getPillars(mockBrand);
      const loadedStatuses = workflowSettingsService.getWorkflowStatuses(mockBrand);
      setAvailablePillars(loadedPillars);
      setAvailableStatuses(loadedStatuses);

      setTitle(initialTitle);
      setPillar(initialPillar || (loadedPillars[0] || 'Edukatif'));
      setFormat(initialFormat);
      setCaption(initialCaption);
      setStatus(loadedStatuses[0]?.id || 'idea');
      setScheduledAt('');
      setProductionDate('');
      setError(null);
    }
  }, [isOpen, initialTitle, initialPillar, initialFormat, initialCaption, brandId]);

  if (!isOpen) return null;

  const handleChannelToggle = (channel: string) => {
    if (channels.includes(channel)) {
      if (channels.length > 1) {
        setChannels(channels.filter((c) => c !== channel));
      }
    } else {
      setChannels([...channels, channel]);
    }
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
        pillar: pillar || availablePillars[0] || 'Edukatif',
        format,
        status,
        channels,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        production_date: productionDate ? new Date(productionDate).toISOString() : null,
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
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                {availablePillars.map((p) => (
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
              {[
                { id: 'instagram', label: 'Instagram' },
                { id: 'tiktok', label: 'TikTok' },
                { id: 'linkedin', label: 'LinkedIn' },
                { id: 'youtube', label: 'YouTube' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleChannelToggle(ch.id)}
                  className={`px-3 py-1 text-xs rounded-md font-medium border transition-colors ${
                    channels.includes(ch.id)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status Alur Kerja (Workflow)
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
            >
              {availableStatuses.map((s) => (
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
