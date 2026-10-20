-- ============================================================
-- ZaFlow: Brief konten, link posting, tanggal posting aktual,
-- dan policy Supabase Storage untuk bucket content-media
-- ============================================================
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Aman dijalankan ulang (idempoten).

BEGIN;

-- 1. Kolom baru pada content_posts
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS brief TEXT,
  ADD COLUMN IF NOT EXISTS post_url TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.content_posts.brief IS 'Script / brief produksi konten';
COMMENT ON COLUMN public.content_posts.post_url IS 'URL postingan setelah konten dipublikasikan';
COMMENT ON COLUMN public.content_posts.posted_at IS 'Tanggal/waktu aktual konten diposting';

-- 2. Isi posted_at untuk konten lama yang sudah published
UPDATE public.content_posts
SET posted_at = COALESCE(posted_at, scheduled_at, updated_at, created_at)
WHERE posted_at IS NULL
  AND (
    status ILIKE '%publish%'
    OR status ILIKE '%posted%'
    OR status ILIKE '%posting%'
    OR status ILIKE '%tayang%'
  );

-- 3. Index untuk filter histori Konten Post
CREATE INDEX IF NOT EXISTS idx_content_posts_brand_posted_at
  ON public.content_posts (brand_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_posts_brand_scheduled_at
  ON public.content_posts (brand_id, scheduled_at DESC);

-- 4. Policy Storage bucket privat `content-media`
-- Path file wajib diawali brand_id, misalnya:
--   <brand_uuid>/1712345678-abcd1234-gambar.jpg
-- Bucket sendiri tidak diubah menjadi public; gambar dibaca melalui signed URL.

DROP POLICY IF EXISTS "content_media_read_brand_members" ON storage.objects;
CREATE POLICY "content_media_read_brand_members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "content_media_insert_editors" ON storage.objects;
CREATE POLICY "content_media_insert_editors"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.get_user_brand_role(((storage.foldername(name))[1])::uuid) IN ('owner', 'admin', 'editor')
);

DROP POLICY IF EXISTS "content_media_update_editors" ON storage.objects;
CREATE POLICY "content_media_update_editors"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.get_user_brand_role(((storage.foldername(name))[1])::uuid) IN ('owner', 'admin', 'editor')
)
WITH CHECK (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.get_user_brand_role(((storage.foldername(name))[1])::uuid) IN ('owner', 'admin', 'editor')
);

DROP POLICY IF EXISTS "content_media_delete_editors" ON storage.objects;
CREATE POLICY "content_media_delete_editors"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.get_user_brand_role(((storage.foldername(name))[1])::uuid) IN ('owner', 'admin', 'editor')
);

COMMIT;
