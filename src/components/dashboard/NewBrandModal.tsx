import React, { useState } from 'react';
import { X, Building2, Loader2, Check } from 'lucide-react';
import { CreateBrandInput } from '../../services/database/brandsService.ts';

interface NewBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateBrandInput) => Promise<unknown>;
}

export const NewBrandModal: React.FC<NewBrandModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('F&B');
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#2563EB');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await onSubmit({
        name: name.trim(),
        industry,
        description: description.trim() || undefined,
        color_hex: colorHex,
        social_accounts: {
          instagram: instagram.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
        },
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || 'Gagal membuat brand';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const presetColors = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Tambah Workspace Brand</h2>
              <p className="text-xs text-slate-500">Buat workspace baru untuk brand atau klien agensi</p>
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
              Nama Brand / Klien *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kopi Sapaan, Aura Skincare"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Industri
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
              >
                <option value="F&B">F&B (Kuliner)</option>
                <option value="Fashion">Fashion & Apparel</option>
                <option value="Kecantikan">Kecantikan & Skincare</option>
                <option value="Teknologi">Teknologi / SaaS</option>
                <option value="Pendidikan">Edukasi / Kursus</option>
                <option value="Jasa">Jasa & Konsultan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warna Brand
              </label>
              <div className="flex items-center gap-1.5 mt-1.5">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorHex(c)}
                    style={{ backgroundColor: c }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110"
                  >
                    {colorHex === c && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fokus produk, target audiens, tone of voice brand..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username Instagram
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@nama.brand"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username TikTok
              </label>
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@nama.brand"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
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
              <span>Buat Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
