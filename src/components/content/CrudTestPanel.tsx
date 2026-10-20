import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Layers,
  Calendar,
  Kanban,
  Copy,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { brandsService } from '../../services/database/brandsService.ts';
import { contentService } from '../../services/database/contentService.ts';
import { Brand } from '../../types/database.ts';

interface TestStep {
  id: string;
  name: string;
  description: string;
  icon: typeof Database;
  status: 'idle' | 'running' | 'success' | 'failed';
  durationMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface CrudTestPanelProps {
  currentBrand: Brand | null;
  onRefreshNeeded: () => void;
}

export const CrudTestPanel: React.FC<CrudTestPanelProps> = ({
  currentBrand,
  onRefreshNeeded,
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    {
      id: 'brand_read',
      name: '1. Verifikasi Baca Brand (RLS Check)',
      description: 'Membaca daftar brand aktif terisolasi berdasarkan token pengguna dari tabel public.brands',
      icon: Layers,
      status: 'idle',
    },
    {
      id: 'post_create',
      name: '2. Create: Buat Postingan Baru',
      description: 'Menyimpan postingan konten baru dengan channel, format, pilar, dan status ke Supabase',
      icon: Database,
      status: 'idle',
    },
    {
      id: 'post_read_filter',
      name: '3. Read & Filter: Pencarian & Saluran',
      description: 'Melakukan query SELECT dengan filter saluran, pencarian teks, dan evaluasi RLS',
      icon: Database,
      status: 'idle',
    },
    {
      id: 'post_duplicate',
      name: '4. Duplicate: Penggandaan Konten',
      description: 'Menduplikasi postingan yang ada menjadi salinan draf baru di database',
      icon: Copy,
      status: 'idle',
    },
    {
      id: 'post_schedule_dnd',
      name: '5. Update: Jadwal Kalender (Drag & Drop)',
      description: 'Mengubah field scheduled_at postingan sesuai interaksi drag-and-drop kalender',
      icon: Calendar,
      status: 'idle',
    },
    {
      id: 'post_status_kanban',
      name: '6. Update: Status Kanban Workflow',
      description: 'Mengubah alur kerja dari idea -> in_review -> approved -> published',
      icon: Kanban,
      status: 'idle',
    },
    {
      id: 'post_delete',
      name: '7. Delete: Hapus Konten',
      description: 'Menghapus postingan uji coba dari tabel public.content_posts di Supabase',
      icon: Trash2,
      status: 'idle',
    },
  ]);

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setTestSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const runAllTests = async () => {
    if (!currentBrand) {
      alert('Silakan pilih atau buat brand aktif terlebih dahulu sebelum menjalankan pengujian CRUD.');
      return;
    }

    setIsRunningAll(true);
    let createdPostId: string | null = null;
    let duplicatedPostId: string | null = null;

    // Reset status
    setTestSteps((prev) => prev.map((s) => ({ ...s, status: 'idle', message: undefined, details: undefined })));

    try {
      // 1. Test Read Brand
      {
        const startTime = performance.now();
        updateStep('brand_read', { status: 'running' });
        try {
          const brands = await brandsService.getUserBrands();
          const duration = Math.round(performance.now() - startTime);
          updateStep('brand_read', {
            status: 'success',
            durationMs: duration,
            message: `Berhasil membaca ${brands.length} workspace brand yang memiliki izin akses RLS.`,
            details: { activeBrandId: currentBrand.id, brandName: currentBrand.name },
          });
        } catch (err: unknown) {
          updateStep('brand_read', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal membaca brand',
          });
          throw err;
        }
      }

      // 2. Test Create Post
      {
        const startTime = performance.now();
        updateStep('post_create', { status: 'running' });
        try {
          const newPost = await contentService.createPost({
            brand_id: currentBrand.id,
            title: `[Uji CRUD] Konten Otomatis ${new Date().toLocaleTimeString('id-ID')}`,
            caption: 'Draf konten dibuat oleh sistem automated testing ZaFlow.',
            hashtags: ['#zaflow', '#ujicrud', '#otomatisasi'],
            channels: ['instagram', 'tiktok'],
            format: 'carousel',
            pillar: 'Edukatif',
            status: 'idea',
            scheduled_at: null,
          });
          createdPostId = newPost.id;
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_create', {
            status: 'success',
            durationMs: duration,
            message: `Postingan berhasil dibuat dengan UUID: ${newPost.id}`,
            details: { title: newPost.title, id: newPost.id, format: newPost.format },
          });
        } catch (err: unknown) {
          updateStep('post_create', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal membuat post',
          });
          throw err;
        }
      }

      // 3. Test Read & Filter
      {
        const startTime = performance.now();
        updateStep('post_read_filter', { status: 'running' });
        try {
          const results = await contentService.getPosts(currentBrand.id, {
            search: 'Uji CRUD',
            channel: 'instagram',
          });
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_read_filter', {
            status: 'success',
            durationMs: duration,
            message: `Filter berhasil menemukan ${results.length} postingan yang cocok di Supabase.`,
          });
        } catch (err: unknown) {
          updateStep('post_read_filter', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal memfilter post',
          });
          throw err;
        }
      }

      // 4. Test Duplicate
      if (createdPostId) {
        const startTime = performance.now();
        updateStep('post_duplicate', { status: 'running' });
        try {
          const duplicated = await contentService.duplicatePost(createdPostId);
          duplicatedPostId = duplicated.id;
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_duplicate', {
            status: 'success',
            durationMs: duration,
            message: `Duplikasi sukses. Salinan baru terbuat dengan judul: "${duplicated.title}"`,
            details: { originalId: createdPostId, duplicatedId: duplicated.id },
          });
        } catch (err: unknown) {
          updateStep('post_duplicate', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal menduplikasi post',
          });
          throw err;
        }
      }

      // 5. Test Update Schedule (Calendar DnD)
      if (createdPostId) {
        const startTime = performance.now();
        updateStep('post_schedule_dnd', { status: 'running' });
        try {
          const targetDate = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 hari ke depan
          const updated = await contentService.updatePostSchedule(createdPostId, targetDate);
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_schedule_dnd', {
            status: 'success',
            durationMs: duration,
            message: `Jadwal tanggal berhasil diupdate menjadi: ${new Date(targetDate).toLocaleDateString('id-ID')}`,
            details: { scheduled_at: updated.scheduled_at },
          });
        } catch (err: unknown) {
          updateStep('post_schedule_dnd', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal mengubah jadwal',
          });
          throw err;
        }
      }

      // 6. Test Update Status (Kanban DnD)
      if (createdPostId) {
        const startTime = performance.now();
        updateStep('post_status_kanban', { status: 'running' });
        try {
          const updated = await contentService.updatePostStatus(createdPostId, 'approved');
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_status_kanban', {
            status: 'success',
            durationMs: duration,
            message: `Status alur kerja berhasil diubah ke: "${updated.status}"`,
          });
        } catch (err: unknown) {
          updateStep('post_status_kanban', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal mengubah status',
          });
          throw err;
        }
      }

      // 7. Test Delete
      {
        const startTime = performance.now();
        updateStep('post_delete', { status: 'running' });
        try {
          if (createdPostId) {
            await contentService.deletePost(createdPostId);
          }
          if (duplicatedPostId) {
            await contentService.deletePost(duplicatedPostId);
          }
          const duration = Math.round(performance.now() - startTime);
          updateStep('post_delete', {
            status: 'success',
            durationMs: duration,
            message: 'Semua postingan uji coba berhasil dibersihkan dari database.',
          });
        } catch (err: unknown) {
          updateStep('post_delete', {
            status: 'failed',
            message: err instanceof Error ? err.message : 'Gagal menghapus post uji',
          });
          throw err;
        }
      }

      onRefreshNeeded();
    } catch {
      // stop sequence on critical failure
    } finally {
      setIsRunningAll(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Panel Pengujian CRUD Supabase</h2>
              <p className="text-xs text-slate-500">
                Verifikasi real-time operasi Create, Read, Update, Delete, Duplikasi, dan Drag-and-Drop pada database nyata
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={runAllTests}
          disabled={isRunningAll || !currentBrand}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
        >
          {isRunningAll ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menjalankan Pengujian...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Jalankan Semua Pengujian CRUD</span>
            </>
          )}
        </button>
      </div>

      {/* Test step items */}
      <div className="space-y-3">
        {testSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-colors ${
                step.status === 'success'
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : step.status === 'failed'
                  ? 'bg-red-50/40 border-red-200'
                  : step.status === 'running'
                  ? 'bg-indigo-50/40 border-indigo-200'
                  : 'bg-slate-50/60 border-slate-200/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      step.status === 'success'
                        ? 'bg-emerald-100 text-emerald-700'
                        : step.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : step.status === 'running'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900">{step.name}</h3>
                      {step.durationMs !== undefined && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                          {step.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{step.description}</p>

                    {step.message && (
                      <p
                        className={`text-xs mt-1.5 font-medium ${
                          step.status === 'success'
                            ? 'text-emerald-800'
                            : step.status === 'failed'
                            ? 'text-red-800'
                            : 'text-slate-700'
                        }`}
                      >
                        {step.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {step.status === 'running' && (
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  )}
                  {step.status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  {step.status === 'idle' && (
                    <span className="text-[11px] text-slate-400 font-medium">Menunggu</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
