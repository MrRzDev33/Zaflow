-- Hapus tanggal posting aktual.
-- Analitik dan laporan kini memakai jadwal posting (scheduled_at) sebagai
-- acuan waktu, dengan fallback created_at untuk konten lama.

DROP INDEX IF EXISTS public.idx_content_posts_brand_posted_at;

ALTER TABLE public.content_posts
  DROP COLUMN IF EXISTS posted_at;

COMMENT ON COLUMN public.content_posts.scheduled_at IS
  'Jadwal posting (tanggal & jam). Menjadi acuan tren analitik dan prompt AI.';
