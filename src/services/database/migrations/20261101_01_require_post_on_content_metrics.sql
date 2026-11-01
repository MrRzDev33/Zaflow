-- ============================================================================
-- Migrasi: Wajibkan Postingan pada Setiap Snapshot Metrik
-- Tanggal: 2026-11-01
--
-- Perubahan:
--   1. Menghapus permanen snapshot umum (content_metrics.post_id IS NULL).
--   2. Menjadikan content_metrics.post_id wajib (NOT NULL).
--   3. Menambah index untuk laporan per postingan + saluran.
--
-- Catatan:
--   - Penghapusan tidak dapat dibatalkan. Snapshot umum juga akan hilang dari
--     laporan historis.
--   - Foreign key tetap ON DELETE CASCADE, sehingga menghapus postingan akan
--     menghapus snapshot miliknya (tidak menghasilkan baris NULL baru).
-- ============================================================================

BEGIN;

-- 1. Hapus semua snapshot tanpa postingan (seluruh brand).
DELETE FROM public.content_metrics
WHERE post_id IS NULL;

-- 2. Setiap snapshot wajib terhubung ke satu postingan.
ALTER TABLE public.content_metrics
    ALTER COLUMN post_id SET NOT NULL;

-- 3. Index untuk mengambil snapshot terbaru per postingan + saluran.
CREATE INDEX IF NOT EXISTS idx_content_metrics_post_channel_recorded
    ON public.content_metrics (post_id, channel, recorded_at DESC);

COMMIT;
