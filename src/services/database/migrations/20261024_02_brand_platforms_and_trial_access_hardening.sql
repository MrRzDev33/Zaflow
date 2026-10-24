-- ==============================================================================
-- ZaFlow - Migrasi 20261024_02
-- 1. Platform brand dipilih saat brand dibuat, bukan semua platform.
-- 2. Membersihkan trial otomatis lama yang tidak pernah dipilih pengguna.
-- 3. Memastikan akun baru hanya memiliki profil, tanpa paket/trial otomatis.
-- ==============================================================================
-- Jalankan SETELAH 20261024_01_activation_code_hardening.sql.
-- Aman dijalankan ulang.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.brands') IS NULL
       OR to_regclass('public.licenses') IS NULL
       OR to_regclass('public.profiles') IS NULL THEN
        RAISE EXCEPTION
            'Tabel brands, licenses, atau profiles belum ada. Jalankan migrasi dasar terlebih dahulu.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'licenses'
          AND column_name = 'billing_cycle'
    ) THEN
        RAISE EXCEPTION
            'Kolom langganan belum lengkap. Jalankan 20261023_01_subscriptions_promo_trial_admin_and_support.sql terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Kolom platform pada brand
-- ------------------------------------------------------------------------------
ALTER TABLE public.brands
    ADD COLUMN IF NOT EXISTS platforms TEXT[] NOT NULL DEFAULT ARRAY['instagram']::TEXT[];

COMMENT ON COLUMN public.brands.platforms IS
    'Platform sosial yang dipilih saat brand dibuat. Hanya platform ini yang dipakai di formulir konten, filter, kalender, dan kanban.';

-- Brand lama: turunkan platform dari akun sosial yang sudah terisi.
UPDATE public.brands AS b
SET platforms = COALESCE(
        (
            SELECT array_agg(entry.key ORDER BY array_position(
                ARRAY['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook']::TEXT[],
                entry.key
            ))
            FROM jsonb_each_text(COALESCE(b.social_accounts, '{}'::JSONB)) AS entry(key, value)
            WHERE entry.key = ANY (
                ARRAY['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook']::TEXT[]
            )
              AND NULLIF(btrim(entry.value), '') IS NOT NULL
        ),
        ARRAY['instagram']::TEXT[]
    ),
    updated_at = NOW()
WHERE b.platforms IS NULL
   OR cardinality(b.platforms) = 0
   OR b.platforms = ARRAY['instagram']::TEXT[];

-- Pastikan tidak ada array kosong atau platform yang tidak dikenal.
UPDATE public.brands
SET platforms = ARRAY['instagram']::TEXT[],
    updated_at = NOW()
WHERE platforms IS NULL OR cardinality(platforms) = 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'brands_platforms_check'
          AND conrelid = 'public.brands'::regclass
    ) THEN
        ALTER TABLE public.brands
            ADD CONSTRAINT brands_platforms_check
            CHECK (
                cardinality(platforms) > 0
                AND platforms <@ ARRAY['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook']::TEXT[]
            );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Trial otomatis lama
-- ------------------------------------------------------------------------------
-- Versi lama membuat lisensi trial otomatis dengan kuota 50 saat pendaftaran.
-- Trial yang dipilih manual dari halaman paket memakai kuota 20. Lisensi lama
-- tetap disimpan sebagai riwayat, tetapi tidak memberi akses dan tidak menjadi
-- alasan untuk menolak trial manual.
UPDATE public.licenses
SET plan_id = 'legacy_auto_trial',
    plan_name = 'Trial lama',
    status = 'expired',
    billing_cycle = 'legacy',
    current_period_end = LEAST(COALESCE(current_period_end, NOW()), NOW()),
    auto_renew = FALSE,
    cancel_at_period_end = TRUE,
    is_legacy_lifetime = FALSE,
    updated_at = NOW()
WHERE (plan_id = 'trial' OR lower(btrim(plan_name)) = 'trial')
  AND ai_quota_total = 50
  AND is_legacy_lifetime = FALSE;

-- Hanya hapus penanda trial jika akun tidak memiliki trial manual sama sekali.
UPDATE public.profiles AS p
SET trial_used_at = NULL,
    updated_at = NOW()
WHERE p.trial_used_at IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.licenses AS l
      WHERE l.owner_user_id = p.id
        AND l.plan_id = 'trial'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.licenses AS l
      WHERE l.owner_user_id = p.id
        AND l.plan_id = 'legacy_auto_trial'
        AND l.ai_quota_used > 0
  );

-- ------------------------------------------------------------------------------
-- 3. Registrasi baru: profil saja, tanpa paket/trial otomatis
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

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFIKASI CEPAT:
--   SELECT id, name, platforms, social_accounts
--   FROM public.brands
--   ORDER BY created_at DESC
--   LIMIT 20;
--
--   SELECT id, email, trial_used_at
--   FROM public.profiles
--   ORDER BY created_at DESC
--   LIMIT 20;
--
--   SELECT owner_user_id, plan_id, plan_name, status, ai_quota_total
--   FROM public.licenses
--   WHERE plan_id IN ('trial', 'legacy_auto_trial')
--   ORDER BY created_at DESC
--   LIMIT 20;
-- ==============================================================================
