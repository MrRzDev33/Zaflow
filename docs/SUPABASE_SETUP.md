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

Setiap migrasi diawali `BEGIN;` dan diakhiri `COMMIT;`. Jika ada error, transaksi akan di-rollback seluruhnya.

> **Jika `schema.sql` pernah gagal di tengah jalan:** jangan lanjut ke migrasi berikutnya. Jalankan ulang **seluruh** `schema.sql` (sekarang idempoten), lalu ulangi migrasi 1 → 2 → 3 dari awal. Urutan ini penting karena `schema.sql` memuat policy RLS dasar yang kemudian diperketat oleh migrasi 1.

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
  'activate_license_from_payment',
  'ensure_user_license'
);

-- Trigger batas paket
SELECT tgname FROM pg_trigger
WHERE tgname IN (
  'trg_brands_enforce_limit',
  'trg_brand_members_enforce_limit'
) AND NOT tgisinternal;

-- Trigger trial otomatis
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';
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

## 5. Midtrans

1. Salin **Server Key** Midtrans ke `MIDTRANS_SERVER_KEY`.
2. Set `MIDTRANS_IS_PRODUCTION=false` untuk sandbox.
3. Daftarkan **Payment Notification URL**:

   ```text
   https://domain-anda.com/api/webhook/midtrans
   ```

4. Isi `APP_URL` dengan URL publik aplikasi.
5. Untuk pengujian lokal tanpa tunnel, set `ALLOW_SANDBOX_CHECKOUT=true` **hanya di development**. Mode ini mengaktifkan lisensi tanpa pembayaran nyata.

## 6. Super Admin Pertama

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

`system_role` harus bernilai `super_admin`. Jika profil belum ada (akun dibuat sebelum trigger terpasang), jalankan `ensure_user_license`/buat ulang profil lewat trigger, atau hubungi dukungan database. Menu **Platform Admin** hanya muncul jika profil memuat `system_role = 'super_admin'`.

## 7. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `policy ... already exists` | `schema.sql` dijalankan ulang saat policy lama masih ada | Versi terbaru `schema.sql` sudah memakai `DROP POLICY IF EXISTS`. Jalankan ulang seluruh `schema.sql`. |
| `relation "public.transactions" does not exist` | `schema.sql` berhenti sebelum membuat tabel `transactions` | Jalankan ulang seluruh `schema.sql` sampai sukses, lalu ulangi migrasi 1 → 2 → 3. |
| `syntax error at or near "line"` | Potongan SQL yang ditempel tidak lengkap/tercampur teks lain | Salin **seluruh isi file** dari folder migrasi, jangan potong manual. |
| `Could not find the function public.consume_ai_credit` | Migrasi 4 belum dijalankan | Jalankan `20261020_01_...sql` |
| `Batas brand paket Anda telah tercapai` | Batas paket aktif | Upgrade paket atau arsipkan brand lama |
| Pembayaran berhasil tetapi lisensi belum aktif | Webhook belum terdaftar / `MIDTRANS_SERVER_KEY` salah | Cek **Midtrans → Settings → Configuration**, lalu lihat log server |
| `Signature Midtrans tidak valid` | Server key berbeda (sandbox vs production) | Samakan `MIDTRANS_IS_PRODUCTION` dan server key |
| Lisensi tidak muncul setelah login | User belum punya lisensi | Lisensi trial dibuat otomatis pada AI pertama; atau jalankan `SELECT public.ensure_user_license('<user-uuid>');` |
| `new row violates check constraint brand_invitations_status_check` | Migrasi 4 belum dijalankan | Jalankan migrasi 4 (menambahkan status `expired`) |
| Panel admin: `Unexpected token "<" ... is not valid JSON` | Frontend tidak terhubung ke backend; `/api/admin/overview` mengembalikan HTML | Lokal: jalankan `npm run dev`/`npm start`. Vercel: pastikan `api/[...path].ts` ter-deploy dan redeploy setelah mengubah env. |
| Panel admin: `Akses ditolak. Anda bukan platform administrator` | `profiles.system_role` bukan `super_admin` | Jalankan `SELECT public.bootstrap_super_admin('email@domain.com');` lalu login ulang |

## 8. Catatan Keamanan

- `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `GEMINI_API_KEY` tidak boleh memakai prefix `VITE_`.
- Tabel `licenses`, `transactions`, dan `ai_usage_logs` tidak dapat ditulis langsung oleh client setelah migrasi 4.
- RPC aktivasi/kuota hanya dieksekusi oleh `service_role`.
- Semua nominal pembayaran berasal dari `src/config/plans.ts`, bukan dari browser.
