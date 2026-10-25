# Panduan Penyiapan Supabase untuk ZaFlow

Panduan ini wajib diikuti **berurutan**. Melewati migrasi akan membuat aplikasi tampak berjalan tetapi tetap rentan (eskalasi role, batas paket tidak ditegakkan, kuota AI tidak atomik).

## 1. Buat Proyek Supabase

1. Buat proyek baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka **Project Settings → API**, salin:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (hanya server)

## 2. Jalankan SQL Secara Berurutan

Buka **SQL Editor**, lalu jalankan satu per satu (jangan digabung dalam satu klik):

| Urutan | Berkas | Fungsi |
|---|---|---|
| 1 | `src/services/database/schema.sql` | Tabel dasar, RLS awal, trigger profil |
| 2 | `src/services/database/migrations/20261013_01_security_hardening_profiles_and_brands.sql` | Menutup eskalasi `super_admin`, memperketat RLS brand/anggota |
| 3 | `src/services/database/migrations/20261013_02_create_brand_invitations_and_activity_logs.sql` | Undangan tim + log aktivitas |
| 4 | `src/services/database/migrations/20261020_01_licensing_payments_limits_and_rpc.sql` | Lisensi, pembayaran, RPC kuota atomik, batas paket |
| 5 | `src/services/database/migrations/20261020_02_content_brief_post_links_and_storage.sql` | Kolom `brief`, `post_url`, `posted_at`, index histori, dan policy Storage `content-media` |
| 6 | `src/services/database/migrations/20261023_01_subscriptions_promo_trial_admin_and_support.sql` | Langganan, trial 3 hari, kode aktivasi, status akun, audit admin, dan pengaturan aplikasi (skema promo lama digantikan migrasi 10) |
| 7 | `src/services/database/migrations/20261024_01_activation_code_hardening.sql` | Mengunci kode aktivasi agar benar-benar sekali pakai dan tidak bisa diaktifkan kembali setelah dipakai |
| 8 | `src/services/database/migrations/20261024_02_brand_platforms_and_trial_access_hardening.sql` | Platform brand dipilih saat brand dibuat, membersihkan trial otomatis lama, dan memastikan akun baru tanpa paket otomatis |
| 9 | `src/services/database/migrations/20261024_03_trial_request_only.sql` | Trial hanya lewat permintaan ke customer service; kode trial tetap bisa ditukar setelah pembersihan trial otomatis lama |
| 10 | `src/services/database/migrations/20261025_01_six_month_plans.sql` | Paket 6 bulan (180 hari), kuota total 6 bulan, kode aktivasi wajib email pembeli, data pembeli pada `activation_codes`, dan harga baru tanpa promo |

Setiap migrasi diawali `BEGIN;` dan diakhiri `COMMIT;`. Jika ada error, transaksi akan di-rollback seluruhnya.

> **Wajib:** migrasi 10 harus dijalankan **sebelum** admin memakai form kode aktivasi baru. Form tersebut menulis kolom `buyer_name`, `buyer_phone`, `price_amount`, `payment_status`, `sales_channel`, dan `notes`.

> **Jika `schema.sql` pernah gagal di tengah jalan:** jangan lanjut ke migrasi berikutnya. Jalankan ulang **seluruh** `schema.sql` (sekarang idempoten), lalu ulangi seluruh migrasi 1 → 10 dari awal. Urutan ini penting karena `schema.sql` memuat policy RLS dasar yang kemudian diperketat oleh migrasi 1.

### Bucket Storage `content-media`

1. Buka **Storage** dan pastikan bucket `content-media` sudah dibuat.
2. Bucket **wajib tetap privat**. Aplikasi membaca gambar lewat signed URL.
3. Jalankan migrasi `20261020_02_...sql` untuk membuat policy baca/upload/update/delete berdasarkan brand.
4. Jalankan migrasi `20261023_01_...sql` untuk menetapkan batas file bucket menjadi **1 MB**.
5. Path file selalu diawali UUID brand, misalnya `brand_uuid/1712345678-abcd1234-gambar.webp`.
6. Aplikasi mengompres gambar di browser sebelum unggah: sisi terpanjang maksimal 1920 px, target di bawah 900 KB, format WebP dengan cadangan JPEG.

Jika bucket belum ada, buat bucket **privat** bernama `content-media` dengan batas file **1 MB** sebelum menjalankan migrasi. Migrasi 6 akan menyelaraskan batas tersebut.

## 3. Verifikasi

Jalankan query berikut. Semua harus mengembalikan baris.

```sql
-- Satu lisensi aktif per pemilik
SELECT indexname FROM pg_indexes
WHERE tablename = 'licenses'
  AND indexname = 'uq_licenses_one_active_per_owner';

-- RPC utama
SELECT proname FROM pg_proc
WHERE proname IN (
  'consume_ai_credit',
  'refund_ai_credit',
  'activate_subscription_from_payment',
  'get_active_license',
  'start_trial',
  'redeem_activation_code',
  'ensure_user_license'
);

-- Trigger batas paket
SELECT tgname FROM pg_trigger
WHERE tgname IN (
  'trg_brands_enforce_limit',
  'trg_brand_members_enforce_limit'
) AND NOT tgisinternal;

-- Trigger profil saat pendaftaran (trial TIDAK lagi dibuat otomatis)
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';

-- Kolom brief, link posting, dan tanggal posting aktual
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'content_posts'
  AND column_name IN ('brief', 'post_url', 'posted_at');

-- Kolom langganan dan status akun
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'licenses' AND column_name IN ('status', 'billing_cycle', 'current_period_start', 'current_period_end', 'is_legacy_lifetime'))
    OR (table_name = 'profiles' AND column_name IN ('status', 'trial_used_at', 'deleted_at'))
    OR (table_name = 'transactions' AND column_name IN ('plan_id', 'is_renewal', 'period_start', 'period_end'))
  );

-- Tabel dan pengaturan baru
SELECT to_regclass('public.activation_codes') AS activation_codes,
       to_regclass('public.admin_audit_logs') AS admin_audit_logs,
       to_regclass('public.app_settings') AS app_settings;

-- Kode aktivasi sekali pakai (constraint + trigger)
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.activation_codes'::regclass
  AND conname IN ('activation_codes_single_use_check', 'activation_codes_use_state_check');

SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.activation_codes'::regclass
  AND tgname = 'trg_guard_activation_code_single_use';

-- Policy Storage untuk bucket content-media
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'content_media_%';

-- Batas bucket 1 MB
SELECT id, file_size_limit
FROM storage.buckets
WHERE id = 'content-media';

-- Platform brand dan constraint platform yang valid
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'brands'
  AND column_name = 'platforms';

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.brands'::regclass
  AND conname = 'brands_platforms_check';

-- Trial otomatis lama sudah dipisahkan dari trial manual
SELECT plan_id, count(*) AS jumlah
FROM public.licenses
WHERE plan_id IN ('trial', 'legacy_auto_trial')
GROUP BY plan_id;

-- Penukaran kode trial tidak memblokir akun dengan trial otomatis lama
SELECT pg_get_functiondef('public.redeem_activation_code(uuid,text,text)'::regprocedure)
       LIKE '%legacy_auto_trial%' AS migrasi_9_aktif;

-- Data pembeli pada kode aktivasi (migrasi 10)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activation_codes'
  AND column_name IN ('buyer_name', 'buyer_phone', 'price_amount', 'payment_status', 'sales_channel', 'notes')
ORDER BY column_name;

-- Harga paket 6 bulan tersimpan di app_settings
SELECT value
FROM public.app_settings
WHERE key = 'pricing';

-- Penukaran kode memakai durasi 180 hari dan menambah kuota (migrasi 10)
SELECT pg_get_functiondef('public.redeem_activation_code(uuid,text,text)'::regprocedure)
       LIKE '%semiannual%' AS redeem_semiannual,
       pg_get_functiondef('public.redeem_activation_code(uuid,text,text)'::regprocedure)
       LIKE '%v_existing.ai_quota_total, 0) + v_plan_quota%' AS redeem_kuota_ditambah;

-- Aktivasi pembayaran memakai 180 hari dan menambah kuota (migrasi 10)
SELECT pg_get_functiondef('public.activate_subscription_from_payment(uuid,text,text,text,integer,integer,integer,integer)'::regprocedure)
       LIKE '%semiannual%' AS activate_semiannual;
```

## 4. Auth Settings

Di **Authentication → URL Configuration**:

- **Site URL**: `https://zaaflow.vercel.app` untuk produksi. Ini adalah fallback terakhir Supabase bila `redirectTo` tidak diizinkan, jadi **jangan biarkan localhost**.
- **Redirect URLs** tambahkan:
  - `https://zaaflow.vercel.app`
  - `https://zaaflow.vercel.app/**`
  - `http://localhost:3000`
  - `http://localhost:3000/**` (khusus development)
- Jika memakai domain lain di kemudian hari, tambahkan juga domain tersebut.

Di **Authentication → Providers → Email**:

- Aktifkan **Confirm email** untuk produksi.
- Buka **Email Templates → Confirm signup** dan **Reset password**, pastikan tautan memakai `{{ .ConfirmationURL }}`. Jangan menulis `http://localhost:3000` langsung di template.

Di **Vercel → Project Settings → Environment Variables** (Production dan Preview):

- `APP_URL=https://zaaflow.vercel.app`
- `VITE_APP_URL=https://zaaflow.vercel.app`
- **Redeploy** setelah mengubah `VITE_APP_URL`, karena nilainya ditanam saat build.

Perilaku aplikasi:

- Tautan konfirmasi mengarah ke `https://zaaflow.vercel.app/?confirmed=1`. Setelah email terverifikasi, aplikasi menutup sesi otomatis dan menampilkan **halaman login** dengan pesan “Email berhasil diverifikasi”.
- Tautan reset mengarah ke `https://zaaflow.vercel.app/?reset=1`. Aplikasi menampilkan form **kata sandi baru**. Jika tautan kedaluwarsa/tidak valid, halaman login menampilkan pesan agar meminta tautan baru.
- Reset dari **Panel Admin → Pengguna** juga memakai `APP_URL` yang sama.

> Catatan: pengguna yang mendaftar saat konfirmasi email aktif belum memiliki sesi. Setelah mengklik tautan verifikasi, mereka diarahkan ke halaman login untuk masuk.

## 5. Harga Paket 6 Bulan, Kode Aktivasi, Trial, dan Masa Tenggang

- Katalog paket ada di `src/config/plans.ts`: Starter **Rp 69.000**, Pro **Rp 99.000**, Ultra **Rp 130.000**. Harga tersebut adalah **harga total 6 bulan** (180 hari), bukan harga bulanan.
- Kuota AI adalah kuota **total 6 bulan**: Starter 300, Pro 600, Ultra 1.200. Kuota tidak direset setiap bulan.
- Promo dihapus total. Harga diatur per paket di **Panel Admin → Harga Paket**. Server selalu memakai harga dari katalog/pengaturan server; harga dari browser tidak dipercaya.
- Harga **tidak ditampilkan** di halaman login atau gate aktivasi. Harga hanya muncul di Workspace saat pengguna ingin memperpanjang.
- **Pembelian pertama hanya melalui kode aktivasi.** Alurnya: pembeli datang dari Meta Ads/WhatsApp → membayar ke customer service di luar aplikasi → admin membuka **Panel Admin → Kode Aktivasi**, mengisi email pembeli, nama, nomor WhatsApp, nominal, status bayar, dan catatan → kode dikirim ke pembeli → pembeli memasukkan kode di halaman aktivasi.
- Kode berbayar **wajib** memiliki `assigned_email`. RPC menolak kode berbayar tanpa email dan menolak kode yang dipakai oleh email berbeda. Kode trial lama tanpa email tetap diizinkan.
- Kode sekali pakai dan default berlaku **30 hari** sejak dibuat (`expires_at`). Admin dapat mengubah email, masa berlaku, dan data pembeli selama kode belum dipakai, serta mencabut kode kapan saja.
- Data pembeli disimpan di tabel `activation_codes` (`buyer_name`, `buyer_phone`, `price_amount`, `payment_status`, `sales_channel`, `notes`) — tidak ada tabel pesanan terpisah.
- **Midtrans hanya untuk perpanjangan.** Server menolak `POST /api/payments/midtrans/create` dengan 403 jika pengguna belum pernah memiliki paket berbayar. Perpanjangan dapat melalui Midtrans, kode aktivasi, atau customer service.
- Perpanjangan menambah masa aktif 180 hari dari akhir periode yang masih berjalan dan menambah kuota paket ke `ai_quota_total`; `ai_quota_used` tidak direset.
- Trial **tidak dibuat otomatis** saat pendaftaran dan tidak bisa dimulai sendiri dari aplikasi. Trial bersifat **by request**: pengguna mengajukan trial ke customer service, lalu customer service membuat kode aktivasi trial. Migrasi 8 membersihkan trial otomatis lama.
- Platform sosial dipilih saat brand dibuat. Hanya platform terpilih yang muncul di formulir konten, filter, kalender, kanban, dan kolom username brand.
- Trial berlangsung 3 hari, 20 kredit AI, 1 brand, 1 anggota, tanpa kartu, hanya sekali per akun, dan hanya untuk akun yang belum pernah berlangganan berbayar. Kode aktivasi trial juga selalu 3 hari.
- Migrasi 9 memastikan akun yang pernah memiliki trial otomatis lama tetap dapat menukarkan kode trial dari customer service, tanpa menghapus riwayat trial lama yang sudah memakai kredit.
- Akun baru tanpa paket tidak dapat masuk ke Workspace. Halaman aktivasi hanya berisi kolom kode aktivasi, kartu trial, dan tombol beli via WhatsApp.
- Server hanya menganggap trial sebagai akses sah jika pengguna benar-benar menukarkan kode trial. Lisensi trial tanpa penukaran kode (misalnya sisa trigger pendaftaran lama) diabaikan meskipun masih berstatus aktif di tabel `licenses`.
- Masa tenggang 3 hari hanya berlaku untuk perpanjangan paket berbayar. Trial tidak memiliki masa tenggang.
- Anggota tim mengikuti paket dan kuota AI pemilik workspace; mereka tidak membayar atau memakai trial terpisah.

## 6. Midtrans

1. Salin **Server Key** Midtrans ke `MIDTRANS_SERVER_KEY`.
2. Set `MIDTRANS_IS_PRODUCTION=false` untuk sandbox.
3. Daftarkan **Payment Notification URL**:

   ```text
   https://domain-anda.com/api/webhook/midtrans
   ```

4. Isi `APP_URL` dengan URL publik aplikasi.
5. Untuk pengujian lokal tanpa tunnel, set `ALLOW_SANDBOX_CHECKOUT=true` **hanya di development**. Mode ini mengaktifkan lisensi tanpa pembayaran nyata.
6. Endpoint Midtrans **hanya untuk perpanjangan**. Pengguna yang belum pernah memiliki paket berbayar akan menerima `403` dan harus memakai kode aktivasi dari customer service.
7. Transaksi perpanjangan memakai `billing_cycle = semiannual` dan `p_period_days = 180`.

## 7. Admin Pertama

Jangan pernah menaikkan role lewat client. Gunakan SQL Editor:

```sql
SELECT public.bootstrap_super_admin('email-admin@domain.com');
```

Fungsi `bootstrap_super_admin` dibuat oleh migrasi `20261013_01`.

Verifikasi:

```sql
SELECT u.email, p.system_role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'email-admin@domain.com';
```

`system_role` harus bernilai `super_admin`. Jika profil belum ada (akun dibuat sebelum trigger terpasang), jalankan `ensure_user_license`/buat ulang profil lewat trigger, atau hubungi dukungan database. Menu **Admin** hanya muncul jika profil memuat `system_role = 'super_admin'`, dan tidak pernah ditampilkan sebagai langkah pembayaran.

Panel Admin memiliki bagian: Ringkasan, Pengguna, Langganan, Kode Aktivasi, Harga Paket, Customer Service, Transaksi, Audit Log, dan Pengaturan Aplikasi. Penghapusan akun bersifat lunak selama 7 hari; pembersihan permanen berjalan otomatis saat panel admin dibuka atau lewat tombol **Bersihkan Terjadwal**.

## 8. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `policy ... already exists` | `schema.sql` dijalankan ulang saat policy lama masih ada | Versi terbaru `schema.sql` sudah memakai `DROP POLICY IF EXISTS`. Jalankan ulang seluruh `schema.sql`. |
| `relation "public.transactions" does not exist` | `schema.sql` berhenti sebelum membuat tabel `transactions` | Jalankan ulang seluruh `schema.sql` sampai sukses, lalu ulangi migrasi 1 → 10. |
| `syntax error at or near "line"` | Potongan SQL yang ditempel tidak lengkap/tercampur teks lain | Salin **seluruh isi file** dari folder migrasi, jangan potong manual. |
| `Could not find the function public.consume_ai_credit` | Migrasi 4 belum dijalankan | Jalankan `20261020_01_...sql` |
| `Batas brand paket Anda telah tercapai` | Batas paket aktif | Upgrade paket atau arsipkan brand lama |
| Pembayaran berhasil tetapi lisensi belum aktif | Webhook belum terdaftar / `MIDTRANS_SERVER_KEY` salah | Cek **Midtrans → Settings → Configuration**, lalu lihat log server |
| `Signature Midtrans tidak valid` | Server key berbeda (sandbox vs production) | Samakan `MIDTRANS_IS_PRODUCTION` dan server key |
| Trial tidak muncul setelah daftar | Trial memang tidak dibuat otomatis dan tidak bisa dimulai sendiri | Minta kode trial ke customer service, lalu masukkan kodenya di halaman aktivasi |
| Lisensi tidak muncul setelah login | User belum punya lisensi dan belum menukarkan kode/membeli paket | Gunakan kode aktivasi dari customer service atau selesaikan perpanjangan |
| Tautan verifikasi email / reset kata sandi mengarah ke `localhost:3000` | **Site URL** Supabase masih localhost, URL produksi belum masuk **Redirect URLs**, atau `VITE_APP_URL`/`APP_URL` belum diisi | Set **Site URL** ke `https://zaaflow.vercel.app`, tambahkan `https://zaaflow.vercel.app` dan `https://zaaflow.vercel.app/**` di **Redirect URLs**, isi `VITE_APP_URL` dan `APP_URL`, lalu redeploy |
| Setelah klik konfirmasi email langsung masuk Workspace, bukan halaman login | Versi aplikasi lama atau parameter `confirmed=1` hilang | Pastikan `emailRedirectTo` memakai `?confirmed=1` dan deploy versi terbaru |
| Halaman reset menampilkan “Tautan reset kata sandi tidak valid atau sudah kedaluwarsa” | Tautan sudah dipakai/kedaluwarsa, atau sesi recovery tidak terbentuk karena redirect tidak diizinkan | Minta tautan reset baru; pastikan domain produksi ada di **Redirect URLs** |
| Pembelian pertama ditolak saat memilih Midtrans (`403`) | Perilaku yang benar | Midtrans hanya untuk perpanjangan. Buat kode aktivasi di **Panel Admin → Kode Aktivasi** untuk pembeli baru |
| Kode aktivasi berbayar ditolak: “belum terhubung ke email pembeli” | Kode dibuat tanpa `assigned_email` | Edit kode di **Panel Admin → Kode Aktivasi** dan isi email pembeli, atau buat kode baru dengan email wajib |
| Kode aktivasi ditolak: “ditujukan untuk akun lain” | Email akun yang login berbeda dengan `assigned_email` | Pastikan pembeli login dengan email yang sama, atau ubah email kode selama belum dipakai |
| Form kode aktivasi gagal: `column ... buyer_name does not exist` | Migrasi 10 belum dijalankan | Jalankan `20261025_01_six_month_plans.sql` |
| Harga lama (29rb/59rb/119rb) masih tampil di Workspace | `app_settings.pricing` belum diperbarui | Jalankan migrasi 10, atau simpan ulang harga di **Panel Admin → Harga Paket** |
| Masa aktif setelah aktivasi masih 30 hari | RPC lama masih terpasang | Jalankan ulang `20261025_01_six_month_plans.sql` lalu verifikasi dengan query `redeem_semiannual` |
| Pembayaran berhasil tetapi paket belum aktif | Webhook belum terdaftar / `MIDTRANS_SERVER_KEY` salah | Cek **Midtrans → Settings → Configuration**, lalu cocokkan server key dan `MIDTRANS_IS_PRODUCTION` |
| Tombol WhatsApp tidak muncul | Kontak belum diaktifkan di Panel Admin | Buka **Panel Admin → Customer Service**, isi nomor, lalu aktifkan |
| `new row violates check constraint brand_invitations_status_check` | Migrasi 4 belum dijalankan | Jalankan migrasi 4 (menambahkan status `expired`) |
| Upload gambar gagal `new row violates row-level security policy` | Policy Storage `content-media` belum dibuat / path tidak diawali brand UUID | Jalankan migrasi `20261020_02_...sql`, lalu pastikan brand aktif dan bucket bernama `content-media` |
| Upload gambar ditolak karena ukuran | Batas bucket 1 MB / kompresi browser gagal | Jalankan migrasi 6 untuk menyelaraskan batas bucket, lalu unggah ulang. Format GIF di atas 1 MB memang ditolak. |
| Gambar konten tampil kosong | Bucket privat tetapi policy SELECT belum ada, atau file lama bukan path Storage | Jalankan policy Storage, lalu unggah ulang gambar dari form konten |
| `column content_posts.brief does not exist` | Migrasi `20261020_02_...sql` belum dijalankan | Jalankan migrasi tersebut di SQL Editor |
| `column profiles.status does not exist` | Migrasi 6 belum dijalankan | Jalankan `20261023_01_...sql` |
| `Could not find the function public.start_trial` | Migrasi 6 belum dijalankan | Jalankan `20261023_01_...sql` |
| Kode aktivasi bekas masih bisa dipakai | Migrasi 7 belum dijalankan | Jalankan `20261024_01_activation_code_hardening.sql` |
| Kode trial ditolak untuk akun yang pernah punya trial otomatis lama | Migrasi 9 belum dijalankan | Jalankan `20261024_03_trial_request_only.sql` |
| Akun baru langsung menampilkan “Trial Anda sudah aktif” dan tombol Workspace padahal tidak punya lisensi | RPC `get_active_license` mengembalikan objek dengan semua kolom `null` saat tidak ada baris; versi lama menganggapnya lisensi sah lalu membuat lisensi Trial palsu | Perbarui aplikasi ke versi terbaru. Server sekarang menolak baris lisensi tanpa `id`. Tidak perlu mengubah database. |
| Akun baru langsung menampilkan “Paket Trial aktif” sebelum memasukkan kode | Trial otomatis lama dari trigger pendaftaran versi sebelumnya | Jalankan migrasi 8 (`20261024_02_...sql`) lalu login ulang. Server versi terbaru juga mengabaikan trial yang tidak berasal dari penukaran kode. |
| Anggota & Tim kosong dan tombol undang tidak muncul | Kode lama meng-embed `profiles` dari `brand_members` yang tidak punya foreign key ke `profiles`, sehingga PostgREST gagal dan daftar dikosongkan | Perbarui aplikasi ke versi terbaru (query profil dipisah dan role diambil dari brand). Tidak perlu mengubah database. |
| Semua platform muncul di formulir konten | Migrasi 8 belum dijalankan atau brand belum diatur ulang | Jalankan migrasi 8, lalu pilih platform di **Pengaturan Brand**. |
| Akun diaktifkan kembali langsung punya akses | Akun masih memiliki paket yang aktif | Akses mengikuti sisa paket. Cabut paketnya di bagian **Langganan** jika akses tidak boleh dipulihkan. |
| Panel admin: `Unexpected token "<" ... is not valid JSON` | Frontend tidak terhubung ke backend; `/api/admin/overview` mengembalikan HTML | Lokal: jalankan `npm run dev`/`npm start`. Vercel: pastikan `api/[...path].ts` ter-deploy dan redeploy setelah mengubah env. |
| Panel admin: akses ditolak | `profiles.system_role` bukan `super_admin` | Jalankan `SELECT public.bootstrap_super_admin('email@domain.com');` lalu login ulang |

## 9. Catatan Keamanan

- `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `GEMINI_API_KEY` tidak boleh memakai prefix `VITE_`.
- Tabel `licenses`, `transactions`, `activation_codes`, `admin_audit_logs`, `app_settings`, dan `ai_usage_logs` tidak dapat ditulis langsung oleh client setelah migrasi 6.
- RPC aktivasi/kuota hanya dieksekusi oleh `service_role`.
- Semua nominal pembayaran berasal dari `src/config/plans.ts` dan pengaturan harga server, bukan dari browser. Harga adalah harga total 6 bulan.
- Kode aktivasi bersifat sekali pakai, wajib terikat email untuk paket berbayar, memiliki masa berlaku 30 hari (default), dapat dicabut, dan tercatat di audit admin.
- Kuota AI adalah kuota total 6 bulan. Perpanjangan menambah `ai_quota_total` tanpa mereset `ai_quota_used`.
- Penghapusan akun permanen memerlukan penghapusan/transfer brand terlebih dahulu; data transaksi dianonimkan setelah akun dihapus.
- Jangan menampilkan istilah teknis (database, server, API, storage, migrasi) di antarmuka pengguna.
