-- ==============================================================================
-- ZAFLOW / NARASOSIAL — SCRIPT ROLLBACK MIGRASI PHASE 1
-- File: 20261013_01_rollback.sql
-- Digunakan HANYA jika migrasi Phase 1 mengalami kendala kritis di staging.
--
-- PERINGATAN KEAMANAN TINGKAT TINGGI (CRITICAL SECURITY NOTICE):
-- Menjalankan script ini TIDAK MENGHAPUS DATA TABEL, TETAPI AKAN MEMULIHKAN
-- CELAH KEAMANAN (VULNERABILITIES) YANG SEBELUMNYA DITUTUP PADA PHASE 1:
-- 1. Mengembalikan hak UPDATE tabel penuh profiles -> Pengguna authenticated dapat
--    kembali mencoba mengubah kolom system_role menjadi super_admin.
-- 2. Menghapus trigger guard profiles -> Tidak ada lapisan trigger yang memvalidasi
--    identitas operator vs pengguna biasa.
-- 3. Mengembalikan policy INSERT brand_members lama -> Pengguna authenticated dapat
--    kembali mencoba mendaftarkan dirinya sendiri sebagai role 'owner' di brand lain.
-- 4. Menghapus index uq_brand_single_owner -> Proteksi kernel satu owner per brand hilang.
-- 5. Mengembalikan policy UPDATE brand_members lama -> Admin dapat kembali mempromosikan
--    anggota tanpa batasan hierarki.
--
-- JANGAN MENJALANKAN ROLLBACK INI DI LINGKUNGAN YANG DAPAT DIAKSES PUBLIK TANPA
-- MENGISOLASI LALU LINTAS APLIKASI TERLEBIH DAHULU.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HAPUS TRIGGER GUARDS & FUNGSI TERKAIT
-- Konsekuensi: Proteksi lapis kedua terhadap eskalasi role di tingkat engine dinonaktifkan.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_guard_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_guard_profiles_update();

DROP TRIGGER IF EXISTS trg_guard_brand_members_update ON public.brand_members;
DROP FUNCTION IF EXISTS public.trg_guard_brand_members_update();

DROP TRIGGER IF EXISTS trg_guard_brand_members_owner_delete ON public.brand_members;
DROP FUNCTION IF EXISTS public.trg_guard_brand_members_owner_delete();

-- Bersihkan trigger warisan lama jika sebelumnya pernah ada
DROP TRIGGER IF EXISTS trg_guard_brand_members ON public.brand_members;
DROP FUNCTION IF EXISTS public.trg_guard_brand_members_mutations();

-- ------------------------------------------------------------------------------
-- 2. HAPUS FUNGSI BOOTSTRAP SUPER ADMIN
-- Konsekuensi: Operator tidak dapat lagi menjalankan fungsi bootstrap terstruktur.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bootstrap_super_admin(TEXT);

-- ------------------------------------------------------------------------------
-- 3. HAPUS CONSTRAINT SINGLE OWNER
-- Konsekuensi: Satu brand dapat memiliki lebih dari 1 owner jika terjadi anomali insert.
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_brand_single_owner;

-- ------------------------------------------------------------------------------
-- 4. PEMULIHAN KEBIJAKAN & GRANT TABEL PROFILES KE SKEMA AWAL (schema.sql)
-- Konsekuensi: Kolom profil tidak lagi dilindungi di tingkat hak akses kolom.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_and_team" ON public.profiles;
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

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Pengguna hanya dapat mengubah profil miliknya sendiri (kecuali role)" ON public.profiles;

CREATE POLICY "Pengguna hanya dapat mengubah profil miliknya sendiri (kecuali role)"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Kembalikan hak Update tabel penuh ke authenticated (Kondisi schema.sql awal)
GRANT UPDATE ON public.profiles TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. PEMULIHAN KEBIJAKAN TABEL BRANDS KE SKEMA AWAL (schema.sql)
-- Konsekuensi: created_by tidak lagi ditegakkan sama dengan auth.uid() di policy INSERT.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "brands_select" ON public.brands;
DROP POLICY IF EXISTS "Anggota dapat melihat brand yang diikutinya" ON public.brands;

CREATE POLICY "Anggota dapat melihat brand yang diikutinya"
    ON public.brands FOR SELECT
    USING (public.is_brand_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "brands_insert_own" ON public.brands;
DROP POLICY IF EXISTS "Pengguna terautentikasi dapat membuat brand baru" ON public.brands;

CREATE POLICY "Pengguna terautentikasi dapat membuat brand baru"
    ON public.brands FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "brands_update_owner_admin" ON public.brands;
DROP POLICY IF EXISTS "Owner atau Admin brand dapat mengubah brand" ON public.brands;

CREATE POLICY "Owner atau Admin brand dapat mengubah brand"
    ON public.brands FOR UPDATE
    USING (public.get_user_brand_role(id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "brands_delete_owner" ON public.brands;
DROP POLICY IF EXISTS "Hanya Owner brand yang dapat menghapus brand" ON public.brands;

CREATE POLICY "Hanya Owner brand yang dapat menghapus brand"
    ON public.brands FOR DELETE
    USING (public.get_user_brand_role(id) = 'owner');

-- ------------------------------------------------------------------------------
-- 6. PEMULIHAN KEBIJAKAN & GRANT TABEL BRAND_MEMBERS KE SKEMA AWAL (schema.sql)
-- Konsekuensi: Mengembalikan celah klaim owner dan pembatasan peran admin yang longgar.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "brand_members_select" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_insert" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_update" ON public.brand_members;
DROP POLICY IF EXISTS "brand_members_delete" ON public.brand_members;

CREATE POLICY "Anggota dapat melihat daftar anggota lain dalam brand yang sama"
    ON public.brand_members FOR SELECT
    TO authenticated
    USING (public.is_brand_member(brand_id));

CREATE POLICY "Owner atau Admin dapat mengundang atau menambahkan anggota"
    ON public.brand_members FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_user_brand_role(brand_id) IN ('owner', 'admin') OR
        (user_id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "Owner atau Admin dapat memperbarui role anggota"
    ON public.brand_members FOR UPDATE
    TO authenticated
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));

CREATE POLICY "Owner atau Admin dapat mengeluarkan anggota (Owner tidak bisa dikeluarkan sembarangan)"
    ON public.brand_members FOR DELETE
    TO authenticated
    USING (public.get_user_brand_role(brand_id) IN ('owner', 'admin'));

-- Kembalikan hak Update tabel penuh ke authenticated (Kondisi schema.sql awal)
GRANT UPDATE ON public.brand_members TO authenticated;

