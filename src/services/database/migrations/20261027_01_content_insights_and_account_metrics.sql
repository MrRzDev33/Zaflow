-- ============================================================================
-- Migrasi: Detail Insight per Postingan + Ringkasan Akun Bulanan
-- Tanggal: 2026-10-27
--
-- Perubahan:
--   1. content_metrics: kolom baru untuk tindakan pengguna, jenis konten, dan
--      detail insight per postingan (JSONB).
--   2. Tabel baru account_metrics: ringkasan akun bulanan dari dashboard
--      profesional Instagram, dipisah dari metrik per konten agar agregasi
--      tidak tercampur (reach akun != penjumlahan reach per konten).
--
-- Catatan: snapshot lama sengaja tidak dimigrasi. Kolom baru terisi mulai
-- snapshot berikutnya.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. KOLOM BARU DI CONTENT_METRICS
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_metrics
    ADD COLUMN IF NOT EXISTS profile_visits INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS follows INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS content_type TEXT,
    ADD COLUMN IF NOT EXISTS insights_detail JSONB;

COMMENT ON COLUMN public.content_metrics.profile_visits IS 'Kunjungan profil yang diatribusikan ke konten ini';
COMMENT ON COLUMN public.content_metrics.follows IS 'Jumlah pengikut baru yang diatribusikan ke konten ini';
COMMENT ON COLUMN public.content_metrics.content_type IS 'Jenis konten: reel, feed, carousel, atau story';
COMMENT ON COLUMN public.content_metrics.insights_detail IS 'Detail insight Instagram per postingan: faktor tayangan, sumber tayangan, demografi pemirsa, dan deret grafik';

-- ---------------------------------------------------------------------------
-- 2. TABEL ACCOUNT_METRICS (Ringkasan Akun Bulanan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'instagram',
    period_month TEXT NOT NULL,
    views INT NOT NULL DEFAULT 0,
    reach INT NOT NULL DEFAULT 0,
    interactions_total INT NOT NULL DEFAULT 0,
    profile_visits INT NOT NULL DEFAULT 0,
    follows INT NOT NULL DEFAULT 0,
    followers_total INT NOT NULL DEFAULT 0,
    traffic_sources JSONB,
    audience_breakdown JSONB,
    raw_ai_analysis JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT account_metrics_period_month_format
        CHECK (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- Satu ringkasan per brand + channel + bulan, sehingga bisa diperbarui tanpa duplikat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_metrics_unique_period
    ON public.account_metrics (brand_id, channel, period_month);

CREATE INDEX IF NOT EXISTS idx_account_metrics_brand_period
    ON public.account_metrics (brand_id, period_month DESC);

ALTER TABLE public.account_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anggota brand dapat membaca ringkasan akun" ON public.account_metrics;
CREATE POLICY "Anggota brand dapat membaca ringkasan akun"
    ON public.account_metrics FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat mencatat ringkasan akun" ON public.account_metrics;
CREATE POLICY "Owner, Admin, dan Editor dapat mencatat ringkasan akun"
    ON public.account_metrics FOR INSERT
    WITH CHECK (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat mengubah ringkasan akun" ON public.account_metrics;
CREATE POLICY "Owner, Admin, dan Editor dapat mengubah ringkasan akun"
    ON public.account_metrics FOR UPDATE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner dan Admin dapat menghapus ringkasan akun" ON public.account_metrics;
CREATE POLICY "Owner dan Admin dapat menghapus ringkasan akun"
    ON public.account_metrics FOR DELETE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin')
    );

COMMIT;
