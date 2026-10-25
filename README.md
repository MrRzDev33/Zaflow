# ZaFlow

Platform perencanaan konten, kalender editorial, analitik metrik, dan lisensi SaaS untuk agensi/tim media sosial. Frontend React + Vite, backend Express (BFF), database & auth Supabase, AI Gemini, serta kode aktivasi dan Midtrans untuk perpanjangan.

## Fitur Utama

- Multi-brand workspace dengan RBAC (owner, admin, editor, viewer).
- Database konten, kalender, dan kanban workflow.
- Ekstraksi metrik dari screenshot/video dengan AI dan laporan analitik.
- AI Strategy Assistant berbasis data historis brand.
- Langganan 6 bulan dengan kuota kredit AI total, batas brand/anggota, dan trial 3 hari yang diajukan ke customer service.
- Pembelian pertama hanya lewat kode aktivasi yang dibuat admin setelah pembayaran via Meta Ads/WhatsApp; kode terikat email pembeli, sekali pakai, dan berlaku 30 hari.
- Pembayaran Midtrans (Snap) dengan webhook terverifikasi, khusus untuk perpanjangan paket yang sudah pernah berbayar.
- Log aktivitas tim dan panel admin lengkap (akun, langganan, kode aktivasi + data pembeli, transaksi, audit, harga paket, dan customer service WhatsApp).
- Daftar data besar (konten, log aktivitas, metrik, transaksi, kode aktivasi, audit) memakai pagination dengan pilihan jumlah baris dan nomor halaman.
- Kompresi gambar otomatis di browser dengan batas unggah 1 MB.

## Prasyarat

- Node.js 20+
- Akun Supabase
- Akun Midtrans (sandbox/production)
- Google AI Studio API key

## Menjalankan Secara Lokal

1. Install dependency:

   ```bash
   npm install
   ```

2. Buat/isi `.env.local` di **root proyek** (sejajar `package.json`). Jika belum ada, salin dari `.env.example`:

   ```bash
   copy .env.example .env.local
   ```

   Lalu isi:

   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `MIDTRANS_SERVER_KEY` (opsional untuk mode pembayaran)
   - `APP_URL` dan `VITE_APP_URL` (URL publik aplikasi, mis. `https://zaaflow.vercel.app`)

3. Jalankan server dev:

   ```bash
   npm run dev
   ```

4. Buka `http://localhost:3000`.

> **Penting:** frontend dan backend harus berjalan bersama. `npm run dev` dan `npm start` menjalankan `scripts/dev-server.ts` (Express + Vite, kode API di `src/server/app.ts`). Jangan memakai `npm run preview`, Live Server, atau hosting statis tanpa konfigurasi API, karena endpoint `/api/*` tidak akan tersedia dan panel admin akan gagal memuat data.

## Penyiapan Supabase (WAJIB, BERURUTAN)

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan berkas berikut satu per satu:

1. `src/services/database/schema.sql` — tabel dasar & RLS awal.
2. `src/services/database/migrations/20261013_01_security_hardening_profiles_and_brands.sql`
3. `src/services/database/migrations/20261013_02_create_brand_invitations_and_activity_logs.sql`
4. `src/services/database/migrations/20261020_01_licensing_payments_limits_and_rpc.sql`
5. `src/services/database/migrations/20261020_02_content_brief_post_links_and_storage.sql`
6. `src/services/database/migrations/20261023_01_subscriptions_promo_trial_admin_and_support.sql`
7. `src/services/database/migrations/20261024_01_activation_code_hardening.sql`
8. `src/services/database/migrations/20261024_02_brand_platforms_and_trial_access_hardening.sql`
9. `src/services/database/migrations/20261024_03_trial_request_only.sql`
10. `src/services/database/migrations/20261025_01_six_month_plans.sql`

> Jangan berhenti di langkah 1. Migrasi memperbaiki kerentanan RLS, menambahkan RPC kuota atomik, menegakkan batas paket, mengunci kode aktivasi sekali pakai, memilih platform per brand, membersihkan trial otomatis lama, menjadikan trial hanya lewat customer service, lalu mengubah paket menjadi 6 bulan dengan data pembeli pada kode aktivasi, audit admin, dan batas bucket 1 MB.

> **Wajib:** jalankan migrasi 10 **sebelum** memakai form kode aktivasi baru. Form tersebut menulis kolom `buyer_name`, `buyer_phone`, `price_amount`, `payment_status`, `sales_channel`, dan `notes` yang dibuat oleh migrasi ini.

### Tautan email Supabase (konfirmasi & reset kata sandi)

Agar tautan email tidak jatuh ke `localhost`, samakan tiga hal:

1. **Supabase → Authentication → URL Configuration**
   - **Site URL**: `https://zaaflow.vercel.app`
   - **Redirect URLs**: `https://zaaflow.vercel.app`, `https://zaaflow.vercel.app/**`, `http://localhost:3000`, dan `http://localhost:3000/**`
2. **Vercel → Environment Variables**: `APP_URL` dan `VITE_APP_URL` = `https://zaaflow.vercel.app`, lalu **redeploy**.
3. **Email Templates**: gunakan `{{ .ConfirmationURL }}` pada template Confirm signup dan Reset password.

Tautan konfirmasi berakhir di halaman login (`?confirmed=1`), sedangkan tautan reset menampilkan form kata sandi baru (`?reset=1`).

Setelah migrasi, cek cepat:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'licenses' AND indexname = 'uq_licenses_one_active_per_owner';

SELECT proname FROM pg_proc
WHERE proname IN (
  'consume_ai_credit',
  'refund_ai_credit',
  'activate_subscription_from_payment',
  'get_active_license',
  'start_trial',
  'redeem_activation_code'
);

SELECT id, file_size_limit FROM storage.buckets WHERE id = 'content-media';

-- Kode aktivasi sekali pakai
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.activation_codes'::regclass
  AND conname IN ('activation_codes_single_use_check', 'activation_codes_use_state_check');

-- Platform brand
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'brands'
  AND column_name = 'platforms';

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.brands'::regclass
  AND conname = 'brands_platforms_check';

-- Data pembeli pada kode aktivasi (migrasi 10)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activation_codes'
  AND column_name IN ('buyer_name', 'buyer_phone', 'price_amount', 'payment_status', 'sales_channel', 'notes');

-- Harga paket 6 bulan aktif
SELECT value FROM public.app_settings WHERE key = 'pricing';
```

## Penyiapan Midtrans

Panduan lengkap (membuat akun, mengambil key, menyusun URL webhook, sandbox, produksi, troubleshooting): **`docs/MIDTRANS_SETUP.md`**.

Ringkasan:

1. Login ke Dashboard Midtrans (mulai dari sandbox), lalu salin **Server Key** ke `MIDTRANS_SERVER_KEY`.
2. Set `MIDTRANS_IS_PRODUCTION=false` untuk sandbox, `true` untuk production.
3. Daftarkan URL notifikasi di **Dashboard Midtrans → Settings → Configuration → Payment Notification URL**:

   ```
   https://domain-anda.com/api/webhook/midtrans
   ```

4. Isi `APP_URL` dengan domain publik aplikasi agar pengguna kembali ke halaman yang benar setelah membayar.
5. Untuk pengujian lokal, daftarkan URL publik (mis. via tunnel) sebagai notification URL, atau aktifkan `ALLOW_SANDBOX_CHECKOUT=true` **hanya untuk development**.

Alur pembayaran: pengguna lama yang ingin memperpanjang masuk → status akses diperiksa → klien memilih paket → `POST /api/payments/midtrans/create` → server menghitung harga paket 6 bulan dan membuat transaksi Snap → pengguna diarahkan ke halaman Midtrans → notifikasi masuk ke `/api/webhook/midtrans` → masa aktif 180 hari ditambahkan dan kuota paket ditambahkan ke sisa kuota. Endpoint ini menolak pengguna yang belum pernah berbayar (403); pembelian pertama hanya melalui kode aktivasi.

## Langganan, Trial, dan Panel Admin

- Paket 6 bulan: Starter Rp 69.000, Pro Rp 99.000, Ultra Rp 130.000. Harga tersebut adalah harga total 6 bulan dan **tidak ditampilkan** di halaman login/gate; harga hanya muncul di Workspace saat pengguna ingin memperpanjang.
- Kuota AI adalah kuota **total 6 bulan** (bukan reset bulanan): Starter 300, Pro 600, Ultra 1.200. Perpanjangan menambah kuota baru ke sisa kuota tanpa mereset pemakaian.
- Promo dihapus. Harga diatur admin di **Panel Admin → Harga Paket** (satu harga per paket).
- **Pembelian pertama hanya lewat kode aktivasi.** Pembeli menghubungi customer service (mis. dari Meta Ads), membayar di luar aplikasi, lalu admin membuat kode aktivasi dengan email pembeli. Kode terikat email, sekali pakai, dan berlaku 30 hari sejak dibuat.
- **Midtrans hanya untuk perpanjangan.** Server menolak pembelian pertama melalui Midtrans; perpanjangan dapat memakai Midtrans, kode aktivasi, atau customer service.
- Trial 3 hari (20 kredit AI, 1 brand, 1 anggota) bersifat **by request**: pengguna mengajukan trial ke customer service, lalu customer service memberikan kode aktivasi trial. Trial tidak diaktifkan sendiri dari aplikasi, hanya sekali per akun, dan hanya untuk akun yang belum pernah berlangganan berbayar.
- Akun baru tanpa paket tidak dapat masuk ke Workspace. Setelah login, pengguna diarahkan ke halaman aktivasi yang hanya berisi kolom kode aktivasi, kartu trial, dan tombol beli via WhatsApp — tanpa daftar harga.
- Lisensi trial hanya membuka Workspace jika berasal dari kode aktivasi yang ditukarkan pengguna. Sisa trial otomatis dari trigger pendaftaran lama diabaikan, meskipun barisnya masih ada di database.
- Masa tenggang 3 hari hanya untuk perpanjangan paket berbayar. Anggota tim mengikuti paket dan kuota pemilik workspace; daftar anggota dan tombol undang dimuat dari role brand, bukan dari embed `profiles` yang tidak memiliki foreign key.
- Panel Admin: Ringkasan, Pengguna, Langganan, Kode Aktivasi, Harga Paket, Customer Service, Transaksi, Audit Log, dan Pengaturan Aplikasi.
- Kode aktivasi mencatat data pembeli langsung di tabel `activation_codes` (`buyer_name`, `buyer_phone`, `price_amount`, `payment_status`, `sales_channel`, `notes`) tanpa tabel pesanan terpisah. Email dan data pembeli kode yang belum dipakai dapat diubah admin.
- Penghapusan akun lunak selama 7 hari, lalu dibersihkan permanen otomatis saat panel admin dibuka atau lewat tombol pembersihan.
- Customer service hanya WhatsApp. Tombol muncul di halaman aktivasi, Workspace, menu bantuan, dan footer selama kontak diaktifkan admin.

Panduan SQL dan operasional lengkap ada di **`docs/SUPABASE_SETUP.md`**.

## Landing Page Penjualan (`/promo`)

Halaman penjualan terpisah dari aplikasi, dirancang mobile-first dan tetap rapi di desktop (kolom selebar ±430px di tengah layar).

- URL: `/promo`. Di Vercel dilayani lewat rewrite `/promo` → `/index.html` di `vercel.json`; server Express juga otomatis melayani path ini.
- Isi: hero, masalah, fitur, 4 langkah aktivasi, paket & harga, FAQ, dan CTA WhatsApp.
- Harga diambil dari `src/config/plans.ts` (`PLAN_CATALOG`), jadi angkanya sama dengan kode aplikasi.
- Tombol beli memakai tautan produk Lynk.id dari env `VITE_LYNK_STARTER_URL`, `VITE_LYNK_PRO_URL`, dan `VITE_LYNK_ULTRA_URL`. Jika kosong, tombol otomatis mengarah ke WhatsApp customer service dengan pesan berisi nama paket.
- Pembayaran tetap diproses di Lynk.id. Kode aktivasi **dibuat manual oleh admin** seperti alur sebelumnya; tidak ada webhook Lynk.id.
- Nomor WhatsApp diambil dari endpoint publik `/api/public/customer-service`, bukan ditulis di kode.
- Landing dimuat lewat dynamic import, sehingga bundle Workspace (App) tidak ikut diunduh pengunjung iklan.
- Pengunjung diarahkan mendaftar dengan **email yang sama** seperti saat membayar di Lynk.id, karena kode aktivasi terikat email.

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server Express + Vite dev |
| `npm run build` | Build frontend ke `dist/` |
| `npm start` | Menjalankan server (mode produksi: set `NODE_ENV=production`) |
| `npm run lint` | Pemeriksaan tipe TypeScript |
| `npm run clean` | Hapus artefak build |

## Deployment

### Vercel (didukung)

Repositori ini sudah menyertakan:

- `api/[...path].ts` — Vercel Function yang menjalankan seluruh API Express (`/api/*`).
- `vercel.json` — konfigurasi build Vite, rewrite `/api/:path*` → `/api/[...path]`, dan durasi fungsi.
- `scripts/dev-server.ts` — server lokal (Express + Vite middleware).

Langkah deploy:

1. Push ke GitHub, lalu import repo di Vercel.
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Isi **Environment Variables** di Vercel (Production dan Preview):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`, `GEMINI_MODELS`, `GEMINI_TIMEOUT_MS`
   - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
   - `APP_URL` = `https://domain-anda.com`
   - `ALLOW_SANDBOX_CHECKOUT=false`
   - `NODE_ENV=production`
4. **Redeploy** setelah menambah/mengubah environment variable.
5. Daftarkan webhook Midtrans ke `https://domain-anda.com/api/webhook/midtrans`.
6. Verifikasi:

   ```text
   https://domain-anda.com/api/health
   ```

   Harus mengembalikan JSON dengan `"status":"ok"` dan `"supabaseConfigured":true`.

Catatan Vercel:

- Request body Vercel Functions dibatasi **4.5 MB**. Karena itu upload AI dibatasi 3 MB (base64 ~4 MB).
- Durasi fungsi di `vercel.json` diset 60 detik. `GEMINI_TIMEOUT_MS` otomatis dibatasi 55 detik di Vercel agar tidak kena 504.
- Rate limiter bersifat per-instance di serverless. Untuk perlindungan global, gunakan Vercel WAF/Upstash Redis.
- Jangan mengandalkan `express.static()` di Vercel; aset frontend disajikan oleh Vercel dari folder `dist`.

Panduan rinci: `docs/VERCEL_DEPLOYMENT.md`.

### VPS / Render / Railway / Fly.io

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Pastikan server tidak di-sleep saat webhook Midtrans datang.

## Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server. Jangan pernah mengeksposnya ke browser.
- Penulisan `licenses`, `transactions`, dan `ai_usage_logs` dikunci dari klien melalui migrasi 20261020_01.
- Webhook Midtrans diverifikasi dengan signature SHA-512 sesuai dokumentasi Midtrans.
- Rate limit diterapkan pada endpoint AI dan pembayaran.

## Dokumentasi

- `docs/architecture.md`
- `docs/SUPABASE_SETUP.md`
- `docs/MIDTRANS_SETUP.md`
- `docs/VERCEL_DEPLOYMENT.md`
