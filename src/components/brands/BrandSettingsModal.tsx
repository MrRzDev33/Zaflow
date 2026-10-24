import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Loader2, Building2, AlertCircle, Check } from 'lucide-react';
import { Brand } from '../../types/database.ts';
import { brandsService, UpdateBrandInput } from '../../services/database/brandsService.ts';
import {
  PLATFORM_CATALOG,
  PLATFORM_ORDER,
  getBrandPlatforms,
  type PlatformId,
} from '../../config/platforms.ts';

interface BrandSettingsModalProps {
  isOpen: boolean;
  brand: Brand | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  canEditBrand?: boolean;
  canDeleteBrand?: boolean;
}

export const BrandSettingsModal: React.FC<BrandSettingsModalProps> = ({
  isOpen,
  brand,
  onClose,
  onUpdated,
  onDeleted,
  canEditBrand = true,
  canDeleteBrand = true,
}) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('F&B');
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#2563EB');
  const [platforms, setPlatforms] = useState<PlatformId[]>(['instagram']);
  const [socialHandles, setSocialHandles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brand) {
      setName(brand.name || '');
      setIndustry(brand.industry || 'F&B');
      setDescription(brand.description || '');
      setColorHex(brand.color_hex || '#2563EB');
      setPlatforms(getBrandPlatforms(brand));
      setSocialHandles({ ...(brand.social_accounts || {}) });
      setError(null);
    }
  }, [brand]);

  if (!isOpen || !brand) return null;

  const presetColors = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626'];

  const togglePlatform = (platformId: PlatformId) => {
    setError(null);
    setPlatforms((prev) => (
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    ));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditBrand) {
      setError('Anda tidak memiliki izin mengubah pengaturan brand ini.');
      return;
    }
    if (!name.trim()) {
      setError('Nama brand tidak boleh kosong.');
      return;
    }
    if (platforms.length === 0) {
      setError('Pilih minimal satu platform yang digunakan brand ini.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const socialAccounts: Record<string, string> = {};
      for (const platformId of PLATFORM_ORDER) {
        if (!platforms.includes(platformId)) continue;
        const value = socialHandles[platformId]?.trim();
        if (value) socialAccounts[platformId] = value;
      }

      const updates: UpdateBrandInput = {
        name: name.trim(),
        industry,
        description: description.trim() || undefined,
        color_hex: colorHex,
        platforms,
        social_accounts: socialAccounts,
      };

      await brandsService.updateBrand(brand.id, updates);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui workspace brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteBrand) {
      setError('Hanya pemilik brand yang dapat menghapus workspace.');
      return;
    }
    if (!window.confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus workspace "${brand.name}" beserta seluruh konten di dalamnya? Tindakan ini permanen.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await brandsService.deleteBrand(brand.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus brand. Pastikan Anda adalah pemilik brand ini.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pengaturan Workspace Brand</h2>
              <p className="text-xs text-slate-500">Kelola identitas, warna, platform, dan akun brand</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Brand *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama brand atau klien"
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
              Deskripsi Singkat Brand
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Target audiens, positioning brand, atau USP..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Platform yang Digunakan *
            </label>
            <p className="text-[10px] text-slate-400 mb-2">
              Hanya platform terpilih yang akan muncul di formulir konten, kalender, kanban, dan filter.
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_ORDER.map((platformId) => {
                const platform = PLATFORM_CATALOG[platformId];
                const selected = platforms.includes(platformId);
                return (
                  <button
                    key={platformId}
                    type="button"
                    onClick={() => togglePlatform(platformId)}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </div>

          {platforms.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Akun Brand per Platform
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLATFORM_ORDER.filter((platformId) => platforms.includes(platformId)).map((platformId) => {
                  const platform = PLATFORM_CATALOG[platformId];
                  return (
                    <div key={platformId}>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        {platform.handleLabel}
                      </label>
                      <input
                        type="text"
                        value={socialHandles[platformId] || ''}
                        onChange={(e) => setSocialHandles((prev) => ({ ...prev, [platformId]: e.target.value }))}
                        placeholder={platform.placeholder}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {canDeleteBrand ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Hapus Brand</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Hanya pemilik dapat menghapus brand</span>
            )}

            <div className="flex items-center gap-2">
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
                <span>Simpan Brand</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
