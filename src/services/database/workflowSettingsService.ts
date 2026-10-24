import { supabase, isConfigured } from '../../config/supabase.ts';
import { Brand, WorkflowStatusConfig } from '../../types/database.ts';

export const DEFAULT_CONTENT_PILLARS: string[] = [
  'Edukatif',
  'Promosi',
  'Interaktif',
  'Inspiratif',
  'Behind The Scenes',
  'Hiburan',
];

export const DEFAULT_WORKFLOW_STATUSES: WorkflowStatusConfig[] = [
  { id: 'idea', title: 'Ide (Backlog)', dotColor: 'bg-slate-400', headerBg: 'bg-slate-100' },
  { id: 'draft', title: 'Draf Penulisan', dotColor: 'bg-amber-500', headerBg: 'bg-amber-50' },
  { id: 'production', title: 'Produksi / Shooting', dotColor: 'bg-indigo-500', headerBg: 'bg-indigo-50' },
  { id: 'in_review', title: 'Perlu Review', dotColor: 'bg-orange-500', headerBg: 'bg-orange-50' },
  { id: 'approved', title: 'Disetujui', dotColor: 'bg-blue-500', headerBg: 'bg-blue-50' },
  { id: 'scheduled', title: 'Terjadwal', dotColor: 'bg-purple-500', headerBg: 'bg-purple-50' },
  { id: 'published', title: 'Dipublikasikan', dotColor: 'bg-emerald-500', headerBg: 'bg-emerald-50' },
];

export const AVAILABLE_STATUS_COLORS = [
  { dot: 'bg-slate-400', bg: 'bg-slate-100', label: 'Abu-abu' },
  { dot: 'bg-amber-500', bg: 'bg-amber-50', label: 'Kuning / Amber' },
  { dot: 'bg-orange-500', bg: 'bg-orange-50', label: 'Oranye' },
  { dot: 'bg-indigo-500', bg: 'bg-indigo-50', label: 'Indigo / Ungu Muda' },
  { dot: 'bg-blue-500', bg: 'bg-blue-50', label: 'Biru' },
  { dot: 'bg-purple-500', bg: 'bg-purple-50', label: 'Ungu' },
  { dot: 'bg-emerald-500', bg: 'bg-emerald-50', label: 'Hijau Emerald' },
  { dot: 'bg-rose-500', bg: 'bg-rose-50', label: 'Merah Muda / Rose' },
  { dot: 'bg-cyan-500', bg: 'bg-cyan-50', label: 'Cyan / Biru Langit' },
  { dot: 'bg-teal-500', bg: 'bg-teal-50', label: 'Teal' },
];

interface StoredWorkflowValue<T> {
  savedAt: string;
  values: T;
}

function readStoredWorkflowValue<T>(key: string): { values: T; savedAt: number | null } | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);

    if (Array.isArray(parsed) && parsed.length > 0) {
      // Format lama: array tanpa penanda waktu. Tetap dipakai sebagai fallback
      // setelah data brand dari database.
      return { values: parsed as T, savedAt: null };
    }

    if (parsed && Array.isArray(parsed.values) && parsed.values.length > 0) {
      const savedAt = new Date(parsed.savedAt).getTime();
      return {
        values: parsed.values as T,
        savedAt: Number.isFinite(savedAt) ? savedAt : null,
      };
    }
  } catch {
    // Abaikan error parse
  }
  return null;
}

function isStoredValueNewerThanBrand(
  storedAt: number | null,
  brandUpdatedAt?: string | null,
): boolean {
  if (storedAt === null) return false;
  const brandTime = brandUpdatedAt ? new Date(brandUpdatedAt).getTime() : NaN;
  return !Number.isFinite(brandTime) || storedAt >= brandTime;
}

function writeStoredWorkflowValue<T>(key: string, values: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      savedAt: new Date().toISOString(),
      values,
    } satisfies StoredWorkflowValue<T>));
  } catch {
    // Abaikan
  }
}

export const workflowSettingsService = {
  /**
   * Mengambil daftar pilar konten aktif untuk brand.
   *
   * Perubahan yang baru disimpan di perangkat ini diprioritaskan selama data
   * brand di memori belum dimuat ulang. Setelah refresh, data terbaru dari
   * database kembali menjadi acuan.
   */
  getPillars(brand: Brand | null): string[] {
    if (!brand) return DEFAULT_CONTENT_PILLARS;

    const stored = readStoredWorkflowValue<string[]>(`zaflow_pillars_${brand.id}`);
    const brandPillars = brand.content_pillars && Array.isArray(brand.content_pillars) && brand.content_pillars.length > 0
      ? brand.content_pillars
      : null;

    if (stored && isStoredValueNewerThanBrand(stored.savedAt, brand.updated_at)) {
      return stored.values;
    }
    if (brandPillars) return brandPillars;
    if (stored) return stored.values;

    return DEFAULT_CONTENT_PILLARS;
  },

  /**
   * Mengambil status alur kerja kanban aktif untuk brand.
   */
  getWorkflowStatuses(brand: Brand | null): WorkflowStatusConfig[] {
    if (!brand) return DEFAULT_WORKFLOW_STATUSES;

    const stored = readStoredWorkflowValue<WorkflowStatusConfig[]>(`zaflow_workflow_${brand.id}`);
    const brandStatuses = brand.workflow_statuses && Array.isArray(brand.workflow_statuses) && brand.workflow_statuses.length > 0
      ? brand.workflow_statuses
      : null;

    if (stored && isStoredValueNewerThanBrand(stored.savedAt, brand.updated_at)) {
      return stored.values;
    }
    if (brandStatuses) return brandStatuses;
    if (stored) return stored.values;

    return DEFAULT_WORKFLOW_STATUSES;
  },

  /**
   * Menyimpan pilar konten baru untuk brand
   */
  async savePillars(brandId: string, pillars: string[]): Promise<void> {
    const cleaned = pillars.map((p) => p.trim()).filter((p) => p.length > 0);
    const finalPillars = cleaned.length > 0 ? cleaned : DEFAULT_CONTENT_PILLARS;

    // Simpan ke local storage agar instan & offline-safe
    writeStoredWorkflowValue(`zaflow_pillars_${brandId}`, finalPillars);

    // Simpan ke Supabase jika terkonfigurasi
    if (isConfigured) {
      try {
        await supabase
          .from('brands')
          .update({
            content_pillars: finalPillars,
            updated_at: new Date().toISOString(),
          })
          .eq('id', brandId);
      } catch (err) {
        console.warn('Gagal menyimpan pilar ke kolom content_pillars Supabase (mungkin kolom belum ditambahkan):', err);
      }
    }

    window.dispatchEvent(new CustomEvent('zaflow_workflow_updated', { detail: { brandId } }));
  },

  /**
   * Menyimpan daftar status alur kerja (kanban columns) untuk brand
   */
  async saveWorkflowStatuses(brandId: string, statuses: WorkflowStatusConfig[]): Promise<void> {
    const cleaned = statuses.filter((s) => s.id && s.title.trim().length > 0);
    const finalStatuses = cleaned.length > 0 ? cleaned : DEFAULT_WORKFLOW_STATUSES;

    // Simpan ke local storage
    writeStoredWorkflowValue(`zaflow_workflow_${brandId}`, finalStatuses);

    // Simpan ke Supabase jika terkonfigurasi
    if (isConfigured) {
      try {
        await supabase
          .from('brands')
          .update({
            workflow_statuses: finalStatuses,
            updated_at: new Date().toISOString(),
          })
          .eq('id', brandId);
      } catch (err) {
        console.warn('Gagal menyimpan workflow ke kolom workflow_statuses Supabase (mungkin kolom belum ditambahkan):', err);
      }
    }

    window.dispatchEvent(new CustomEvent('zaflow_workflow_updated', { detail: { brandId } }));
  },
};
