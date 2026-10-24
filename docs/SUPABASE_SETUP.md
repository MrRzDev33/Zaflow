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
| 6 | `src/services/database/migrations/20261023_01_subscriptions_promo_trial_admin_and_support.sql` | Langganan bulanan, promo berjangka, trial 3 hari, kode aktivasi, status akun, audit admin, dan pengaturan aplikasi |
| 7 | `src/services/database/migrations/20261024_01_activation_code_hardening.sql` | Mengunci kode aktivasi agar benar-benar sekali pakai dan tidak bisa diaktifkan kembali setelah dipakai |
| 8 | `src/services/database/migrations/20261024_02_brand_platforms_and_trial_access_hardening.sql` | Platform brand dipilih saat brand dibuat, membersihkan trial otomatis lama, dan memastikan akun baru tanpa paket otomatis |
| 9 | `src/services/database/migrations/20261024_03_trial_request_only.sql` | Trial hanya lewat permintaan ke customer service; kode trial tetap bisa ditukar setelah pembersihan trial otomatis lama |

Setiap migrasi diawali `BEGIN;` dan diakhiri `COMMIT;`. Jika ada error, transaksi akan di-rollback seluruhnya.

> **Jika `schema.sql` pernah gagal di tengah jalan:** jangan lanjut ke migrasi berikutnya. Jalankan ulang **seluruh** `schema.sql` (sekarang idempoten), lalu ulangi seluruh migrasi 1 → 9 dari awal. Urutan ini penting karena `schema.sql` memuat policy RLS dasar yang kemudian diperketat oleh migrasi 1.

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

-- Kolom langganan bulanan dan status akun
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
```

## 4. Auth Settings

Di **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (development) atau domain produksi.
- **Redirect URLs** tambahkan:
  - `http://localhost:3000/**`
  - `https://domain-anda.com/**`

Di **Authentication → Providers → Email**:

- Aktifkan **Confirm email** untuk produksi.
- Atur template **Reset Password** agar mengarah ke aplikasi. Aplikasi menangani event `PASSWORD_RECOVERY` dan menampilkan form kata sandi baru.

> Catatan: pengguna yang mendaftar saat konfirmasi email aktif belum memiliki sesi. Setelah mengklik tautan verifikasi, mereka dapat masuk.

## 5. Harga, Promo, Trial, dan Masa Tenggang

- Katalog paket bulanan ada di `src/config/plans.ts`: Starter Rp 29.000, Pro Rp 59.000, Ultra Rp 119.000.
- Harga promo awal: Starter Rp 19.000, Pro Rp 39.000, Ultra Rp 79.000. Promo **hanya untuk pembelian paket baru**, tidak berlaku untuk perpanjangan.
- Promo diatur per paket di **Panel Admin → Harga & Promo**: harga normal, harga promo, tanggal mulai/berakhir, dan sakelar aktif. Server selalu menghitung harga akhir; harga dari browser tidak dipercaya.
- Setelah tanggal promo berakhir, harga otomatis kembali ke harga normal.
- Trial **tidak dibuat otomatis** saat pendaftaran dan tidak lagi bisa dimulai sendiri dari aplikasi. Trial bersifat **by request**: pengguna mengajukan trial ke customer service, lalu customer service membuat dan mengirimkan kode aktivasi trial. Migrasi 8 membersihkan trial otomatis lama yang dibuat versi sebelumnya agar tidak lagi tampil sebagai paket aktif.
- Platform sosial dipilih saat brand dibuat. Hanya platform terpilih yang muncul di formulir konten, filter, kalender, kanban, dan kolom username brand.
- Trial berlangsung 3 hari, 20 kredit AI, 1 brand, 1 anggota, tanpa kartu, hanya sekali per akun, dan hanya untuk akun yang belum pernah berlangganan berbayar. Kode aktivasi trial juga selalu 3 hari.
- Migrasi 9 memastikan akun yang pernah memiliki trial otomatis lama tetap dapat menukarkan kode trial dari customer service, tanpa menghapus riwayat trial lama yang sudah memakai kredit.
- Akun baru tanpa paket tidak dapat masuk ke Workspace. Halaman paket wajib dilewati dengan membeli paket, menukarkan kode aktivasi, atau menerima kode trial dari customer service.
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

Panel Admin memiliki bagian: Ringkasan, Pengguna, Langganan, Kode Aktivasi, Harga & Promo, Customer Service, Transaksi, Audit Log, dan Pengaturan Aplikasi. Penghapusan akun bersifat lunak selama 7 hari; pembersihan permanen berjalan otomatis saat panel admin dibuka atau lewat tombol **Bersihkan Terjadwal**.

## 8. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `policy ... already exists` | `schema.sql` dijalankan ulang saat policy lama masih ada | Versi terbaru `schema.sql` sudah memakai `DROP POLICY IF EXISTS`. Jalankan ulang seluruh `schema.sql`. |
| `relation "public.transactions" does not exist` | `schema.sql` berhenti sebelum membuat tabel `transactions` | Jalankan ulang seluruh `schema.sql` sampai sukses, lalu ulangi migrasi 1 → 9. |
| `syntax error at or near "line"` | Potongan SQL yang ditempel tidak lengkap/tercampur teks lain | Salin **seluruh isi file** dari folder migrasi, jangan potong manual. |
| `Could not find the function public.consume_ai_credit` | Migrasi 4 belum dijalankan | Jalankan `20261020_01_...sql` |
| `Batas brand paket Anda telah tercapai` | Batas paket aktif | Upgrade paket atau arsipkan brand lama |
| Pembayaran berhasil tetapi lisensi belum aktif | Webhook belum terdaftar / `MIDTRANS_SERVER_KEY` salah | Cek **Midtrans → Settings → Configuration**, lalu lihat log server |
| `Signature Midtrans tidak valid` | Server key berbeda (sandbox vs production) | Samakan `MIDTRANS_IS_PRODUCTION` dan server key |
| Trial tidak muncul setelah daftar | Trial memang tidak dibuat otomatis dan tidak bisa dimulai sendiri | Minta kode trial ke customer service, lalu masukkan kodenya di halaman paket |
| Lisensi tidak muncul setelah login | User belum punya lisensi dan belum menukarkan kode/membeli paket | Gunakan kode aktivasi dari customer service atau selesaikan pembayaran |
| Promo tidak berlaku saat perpanjangan | Perilaku yang benar | Promo hanya untuk pembelian paket baru; perpanjangan memakai harga normal |
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
| Akun baru langsung menampilkan “Paket aktif” dan bisa masuk Workspace | Trial otomatis lama dari trigger pendaftaran versi sebelumnya | Jalankan migrasi 8 (`20261024_02_...sql`) lalu login ulang. Server juga membersihkan trial lama ini saat status akses dimuat. |
| Promo kembali ke harga normal setelah disimpan | Tanggal akhir promo kosong atau sudah lewat sehingga promo tidak berlaku | Saat mengaktifkan promo, tanggal akhir otomatis diisi 30 hari. Jika diubah manual, pastikan tanggal akhir masih di masa depan. |
| Semua platform muncul di formulir konten | Migrasi 8 belum dijalankan atau brand belum diatur ulang | Jalankan migrasi 8, lalu pilih platform di **Pengaturan Brand**. |
| Akun diaktifkan kembali langsung punya akses | Akun masih memiliki paket yang aktif | Akses mengikuti sisa paket. Cabut paketnya di bagian **Langganan** jika akses tidak boleh dipulihkan. |
| Panel admin: `Unexpected token "<" ... is not valid JSON` | Frontend tidak terhubung ke backend; `/api/admin/overview` mengembalikan HTML | Lokal: jalankan `npm run dev`/`npm start`. Vercel: pastikan `api/[...path].ts` ter-deploy dan redeploy setelah mengubah env. |
| Panel admin: akses ditolak | `profiles.system_role` bukan `super_admin` | Jalankan `SELECT public.bootstrap_super_admin('email@domain.com');` lalu login ulang |

## 9. Catatan Keamanan

- `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `GEMINI_API_KEY` tidak boleh memakai prefix `VITE_`.
- Tabel `licenses`, `transactions`, `activation_codes`, `admin_audit_logs`, `app_settings`, dan `ai_usage_logs` tidak dapat ditulis langsung oleh client setelah migrasi 6.
- RPC aktivasi/kuota hanya dieksekusi oleh `service_role`.
- Semua nominal pembayaran berasal dari `src/config/plans.ts` dan pengaturan harga server, bukan dari browser.
- Kode aktivasi bersifat sekali pakai, dapat dibatasi email, memiliki masa berlaku, dapat dicabut, dan tercatat di audit admin.
- Penghapusan akun permanen memerlukan penghapusan/transfer brand terlebih dahulu; data transaksi dianonimkan setelah akun dihapus.
- Jangan menampilkan istilah teknis (database, server, API, storage, migrasi) di antarmuka pengguna.
