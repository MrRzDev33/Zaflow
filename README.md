# ZaFlow

Platform perencanaan konten, kalender editorial, analitik metrik, dan lisensi SaaS untuk agensi/tim media sosial. Frontend React + Vite, backend Express (BFF), database & auth Supabase, AI Gemini, dan pembayaran Midtrans.

## Fitur Utama

- Multi-brand workspace dengan RBAC (owner, admin, editor, viewer).
- Database konten, kalender, dan kanban workflow.
- Ekstraksi metrik dari screenshot/video dengan AI dan laporan analitik.
- AI Strategy Assistant berbasis data historis brand.
- Lisensi sekali bayar dengan kuota kredit AI dan batas brand/anggota.
- Pembayaran Midtrans (Snap) dengan webhook yang terverifikasi.
- Log aktivitas tim dan panel platform admin (super admin).

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

> **Penting:** frontend dan backend harus berjalan bersama. `npm run dev` dan `npm start` menjalankan `server.ts` (Express + Vite). Jangan memakai `npm run preview`, Live Server, atau hosting statis saja, karena endpoint `/api/*` tidak akan tersedia dan panel admin akan gagal memuat data.

## Penyiapan Supabase (WAJIB, BERURUTAN)

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan berkas berikut satu per satu:

1. `src/services/database/schema.sql` — tabel dasar & RLS awal.
2. `src/services/database/migrations/20261013_01_security_hardening_profiles_and_brands.sql`
3. `src/services/database/migrations/20261013_02_create_brand_invitations_and_activity_logs.sql`
4. `src/services/database/migrations/20261020_01_licensing_payments_limits_and_rpc.sql`

> Jangan berhenti di langkah 1. Migrasi 01 dan 20 memperbaiki kerentanan RLS, menambahkan RPC kuota atomik, dan menegakkan batas paket.

Setelah migrasi, cek cepat:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'licenses' AND indexname = 'uq_licenses_one_active_per_owner';

SELECT proname FROM pg_proc
WHERE proname IN ('consume_ai_credit', 'refund_ai_credit', 'activate_license_from_payment');
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

Alur pembayaran: klien memilih paket → `POST /api/payments/midtrans/create` → server membuat transaksi Snap → pengguna diarahkan ke halaman Midtrans → notifikasi masuk ke `/api/webhook/midtrans` → lisensi diaktifkan secara idempoten.

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server Express + Vite dev |
| `npm run build` | Build frontend ke `dist/` |
| `npm start` | Menjalankan server (mode produksi: set `NODE_ENV=production`) |
| `npm run lint` | Pemeriksaan tipe TypeScript |
| `npm run clean` | Hapus artefak build |

## Deployment

ZaFlow membutuhkan **Node.js runtime** karena frontend dan backend (`server.ts`) berjalan bersama.

Opsi yang didukung:

- **VPS / Render / Railway / Fly.io / Coolify:** jalankan `npm install && npm run build`, lalu `NODE_ENV=production npm start`.
- **Platform statis saja (Vercel static, Netlify static, GitHub Pages): tidak didukung** untuk fitur `/api/*` (admin, AI, pembayaran, undangan). Halaman akan tampil, tetapi request API mengembalikan HTML 404 dan UI menampilkan error JSON.

Checklist production:

- `NODE_ENV=production`
- `APP_URL` domain publik (HTTPS)
- Semua environment pada `.env.example` diisi
- Payment Notification URL Midtrans diarahkan ke `https://domain-anda.com/api/webhook/midtrans`
- Server tidak di-sleep saat webhook datang

Jika memakai Vercel, deploy sebagai **Node service** atau tambahkan serverless function yang meneruskan seluruh `/api/*` ke Express. Konfigurasi statis `outputDirectory: dist` saja tidak cukup.

## Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di server. Jangan pernah mengeksposnya ke browser.
- Penulisan `licenses`, `transactions`, dan `ai_usage_logs` dikunci dari klien melalui migrasi 20261020_01.
- Webhook Midtrans diverifikasi dengan signature SHA-512 sesuai dokumentasi Midtrans.
- Rate limit diterapkan pada endpoint AI dan pembayaran.

## Dokumentasi

- `docs/architecture.md`
- `docs/SUPABASE_SETUP.md`
- `docs/MIDTRANS_SETUP.md`
