-- ==============================================================================
-- ZAFLOW / NARASOSIAL — DATABASE SECURITY MIGRATION PHASE 1 (FINAL HARDENED V2)
-- File: 20261013_01_security_hardening_profiles_and_brands.sql
-- Sasaran:
--   1. Menutup celah eskalasi hak akses profiles.system_role
--   2. Menutup celah pemalsuan created_by dan penanganan brand yatim pada brands
--   3. Menutup celah klaim role owner dan eskalasi membership brand_members
-- Sifat: Idempotent, Transaksional, & Non-destructive (Tanpa kehilangan data)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PREFLIGHT CHECK & DIAGNOSTIK
-- ------------------------------------------------------------------------------
-- Jalankan query diagnostik berikut secara transparan di SQL Editor untuk melihat
-- baris data bermasalah (jika ada) sebelum transaksi DDL dilanjutkan:

-- Preflight 1 Diagnostic Query: Tampilkan daftar brand dengan lebih dari 1 owner (jika ada)
SELECT 
    bm.brand_id, 
    b.name AS brand_name, 
    COUNT(*) AS owner_count, 
    array_agg(bm.user_id) AS owner_user_ids
FROM public.brand_members bm
LEFT JOIN public.brands b ON b.id = bm.brand_id
WHERE bm.role = 'owner'
GROUP BY bm.brand_id, b.name
HAVING COUNT(*) > 1;

-- Preflight 2 Diagnostic Query: Tampilkan daftar brand yatim tanpa owner sama sekali (jika ada)
SELECT 
    b.id AS orphan_brand_id, 
    b.name AS brand_name, 
    b.created_by, 
    b.created_at
FROM public.brands b
LEFT JOIN public.brand_members bm ON b.id = bm.brand_id AND bm.role = 'owner'
WHERE bm.id IS NULL;

-- Penegakan Pembatalan Otomatis: Hentikan migrasi seketika jika ada multi-owner
DO $$
DECLARE
    v_multi_owner_count INT;
BEGIN
    SELECT COUNT(*) INTO v_multi_owner_count
    FROM (
        SELECT brand_id
        FROM public.brand_members
        WHERE role = 'owner'
        GROUP BY brand_id
        HAVING COUNT(*) > 1
    ) sub;

    IF v_multi_owner_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT GAGAL: Ditemukan % brand dengan lebih dari 1 owner. Selesaikan konflik data sebelum memasang partial unique index uq_brand_single_owner.', v_multi_owner_count;
    END IF;
END $$;

-- Preflight 2 Assertion: Berikan peringatan terstruktur jika ada brand yatim
DO $$
DECLARE
    v_orphan_brand_count INT;
BEGIN
    SELECT COUNT(*) INTO v_orphan_brand_count
    FROM public.brands b
    LEFT JOIN public.brand_members bm ON b.id = bm.brand_id AND bm.role = 'owner'
    WHERE bm.id IS NULL;

    IF v_orphan_brand_count > 0 THEN
        RAISE WARNING 'PREFLIGHT PERINGATAN: Ditemukan % brand tanpa owner aktif. Gunakan kueri diagnostik Preflight 2 untuk memeriksa brand yatim.', v_orphan_brand_count;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- BAGIAN 1: PENEGASAN PRIVILEGE MINIMUM (LEAST PRIVILEGE) PADA 3 TABEL
-- ------------------------------------------------------------------------------

-- 1.1 Cabut seluruh privilege default dari peran PUBLIC (mencegah default leakage)
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.brands FROM PUBLIC;
REVOKE ALL ON TABLE public.brand_members FROM PUBLIC;

-- 1.2 Cabut secara eksplisit privilege TRUNCATE dari seluruh peran non-superuser
REVOKE TRUNCATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public.brands FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON TABLE public.brand_members FROM PUBLIC, anon, authenticated;

-- 1.3 Bersihkan seluruh privilege peran anon (anon tidak membutuhkan akses langsung ke 3 tabel ini)
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.brands FROM anon;
REVOKE ALL ON TABLE public.brand_members FROM anon;

-- 1.4 Bersihkan privilege tabel penuh dari peran authenticated
REVOKE ALL ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.brands FROM authenticated;
REVOKE ALL ON TABLE public.brand_members FROM authenticated;

-- Berikan HANYA hak yang benar-benar dibutuhkan oleh alur aplikasi terautentikasi:
-- Tabel profiles:
-- - Membaca data profil (SELECT)
-- - Memperbarui hanya kolom non-sensitif (UPDATE pada full_name, avatar_url, updated_at)
-- - INSERT dilakukan oleh trigger auth.users (SECURITY DEFINER), bukan client langsung
-- - DELETE profil dilarang via client PostgREST
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

-- Tabel brands:
-- - Membaca data brand (SELECT)
-- - Membuat brand baru (INSERT)
-- - Memperbarui nama, deskripsi, warna, dll (UPDATE)
-- - Menghapus brand miliknya (DELETE)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brands TO authenticated;

-- Tabel brand_members:
-- - Membaca membership (SELECT)
-- - Mendaftarkan membership sah (INSERT)
-- - Menghapus anggota / self-leave (DELETE)
-- - Memperbarui HANYA kolom role (UPDATE pada role saja)
-- - Kolom brand_id dan user_id TIDAK diberikan izin UPDATE
GRANT SELECT, INSERT, DELETE ON TABLE public.brand_members TO authenticated;
GRANT UPDATE (role) ON TABLE public.brand_members TO authenticated;

-- 1.5 Pastikan backend tepercaya (service_role) dan postgres memiliki akses penuh
GRANT ALL PRIVILEGES ON TABLE public.profiles TO postgres, service_role;
GRANT ALL PRIVILEGES ON TABLE public.brands TO postgres, service_role;
GRANT ALL PRIVILEGES ON TABLE public.brand_members TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- BAGIAN 2: HARDENING KEAMANAN PROFILES & SYSTEM_ROLE
-- ------------------------------------------------------------------------------

-- 2.1 Hapus seluruh policy lama pada profiles untuk memastikan tidak ada evaluasi OR permissive
DROP POLICY IF EXISTS "Pengguna dapat melihat profil pengguna lain dalam brand yang sama" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_and_team" ON public.profiles;
DROP POLICY IF EXISTS "Pengguna hanya dapat mengubah profil miliknya sendiri (kecuali role)" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2.2 Pasang policy SELECT profiles (membaca profil sendiri atau anggota dalam brand yang sama)
CREATE POLICY "profiles_select_own_and_team"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.brand_members bm1
            JOIN public.brand_members bm2 ON bm1.brand_id = bm2.brand_id
            WHERE bm1.user_id = auth.uid() AND bm2.user_id = public.profiles.id
        )
    );

-- 2.3 Pasang policy UPDATE baru yang ketat (id harus auth.uid())
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 2.4 Trigger Guard: Proteksi lapisan kedua terhadap manipulasi system_role & id
CREATE OR REPLACE FUNCTION public.trg_guard_profiles_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Mencegah manipulasi UUID profil
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Manipulasi terdeteksi: Kolom id pada profil tidak dapat diubah.' USING ERRCODE = '42501';
    END IF;

    -- Mencegah manipulasi system_role oleh pengguna biasa
    IF NEW.system_role IS DISTINCT FROM OLD.system_role THEN
        -- Izinkan HANYA jika dipanggil oleh sesi operator database (postgres / supabase_admin)
        -- ATAU service_role token dari backend terpercaya
        IF (SESSION_USER IN ('postgres', 'supabase_admin')) OR (auth.role() = 'service_role') THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Akses Ditolak: Perubahan system_role tidak diizinkan untuk peran pemanggil saat ini (Privilege Escalation Detected).' USING ERRCODE = '42501';
    END IF;

    -- Otomatis perbarui updated_at jika tidak disuplai
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles ON public.profiles;
CREATE TRIGGER trg_guard_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_guard_profiles_update();

-- Batasi hak eksekusi trigger function: Hanya postgres dan service_role.
-- Peran authenticated dan anon TIDAK memerlukan hak EXECUTE karena trigger dieksekusi otomatis oleh engine.
REVOKE ALL ON FUNCTION public.trg_guard_profiles_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_profiles_update() TO postgres, service_role;

-- 2.5 Jalur Bootstrap Super Admin Terpercaya (Untuk operator di SQL Editor)
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_rows_affected INT;
BEGIN
    -- Verifikasi identitas pemanggil: Hanya operator sistem (postgres / supabase_admin) atau service_role
    IF NOT ((SESSION_USER IN ('postgres', 'supabase_admin')) OR (auth.role() = 'service_role')) THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya operator sistem (postgres/service_role) yang berwenang mengeksekusi bootstrap.' USING ERRCODE = '42501';
    END IF;

    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RAISE EXCEPTION 'Parameter p_email wajib diisi.' USING ERRCODE = '22023';
    END IF;

    -- Cari user target berdasarkan email terdaftar di auth.users
    SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_user_id, v_user_name
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email));

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna dengan email "%" tidak ditemukan di auth.users.', p_email USING ERRCODE = 'P0002';
    END IF;

    -- Pastikan baris profil ada dan mutasikan system_role menjadi super_admin
    INSERT INTO public.profiles (id, full_name, system_role, created_at, updated_at)
    VALUES (v_user_id, v_user_name, 'super_admin', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET system_role = 'super_admin',
        updated_at = NOW();

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected < 1 THEN
        RAISE EXCEPTION 'Gagal memperbarui profil untuk user ID %.', v_user_id USING ERRCODE = 'P0003';
    END IF;

    RETURN FORMAT('SUKSES: Akun %s (User ID: %s) berhasil ditetapkan sebagai super_admin.', p_email, v_user_id);
END;
$$;

-- Kunci eksekusi fungsi bootstrap: Hanya operator sistem dan backend terpercaya
REVOKE ALL ON FUNCTION public.bootstrap_super_admin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin(TEXT) TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- BAGIAN 3: HARDENING KEAMANAN BRANDS & PENCEGAHAN ORPHAN BRANDS
-- ------------------------------------------------------------------------------

-- 3.1 Hapus seluruh policy lama pada tabel brands untuk mencegah celah permissive (OR)
DROP POLICY IF EXISTS "Anggota dapat melihat brand yang diikutinya" ON public.brands;
DROP POLICY IF EXISTS "brands_select" ON public.brands;
DROP POLICY IF EXISTS "Pengguna terautentikasi dapat membuat brand baru" ON public.brands;
DROP POLICY IF EXISTS "brands_insert_own" ON public.brands;
DROP POLICY IF EXISTS "Owner atau Admin brand dapat mengubah brand" ON public.brands;
DROP POLICY IF EXISTS "brands_update_owner_admin" ON public.brands;
DROP POLICY IF EXISTS "Hanya Owner brand yang dapat menghapus brand" ON public.brands;
DROP POLICY IF EXISTS "brands_delete_owner" ON public.brands;

-- 3.2 Policy SELECT: Anggota brand atau pembuat brand dapat membaca brand
CREATE POLICY "brands_select"
    ON public.brands FOR SELECT
    TO authenticated
    USING (
        public.is_brand_member(id) OR created_by = auth.uid()
    );

-- 3.3 Policy INSERT: Pembuat brand WAJIB mencantumkan created_by = auth.uid() (Mencegah Pemalsuan)
CREATE POLICY "brands_insert_own"
    ON public.brands FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
    );

-- 3.4 Policy UPDATE: Hanya Owner atau Admin brand yang berhak mengubah informasi brand
CREATE POLICY "brands_update_owner_admin"
    ON public.brands FOR UPDATE
    TO authenticated
    USING (
        public.get_user_brand_role(id) IN ('owner', 'admin')
    )
    WITH CHECK (
        public.get_user_brand_role(id) IN ('owner', 'admin')
    );

-- 3.5 Policy DELETE: Owner aktif berhak menghapus brand, ATAU pembuat sah berhak
-- menghapus jika membership owner gagal dibuat (orphan cleanup).
CREATE POLICY "brands_delete_owner"
    ON public.brands FOR DELETE
    TO authenticated
    USING (
        public.get_user_brand_role(id) = 'owner'
        OR (
            created_by = auth.uid()
            AND NOT EXISTS (
                SELECT 1 FROM public.brand_members WHERE brand_id = public.brands.id
            )
        )
    );

-- ------------------------------------------------------------------------------
-- BAGIAN 4: HARDENING KEAMANAN BRAND_MEMBERS & SINGLE-OWNER
-- ------------------------------------------------------------------------------

-- 4.1 Penegakan Kernel Database: Tepat Satu Owner per Brand
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_single_owner
    ON public.brand_members(brand_id)
    WHERE (role = 'owner');

-- 4.2 Hapus seluruh policy lama pada brand_members untuk diganti dengan versi terkoreksi
DROP POLICY IF EXISTS "Anggota dapat melihat daftar anggota lain dalam brand yang sama" ON public.brand_members;
DROP POLICY IF EXISTS "Owner atau Admin dapat mengundang atau menambahkan anggota" ON public.brand_members;
DROP POLICY IF EXISTS "Owner atau Admin dapat memperbarui role anggota" ON public.brand_members;
DROP POLICY IF EXISTS "Owner atau Admin dapat mengeluarkan anggota (Owner tidak bisa dikeluarkan sembarangan)" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_select" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_insert" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_update" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_delete" ON public.brand_members;

-- 4.3 Policy SELECT: Anggota brand atau pengguna itu sendiri dapat membaca membership
CREATE POLICY "brand_members_select"
    ON public.brand_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.is_brand_member(brand_id)
    );

-- 4.4 Policy INSERT:
--     Kasus 1: Pembuat brand (created_by) mendaftarkan dirinya sendiri (user_id = auth.uid()) sebagai owner awal.
--     Kasus 2: Owner atau Admin brand menambahkan anggota dengan role non-owner (admin, editor, viewer).
CREATE POLICY "brand_members_insert"
    ON public.brand_members FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            -- Pendaftaran owner awal oleh pembuat brand sah
            role = 'owner'
            AND user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.brands b
                WHERE b.id = brand_id
                  AND b.created_by = auth.uid()
            )
        )
        OR
        (
            -- Penambahan anggota tim non-owner oleh owner atau admin
            role IN ('admin', 'editor', 'viewer')
            AND public.get_user_brand_role(brand_id) IN ('owner', 'admin')
        )
    );

-- 4.5 Policy UPDATE:
--     Hanya Owner yang dapat mengubah role anggota lain (menjadi admin, editor, atau viewer).
--     Admin HANYA boleh mengubah role editor dan viewer (menjadi editor atau viewer).
--     Admin DILARANG mempromosikan anggota menjadi admin atau owner.
--     Admin DILARANG mengubah sesama admin atau owner.
--     Role sasaran TIDAK BOLEH diubah menjadi 'owner' lewat direct client update.
CREATE POLICY "brand_members_update"
    ON public.brand_members FOR UPDATE
    TO authenticated
    USING (
        role <> 'owner' -- Baris owner saat ini tidak dapat dimutasi langsung lewat update biasa
        AND (
            public.get_user_brand_role(brand_id) = 'owner'
            OR (public.get_user_brand_role(brand_id) = 'admin' AND role IN ('editor', 'viewer'))
        )
    )
    WITH CHECK (
        (
            -- Owner berhak mengubah anggota non-owner menjadi admin, editor, atau viewer
            public.get_user_brand_role(brand_id) = 'owner'
            AND role IN ('admin', 'editor', 'viewer')
        )
        OR
        (
            -- Admin hanya berhak mengubah editor/viewer menjadi editor atau viewer (dilarang promosi ke admin/owner)
            public.get_user_brand_role(brand_id) = 'admin'
            AND role IN ('editor', 'viewer')
        )
    );

-- 4.6 Policy DELETE:
--     Owner dapat menghapus anggota non-owner.
--     Admin dapat menghapus editor atau viewer.
--     Anggota non-owner dapat menghapus dirinya sendiri (self-leave).
--     Baris owner DILARANG dihapus secara langsung (hanya terhapus jika brand dihapus).
CREATE POLICY "brand_members_delete"
    ON public.brand_members FOR DELETE
    TO authenticated
    USING (
        role <> 'owner'
        AND (
            public.get_user_brand_role(brand_id) = 'owner'
            OR (public.get_user_brand_role(brand_id) = 'admin' AND role IN ('editor', 'viewer'))
            OR user_id = auth.uid()
        )
    );

-- 4.7 Trigger Guard UPDATE: Pertahanan Tambahan pada brand_members saat UPDATE
CREATE OR REPLACE FUNCTION public.trg_guard_brand_members_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Larang perubahan brand_id atau user_id
    IF NEW.brand_id <> OLD.brand_id OR NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Manipulasi terdeteksi: Kolom brand_id dan user_id tidak dapat dipindahkan.' USING ERRCODE = '42501';
    END IF;

    -- Larang promosi langsung menjadi owner melalui mutasi client
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
        IF NOT ((SESSION_USER IN ('postgres', 'supabase_admin')) OR (auth.role() = 'service_role')) THEN
            RAISE EXCEPTION 'Akses Ditolak: Role owner adalah peran tetap yang ditetapkan saat inisialisasi brand dan tidak dapat dimutasi atau ditingkatkan melalui operasi UPDATE standar.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Larang demosi owner tunggal secara sembarangan
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
        IF NOT ((SESSION_USER IN ('postgres', 'supabase_admin')) OR (auth.role() = 'service_role')) THEN
            RAISE EXCEPTION 'Akses Ditolak: Role owner tidak dapat diubah atau diturunkan melalui operasi UPDATE standar.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Bersihkan trigger versi lama / legacy jika ada
DROP TRIGGER IF EXISTS trg_guard_brand_members ON public.brand_members;
DROP FUNCTION IF EXISTS public.trg_guard_brand_members_mutations();

DROP TRIGGER IF EXISTS trg_guard_brand_members_update ON public.brand_members;
CREATE TRIGGER trg_guard_brand_members_update
    BEFORE UPDATE ON public.brand_members
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_guard_brand_members_update();

REVOKE ALL ON FUNCTION public.trg_guard_brand_members_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_brand_members_update() TO postgres, service_role;

-- 4.8 Constraint Trigger Guard DELETE: Melindungi owner dari DELETE langsung tanpa memblokir FK Cascade
-- PEMBUKTIAN LOGIKA, WAKTU EKSEKUSI (TIMING), & PENCEGAHAN ANTI-PATTERN:
-- 1. Pendekatan `current_query()` DIHINDARI SECARA MUTLAK karena rapuh, mudah dimanipulasi
--    lewat subquery/komentar SQL, dan tidak kompatibel dengan prepared statements / RPC.
-- 2. Mekanisme yang terbukti secara relasional adalah DEFERRED CONSTRAINT TRIGGER:
--    - WAKTU EKSEKUSI (TIMING): Constraint trigger dengan klausa 'DEFERRABLE INITIALLY DEFERRED'
--      TIDAK dievaluasi seketika saat pernyataan DELETE dijalankan. Pemeriksaannya ditunda hingga
--      waktu pemeriksaan constraint (secara default pada akhir transaksi saat COMMIT, atau saat
--      perintah 'SET CONSTRAINTS ... IMMEDIATE' dipanggil).
--    - JAMINAN ATOMISITAS TRANSAKSI: Jika terjadi pelanggaran (penghapusan owner ilegal saat brand
--      masih ada), pengecualian ERROR 42501 dilempar saat COMMIT, yang memaksa PostgreSQL membatalkan
--      (ROLLBACK) seluruh transaksi secara atomik tanpa meninggalkan status data setengah terhapus.
--    - KASUS A (Penghapusan Langsung Member Owner): Baris owner dihapus sementara tabel brands
--      masih memuat brand terkait -> EXISTS (SELECT 1 FROM public.brands WHERE id = OLD.brand_id)
--      bernilai TRUE -> Trigger melempar exception 42501 dan membatalkan transaksi.
--    - KASUS B (Penghapusan Brand oleh Owner melalui FK Cascade): Seluruh brand dihapus,
--      cascade FK PostgreSQL menghapus member. Saat evaluasi commit, brand TIDAK LAGI DITEMUKAN
--      pada public.brands -> EXISTS (...) bernilai FALSE -> Transaksi commit sukses.
CREATE OR REPLACE FUNCTION public.trg_guard_brand_members_owner_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.role = 'owner' THEN
        -- Periksa apakah brand induk masih ada di tabel public.brands
        IF EXISTS (SELECT 1 FROM public.brands WHERE id = OLD.brand_id) THEN
            IF NOT ((SESSION_USER IN ('postgres', 'supabase_admin')) OR (auth.role() = 'service_role')) THEN
                RAISE EXCEPTION 'Akses Ditolak: Anggota owner tidak dapat dihapus selama brand masih aktif. Penghapusan owner hanya diizinkan saat seluruh brand dihapus.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_brand_members_owner_delete ON public.brand_members;
CREATE CONSTRAINT TRIGGER trg_guard_brand_members_owner_delete
    AFTER DELETE ON public.brand_members
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_guard_brand_members_owner_delete();

REVOKE ALL ON FUNCTION public.trg_guard_brand_members_owner_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_guard_brand_members_owner_delete() TO postgres, service_role;

-- ------------------------------------------------------------------------------
-- BAGIAN 5: VERIFIKASI FUNGSI HELPER KEAMANAN (SEARCH_PATH & EXECUTE)
-- ------------------------------------------------------------------------------

-- Pastikan search_path aman pada fungsi helper RLS untuk mencegah search_path hijacking
ALTER FUNCTION public.is_brand_member(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_brand_role(UUID) SET search_path = public, pg_temp;

-- Cabut dari anon/PUBLIC, berikan hanya kepada pemanggil yang berhak
REVOKE ALL ON FUNCTION public.is_brand_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_brand_role(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_brand_member(UUID) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_brand_role(UUID) TO authenticated, postgres, service_role;

COMMIT;
