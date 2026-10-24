-- ==============================================================================
-- ZaFlow - Migrasi 20261023_01
-- Langganan bulanan, promo berjangka, trial 3 hari, kode aktivasi,
-- pengelolaan akun admin, audit log, dan kontak customer service.
-- ==============================================================================
-- Jalankan SETELAH:
--   20261020_01_licensing_payments_limits_and_rpc.sql
--   20261020_02_content_brief_post_links_and_storage.sql
--
-- Migrasi ini idempoten. Bagian backfill hanya mengubah data lama yang belum
-- memiliki status/perioda langganan.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.licenses') IS NULL
       OR to_regclass('public.profiles') IS NULL
       OR to_regclass('public.transactions') IS NULL THEN
        RAISE EXCEPTION
            'Tabel dasar belum lengkap. Jalankan schema.sql dan migrasi sebelumnya terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Profil: status akun dan penanda trial
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

UPDATE public.profiles SET status = 'active' WHERE status IS NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_status_check
    CHECK (status IN ('active', 'suspended', 'pending_deletion'));

-- ------------------------------------------------------------------------------
-- 2. Lisensi: perioda langganan, grace period, dan legacy lifetime
-- ------------------------------------------------------------------------------
ALTER TABLE public.licenses
    ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_legacy_lifetime BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_status_check;
ALTER TABLE public.licenses
    ADD CONSTRAINT licenses_status_check
    CHECK (status IN ('active', 'trialing', 'past_due', 'expired', 'revoked', 'canceled'));

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT FALSE;

-- Rapikan duplikasi lisensi berjalan sebelum unique index baru dibuat.
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY owner_user_id
            ORDER BY
                CASE status
                    WHEN 'active' THEN 1
                    WHEN 'past_due' THEN 2
                    WHEN 'trialing' THEN 3
                    ELSE 4
                END,
                COALESCE(activated_at, created_at) DESC,
                created_at DESC
        ) AS rn
    FROM public.licenses
    WHERE status IN ('active', 'trialing', 'past_due')
      AND owner_user_id IS NOT NULL
)
UPDATE public.licenses AS l
SET status = 'revoked',
    updated_at = NOW()
FROM ranked AS r
WHERE l.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS uq_licenses_one_active_per_owner;
CREATE UNIQUE INDEX uq_licenses_one_active_per_owner
    ON public.licenses (owner_user_id)
    WHERE status IN ('active', 'trialing', 'past_due')
      AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_owner_status
    ON public.licenses (owner_user_id, status);

-- Backfill lisensi lama:
--   * Paket berbayar lama dianggap legacy lifetime agar tidak terpotong.
--   * Trial lama diberi masa berlaku 3 hari mulai migrasi ini.
UPDATE public.licenses
SET is_legacy_lifetime = TRUE,
    current_period_start = COALESCE(current_period_start, activated_at, created_at),
    current_period_end = NULL,
    billing_cycle = 'lifetime',
    updated_at = NOW()
WHERE plan_id IS DISTINCT FROM 'trial'
  AND status = 'active'
  AND current_period_end IS NULL
  AND is_legacy_lifetime = FALSE;

UPDATE public.licenses
SET status = 'trialing',
    billing_cycle = 'trial',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '3 days',
    auto_renew = FALSE,
    cancel_at_period_end = FALSE,
    is_legacy_lifetime = FALSE,
    updated_at = NOW()
WHERE plan_id = 'trial'
  AND status = 'active';

UPDATE public.profiles p
SET trial_used_at = COALESCE(
    (
        SELECT MIN(COALESCE(l.activated_at, l.created_at))
        FROM public.licenses l
        WHERE l.owner_user_id = p.id
          AND l.plan_id = 'trial'
    ),
    p.created_at
)
WHERE p.trial_used_at IS NULL
  AND EXISTS (
      SELECT 1
      FROM public.licenses l
      WHERE l.owner_user_id = p.id
        AND l.plan_id = 'trial'
  );

-- ------------------------------------------------------------------------------
-- 3. Tabel pengaturan aplikasi (harga promo & customer service)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.app_settings TO postgres, service_role;

-- Promo awal aktif 30 hari. Admin dapat mengubah/mematikan dari panel.
INSERT INTO public.app_settings (key, value)
VALUES (
    'pricing',
    jsonb_build_object(
        'currency', 'IDR',
        'plans', jsonb_build_object(
            'starter', jsonb_build_object(
                'normalPrice', 29000,
                'promoPrice', 19000,
                'promoActive', TRUE,
                'promoStartsAt', NOW(),
                'promoEndsAt', NOW() + INTERVAL '30 days',
                'promoLabel', 'Promo Peluncuran'
            ),
            'pro', jsonb_build_object(
                'normalPrice', 59000,
                'promoPrice', 39000,
                'promoActive', TRUE,
                'promoStartsAt', NOW(),
                'promoEndsAt', NOW() + INTERVAL '30 days',
                'promoLabel', 'Promo Peluncuran'
            ),
            'ultra', jsonb_build_object(
                'normalPrice', 119000,
                'promoPrice', 79000,
                'promoActive', TRUE,
                'promoStartsAt', NOW(),
                'promoEndsAt', NOW() + INTERVAL '30 days',
                'promoLabel', 'Promo Peluncuran'
            )
        )
    )
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
    'customer_service',
    jsonb_build_object(
        'whatsapp', '',
        'label', 'Bantuan ZaFlow',
        'message', 'Halo, saya ingin bertanya tentang ZaFlow.',
        'active', FALSE
    )
)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Kode aktivasi single-use
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    duration_days INT NOT NULL CHECK (duration_days > 0),
    max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    assigned_email TEXT,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'used', 'revoked', 'expired')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_codes_status
    ON public.activation_codes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_codes_email
    ON public.activation_codes (lower(assigned_email));

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activation_codes FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.activation_codes TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- 5. Audit log tindakan admin
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
    ON public.admin_audit_logs (created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.admin_audit_logs TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- 6. Lisensi efektif: legacy lifetime, trial, aktif, dan grace period
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_license(p_user_id UUID)
RETURNS public.licenses
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT *
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status IN ('active', 'trialing', 'past_due')
      AND (
          is_legacy_lifetime = TRUE
          OR (
              current_period_end IS NOT NULL
              AND current_period_end > (
                  NOW() - CASE
                      WHEN status IN ('active', 'past_due') THEN INTERVAL '3 days'
                      ELSE INTERVAL '0'
                  END
              )
          )
      )
    ORDER BY
        CASE status
            WHEN 'active' THEN 1
            WHEN 'past_due' THEN 2
            WHEN 'trialing' THEN 3
            ELSE 4
        END,
        COALESCE(activated_at, created_at) DESC
    LIMIT 1;
$$;

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

    SELECT * INTO v_license
    FROM public.get_active_license(p_user_id);

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Mulai trial 3 hari
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_trial(p_user_id UUID)
RETURNS public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile public.profiles;
    v_existing public.licenses;
    v_license public.licenses;
    v_key TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Akun tidak valid';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil akun tidak ditemukan';
    END IF;

    IF v_profile.status <> 'active' THEN
        RAISE EXCEPTION 'Akun ini sedang tidak aktif';
    END IF;

    IF v_profile.trial_used_at IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM public.licenses
           WHERE owner_user_id = p_user_id
             AND (plan_id = 'trial' OR status = 'trialing')
       ) THEN
        RAISE EXCEPTION 'Trial sudah pernah digunakan oleh akun ini';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.licenses
        WHERE owner_user_id = p_user_id
          AND plan_id IS NOT NULL
          AND plan_id <> 'trial'
    ) THEN
        RAISE EXCEPTION 'Trial hanya untuk akun yang belum pernah berlangganan';
    END IF;

    SELECT * INTO v_existing
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status IN ('active', 'trialing', 'past_due')
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Akun sudah memiliki akses aktif';
    END IF;

    v_key := 'TRIAL-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 12))
        || '-' || upper(substr(md5(random()::text), 1, 6));

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
        activated_at,
        billing_cycle,
        current_period_start,
        current_period_end,
        auto_renew,
        cancel_at_period_end,
        is_legacy_lifetime
    )
    VALUES (
        v_key,
        'trial',
        'Trial',
        1,
        1,
        20,
        0,
        'trialing',
        p_user_id,
        NOW(),
        'trial',
        NOW(),
        NOW() + INTERVAL '3 days',
        FALSE,
        FALSE,
        FALSE
    )
    RETURNING * INTO v_license;

    UPDATE public.profiles
    SET trial_used_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Aktivasi / perpanjangan setelah pembayaran
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
    p_user_id UUID,
    p_license_key TEXT,
    p_plan_id TEXT,
    p_plan_name TEXT,
    p_max_brands INT,
    p_max_team_members INT,
    p_ai_quota INT,
    p_period_days INT DEFAULT 30
)
RETURNS public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_license public.licenses;
    v_period_days INT;
    v_period_start TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL OR p_plan_id IS NULL OR p_plan_id = 'trial' THEN
        RAISE EXCEPTION 'Data aktivasi langganan tidak lengkap';
    END IF;

    v_period_days := GREATEST(COALESCE(p_period_days, 30), 1);

    SELECT * INTO v_license
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY COALESCE(activated_at, created_at) DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND v_license.is_legacy_lifetime THEN
        RETURN v_license;
    END IF;

    IF FOUND THEN
        -- Perpanjangan memperpanjang dari akhir periode yang masih berjalan.
        -- Trial yang ditingkatkan ke paket berbayar dimulai dari sekarang.
        v_period_start := CASE
            WHEN v_license.status IN ('active', 'past_due')
                 AND v_license.current_period_end IS NOT NULL
                 AND v_license.current_period_end > NOW()
                THEN v_license.current_period_end
            ELSE NOW()
        END;

        UPDATE public.licenses
        SET plan_id = p_plan_id,
            plan_name = p_plan_name,
            max_brands = GREATEST(p_max_brands, 1),
            max_team_members = GREATEST(p_max_team_members, 1),
            ai_quota_total = GREATEST(p_ai_quota, 0),
            ai_quota_used = 0,
            license_key = COALESCE(NULLIF(p_license_key, ''), license_key),
            status = 'active',
            billing_cycle = 'monthly',
            current_period_start = v_period_start,
            current_period_end = v_period_start + (v_period_days || ' days')::INTERVAL,
            auto_renew = FALSE,
            cancel_at_period_end = FALSE,
            is_legacy_lifetime = FALSE,
            activated_at = COALESCE(activated_at, NOW()),
            updated_at = NOW()
        WHERE id = v_license.id
        RETURNING * INTO v_license;

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
        activated_at,
        billing_cycle,
        current_period_start,
        current_period_end,
        auto_renew,
        cancel_at_period_end,
        is_legacy_lifetime
    )
    VALUES (
        p_license_key,
        p_plan_id,
        p_plan_name,
        GREATEST(p_max_brands, 1),
        GREATEST(p_max_team_members, 1),
        GREATEST(p_ai_quota, 0),
        0,
        'active',
        p_user_id,
        NOW(),
        'monthly',
        NOW(),
        NOW() + (v_period_days || ' days')::INTERVAL,
        FALSE,
        FALSE,
        FALSE
    )
    RETURNING * INTO v_license;

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Tukar kode aktivasi
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_activation_code(
    p_user_id UUID,
    p_user_email TEXT,
    p_code TEXT
)
RETURNS public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code public.activation_codes;
    v_profile public.profiles;
    v_license public.licenses;
    v_existing public.licenses;
    v_key TEXT;
    v_period_start TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL OR COALESCE(trim(p_code), '') = '' THEN
        RAISE EXCEPTION 'Kode aktivasi wajib diisi';
    END IF;

    SELECT * INTO v_code
    FROM public.activation_codes
    WHERE upper(code) = upper(trim(p_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kode aktivasi tidak ditemukan';
    END IF;

    IF v_code.status = 'revoked' THEN
        RAISE EXCEPTION 'Kode aktivasi sudah dicabut';
    END IF;

    IF v_code.status = 'used'
       OR v_code.used_count >= v_code.max_uses
       OR v_code.used_count > 0
       OR v_code.redeemed_at IS NOT NULL
       OR v_code.redeemed_by IS NOT NULL THEN
        RAISE EXCEPTION 'Kode aktivasi sudah pernah digunakan';
    END IF;

    IF v_code.status = 'expired'
       OR (v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW()) THEN
        UPDATE public.activation_codes
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_code.id;
        RAISE EXCEPTION 'Kode aktivasi sudah kedaluwarsa';
    END IF;

    IF v_code.assigned_email IS NOT NULL
       AND lower(trim(v_code.assigned_email)) <> lower(trim(COALESCE(p_user_email, ''))) THEN
        RAISE EXCEPTION 'Kode aktivasi ini ditujukan untuk akun lain';
    END IF;

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profil akun tidak ditemukan';
    END IF;

    IF v_profile.status <> 'active' THEN
        RAISE EXCEPTION 'Akun ini sedang tidak aktif';
    END IF;

    SELECT * INTO v_existing
    FROM public.licenses
    WHERE owner_user_id = p_user_id
      AND status IN ('active', 'trialing', 'past_due')
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND v_existing.is_legacy_lifetime THEN
        RAISE EXCEPTION 'Akun sudah memiliki akses seumur hidup';
    END IF;

    IF v_code.plan_id = 'trial' THEN
        IF v_profile.trial_used_at IS NOT NULL
           OR EXISTS (
               SELECT 1
               FROM public.licenses
               WHERE owner_user_id = p_user_id
                 AND (plan_id = 'trial' OR status = 'trialing')
           ) THEN
            RAISE EXCEPTION 'Trial sudah pernah digunakan oleh akun ini';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.licenses
            WHERE owner_user_id = p_user_id
              AND plan_id IS NOT NULL
              AND plan_id <> 'trial'
        ) THEN
            RAISE EXCEPTION 'Trial hanya untuk akun yang belum pernah berlangganan';
        END IF;

        IF v_existing.id IS NOT NULL THEN
            RAISE EXCEPTION 'Akun sudah memiliki akses aktif';
        END IF;

        v_key := 'TRIAL-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 12))
            || '-' || upper(substr(md5(random()::text), 1, 6));

        INSERT INTO public.licenses (
            license_key, plan_id, plan_name, max_brands, max_team_members,
            ai_quota_total, ai_quota_used, status, owner_user_id, activated_at,
            billing_cycle, current_period_start, current_period_end,
            auto_renew, cancel_at_period_end, is_legacy_lifetime
        )
        VALUES (
            v_key, 'trial', 'Trial', 1, 1, 20, 0, 'trialing', p_user_id, NOW(),
            'trial', NOW(), NOW() + INTERVAL '3 days',
            FALSE, FALSE, FALSE
        )
        RETURNING * INTO v_license;

        UPDATE public.profiles
        SET trial_used_at = NOW(), updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        v_key := 'ZF-' || upper(v_code.plan_id) || '-'
            || upper(substr(md5(random()::text), 1, 6)) || '-'
            || upper(substr(md5(random()::text), 1, 6));

        IF v_existing.id IS NOT NULL THEN
            v_period_start := CASE
                WHEN v_existing.status IN ('active', 'past_due')
                     AND v_existing.current_period_end IS NOT NULL
                     AND v_existing.current_period_end > NOW()
                    THEN v_existing.current_period_end
                ELSE NOW()
            END;

            UPDATE public.licenses
            SET plan_id = v_code.plan_id,
                plan_name = v_code.plan_name,
                max_brands = CASE v_code.plan_id
                    WHEN 'starter' THEN 1
                    WHEN 'pro' THEN 3
                    WHEN 'ultra' THEN 10
                    ELSE 1
                END,
                max_team_members = CASE v_code.plan_id
                    WHEN 'starter' THEN 2
                    WHEN 'pro' THEN 5
                    WHEN 'ultra' THEN 15
                    ELSE 1
                END,
                ai_quota_total = CASE v_code.plan_id
                    WHEN 'starter' THEN 100
                    WHEN 'pro' THEN 300
                    WHEN 'ultra' THEN 1000
                    ELSE 20
                END,
                ai_quota_used = 0,
                status = 'active',
                billing_cycle = 'monthly',
                current_period_start = v_period_start,
                current_period_end = v_period_start + (v_code.duration_days || ' days')::INTERVAL,
                cancel_at_period_end = FALSE,
                is_legacy_lifetime = FALSE,
                activated_at = COALESCE(activated_at, NOW()),
                updated_at = NOW()
            WHERE id = v_existing.id
            RETURNING * INTO v_license;
        ELSE
            INSERT INTO public.licenses (
                license_key, plan_id, plan_name, max_brands, max_team_members,
                ai_quota_total, ai_quota_used, status, owner_user_id, activated_at,
                billing_cycle, current_period_start, current_period_end,
                auto_renew, cancel_at_period_end, is_legacy_lifetime
            )
            VALUES (
                v_key, v_code.plan_id, v_code.plan_name,
                CASE v_code.plan_id
                    WHEN 'starter' THEN 1
                    WHEN 'pro' THEN 3
                    WHEN 'ultra' THEN 10
                    ELSE 1
                END,
                CASE v_code.plan_id
                    WHEN 'starter' THEN 2
                    WHEN 'pro' THEN 5
                    WHEN 'ultra' THEN 15
                    ELSE 1
                END,
                CASE v_code.plan_id
                    WHEN 'starter' THEN 100
                    WHEN 'pro' THEN 300
                    WHEN 'ultra' THEN 1000
                    ELSE 20
                END,
                0, 'active', p_user_id, NOW(),
                'monthly',
                NOW(), NOW() + (v_code.duration_days || ' days')::INTERVAL,
                FALSE, FALSE, FALSE
            )
            RETURNING * INTO v_license;
        END IF;
    END IF;

    UPDATE public.activation_codes
    SET used_count = used_count + 1,
        status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE 'active' END,
        redeemed_by = p_user_id,
        redeemed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_code.id;

    RETURN v_license;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Pemotongan kuota AI: hanya untuk lisensi yang masih berlaku
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

    SELECT * INTO v_license
    FROM public.get_active_license(p_user_id);

    IF v_license.id IS NULL THEN
        SELECT * INTO v_license
        FROM public.licenses
        WHERE owner_user_id = p_user_id
          AND status IN ('expired', 'past_due', 'trialing', 'active', 'canceled')
        ORDER BY COALESCE(current_period_end, updated_at) DESC
        LIMIT 1;

        IF v_license.id IS NOT NULL THEN
            RETURN QUERY SELECT
                false,
                GREATEST(v_license.ai_quota_total - v_license.ai_quota_used, 0),
                v_license.ai_quota_total,
                v_license.ai_quota_used,
                v_license.id,
                NULL::uuid,
                'Masa aktif akun telah berakhir. Silakan perpanjang paket untuk melanjutkan.';
            RETURN;
        END IF;

        RETURN QUERY SELECT false, 0, 0, 0, NULL::uuid, NULL::uuid, 'Akun belum memiliki akses aktif.';
        RETURN;
    END IF;

    UPDATE public.licenses
    SET ai_quota_used = ai_quota_used + 1,
        updated_at = NOW()
    WHERE id = v_license.id
      AND status IN ('active', 'trialing', 'past_due')
      AND (
          is_legacy_lifetime = TRUE
          OR (
              current_period_end IS NOT NULL
              AND current_period_end > (
                  NOW() - CASE
                      WHEN status IN ('active', 'past_due') THEN INTERVAL '3 days'
                      ELSE INTERVAL '0'
                  END
              )
          )
      )
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
            'Kuota kredit AI Anda telah habis. Silakan perpanjang atau tingkatkan paket.';
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
-- 11. Penegakan batas brand dan anggota mengikuti status trial/aktif
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
    FROM public.get_active_license(NEW.created_by);

    IF v_max IS NULL THEN
        RAISE EXCEPTION
            'Akun belum memiliki paket aktif. Mulai trial atau pilih paket terlebih dahulu.'
            USING ERRCODE = '42501';
    END IF;

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
    FROM public.get_active_license(v_owner);

    IF v_max IS NULL THEN
        RAISE EXCEPTION
            'Paket pemilik workspace belum aktif. Anggota baru belum dapat ditambahkan.'
            USING ERRCODE = '42501';
    END IF;

    SELECT count(*)
    INTO v_count
    FROM public.brand_members
    WHERE brand_id = NEW.brand_id;

    IF v_count >= v_max THEN
        RAISE EXCEPTION
            'Batas anggota tim paket Anda telah tercapai (% anggota). Tingkatkan paket untuk menambah anggota.', v_max
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. Registrasi baru: buat profil saja, trial dipilih manual di halaman paket
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, system_role, status)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        'user',
        'active'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 13. Hak akses fungsi & tabel sensitif
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_active_license(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_user_license(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_trial(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_subscription_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_active_license(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_license(UUID) TO service_role;

REVOKE ALL ON TABLE public.activation_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.activation_codes TO postgres, service_role;
GRANT ALL PRIVILEGES ON TABLE public.app_settings TO postgres, service_role;
GRANT ALL PRIVILEGES ON TABLE public.admin_audit_logs TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- 14. Batas ukuran media konten (hard limit 1 MB)
-- ------------------------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 1048576
WHERE id = 'content-media';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFIKASI CEPAT:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'licenses'
--     AND column_name IN ('billing_cycle','current_period_end','is_legacy_lifetime');
--
--   SELECT key, value FROM public.app_settings;
--   SELECT status, count(*) FROM public.licenses GROUP BY status;
-- ==============================================================================
