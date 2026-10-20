# Panduan Lengkap Midtrans untuk ZaFlow

Panduan ini mencakup pembuatan akun, pengambilan **Server Key** dan **Client Key**, penyusunan URL webhook, pengujian di sandbox, hingga checklist produksi.

> Ringkasan: ZaFlow memakai **Snap Redirect**. Server membuat transaksi lewat API Midtrans, lalu browser diarahkan ke `redirect_url`. Status pembayaran dikonfirmasi oleh **webhook** ke `/api/webhook/midtrans`. Server key **hanya** disimpan di backend.

---

## 1. Buat Akun Midtrans (Sandbox)

1. Buka <https://midtrans.com> lalu klik **Daftar**.
2. Setelah masuk, pilih environment **Sandbox** (bukan Production).
   - Dashboard Sandbox: <https://dashboard.sandbox.midtrans.com>
   - Dashboard Production: <https://dashboard.midtrans.com>
3. Lengkapi profil bisnis bila diminta. Untuk sandbox, data uji boleh memakai data dummy.
4. Pastikan Anda berada di dashboard **Sandbox** saat mengambil kunci untuk pengujian.

> Kunci Sandbox dan Production **berbeda**. Mencampurnya adalah penyebab paling umum error `Signature Midtrans tidak valid`.

---

## 2. Ambil Server Key dan Client Key

Di Dashboard Midtrans:

1. Buka **Settings → Access Keys**.
2. Salin dua nilai berikut:

| Nama di dashboard | Variabel di ZaFlow | Dipakai untuk | Boleh masuk browser? |
|---|---|---|---|
| **Server Key** | `MIDTRANS_SERVER_KEY` | Membuat transaksi Snap, verifikasi signature webhook | **TIDAK. Hanya backend.** |
| **Client Key** | `MIDTRANS_CLIENT_KEY` | Snap.js / integrasi frontend Midtrans | Boleh, tetapi ZaFlow saat ini tidak memerlukannya |

> ZaFlow memakai alur redirect, jadi **cukup Server Key** untuk membuat pembayaran. Client Key disiapkan untuk pengembangan lanjutan (misalnya popup Snap.js).

Masukkan ke `.env.local` di **root proyek** (sejajar `package.json`):

```env
MIDTRANS_SERVER_KEY="SB-Mid-server-xxxxxxxxxxxxxxxx"
MIDTRANS_CLIENT_KEY="SB-Mid-client-xxxxxxxxxxxxxxxx"
MIDTRANS_IS_PRODUCTION=false
APP_URL="http://localhost:3000"
```

Untuk production:

```env
MIDTRANS_SERVER_KEY="Mid-server-xxxxxxxxxxxxxxxx"
MIDTRANS_CLIENT_KEY="Mid-client-xxxxxxxxxxxxxxxx"
MIDTRANS_IS_PRODUCTION=true
APP_URL="https://app.domainanda.com"
```

Setelah mengubah `.env.local`, **restart** `npm run dev` / `npm start`.

> Jangan pernah menambahkan prefix `VITE_` pada `MIDTRANS_SERVER_KEY`. Semua variabel `VITE_*` akan dikirim ke browser.

---

## 3. Susun URL Webhook

Webhook adalah alamat yang dipanggil Midtrans saat status pembayaran berubah.

Format:

```text
https://DOMAIN-ANDA/api/webhook/midtrans
```

Contoh:

```text
https://app.zaflow.id/api/webhook/midtrans
```

Syarat:

- Harus **HTTPS** dan dapat diakses publik.
- Tidak boleh memakai `localhost` atau IP privat.
- Jangan menambahkan query string.
- Endpoint ini **tidak memakai login**. Keamanannya berasal dari verifikasi signature SHA-512.

Daftarkan di:

**Dashboard Midtrans → Settings → Configuration → Payment Notification URL**

Tempel URL di atas, lalu simpan.

### Menguji lokal dengan tunnel

Midtrans tidak bisa memanggil `http://localhost:3000`. Gunakan tunnel:

**ngrok**

```bash
ngrok http 3000
```

**cloudflared**

```bash
cloudflared tunnel --url http://localhost:3000
```

Salin URL HTTPS yang muncul, misalnya:

```text
https://abc123.ngrok-free.app/api/webhook/midtrans
```

Daftarkan URL tersebut sebagai Payment Notification URL di dashboard Sandbox. Selama tunnel berjalan, pembayaran sandbox akan langsung mengaktifkan lisensi.

> URL tunnel berubah setiap kali dijalankan (kecuali paket berbayar). Perbarui dashboard Midtrans jika URL berubah.

---

## 4. Alur Pembayaran di ZaFlow

1. Pengguna membuka **Paket & Kuota** lalu memilih paket.
2. Browser memanggil `POST /api/payments/midtrans/create` dengan `planId`.
3. Server:
   - memvalidasi sesi pengguna,
   - mengambil harga dari `src/config/plans.ts` (bukan dari browser),
   - membuat baris `transactions` berstatus `pending`,
   - memanggil API Snap Midtrans,
   - mengembalikan `redirectUrl`.
4. Browser diarahkan ke halaman pembayaran Midtrans.
5. Setelah pembayaran, Midtrans mengirim notifikasi ke `/api/webhook/midtrans`.
6. Server:
   - memverifikasi `signature_key` dengan SHA-512,
   - mencocokkan `order_id` dan nominal,
   - memperbarui status transaksi,
   - memanggil RPC `activate_license_from_payment` secara idempoten.
7. Lisensi dan kredit AI langsung aktif.

Endpoint pendukung:

| Endpoint | Fungsi |
|---|---|
| `POST /api/payments/midtrans/create` | Membuat transaksi Snap |
| `GET /api/payments/midtrans/status/:orderId` | Cek status transaksi |
| `POST /api/webhook/midtrans` | Menerima notifikasi Midtrans |

---

## 5. Uji di Sandbox

1. Pastikan `.env.local` berisi Server Key sandbox dan `MIDTRANS_IS_PRODUCTION=false`.
2. Jalankan:

   ```bash
   npm run dev
   ```

3. Buka `http://localhost:3000`, masuk, lalu buka **Paket & Kuota**.
4. Pilih paket **Starter**.
5. Anda akan diarahkan ke halaman Snap Sandbox.
6. Gunakan kartu uji Midtrans, misalnya:

   | Jenis | Nomor | Hasil |
   |---|---|---|
   | Kartu sukses | `4811 1111 1111 1114` | Pembayaran sukses |
   | Kartu ditolak | `4911 1111 1111 1113` | Pembayaran ditolak |

   Gunakan masa berlaku dan CVV apa pun yang valid secara format (mis. `01/30`, `123`). Untuk 3DS, ikuti instruksi di halaman simulasi.

7. Setelah selesai, halaman Midtrans akan mengarahkan kembali ke `APP_URL`.
8. Cek database:

   ```sql
   SELECT order_id, status, plan_id, amount, paid_at
   FROM public.transactions
   ORDER BY created_at DESC
   LIMIT 5;

   SELECT owner_user_id, plan_id, status, ai_quota_total, ai_quota_used, expires_at
   FROM public.licenses
   ORDER BY updated_at DESC
   LIMIT 5;
   ```

Yang diharapkan:

- `transactions.status` = `success` (hasil pemetaan `settlement` / `capture`).
- `transactions.paid_at` terisi.
- `licenses.plan_id` berubah sesuai paket.
- `licenses.ai_quota_used` tidak di-reset; kredit baru **ditambahkan**.

### Mengetes webhook tanpa pembayaran

Gunakan **Simulator** di dashboard Sandbox:

1. Buka **Settings → Simulation** (atau menu Simulator).
2. Pilih endpoint notification.
3. Isi `order_id` yang sudah ada di tabel `transactions`.
4. Kirim notifikasi `settlement`.
5. Periksa log server dan tabel `transactions`.

Jika signature salah, server membalas `401` dan transaksi tidak berubah.

---

## 6. Mode Pengembangan Tanpa Midtrans

Untuk menguji alur lisensi tanpa akun Midtrans:

```env
ALLOW_SANDBOX_CHECKOUT=true
NODE_ENV=development
```

Dengan konfigurasi ini, checkout paket langsung mengaktifkan lisensi (tanpa pembayaran nyata).

> **Jangan aktifkan di production.** Server hanya mengizinkannya jika `NODE_ENV !== 'production'`.

---

## 7. Checklist Sebelum Production

- [ ] Akun Midtrans Production sudah aktif dan terverifikasi.
- [ ] `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` memakai kunci **Production**.
- [ ] `MIDTRANS_IS_PRODUCTION=true`.
- [ ] `APP_URL` memakai domain HTTPS publik.
- [ ] Payment Notification URL di dashboard Production: `https://domain-anda.com/api/webhook/midtrans`.
- [ ] `ALLOW_SANDBOX_CHECKOUT=false`.
- [ ] `NODE_ENV=production`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, dan `GEMINI_API_KEY` hanya ada di server.
- [ ] Uji satu transaksi nyata dengan nominal terkecil, lalu refund manual bila perlu.
- [ ] Pastikan server tidak di-sleep (serverless) saat webhook datang.

---

## 8. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `Midtrans belum dikonfigurasi di server` (HTTP 503) | `MIDTRANS_SERVER_KEY` kosong | Isi `.env.local`, restart server |
| `Signature Midtrans tidak valid` (HTTP 401) | Server key salah, atau sandbox vs production tercampur | Samakan key dengan `MIDTRANS_IS_PRODUCTION` |
| Pembayaran sukses, lisensi tidak aktif | Webhook tidak terdaftar / URL salah / server tidak publik | Cek Payment Notification URL dan log server |
| `Midtrans tidak mengembalikan halaman pembayaran` | Respons Snap tidak berisi `redirect_url` | Cek Server Key dan koneksi keluar server |
| Transaksi tetap `pending` | Notifikasi `pending` atau fraud `challenge` | Tunggu `settlement`, atau selesaikan verifikasi 3DS |
| `amount mismatch` / nominal ditolak | Harga di database lama berbeda dari katalog | Pastikan `src/config/plans.ts` sama dengan data transaksi |
| Webhook masuk tetapi 404 | Path salah | Gunakan tepat `/api/webhook/midtrans` |
| Webhook tidak pernah masuk saat lokal | Midtrans tidak bisa menghubungi `localhost` | Gunakan ngrok/cloudflared |
| Halaman admin menampilkan error `Unexpected token "<"` | Frontend tidak terhubung ke backend `server.ts` | Jalankan `npm run dev`/`npm start`, bukan hosting statis |

---

## 9. Catatan Keamanan Implementasi

- Harga dan kuota **selalu** diambil dari katalog server, bukan body request.
- Signature webhook dihitung dengan:

  ```text
  SHA512(order_id + status_code + gross_amount + server_key)
  ```

- Verifikasi memakai perbandingan waktu konstan (`timingSafeEqual`).
- Webhook bersifat idempoten: notifikasi berulang tidak menggandakan kredit.
- Endpoint pembuatan transaksi memiliki rate limit.
- RPC aktivasi lisensi hanya dapat dijalankan oleh `service_role`, bukan client.
- `licenses`, `transactions`, dan `ai_usage_logs` tidak dapat ditulis langsung dari browser.
