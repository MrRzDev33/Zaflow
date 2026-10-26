# Deploy ZaFlow ke Vercel

Panduan ini membuat frontend Vite **dan** backend Express berjalan di satu domain Vercel.

## Arsitektur

```text
Browser
  ├── /                 → dist/index.html (static Vite)
  ├── /assets/*         → dist/assets/*   (static Vercel)
  └── /api/*            → rewrite → api/[...path].ts (Vercel Function → Express)
```

> Vercel Function biasa **tidak** memperlakukan `[...path].ts` sebagai catch-all multi-segmen. Tanpa rewrite, hanya `/api/health` (satu segmen) yang cocok; `/api/admin/overview` akan 404. Karena itu `vercel.json` memuat:
>
> ```json
> { "source": "/api/:path*", "destination": "/api/[...path]" }
> ```
>
> Rewrite mempertahankan `req.url` asli, sehingga Express tetap melihat `/api/admin/overview`.

File penting:

| File | Fungsi |
|---|---|
| `api/[...path].ts` | Meneruskan semua `/api/*` ke Express |
| `src/server/app.ts` | Seluruh route API (admin, AI, lisensi, Midtrans, tim) |
| `scripts/dev-server.ts` | Server lokal (Express + Vite middleware) |
| `vercel.json` | Build Vite + durasi/memori function |
| `dist/` | Hasil build frontend |

---

## 1. Pastikan Build Lokal Berhasil

```bash
npm install
npm run lint
npm run build
```

Tidak boleh ada error TypeScript.

Uji backend lokal:

```bash
npm run dev
```

Buka:

```text
http://localhost:3000/api/health
```

Harus JSON dengan `"status":"ok"`.

---

## 2. Hubungkan GitHub ke Vercel

1. Push seluruh perubahan ke GitHub.
2. Buka <https://vercel.com/new>, import repository.
3. Vercel akan membaca `vercel.json`:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Jika ditanya framework, pilih **Vite**.
5. Jangan mengubah output directory menjadi `.` atau `public`.

---

## 3. Isi Environment Variables

Buka **Project → Settings → Environment Variables**. Tambahkan untuk **Production**, **Preview**, dan **Development**:

| Nama | Contoh | Wajib |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Ya |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Ya |
| `GEMINI_API_KEY` | `AIza...` | Untuk AI |
| `GEMINI_MODELS` | `gemini-flash-latest,gemini-2.5-flash` | Opsional |
| `GEMINI_TIMEOUT_MS` | `50000` | Opsional |
| `MIDTRANS_SERVER_KEY` | `Mid-server-...` / `SB-Mid-server-...` | Untuk pembayaran |
| `MIDTRANS_CLIENT_KEY` | `Mid-client-...` | Opsional |
| `MIDTRANS_IS_PRODUCTION` | `true` | Ya |
| `APP_URL` | `https://zaaflow.vercel.app` | Ya |
| `VITE_APP_URL` | `https://zaaflow.vercel.app` | Ya |
| `VITE_LYNK_STARTER_URL` | `https://lynk.id/...` | Opsional (ada tautan bawaan) |
| `VITE_LYNK_PRO_URL` | `https://lynk.id/...` | Opsional (ada tautan bawaan) |
| `VITE_LYNK_ULTRA_URL` | `https://lynk.id/...` | Opsional (ada tautan bawaan) |
| `ALLOW_SANDBOX_CHECKOUT` | `false` | Ya |
| `NODE_ENV` | `production` | Ya |

Aturan penting:

- `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `GEMINI_API_KEY` **tidak boleh** memakai prefix `VITE_`.
- `VITE_*` di-inline saat build. Setelah mengubah nilainya, lakukan **Redeploy**.
- `APP_URL` dan `VITE_APP_URL` harus sama dengan domain produksi agar tautan konfirmasi email, reset kata sandi, dan callback Midtrans tidak jatuh ke localhost.
- Jangan mengunggah `.env.local` ke GitHub. File itu hanya untuk lokal.

---

## 4. Redeploy

Setelah environment diisi:

1. Buka **Deployments**.
2. Klik deployment terakhir → **Redeploy**.
3. Centang **Use existing build cache?** → pilih **No** jika baru mengubah `VITE_*`.

Tunggu sampai status **Ready**.

---

## 5. Verifikasi

### Health check

```text
https://domain-anda.com/api/health
```

Contoh respons yang benar:

```json
{
  "status": "ok",
  "supabaseConfigured": true,
  "geminiConfigured": true,
  "midtransConfigured": true,
  "midtransMode": "production"
}
```

Jika `supabaseConfigured` masih `false`, environment `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` belum terbaca. Perbaiki lalu redeploy.

### Endpoint admin

Tanpa token, harus mengembalikan **JSON 401**:

```text
https://domain-anda.com/api/admin/overview
```

Kalau yang muncul halaman HTML 404, function API belum ter-deploy. Lihat bagian Troubleshooting.

### Panel admin

1. Login sebagai akun dengan `profiles.system_role = 'super_admin'`.
2. Buka **Platform Admin**.
3. Data user, brand, lisensi, dan transaksi harus muncul.

---

## 6. Midtrans di Vercel

Daftarkan **Payment Notification URL**:

```text
https://domain-anda.com/api/webhook/midtrans
```

Pastikan:

- `APP_URL` sama dengan domain Vercel.
- `MIDTRANS_IS_PRODUCTION=true` dan memakai Server Key production.
- Webhook diuji dari dashboard Midtrans Sandbox/Production.
- Function tidak di-sleep saat notifikasi datang (Vercel Functions aktif sesuai request, jadi aman).

Panduan key Midtrans: `docs/MIDTRANS_SETUP.md`.

---

## 7. Batasan Vercel yang Perlu Diketahui

| Batasan | Dampak | Penanganan di ZaFlow |
|---|---|---|
| Request body 4.5 MB | Upload AI gagal jika terlalu besar | Upload dibatasi 3 MB (base64 ~4 MB) |
| Durasi function | AI bisa 504 | `maxDuration: 60`, timeout Gemini otomatis dibatasi 55 detik di Vercel |
| Rate limit per instance | Tidak global | Gunakan Vercel WAF/Upstash untuk produksi serius |
| `express.static()` tidak melayani aset | Frontend harus statis | Vercel menyajikan `dist` |
| Cold start | Request pertama lebih lambat | Wajar pada serverless |

Untuk AI berdurasi lebih lama, gunakan Vercel Pro lalu naikkan `maxDuration` di `vercel.json` dan `GEMINI_TIMEOUT_MS`.

---

## 8. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Panel admin: `Unexpected token "<"` | `/api/*` mengembalikan HTML | Pastikan `api/[...path].ts` ada dan ter-deploy |
| `/api/health` 404 | Function API tidak terdeteksi | Cek build log; pastikan folder `api/` ikut ter-commit |
| `/api/health` OK, tetapi `/api/admin/overview` 404 | Catch-all `[...path].ts` tidak otomatis multi-segmen di Vercel | Pastikan `vercel.json` berisi rewrite `/api/:path*` → `/api/[...path]`, lalu redeploy |
| Semua `/api/*` 404 | `vercel.json` tidak terbaca / folder `api` tidak ter-deploy | Cek **Functions** tab dan build log |
| `supabaseConfigured: false` | Env salah nama / belum redeploy | Isi `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, redeploy tanpa cache |
| `MIDTRANS belum dikonfigurasi` | Server key kosong | Isi `MIDTRANS_SERVER_KEY`, redeploy |
| `Signature Midtrans tidak valid` | Sandbox vs production tercampur | Samakan key dengan `MIDTRANS_IS_PRODUCTION` |
| `413 Payload Too Large` | File AI > 3 MB / body > 4.5 MB | Kompres file |
| `504 Gateway Timeout` | AI melebihi durasi function | Turunkan `GEMINI_TIMEOUT_MS` atau naikkan `maxDuration` |
| Webhook 401 | Server key salah | Salin ulang dari dashboard Midtrans |
| Perubahan env tidak berpengaruh | Build cache / belum redeploy | Redeploy dan kosongkan cache |

### Melihat log function

**Vercel → Project → Logs → Functions**, lalu filter path `/api/...`.

Log server juga menampilkan peringatan saat start:

```text
[ZaFlow] SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL belum diisi...
[ZaFlow] MIDTRANS_SERVER_KEY belum diisi...
```

---

## 9. Perintah Bermanfaat

```bash
# build lokal
npm run build

# server lokal (Express + Vite)
npm run dev

# mode produksi lokal
npm run build
NODE_ENV=production npm start
```

Untuk meniru Vercel secara lokal, instal Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

`vercel dev` membaca `vercel.json` dan menjalankan `api/[...path].ts` seperti di production.
