-- ==============================================================================
-- ZAFLOW / NARASOSIAL — SUITE PENGUJIAN DAN VERIFIKASI POST-MIGRASI PHASE 1
-- File: 20261013_01_verify_and_tests.sql
-- Digunakan untuk menguji efektivitas keamanan dan fungsionalitas di lingkungan staging.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INSPEKSI STRUKTUR DATABASE (POST-MIGRATION VERIFICATION)
-- ------------------------------------------------------------------------------

-- 1.1 Verifikasi partial unique index single owner
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'brand_members' AND indexname = 'uq_brand_single_owner';

-- 1.2 Verifikasi hak akses tabel tingkat tinggi (Table-level Privileges)
SELECT 
    table_schema, 
    table_name, 
    grantee, 
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('profiles', 'brands', 'brand_members')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role', 'postgres')
ORDER BY table_name, grantee, privilege_type;

-- 1.3 Verifikasi pencegahan TRUNCATE (Wajib menghasilkan 0 baris untuk non-superuser)
SELECT 
    table_name, 
    grantee, 
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('profiles', 'brands', 'brand_members')
  AND privilege_type = 'TRUNCATE'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- 1.4 Verifikasi hak akses kolom (Column Privileges) pada profiles
SELECT 
    table_schema, 
    table_name, 
    column_name, 
    privilege_type, 
    grantee
FROM information_schema.column_privileges
WHERE table_name = 'profiles' AND grantee = 'authenticated'
ORDER BY column_name, privilege_type;

-- 1.5 Verifikasi hak akses kolom pada brand_members (Hanya kolom role untuk UPDATE)
SELECT 
    table_schema, 
    table_name, 
    column_name, 
    privilege_type, 
    grantee
FROM information_schema.column_privileges
WHERE table_name = 'brand_members' AND grantee = 'authenticated'
ORDER BY column_name, privilege_type;

-- 1.6 Verifikasi status trigger terpasang
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    event_manipulation AS event, 
    action_timing AS timing
FROM information_schema.triggers
WHERE event_object_table IN ('profiles', 'brand_members')
ORDER BY event_object_table, trigger_name;

-- 1.7 Verifikasi RLS policies aktif (pada profiles, brands, dan brand_members)
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'brands', 'brand_members')
ORDER BY tablename, cmd, policyname;

-- 1.8 Verifikasi hak EXECUTE pada fungsi keamanan, trigger, dan bootstrap
-- Ekspektasi:
-- - Fungsi trigger (trg_guard_*) HANYA diberikan ke postgres & service_role (TIDAK ke authenticated/anon/PUBLIC).
-- - Fungsi helper RLS (is_brand_member, get_user_brand_role) diberikan ke authenticated, postgres, & service_role.
-- - Fungsi bootstrap (bootstrap_super_admin) HANYA diberikan ke postgres & service_role.
SELECT 
    routine_name, 
    grantee, 
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN (
    'bootstrap_super_admin', 
    'trg_guard_profiles_update', 
    'trg_guard_brand_members_update', 
    'trg_guard_brand_members_owner_delete', 
    'is_brand_member', 
    'get_user_brand_role'
)
ORDER BY routine_name, grantee;

-- 1.9 Verifikasi konfigurasi search_path pada fungsi terdefinisi
SELECT 
    proname AS function_name, 
    prosecdef AS is_security_definer, 
    proconfig AS configuration_settings
FROM pg_proc
WHERE proname IN (
    'bootstrap_super_admin', 
    'trg_guard_profiles_update', 
    'trg_guard_brand_members_update', 
    'trg_guard_brand_members_owner_delete', 
    'is_brand_member', 
    'get_user_brand_role'
);



-- ==============================================================================
-- PANDUAN PENGUJIAN MUTASI STAGING (BUKAN TES YANG TELAH DIJALANKAN)
-- ==============================================================================
-- PERHATIAN PENTING:
-- Seluruh blok di bawah ini DILETAKKAN DI DALAM BLOK KOMENTAR (/* ... */)
-- dan TIDAK DIJALANKAN secara otomatis saat memeriksa struktur database.
--
-- Blok ini merupakan TEMPLATE RANCANGAN PENGUJIAN MANUAL untuk operator staging.
-- Pengujian faktual di lingkungan staging mewajibkan operator:
--   1. Menyiapkan akun nyata di auth.users (misal: akun admin, editor, owner, dan penyerang).
--   2. Mengganti UUID dummy ('00000000-...' dan '11111111-...') dengan UUID riil di staging.
--   3. Menjalankan setiap blok transaksi satu per satu dengan blok BEGIN; ... ROLLBACK;.
--
-- JANGAN PERNAH mengklaim atau berasumsi bahwa tes mutasi database di bawah ini
-- telah berhasil sebelum operator menjalankannya langsung di database staging.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2. TEMPLATE PENGUJIAN NEGATIF (SECURITY PENETRATION TESTS)
-- Jalankan di bawah konteks simulasi pengguna terautentikasi (role 'authenticated')
-- ------------------------------------------------------------------------------

/*
-- [TEST NEGATIF 1] Pengguna biasa mencoba menaikkan system_role miliknya menjadi super_admin
-- EXPECTED RESULT: GAGAL / ERROR 42501 (Permission denied atau Trigger Exception)
BEGIN;
-- Set simulasi konteks user:
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles
SET system_role = 'super_admin'
WHERE id = '00000000-0000-0000-0000-000000000001';
ROLLBACK;


-- [TEST NEGATIF 2] Pengguna biasa mencoba mengklaim role 'owner' pada brand milik pengguna lain
-- EXPECTED RESULT: GAGAL / ERROR 42501 (violates row-level security policy)
BEGIN;
-- Misal brand_id '11111111-1111-1111-1111-111111111111' dibuat oleh orang lain
INSERT INTO public.brand_members (brand_id, user_id, role)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    '00000000-0000-0000-0000-000000000001', 
    'owner'
);
ROLLBACK;


-- [TEST NEGATIF 3a] Admin brand mencoba mempromosikan anggota editor menjadi 'admin'
-- EXPECTED RESULT: GAGAL / ERROR 42501 (new row violates row-level security policy with check)
BEGIN;
-- Konteks simulasi admin:
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002'; -- Akun admin
UPDATE public.brand_members
SET role = 'admin'
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000003'; -- Akun editor
ROLLBACK;


-- [TEST NEGATIF 3b] Admin brand mencoba mengubah role sesama admin
-- EXPECTED RESULT: GAGAL / 0 rows affected (karena USING membatasi target role IN ('editor', 'viewer'))
BEGIN;
UPDATE public.brand_members
SET role = 'viewer'
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004'; -- Akun admin lain
ROLLBACK;


-- [TEST NEGATIF 3c] Pengguna/Admin mencoba menaikkan rolenya sendiri atau orang lain menjadi 'owner'
-- EXPECTED RESULT: GAGAL / ERROR 42501 (violates WITH CHECK atau trigger exception)
BEGIN;
UPDATE public.brand_members
SET role = 'owner'
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000002';
ROLLBACK;


-- [TEST NEGATIF 4a] Admin mencoba menghapus sesama admin
-- EXPECTED RESULT: GAGAL / 0 rows affected (karena USING pada DELETE menyaring role IN ('editor', 'viewer'))
BEGIN;
DELETE FROM public.brand_members
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND user_id = '00000000-0000-0000-0000-000000000004'; -- Akun admin lain
ROLLBACK;


-- [TEST NEGATIF 4b-1] Pengguna authenticated mencoba menghapus anggota ber-role 'owner' miliknya secara langsung
-- EXPECTED RESULT: GAGAL / 0 rows affected (klausul role <> 'owner' pada policy brand_members_delete)
BEGIN;
DELETE FROM public.brand_members
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND role = 'owner';
ROLLBACK;


-- [TEST NEGATIF 4b-2] Pengguna authenticated mencoba menghapus owner milik brand lain
-- EXPECTED RESULT: GAGAL / 0 rows affected (klausul role <> 'owner' dan isolasi brand RLS)
BEGIN;
DELETE FROM public.brand_members
WHERE brand_id = '99999999-9999-9999-9999-999999999999' -- Brand milik orang lain
  AND role = 'owner';
ROLLBACK;


-- [TEST NEGATIF 4c] Percobaan penghapusan langsung baris owner via DML tanpa RLS saat brand masih ada
-- (Simulasi bypass RLS / raw query internal)
-- EXPECTED RESULT: GAGAL saat COMMIT / ERROR 42501 (trg_guard_brand_members_owner_delete)
BEGIN;
DELETE FROM public.brand_members
WHERE brand_id = '11111111-1111-1111-1111-111111111111'
  AND role = 'owner';
-- Catatan: Pengecualian ERROR 42501 dilempar saat COMMIT karena deferred constraint trigger
COMMIT; -- Akibatnya transaksi dibatalkan (ROLLBACK otomatis oleh engine)


-- [TEST NEGATIF 4d] Atomisitas Transaksi: Kegagalan guard membatalkan seluruh transaksi tanpa data parsial
-- EXPECTED RESULT: Transaksi gagal total saat COMMIT, operasi lain dalam transaksi ikut batal
BEGIN;
-- Operasi 1: Update nama profil sah
UPDATE public.profiles SET full_name = 'Percobaan Nama' WHERE id = '00000000-0000-0000-0000-000000000001';
-- Operasi 2: Penghapusan ilegal baris owner
DELETE FROM public.brand_members WHERE brand_id = '11111111-1111-1111-1111-111111111111' AND role = 'owner';
-- Saat COMMIT: Trigger guard mendeteksi pelanggaran -> Exception 42501 dilempar -> Seluruh transaksi rollback
COMMIT;
-- Verifikasi: full_name profil TIDAK BERUBAH (tidak ada data setengah tersimpan).


-- [TEST NEGATIF 5] Pengguna biasa memanggil fungsi bootstrap_super_admin
-- EXPECTED RESULT: GAGAL / ERROR 42501 (permission denied for function bootstrap_super_admin)
BEGIN;
SELECT public.bootstrap_super_admin('attacker@example.com');
ROLLBACK;
*/


-- ------------------------------------------------------------------------------
-- 3. SUITE PENGUJIAN POSITIF (FUNCTIONAL CONTINUITY TESTS)
-- Memastikan alur bisnis normal pengguna dan aplikasi tetap berjalan mulus
-- ------------------------------------------------------------------------------

/*
-- [TEST POSITIF 1] Pengguna biasa memperbarui data profilnya yang sah (full_name, avatar_url)
-- EXPECTED RESULT: BERHASIL (1 row updated)
BEGIN;
UPDATE public.profiles
SET full_name = 'Nama Baru Terverifikasi',
    avatar_url = 'https://example.com/avatar.jpg'
WHERE id = '00000000-0000-0000-0000-000000000001';
ROLLBACK;


-- [TEST POSITIF 2] Alur pembuatan brand baru (brandsService.createBrand)
-- EXPECTED RESULT: BERHASIL (Brand terbuat dan pembuat sukses didaftarkan sebagai owner tunggal)
BEGIN;
-- Step 2a: Insert brand dengan created_by = auth.uid()
INSERT INTO public.brands (id, name, slug, created_by)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Brand Baru Saya',
    'brand-baru-saya',
    '00000000-0000-0000-0000-000000000001'
);

-- Step 2b: Pendaftaran owner awal oleh pembuat brand sah
INSERT INTO public.brand_members (brand_id, user_id, role)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    'owner'
);
ROLLBACK;


-- [TEST POSITIF 3a] Owner mengangkat anggota non-owner menjadi admin
-- EXPECTED RESULT: BERHASIL (Role berhasil diubah menjadi admin)
BEGIN;
UPDATE public.brand_members
SET role = 'admin'
WHERE brand_id = '22222222-2222-2222-2222-222222222222'
  AND user_id = '00000000-0000-0000-0000-000000000003';
ROLLBACK;


-- [TEST POSITIF 3b] Admin mengubah role editor menjadi viewer
-- EXPECTED RESULT: BERHASIL (Role berhasil diubah menjadi viewer)
BEGIN;
UPDATE public.brand_members
SET role = 'viewer'
WHERE brand_id = '22222222-2222-2222-2222-222222222222'
  AND user_id = '00000000-0000-0000-0000-000000000003';
ROLLBACK;


-- [TEST POSITIF 4a] Penghapusan brand oleh Owner sah beserta Foreign-Key Cascade
-- EXPECTED RESULT: BERHASIL (Brand dan seluruh membership terhapus via CASCADE tanpa dicegat trigger)
BEGIN;
DELETE FROM public.brands
WHERE id = '22222222-2222-2222-2222-222222222222';
COMMIT;


-- [TEST POSITIF 4b] Penghapusan anggota non-owner (editor) oleh Admin/Owner
-- EXPECTED RESULT: BERHASIL (1 row deleted)
BEGIN;
DELETE FROM public.brand_members
WHERE brand_id = '22222222-2222-2222-2222-222222222222'
  AND user_id = '00000000-0000-0000-0000-000000000003';
ROLLBACK;


-- [TEST POSITIF 4c] Anggota non-owner keluar mandiri (self-leave)
-- EXPECTED RESULT: BERHASIL (1 row deleted)
BEGIN;
-- Konteks simulasi user target:
-- SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.brand_members
WHERE brand_id = '22222222-2222-2222-2222-222222222222'
  AND user_id = '00000000-0000-0000-0000-000000000003';
ROLLBACK;


-- [TEST POSITIF 5] Operator sistem menjalankan bootstrap super admin di SQL Editor (role postgres)
-- EXPECTED RESULT: BERHASIL (Status SUKSES dikembalikan)
-- SELECT public.bootstrap_super_admin('admin_resmi@zaflow.com');

*/
