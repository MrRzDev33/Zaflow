-- ==============================================================================
-- ZaFlow - Migrasi 20261024_01
-- Penguatan kode aktivasi: benar-benar sekali pakai dan tidak dapat diaktifkan
-- kembali setelah pernah dipakai.
-- ==============================================================================
-- Jalankan SETELAH 20261023_01_subscriptions_promo_trial_admin_and_support.sql.
-- Aman dijalankan ulang.
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.activation_codes') IS NULL THEN
        RAISE EXCEPTION
            'Tabel activation_codes belum ada. Jalankan migrasi 20261023_01 terlebih dahulu.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. Rapikan data lama agar semua kode mengikuti aturan sekali pakai
-- ------------------------------------------------------------------------------
-- Kode yang pernah diredeem dipaksa berstatus used, termasuk jika sebelumnya
-- statusnya sempat kembali menjadi active karena data lama/manual.
UPDATE public.activation_codes
SET max_uses = 1,
    used_count = CASE
        WHEN status = 'used'
          OR used_count > 0
          OR redeemed_at IS NOT NULL
          OR redeemed_by IS NOT NULL
            THEN 1
        ELSE 0
    END,
    status = CASE
        WHEN status IN ('revoked', 'expired') THEN status
        WHEN status = 'used'
          OR used_count > 0
          OR redeemed_at IS NOT NULL
          OR redeemed_by IS NOT NULL
            THEN 'used'
        ELSE 'active'
    END,
    redeemed_at = CASE
        WHEN status = 'used'
          OR used_count > 0
          OR redeemed_at IS NOT NULL
          OR redeemed_by IS NOT NULL
            THEN COALESCE(redeemed_at, updated_at, NOW())
        ELSE redeemed_at
    END,
    updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 2. Constraint: satu kode hanya boleh dipakai satu kali
-- ------------------------------------------------------------------------------
ALTER TABLE public.activation_codes
    DROP CONSTRAINT IF EXISTS activation_codes_single_use_check;
ALTER TABLE public.activation_codes
    ADD CONSTRAINT activation_codes_single_use_check
    CHECK (max_uses = 1 AND used_count >= 0 AND used_count <= 1);

ALTER TABLE public.activation_codes
    DROP CONSTRAINT IF EXISTS activation_codes_use_state_check;
ALTER TABLE public.activation_codes
    ADD CONSTRAINT activation_codes_use_state_check
    CHECK (
        status IN ('revoked', 'expired')
        OR (status = 'active' AND used_count = 0 AND redeemed_at IS NULL AND redeemed_by IS NULL)
        OR (status = 'used' AND used_count = 1)
    );

-- ------------------------------------------------------------------------------
-- 3. Trigger: kode bekas tidak bisa dikembalikan menjadi aktif
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_activation_code_single_use()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.status IN ('revoked', 'expired')
       AND NEW.status = 'active' THEN
        RAISE EXCEPTION 'Kode aktivasi yang sudah dicabut atau kedaluwarsa tidak dapat diaktifkan kembali';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           OLD.used_count > 0
           OR OLD.redeemed_at IS NOT NULL
           OR OLD.redeemed_by IS NOT NULL
       ) THEN
        -- redeemed_by/redeemed_at boleh berubah karena pembersihan data akun,
        -- tetapi kode yang pernah dipakai tidak boleh kembali menjadi aktif.
        IF NEW.status = 'active'
           OR NEW.used_count = 0 THEN
            RAISE EXCEPTION 'Kode aktivasi yang sudah dipakai tidak dapat diaktifkan kembali';
        END IF;
    END IF;

    IF NEW.status = 'active'
       AND (
           NEW.used_count > 0
           OR NEW.redeemed_at IS NOT NULL
           OR NEW.redeemed_by IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'Kode aktivasi yang sudah dipakai tidak dapat diaktifkan kembali';
    END IF;

    IF NEW.status = 'used' THEN
        NEW.used_count := 1;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_activation_code_single_use ON public.activation_codes;
CREATE TRIGGER trg_guard_activation_code_single_use
    BEFORE INSERT OR UPDATE ON public.activation_codes
    FOR EACH ROW EXECUTE FUNCTION public.guard_activation_code_single_use();

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- VERIFIKASI CEPAT:
--   SELECT status, count(*) FROM public.activation_codes GROUP BY status;
--   SELECT code, status, used_count, max_uses, redeemed_at
--   FROM public.activation_codes
--   ORDER BY created_at DESC
--   LIMIT 20;
-- ==============================================================================
