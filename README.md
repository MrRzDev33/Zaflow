# ZaFlow

Platform perencanaan konten, kalender editorial, analitik metrik, dan lisensi SaaS untuk agensi/tim media sosial. Frontend React + Vite, backend Express (BFF), database & auth Supabase, AI Gemini, dan pembayaran Midtrans.

## Fitur Utama

- Multi-brand workspace dengan RBAC (owner, admin, editor, viewer).
- Database konten, kalender, dan kanban workflow.
- Ekstraksi metrik dari screenshot/video dengan AI dan laporan analitik.
- AI Strategy Assistant berbasis data historis brand.
- Langganan bulanan dengan kuota kredit AI, batas brand/anggota, promo berjangka, dan trial 3 hari yang diajukan ke customer service.
- Pembayaran Midtrans (Snap) dengan webhook terverifikasi, harga promo hanya untuk pembelian baru, serta kode aktivasi sekali pakai.
- Log aktivitas tim dan panel admin lengkap (akun, langganan, kode aktivasi, transaksi, audit, harga, dan customer service WhatsApp).
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
   - `APP_URL`

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

> Jangan berhenti di langkah 1. Migrasi memperbaiki kerentanan RLS, menambahkan RPC kuota atomik, menegakkan batas paket, membuat langganan bulanan/promo, mengunci kode aktivasi sekali pakai, memilih platform per brand, membersihkan trial otomatis lama, menjadikan trial hanya lewat customer service, audit admin, dan batas bucket 1 MB.

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

Alur pembayaran: pengguna masuk → status akses diperiksa → klien memilih paket → `POST /api/payments/midtrans/create` → server menghitung harga normal/promo dan membuat transaksi Snap → pengguna diarahkan ke halaman Midtrans → notifikasi masuk ke `/api/webhook/midtrans` → langganan bulanan diaktifkan secara idempoten. Perpanjangan selalu memakai harga normal, dan masa aktif baru ditambahkan setelah periode berjalan.

## Langganan, Trial, dan Panel Admin

- Paket bulanan: Starter Rp 29.000, Pro Rp 59.000, Ultra Rp 119.000.
- Promo awal: Starter Rp 19.000, Pro Rp 39.000, Ultra Rp 79.000; hanya untuk pembelian baru dan berakhir sesuai tanggal yang diatur admin.
- Trial 3 hari (20 kredit AI, 1 brand, 1 anggota) bersifat **by request**: pengguna mengajukan trial ke customer service, lalu customer service memberikan kode aktivasi trial. Trial tidak diaktifkan sendiri dari aplikasi, hanya sekali per akun, dan hanya untuk akun yang belum pernah berlangganan berbayar.
- Akun baru tanpa paket tidak dapat masuk ke Workspace. Setelah login, pengguna diarahkan ke halaman paket untuk membeli paket, menukarkan kode aktivasi, atau mengajukan trial ke customer service.
- Lisensi trial hanya membuka Workspace jika berasal dari kode aktivasi yang ditukarkan pengguna. Sisa trial otomatis dari trigger pendaftaran lama diabaikan, meskipun barisnya masih ada di database.
- Masa tenggang 3 hari hanya untuk perpanjangan paket berbayar. Anggota tim mengikuti paket dan kuota pemilik workspace; daftar anggota dan tombol undang dimuat dari role brand, bukan dari embed `profiles` yang tidak memiliki foreign key.
- Panel Admin: Ringkasan, Pengguna, Langganan, Kode Aktivasi, Harga & Promo, Customer Service, Transaksi, Audit Log, dan Pengaturan Aplikasi.
- Penghapusan akun lunak selama 7 hari, lalu dibersihkan permanen otomatis saat panel admin dibuka atau lewat tombol pembersihan.
- Customer service hanya WhatsApp. Tombol muncul di halaman paket, menu bantuan, dan footer selama kontak diaktifkan admin.

Panduan SQL dan operasional lengkap ada di **`docs/SUPABASE_SETUP.md`**.

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
