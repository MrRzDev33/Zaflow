-- ==============================================================================
-- ZaFlow - Migrasi 20261025_01
-- 1. Paket berbayar menjadi 6 bulan (180 hari).
-- 2. Kuota AI adalah kuota total 6 bulan dan ditambah saat perpanjangan.
-- 3. Kode aktivasi berbayar wajib terikat email pembeli.
-- 4. Data pembeli disimpan di activation_codes (tanpa tabel pesanan baru).
-- 5. Harga paket baru tanpa promo.
-- ==============================================================================
-- Jalankan SETELAH 20261024_03_trial_request_only.sql.
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
       OR to_regprocedure('public.activate_subscription_from_payment(uuid,text,text,text,integer,integer,integer,integer)') IS NULL THEN
        RAISE EXCEPTION
            'Fungsi lisensi belum ada. Jalankan 20261023_01_subscriptions_promo_trial_admin_and_support.sql terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Data pembeli pada kode aktivasi
-- ------------------------------------------------------------------------------
ALTER TABLE public.activation_codes
    ADD COLUMN IF NOT EXISTS buyer_name TEXT,
    ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
    ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
    ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'meta_ads',
    ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.activation_codes.buyer_name IS 'Nama pembeli dari Meta Ads / WhatsApp.';
COMMENT ON COLUMN public.activation_codes.buyer_phone IS 'Nomor WhatsApp pembeli.';
COMMENT ON COLUMN public.activation_codes.price_amount IS 'Nominal yang dibayarkan pembeli.';
COMMENT ON COLUMN public.activation_codes.payment_status IS 'paid, pending, atau free (trial).';
COMMENT ON COLUMN public.activation_codes.sales_channel IS 'Kanal penjualan, default meta_ads.';
COMMENT ON COLUMN public.activation_codes.notes IS 'Catatan admin tentang pesanan.';

-- ------------------------------------------------------------------------------
-- 2. Pastikan billing_cycle tidak dibatasi constraint lama
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.licenses'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%billing_cycle%'
    LOOP
        EXECUTE format('ALTER TABLE public.licenses DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Penukaran kode aktivasi: 6 bulan, kuota ditambah, email wajib
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
    v_duration_days INT;
    v_plan_quota INT;
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

    -- Kode berbayar wajib terikat ke email pembeli. Kode trial lama yang belum
    -- memiliki email tetap diizinkan agar tidak memutus alur customer service.
    IF v_code.plan_id <> 'trial'
       AND (v_code.assigned_email IS NULL OR trim(v_code.assigned_email) = '') THEN
        RAISE EXCEPTION 'Kode aktivasi ini belum terhubung ke email pembeli';
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
        v_duration_days := GREATEST(COALESCE(NULLIF(v_code.duration_days, 0), 180), 1);
        v_plan_quota := CASE v_code.plan_id
            WHEN 'starter' THEN 300
            WHEN 'pro' THEN 600
            WHEN 'ultra' THEN 1200
            ELSE 20
        END;

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
                -- Sisa kuota dipertahankan, lalu ditambah kuota paket baru.
                ai_quota_total = COALESCE(v_existing.ai_quota_total, 0) + v_plan_quota,
                ai_quota_used = COALESCE(v_existing.ai_quota_used, 0),
                status = 'active',
                billing_cycle = 'semiannual',
                current_period_start = v_period_start,
                current_period_end = v_period_start + (v_duration_days || ' days')::INTERVAL,
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
                v_plan_quota,
                0, 'active', p_user_id, NOW(),
                'semiannual',
                NOW(), NOW() + (v_duration_days || ' days')::INTERVAL,
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

REVOKE ALL ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT, TEXT)
    TO service_role;

-- ------------------------------------------------------------------------------
-- 4. Aktivasi dari pembayaran Midtrans: 6 bulan, kuota ditambah
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
    p_user_id UUID,
    p_license_key TEXT,
    p_plan_id TEXT,
    p_plan_name TEXT,
    p_max_brands INT,
    p_max_team_members INT,
    p_ai_quota INT,
    p_period_days INT DEFAULT 180
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

    v_period_days := GREATEST(COALESCE(p_period_days, 180), 1);

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
            -- Sisa kuota dipertahankan, lalu ditambah kuota paket baru.
            ai_quota_total = COALESCE(v_license.ai_quota_total, 0) + GREATEST(p_ai_quota, 0),
            ai_quota_used = COALESCE(v_license.ai_quota_used, 0),
            license_key = COALESCE(NULLIF(p_license_key, ''), license_key),
            status = 'active',
            billing_cycle = 'semiannual',
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
        'semiannual',
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

REVOKE ALL ON FUNCTION public.activate_subscription_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT)
    TO service_role;

-- ------------------------------------------------------------------------------
-- 5. Harga paket 6 bulan (tanpa promo)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        INSERT INTO public.app_settings (key, value)
        VALUES (
            'pricing',
            jsonb_build_object(
                'currency', 'IDR',
                'plans', jsonb_build_object(
                    'starter', jsonb_build_object('price', 69000),
                    'pro', jsonb_build_object('price', 99000),
                    'ultra', jsonb_build_object('price', 130000)
                )
            )
        )
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = NOW();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. Kode lama yang masih aktif: samakan durasi paket berbayar menjadi 180 hari
-- ------------------------------------------------------------------------------
UPDATE public.activation_codes
SET duration_days = 180,
    updated_at = NOW()
WHERE plan_id <> 'trial'
  AND status = 'active'
  AND redeemed_at IS NULL;

COMMIT;
