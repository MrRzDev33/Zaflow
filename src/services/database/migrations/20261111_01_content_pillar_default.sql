-- ==============================================================================
-- DEFAULT PILAR KONTEN
-- Menghapus default 'Edukatif' pada content_posts.pillar agar postingan tanpa
-- pilar tidak otomatis memakai pilar yang tidak dipilih pengguna.
-- Nilai pilar tetap diisi dari daftar pilar aktif brand oleh aplikasi.
-- ==============================================================================

BEGIN;

ALTER TABLE public.content_posts
    ALTER COLUMN pillar SET DEFAULT '';

COMMIT;
