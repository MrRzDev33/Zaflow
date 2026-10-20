-- ==============================================================================
-- ZaFlow - Migrasi 20261020_01
-- Lisensi, pembayaran Midtrans, kuota AI atomik, dan penegakan batas paket
-- ==============================================================================
-- Jalankan SETELAH:
--   20261013_01_security_hardening_profiles_and_brands.sql
--   20261013_02_create_brand_invitations_and_activity_logs.sql
--
-- Migrasi ini idempoten (aman dijalankan ulang), kecuali bagian deduplikasi
-- lisensi aktif yang memang dimaksudkan untuk merapikan data lama.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Pastikan hardening 20261013_01 sudah diterapkan.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_guard_profiles'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Migrasi 20261013_01_security_hardening_profiles_and_brands.sql belum dijalankan. Jalankan migrasi tersebut lebih dahulu.';
    END IF;

    -- Tabel dasar dibuat oleh schema.sql. Beri pesan jelas jika schema.sql
    -- sebelumnya berhenti di tengah jalan.
    IF to_regclass('public.transactions') IS NULL
       OR to_regclass('public.licenses') IS NULL
       OR to_regclass('public.ai_usage_logs') IS NULL THEN
        RAISE EXCEPTION
            'Tabel dasar belum lengkap. Jalankan ulang schema.sql sampai selesai tanpa error, lalu jalankan migrasi ini lagi.';
    END IF;

    IF to_regclass('public.brand_invitations') IS NULL THEN
        RAISE EXCEPTION
            'Tabel public.brand_invitations belum ada. Jalankan 20261013_02_create_brand_invitations_and_activity_logs.sql terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Kolom baru untuk lisensi & pembayaran
-- ------------------------------------------------------------------------------
ALTER TABLE public.licenses
    ADD COLUMN IF NOT EXISTS plan_id TEXT;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS payment_provider TEXT,
    ADD COLUMN IF NOT EXISTS plan_id TEXT,
    ADD COLUMN IF NOT EXISTS snap_token TEXT,
    ADD COLUMN IF NOT EXISTS redirect_url TEXT,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.ai_usage_logs
    ADD COLUMN IF NOT EXISTS license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL;

-- Status pembayaran Midtrans dipetakan ke status internal.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'success', 'settlement', 'failed', 'expired', 'refunded'));

-- Status undangan boleh 'expired' (dipakai server saat masa berlaku habis).
ALTER TABLE public.brand_invitations DROP CONSTRAINT IF EXISTS brand_invitations_status_check;
ALTER TABLE public.brand_invitations
    ADD CONSTRAINT brand_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));

-- Audit kapan undangan diterima.
ALTER TABLE public.brand_invitations
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 2. Normalisasi email undangan + index pencarian
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_brand_invitation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.email := lower(trim(NEW.email));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_brand_invitation_email ON public.brand_invitations;
CREATE TRIGGER trg_normalize_brand_invitation_email
    BEFORE INSERT OR UPDATE OF email ON public.brand_invitations
    FOR EACH ROW EXECUTE FUNCTION public.normalize_brand_invitation_email();

CREATE INDEX IF NOT EXISTS idx_brand_invitations_email_lower
    ON public.brand_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
    ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_license
    ON public.ai_usage_logs (license_id);

-- ------------------------------------------------------------------------------
-- 3. Satu lisensi aktif per pemilik
-- ------------------------------------------------------------------------------
-- Rapikan duplikasi lama: pertahankan lisensi aktif terbaru, cabut sisanya.
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY owner_user_id
            ORDER BY COALESCE(activated_at, created_at) DESC, created_at DESC
        ) AS rn
    FROM public.licenses
    WHERE status = 'active'
      AND owner_user_id IS NOT NULL
)
UPDATE public.licenses AS l
SET status = 'revoked',
    updated_at = NOW()
FROM ranked AS r
WHERE l.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_one_active_per_owner
    ON public.licenses (owner_user_id)
    WHERE status = 'active' AND owner_user_id IS NOT NULL;

-- Backfill plan_id untuk data lama.
UPDATE public.licenses
SET plan_id = CASE
    WHEN lower(plan_name) LIKE '%ultra%' THEN 'ultra'
    WHEN lower(plan_name) LIKE '%pro%' THEN 'pro'
    WHEN lower(plan_name) LIKE '%starter%' THEN 'starter'
    ELSE 'trial'
END
WHERE plan_id IS NULL;

-- ------------------------------------------------------------------------------
-- 4. Pastikan setiap pengguna punya lisensi trial
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_license(p_user_id UUID)
RETURNS public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license public.licenses;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id wajib diisi';
    END IF;

    SELECT *
    INTO v_license
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status = 'active'
    ORDER BY COALESCE(activated_at, created_at) DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN v_license;
    END IF;

    INSERT INTO public.licenses (
        license_key,
        plan_id,
        plan_name,
        max_brands,
        max_team_members,
        ai_quota_total,
        ai_quota_used,
        status,
        owner_user_id,
        activated_at
    )
    VALUES (
        'TRIAL-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 12))
            || '-' || upper(substr(md5(random()::text), 1, 6)),
        'trial',
        'Trial',
        1,
        1,
        50,
        0,
        'active',
        p_user_id,
        NOW()
    )
    ON CONFLICT (owner_user_id)
        WHERE status = 'active' AND owner_user_id IS NOT NULL
        DO NOTHING
    RETURNING * INTO v_license;

    IF v_license.id IS NULL THEN
        SELECT *
        INTO v_license
        FROM public.licenses
        WHERE owner_user_id = p_user_id
          AND status = 'active'
        ORDER BY COALESCE(activated_at, created_at) DESC
        LIMIT 1;
    END IF;

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Pemotongan kuota AI atomik
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_ai_credit(
    p_user_id UUID,
    p_brand_id UUID,
    p_action_type TEXT,
    p_summary TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INT,
    total INT,
    used INT,
    license_id UUID,
    log_id UUID,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license public.licenses;
    v_updated public.licenses;
    v_log_id UUID;
BEGIN
    IF p_action_type NOT IN ('metrics_extractor', 'strategy_assistant', 'caption_writer') THEN
        RAISE EXCEPTION 'action_type tidak valid';
    END IF;

    v_license := public.ensure_user_license(p_user_id);

    IF v_license.id IS NULL THEN
        RETURN QUERY SELECT false, 0, 0, 0, NULL::uuid, NULL::uuid, 'Lisensi akun tidak ditemukan.';
        RETURN;
    END IF;

    -- Satu UPDATE bersyarat = atomik. Dua request paralel tidak bisa
    -- memakai kredit yang sama.
    UPDATE public.licenses
    SET ai_quota_used = ai_quota_used + 1,
        updated_at = NOW()
    WHERE id = v_license.id
      AND status = 'active'
      AND ai_quota_used < ai_quota_total
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
        SELECT * INTO v_updated FROM public.licenses WHERE id = v_license.id;
        RETURN QUERY SELECT
            false,
            GREATEST(v_updated.ai_quota_total - v_updated.ai_quota_used, 0),
            v_updated.ai_quota_total,
            v_updated.ai_quota_used,
            v_updated.id,
            NULL::uuid,
            'Kuota kredit AI Anda telah habis. Silakan tingkatkan paket untuk menambah kredit.';
        RETURN;
    END IF;

    INSERT INTO public.ai_usage_logs (
        user_id, brand_id, license_id, action_type, tokens_consumed, credits_deducted, prompt_summary
    )
    VALUES (
        p_user_id, p_brand_id, v_updated.id, p_action_type, 0, 1, left(coalesce(p_summary, ''), 300)
    )
    RETURNING id INTO v_log_id;

    RETURN QUERY SELECT
        true,
        v_updated.ai_quota_total - v_updated.ai_quota_used,
        v_updated.ai_quota_total,
        v_updated.ai_quota_used,
        v_updated.id,
        v_log_id,
        NULL::text;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Pengembalian kuota berdasarkan log tertentu (bukan log terakhir)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_ai_credit(
    p_license_id UUID,
    p_log_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.ai_usage_logs
    WHERE id = p_log_id
      AND license_id = p_license_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
        RETURN false;
    END IF;

    UPDATE public.licenses
    SET ai_quota_used = GREATEST(ai_quota_used - 1, 0),
        updated_at = NOW()
    WHERE id = p_license_id;

    RETURN true;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Aktivasi / upgrade lisensi setelah pembayaran berhasil
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_license_from_payment(
    p_user_id UUID,
    p_license_key TEXT,
    p_plan_id TEXT,
    p_plan_name TEXT,
    p_max_brands INT,
    p_max_team_members INT,
    p_ai_quota INT
)
RETURNS public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license public.licenses;
BEGIN
    IF p_user_id IS NULL OR p_plan_id IS NULL THEN
        RAISE EXCEPTION 'Data aktivasi lisensi tidak lengkap';
    END IF;

    SELECT *
    INTO v_license
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status = 'active'
    ORDER BY COALESCE(activated_at, created_at) DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.licenses
        SET plan_id = p_plan_id,
            plan_name = p_plan_name,
            max_brands = p_max_brands,
            max_team_members = p_max_team_members,
            -- Pembelian baru menambah kredit, bukan mereset pemakaian.
            ai_quota_total = ai_quota_used + GREATEST(p_ai_quota, 0),
            license_key = COALESCE(NULLIF(p_license_key, ''), license_key),
            activated_at = COALESCE(activated_at, NOW()),
            updated_at = NOW()
        WHERE id = v_license.id
        RETURNING * INTO v_license;

        RETURN v_license;
    END IF;

    INSERT INTO public.licenses AS l (
        license_key,
        plan_id,
        plan_name,
        max_brands,
        max_team_members,
        ai_quota_total,
        ai_quota_used,
        status,
        owner_user_id,
        activated_at
    )
    VALUES (
        p_license_key,
        p_plan_id,
        p_plan_name,
        p_max_brands,
        p_max_team_members,
        GREATEST(p_ai_quota, 0),
        0,
        'active',
        p_user_id,
        NOW()
    )
    ON CONFLICT (owner_user_id)
        WHERE status = 'active' AND owner_user_id IS NOT NULL
        DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            plan_name = EXCLUDED.plan_name,
            max_brands = EXCLUDED.max_brands,
            max_team_members = EXCLUDED.max_team_members,
            ai_quota_total = l.ai_quota_used + EXCLUDED.ai_quota_total,
            license_key = COALESCE(EXCLUDED.license_key, l.license_key),
            activated_at = COALESCE(l.activated_at, NOW()),
            updated_at = NOW()
    RETURNING * INTO v_license;

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Auto-create trial license saat user mendaftar
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    PERFORM public.ensure_user_license(new.id);
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Penegakan batas brand dan anggota tim
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_brand_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_max INT;
    v_count INT;
BEGIN
    IF NEW.created_by IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT max_brands
    INTO v_max
    FROM public.licenses
    WHERE owner_user_id = NEW.created_by
      AND status = 'active'
    LIMIT 1;

    v_max := COALESCE(v_max, 1);

    SELECT count(*)
    INTO v_count
    FROM public.brands
    WHERE created_by = NEW.created_by;

    IF v_count >= v_max THEN
        RAISE EXCEPTION
            'Batas brand paket Anda telah tercapai (% brand). Tingkatkan paket untuk menambah brand.', v_max
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brands_enforce_limit ON public.brands;
CREATE TRIGGER trg_brands_enforce_limit
    BEFORE INSERT ON public.brands
    FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_brand_limit();

CREATE OR REPLACE FUNCTION public.trg_enforce_team_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner UUID;
    v_max INT;
    v_count INT;
BEGIN
    -- Owner brand tidak dihitung sebagai anggota tambahan.
    IF NEW.role = 'owner' THEN
        RETURN NEW;
    END IF;

    SELECT created_by INTO v_owner
    FROM public.brands
    WHERE id = NEW.brand_id;

    IF v_owner IS NULL THEN
        SELECT user_id INTO v_owner
        FROM public.brand_members
        WHERE brand_id = NEW.brand_id
          AND role = 'owner'
        LIMIT 1;
    END IF;

    IF v_owner IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT max_team_members
    INTO v_max
    FROM public.licenses
    WHERE owner_user_id = v_owner
      AND status = 'active'
    LIMIT 1;

    v_max := COALESCE(v_max, 1);

    SELECT count(*)
    INTO v_count
    FROM public.brand_members
    WHERE brand_id = NEW.brand_id;

    -- v_count sudah mencakup owner yang biasanya sudah ada.
    IF v_count >= v_max THEN
        RAISE EXCEPTION
            'Batas anggota tim paket Anda telah tercapai (% anggota). Tingkatkan paket untuk menambah anggota.', v_max
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_members_enforce_limit ON public.brand_members;
CREATE TRIGGER trg_brand_members_enforce_limit
    BEFORE INSERT ON public.brand_members
    FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_team_member_limit();

-- ------------------------------------------------------------------------------
-- 10. Kunci tabel sensitif dari penulisan langsung oleh client
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.licenses FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage_logs FROM anon, authenticated;

GRANT SELECT ON public.licenses TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.ai_usage_logs TO authenticated;

-- RPC hanya untuk service role (server BFF).
REVOKE ALL ON FUNCTION public.ensure_user_license(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_ai_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_license_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enforce_brand_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enforce_team_member_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_brand_invitation_email() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_user_license(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_license_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 11. Muat ulang schema cache PostgREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFIKASI CEPAT (jalankan manual setelah migrasi):
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'licenses' AND indexname = 'uq_licenses_one_active_per_owner';
--
--   SELECT proname FROM pg_proc
--   WHERE proname IN ('consume_ai_credit', 'refund_ai_credit', 'activate_license_from_payment');
-- ==============================================================================
