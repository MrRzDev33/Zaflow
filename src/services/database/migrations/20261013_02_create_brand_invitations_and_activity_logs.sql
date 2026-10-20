-- ==============================================================================
-- ZaFlow - Migrasi 20261013_02
-- Tabel undangan tim (brand_invitations) dan log aktivitas (activity_logs)
-- ==============================================================================
-- Jalankan SETELAH schema.sql dan 20261013_01.
-- Sifat: idempotent dan transaksional. Aman dijalankan ulang.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Tabel brand_invitations
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_brand_invitations_brand_id
    ON public.brand_invitations (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_invitations_email
    ON public.brand_invitations (email);
CREATE INDEX IF NOT EXISTS idx_brand_invitations_status
    ON public.brand_invitations (status);

ALTER TABLE public.brand_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anggota brand dapat melihat undangan brand" ON public.brand_invitations;
DROP POLICY IF EXISTS "Owner atau Admin dapat mengelola undangan brand" ON public.brand_invitations;
DROP POLICY IF EXISTS "brand_invitations_select_policy" ON public.brand_invitations;
CREATE POLICY "brand_invitations_select_policy"
    ON public.brand_invitations FOR SELECT
    TO authenticated
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "brand_invitations_manage_policy" ON public.brand_invitations;
CREATE POLICY "brand_invitations_manage_policy"
    ON public.brand_invitations FOR ALL
    TO authenticated
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));

REVOKE ALL ON TABLE public.brand_invitations FROM PUBLIC, anon;
GRANT ALL ON TABLE public.brand_invitations TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brand_invitations TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Tabel activity_logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_brand
    ON public.activity_logs (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user
    ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anggota brand dapat membaca log aktivitas" ON public.activity_logs;
DROP POLICY IF EXISTS "Anggota brand dapat membuat log aktivitas" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
CREATE POLICY "activity_logs_select_policy"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (public.is_brand_member(brand_id));

DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_policy"
    ON public.activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_brand_member(brand_id));

REVOKE ALL ON TABLE public.activity_logs FROM PUBLIC, anon;
GRANT ALL ON TABLE public.activity_logs TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.activity_logs TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
