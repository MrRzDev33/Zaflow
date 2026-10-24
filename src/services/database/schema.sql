-- ==============================================================================
-- ZaFlow - SKEMA DATABASE POSTGRESQL & ROW LEVEL SECURITY (RLS) UNTUK SUPABASE
-- ==============================================================================
-- Modul: Multi-Brand, Multi-User RBAC, Konten Kalender/Kanban, Metrik, & Lisensi
-- ==============================================================================
-- PENTING (WAJIB DIBACA):
-- Berkas ini hanya membuat skema DASAR. Setelah menjalankannya, Anda WAJIB
-- menjalankan migrasi berikut secara berurutan di Supabase SQL Editor:
--   1. migrations/20261013_01_security_hardening_profiles_and_brands.sql
--   2. migrations/20261013_02_create_brand_invitations_and_activity_logs.sql
--   3. migrations/20261020_01_licensing_payments_limits_and_rpc.sql
--   4. migrations/20261020_02_content_brief_post_links_and_storage.sql
--   5. migrations/20261023_01_subscriptions_promo_trial_admin_and_support.sql
--   6. migrations/20261024_01_activation_code_hardening.sql
--   7. migrations/20261024_02_brand_platforms_and_trial_access_hardening.sql
--
-- Tanpa migrasi di atas, kebijakan RLS pada berkas ini masih rentan
-- (termasuk eskalasi role dan pelanggaran batas paket).
-- ==============================================================================

BEGIN;

-- 1. TABEL PROFILES (Ekstensi auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    system_role TEXT NOT NULL DEFAULT 'user' CHECK (system_role IN ('user', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL LICENSES (Langganan Bulanan, Trial, dan Kuota AI)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'Starter',
    max_brands INT NOT NULL DEFAULT 1,
    max_team_members INT NOT NULL DEFAULT 2,
    ai_quota_total INT NOT NULL DEFAULT 100, -- Kuota AI per siklus langganan
    ai_quota_used INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'expired', 'revoked', 'canceled')),
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL BRANDS (Workspace Multi-Brand)
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    industry TEXT,
    description TEXT,
    logo_url TEXT,
    color_hex TEXT NOT NULL DEFAULT '#2563EB',
    social_accounts JSONB NOT NULL DEFAULT '{}'::jsonb, -- { "instagram": "@brand", "tiktok": "@brand", ... }
    platforms TEXT[] NOT NULL DEFAULT ARRAY['instagram']::TEXT[], -- Platform yang dipilih saat brand dibuat
    content_pillars JSONB DEFAULT '["Edukatif", "Promosi", "Interaktif", "Inspiratif", "Behind The Scenes", "Hiburan"]'::jsonb,
    workflow_statuses JSONB DEFAULT '[{"id":"idea","title":"Ide (Backlog)","dotColor":"bg-slate-400","headerBg":"bg-slate-100"},{"id":"draft","title":"Draf Penulisan","dotColor":"bg-amber-500","headerBg":"bg-amber-50"},{"id":"production","title":"Produksi / Shooting","dotColor":"bg-indigo-500","headerBg":"bg-indigo-50"},{"id":"in_review","title":"Perlu Review","dotColor":"bg-orange-500","headerBg":"bg-orange-50"},{"id":"approved","title":"Disetujui","dotColor":"bg-blue-500","headerBg":"bg-blue-50"},{"id":"scheduled","title":"Terjadwal","dotColor":"bg-purple-500","headerBg":"bg-purple-50"},{"id":"published","title":"Dipublikasikan","dotColor":"bg-emerald-500","headerBg":"bg-emerald-50"}]'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL BRAND_MEMBERS (Role-Based Access Control per Brand)
CREATE TABLE IF NOT EXISTS public.brand_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand_id, user_id)
);

-- 5. TABEL CONTENT_POSTS (Content Planning, Calendar, & Kanban)
CREATE TABLE IF NOT EXISTS public.content_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caption TEXT,
    brief TEXT, -- Script / brief produksi konten
    hashtags TEXT[] NOT NULL DEFAULT '{}',
    channels TEXT[] NOT NULL DEFAULT '{"instagram"}'::TEXT[], -- 'instagram', 'tiktok', 'reels', 'linkedin', 'facebook', 'youtube'
    format TEXT NOT NULL DEFAULT 'single_image' CHECK (format IN ('single_image', 'carousel', 'reel_short', 'video', 'story', 'text_thread')),
    pillar TEXT NOT NULL DEFAULT 'Edukatif', -- Kustom per brand
    status TEXT NOT NULL DEFAULT 'idea', -- Dinamis mengikuti status alur kerja kanban brand
    scheduled_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ, -- Tanggal aktual konten diposting
    production_date TIMESTAMPTZ, -- Tanggal dan waktu produksi / shooting
    post_url TEXT, -- URL postingan publik
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL CONTENT_METRICS (Hasil Ekstraksi AI & Analitik Performa Konten)
CREATE TABLE IF NOT EXISTS public.content_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    impressions INT NOT NULL DEFAULT 0,
    reach INT NOT NULL DEFAULT 0,
    engagement_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    likes INT NOT NULL DEFAULT 0,
    comments INT NOT NULL DEFAULT 0,
    shares INT NOT NULL DEFAULT 0,
    saves INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_screenshot', 'ai_video')),
    watch_time TEXT,
    drop_off_rate NUMERIC,
    reposts INT DEFAULT 0,
    traffic_sources JSONB,
    audience_breakdown JSONB,
    raw_ai_analysis JSONB,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABEL AI_USAGE_LOGS (Pencatatan Audit Penggunaan Kuota AI)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('metrics_extractor', 'strategy_assistant', 'caption_writer')),
    tokens_consumed INT NOT NULL DEFAULT 0,
    credits_deducted INT NOT NULL DEFAULT 1,
    prompt_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL ACTIVITY_LOGS (Audit Trail Aktivitas Tim)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g., 'created_post', 'updated_status', 'added_member'
    entity_type TEXT NOT NULL, -- 'content_post', 'brand_member', 'brand'
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXING UNTUK PERFORMA QUERY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_brand_members_user ON public.brand_members(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_members_brand ON public.brand_members(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_brand ON public.content_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts(status);
CREATE INDEX IF NOT EXISTS idx_content_posts_scheduled ON public.content_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_posts_brand_posted_at ON public.content_posts(brand_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_posts_brand_scheduled_at ON public.content_posts(brand_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_metrics_brand ON public.content_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_brand ON public.activity_logs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON public.ai_usage_logs(user_id, created_at DESC);

-- ==============================================================================
-- FUNGSI SECURITY DEFINER (Mencegah Rekursi RLS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_brand_member(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.brand_members
        WHERE brand_id = p_brand_id
          AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_brand_role(p_brand_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role
    FROM public.brand_members
    WHERE brand_id = p_brand_id
      AND user_id = auth.uid()
    LIMIT 1;
$$;

-- TRIGGER AUTO-CREATE PROFILE SAAT USER REGISTER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, system_role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Pengguna dapat melihat profil pengguna lain dalam brand yang sama" ON public.profiles;
CREATE POLICY "Pengguna dapat melihat profil pengguna lain dalam brand yang sama"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.brand_members bm1
            JOIN public.brand_members bm2 ON bm1.brand_id = bm2.brand_id
            WHERE bm1.user_id = auth.uid() AND bm2.user_id = public.profiles.id
        )
    );

DROP POLICY IF EXISTS "Pengguna hanya dapat mengubah profil miliknya sendiri (kecuali role)" ON public.profiles;
CREATE POLICY "Pengguna hanya dapat mengubah profil miliknya sendiri (kecuali role)"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 2. LICENSES POLICIES (Read-only untuk pemilik, modifikasi kuota hanya oleh backend)
DROP POLICY IF EXISTS "Pemilik dapat melihat lisensi miliknya" ON public.licenses;
CREATE POLICY "Pemilik dapat melihat lisensi miliknya"
    ON public.licenses FOR SELECT
    USING (owner_user_id = auth.uid());

-- 3. BRANDS POLICIES
DROP POLICY IF EXISTS "Anggota dapat melihat brand yang diikutinya" ON public.brands;
CREATE POLICY "Anggota dapat melihat brand yang diikutinya"
    ON public.brands FOR SELECT
    USING (public.is_brand_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Pengguna terautentikasi dapat membuat brand baru" ON public.brands;
CREATE POLICY "Pengguna terautentikasi dapat membuat brand baru"
    ON public.brands FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owner atau Admin brand dapat mengubah brand" ON public.brands;
CREATE POLICY "Owner atau Admin brand dapat mengubah brand"
    ON public.brands FOR UPDATE
    USING (public.get_user_brand_role(id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Hanya Owner brand yang dapat menghapus brand" ON public.brands;
CREATE POLICY "Hanya Owner brand yang dapat menghapus brand"
    ON public.brands FOR DELETE
    USING (public.get_user_brand_role(id) = 'owner');

-- 4. BRAND_MEMBERS POLICIES
DROP POLICY IF EXISTS "Anggota dapat melihat daftar anggota lain dalam brand yang sama" ON public.brand_members;
CREATE POLICY "Anggota dapat melihat daftar anggota lain dalam brand yang sama"
    ON public.brand_members FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Owner atau Admin dapat mengundang atau menambahkan anggota" ON public.brand_members;
CREATE POLICY "Owner atau Admin dapat mengundang atau menambahkan anggota"
    ON public.brand_members FOR INSERT
    WITH CHECK (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin') OR
        -- Izinkan pembuat brand pertama kali mendaftarkan dirinya sebagai 'owner'
        (user_id = auth.uid() AND role = 'owner')
    );

DROP POLICY IF EXISTS "Owner atau Admin dapat memperbarui role anggota" ON public.brand_members;
CREATE POLICY "Owner atau Admin dapat memperbarui role anggota"
    ON public.brand_members FOR UPDATE
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owner atau Admin dapat mengeluarkan anggota (Owner tidak bisa dikeluarkan sembarangan)" ON public.brand_members;
CREATE POLICY "Owner atau Admin dapat mengeluarkan anggota (Owner tidak bisa dikeluarkan sembarangan)"
    ON public.brand_members FOR DELETE
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));

-- 5. CONTENT_POSTS POLICIES
DROP POLICY IF EXISTS "Anggota brand dapat melihat semua konten postingan brand" ON public.content_posts;
CREATE POLICY "Anggota brand dapat melihat semua konten postingan brand"
    ON public.content_posts FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat membuat konten" ON public.content_posts;
CREATE POLICY "Owner, Admin, dan Editor dapat membuat konten"
    ON public.content_posts FOR INSERT
    WITH CHECK (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat mengubah konten" ON public.content_posts;
CREATE POLICY "Owner, Admin, dan Editor dapat mengubah konten"
    ON public.content_posts FOR UPDATE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner dan Admin dapat menghapus konten" ON public.content_posts;
CREATE POLICY "Owner dan Admin dapat menghapus konten"
    ON public.content_posts FOR DELETE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin')
    );

-- 6. CONTENT_METRICS POLICIES
DROP POLICY IF EXISTS "Anggota brand dapat membaca metrik analitik" ON public.content_metrics;
CREATE POLICY "Anggota brand dapat membaca metrik analitik"
    ON public.content_metrics FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat mencatat atau mengunggah metrik" ON public.content_metrics;
CREATE POLICY "Owner, Admin, dan Editor dapat mencatat atau mengunggah metrik"
    ON public.content_metrics FOR INSERT
    WITH CHECK (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner, Admin, dan Editor dapat mengubah metrik" ON public.content_metrics;
CREATE POLICY "Owner, Admin, dan Editor dapat mengubah metrik"
    ON public.content_metrics FOR UPDATE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin', 'editor')
    );

DROP POLICY IF EXISTS "Owner dan Admin dapat menghapus metrik" ON public.content_metrics;
CREATE POLICY "Owner dan Admin dapat menghapus metrik"
    ON public.content_metrics FOR DELETE
    USING (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin')
    );

-- 7. ACTIVITY_LOGS POLICIES
DROP POLICY IF EXISTS "Anggota brand dapat membaca log aktivitas" ON public.activity_logs;
CREATE POLICY "Anggota brand dapat membaca log aktivitas"
    ON public.activity_logs FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Anggota brand dapat membuat log aktivitas" ON public.activity_logs;
CREATE POLICY "Anggota brand dapat membuat log aktivitas"
    ON public.activity_logs FOR INSERT
    WITH CHECK (public.is_brand_member(brand_id));

-- 8. AI_USAGE_LOGS POLICIES
DROP POLICY IF EXISTS "Pengguna dapat melihat riwayat kuota AI miliknya" ON public.ai_usage_logs;
CREATE POLICY "Pengguna dapat melihat riwayat kuota AI miliknya"
    ON public.ai_usage_logs FOR SELECT
    USING (user_id = auth.uid());

-- 9. TABEL TRANSACTIONS (Pencatatan Transaksi Pembayaran Lisensi Sekali Bayar)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    license_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'settlement', 'failed', 'expired')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengguna dapat melihat transaksi miliknya" ON public.transactions;
CREATE POLICY "Pengguna dapat melihat transaksi miliknya"
    ON public.transactions FOR SELECT
    USING (user_id = auth.uid());

-- 10. TABEL BRAND_INVITATIONS (Undangan Anggota Brand)
CREATE TABLE IF NOT EXISTS public.brand_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.brand_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anggota brand dapat melihat undangan brand" ON public.brand_invitations;
CREATE POLICY "Anggota brand dapat melihat undangan brand"
    ON public.brand_invitations FOR SELECT
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "Owner atau Admin dapat mengelola undangan brand" ON public.brand_invitations;
CREATE POLICY "Owner atau Admin dapat mengelola undangan brand"
    ON public.brand_invitations FOR ALL
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));


COMMIT;
