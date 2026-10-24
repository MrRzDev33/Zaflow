-- ==============================================================================
-- ZaFlow - Migrasi 20261024_03
-- 1. Trial hanya melalui permintaan ke customer service (kode aktivasi trial).
-- 2. Penukaran kode trial tidak lagi ditolak hanya karena akun memiliki
--    lisensi trial otomatis lama (`legacy_auto_trial`).
-- ==============================================================================
-- Jalankan SETELAH 20261024_02_brand_platforms_and_trial_access_hardening.sql.
-- Aman dijalankan ulang.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.licenses') IS NULL
       OR to_regclass('public.profiles') IS NULL
       OR to_regclass('public.activation_codes') IS NULL THEN
        RAISE EXCEPTION
            'Tabel licenses, profiles, atau activation_codes belum ada. Jalankan migrasi dasar terlebih dahulu.';
    END IF;

    IF to_regprocedure('public.redeem_activation_code(uuid,text,text)') IS NULL
       OR to_regprocedure('public.start_trial(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'Fungsi lisensi belum ada. Jalankan 20261023_01_subscriptions_promo_trial_admin_and_support.sql terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Penukaran kode aktivasi
-- ------------------------------------------------------------------------------
-- Sama dengan versi 20261023_01, dengan pengecualian:
-- - `legacy_auto_trial` tidak dihitung sebagai langganan berbayar.
-- - `legacy_auto_trial` tidak dihitung sebagai trial yang pernah dipakai.
-- Dengan begitu, akun yang pernah menerima trial otomatis versi lama tetap
-- dapat menukarkan kode trial yang diberikan customer service.
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
                 AND (
                     plan_id = 'trial'
                     OR (status = 'trialing' AND COALESCE(plan_id, '') <> 'legacy_auto_trial')
                 )
           ) THEN
            RAISE EXCEPTION 'Trial sudah pernah digunakan oleh akun ini';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.licenses
            WHERE owner_user_id = p_user_id
              AND plan_id IS NOT NULL
              AND plan_id NOT IN ('trial', 'legacy_auto_trial')
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
-- 2. Hak eksekusi
-- ------------------------------------------------------------------------------
-- Hanya server (service_role) yang boleh menukarkan kode aktivasi.
REVOKE ALL ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT)
    TO service_role;

-- start_trial tetap tidak diekspos ke aplikasi. Trial diberikan lewat kode
-- aktivasi yang dibuat admin setelah permintaan ke customer service.
REVOKE ALL ON FUNCTION public.start_trial(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFIKASI CEPAT:
--   SELECT p.id, p.email, p.trial_used_at,
--          l.plan_id, l.status, l.ai_quota_total, l.ai_quota_used
--   FROM public.profiles AS p
--   LEFT JOIN public.licenses AS l ON l.owner_user_id = p.id
--   ORDER BY p.created_at DESC
--   LIMIT 20;
--
--   SELECT code, plan_id, status, used_count, max_uses, assigned_email
--   FROM public.activation_codes
--   WHERE plan_id = 'trial'
--   ORDER BY created_at DESC
--   LIMIT 20;
-- ==============================================================================
