# NaraSosial - Arsitektur Sistem, Keamanan & Skema Database

Dokumen ini merangkum fondasi teknis platform SaaS Social Media Marketing **ZaFlow** untuk pasar Indonesia (lisensi sekali bayar dengan kuota AI terukur).

---

## 1. Arsitektur Folder & Modul

Aplikasi memisahkan layer secara tegas antara Presentation (Frontend React), Database Service (Supabase PostgreSQL + RLS), Authentication Service, License & Quota Service, serta AI Server-Side Proxy:

```text
/
├── .env.example                     # Definisi resmi seluruh env variables
├── api/
│   └── [...path].ts                 # Vercel Function: meneruskan /api/* ke Express
├── index.html                       # Entry point SPA + metadata SEO
├── vercel.json                      # Konfigurasi build & function Vercel
├── scripts/
│   └── dev-server.ts                # Launcher lokal: Express + Vite middleware
├── docs/
│   └── architecture.md              # Dokumentasi arsitektur, RLS, analisis risiko
├── src/
│   ├── server/
│   │   └── app.ts                   # Seluruh route backend (AI, admin, lisensi, Midtrans, tim)
│   ├── config/
│   │   ├── env.ts                   # Validasi konfigurasi runtime & fallback terarah
│   │   └── supabase.ts              # Inisialisasi Supabase Client (Browser safe)
│   ├── types/
│   │   ├── database.ts              # Tipe TypeScript sesuai skema PostgreSQL
│   │   ├── auth.ts                  # Tipe sesi pengguna & hak akses role
│   │   └── license.ts               # Tipe lisensi & kuota AI
│   ├── services/
│   │   ├── auth/
│   │   │   └── authService.ts       # Manajemen Login, Register, Logout, Profil
│   │   ├── database/
│   │   │   ├── schema.sql           # DDL & kebijakan Row Level Security lengkap
│   │   │   ├── brandsService.ts     # Operasi multi-brand workspace
│   │   │   ├── contentService.ts    # Operasi postingan, kalender, kanban
│   │   │   └── activityService.ts   # Operasi audit trail aktivitas tim
│   │   ├── license/
│   │   │   └── licenseService.ts    # Pengecekan lisensi & kuota AI dari backend
│   │   └── ai/
│   │       └── aiClientService.ts   # Panggilan API AI via endpoint backend terproteksi
│   ├── hooks/
│   │   ├── useAuth.ts               # Hook state autentikasi & profil aktif
│   │   ├── useBrands.ts             # Hook pemilihan workspace brand aktif
│   │   └── useLicense.ts            # Hook pemantauan kuota AI & status lisensi
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx        # Form masuk berbahasa Indonesia
│   │   │   └── RegisterForm.tsx     # Form daftar baru
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        # Shell tata letak (Sidebar + Topbar + Brand Switcher)
│   │   │   ├── Sidebar.tsx          # Navigasi utama
│   │   │   ├── Topbar.tsx           # User menu, status kuota, notifikasi
│   │   │   └── BrandSwitcher.tsx    # Dropdown pemilihan brand aktif
│   │   ├── dashboard/
│   │   │   ├── DashboardOverview.tsx# Widget statistik, konten terjadwal, performa pilar
│   │   │   ├── StatCard.tsx         # Kartu metrik ringkas
│   │   │   └── RecentContentList.tsx# Daftar ringkas konten antrean
│   │   └── common/
│   │       ├── ConfigNotice.tsx     # Petunjuk konfigurasi bila env Supabase belum diisi
│   │       └── Badges.tsx           # Badge role, pilar, dan status
│   ├── App.tsx                      # Root state router & guard autentikasi
│   ├── main.tsx                     # React root mount
│   └── index.css                    # Tailwind CSS 4 style token
```

---

## 2. Skema Database & Relasi Antartabel

### Katalog Paket (sumber tunggal: `src/config/plans.ts`)

| Paket | Harga | Kredit AI | Brand | Anggota tim | Dapat dibeli |
|---|---:|---:|---:|---:|---|
| Trial | Rp 0 | 50 | 1 | 1 | Tidak (otomatis) |
| Starter | Rp 60.000 | 150 | 1 | 2 | Ya |
| Pro | Rp 99.000 | 350 | 3 | 5 | Ya |
| Ultra | Rp 150.000 | 2.000 | 999 | 999 | Ya |

Harga dan kuota tidak pernah diambil dari request body browser. Server selalu membaca katalog ini. Pembelian paket baru **menambahkan** kredit ke sisa kuota, bukan mereset pemakaian.


| Tabel | Keterangan | Relasi Kunci |
|---|---|---|
| `profiles` | Data profil pengguna (nama, avatar, system_role). Dibuat otomatis via Trigger Postgres saat sign-up. | `id -> auth.users.id` (1:1) |
| `licenses` | Menyimpan status lisensi sekali bayar, batas brand/member, dan sisa kuota AI. | `owner_user_id -> auth.users.id` |
| `brands` | Workspace independen untuk setiap brand atau klien agensi. | `created_by -> auth.users.id` |
| `brand_members` | Pemetaan anggota tim ke brand dengan Role (owner, admin, editor, viewer). | `brand_id -> brands.id`, `user_id -> auth.users.id` |
| `content_posts` | Database konten ide, draft, terjadwal, dan dipublikasikan. | `brand_id -> brands.id`, `author_id -> auth.users.id` |
| `content_metrics` | Data analitik performa konten (reach, engagement, likes, dll.) dari input manual atau AI extractor. | `post_id -> content_posts.id`, `brand_id -> brands.id` |
| `ai_usage_logs` | Catatan audit setiap token & kredit AI yang terpakai untuk transparansi kuota. | `user_id -> auth.users.id`, `brand_id -> brands.id`, `license_id -> licenses.id` |
| `transactions` | Riwayat pembayaran Midtrans, status, nominal, snap token, dan payload notifikasi. | `user_id -> auth.users.id` |
| `activity_logs` | Audit trail perubahan konten atau struktur tim per brand. | `brand_id -> brands.id`, `user_id -> auth.users.id` |

---

## 3. Desain Autentikasi & Kebijakan RLS (Row Level Security)

1. **Prinsip Least Privilege**:
   - Seluruh tabel memiliki `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
   - Browser client hanya menggunakan `anon_key` publik Supabase.
   - Hak akses pengguna dievaluasi langsung di tingkat kernel PostgreSQL berdasarkan JWT `auth.uid()`.
2. **Isolasi Workspace Antar-Brand**:
   - Tidak ada pengguna yang dapat melihat brand atau konten milik pengguna lain kecuali terdaftar di `brand_members`.
   - Fungsi PostgreSQL `is_brand_member(brand_id)` dan `get_user_brand_role(brand_id)` dibuat dengan flag `SECURITY DEFINER` untuk mencegah loop rekursi RLS.
3. **Pencegahan Eksploitasi Hak Akses (Anti Privilege Escalation)**:
   - Kolom `system_role` pada `profiles` dan pemotongan `ai_quota_used` pada `licenses` **tidak dapat diubah langsung oleh browser client**.
   - Pengguna tidak dapat mengangkat dirinya sendiri menjadi `owner` pada brand orang lain.
   - Pengecekan role tidak pernah mengandalkan input email dari request body browser, melainkan token JWT terverifikasi.

---

## 4. Daftar Environment Variables yang Diperlukan

| Variabel | Lokasi | Deskripsi & Sumber |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend & Backend | URL endpoint project Supabase (diambil dari Dashboard Supabase -> Project Settings -> API). |
| `VITE_SUPABASE_ANON_KEY` | Frontend & Backend | Public Anon Key untuk inisialisasi client Supabase di browser dengan penjagaan RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend Only (`src/server/app.ts`) | Kunci admin Supabase untuk validasi kuota AI & administrasi lisensi. **Jangan diekspos ke frontend**. |
| `GEMINI_API_KEY` | Backend Only (`src/server/app.ts`) | API key Google Gemini untuk OCR metrics insight & AI strategy generation. |
| `GEMINI_MODELS` | Backend Only (`src/server/app.ts`) | Daftar model Gemini dipisah koma, dicoba berurutan. |
| `MIDTRANS_SERVER_KEY` | Backend Only (`src/server/app.ts`) | Server Key Midtrans untuk membuat transaksi Snap dan memverifikasi signature webhook. |
| `MIDTRANS_IS_PRODUCTION` | Backend Only (`src/server/app.ts`) | `false` untuk sandbox, `true` untuk production. |
| `ALLOW_SANDBOX_CHECKOUT` | Backend Only (`src/server/app.ts`) | **Hanya development.** Jika `true`, pembelian mengaktifkan lisensi tanpa Midtrans. |
| `PAYMENT_WEBHOOK_SECRET` | Backend Only (`src/server/app.ts`) | Opsional, untuk webhook provider generik (`/api/webhook/payment`). |
| `APP_URL` | Backend / Env | URL publik aplikasi untuk callback Midtrans (misal `http://localhost:3000` atau domain produksi). |

---

## 5. Identifikasi Risiko Keamanan & Biaya Operasional

### A. Risiko Keamanan & Mitigasinya
1. **Penyusupan Akses Data Lintas Brand (Multi-tenant data leakage)**:
   - *Risiko*: User A melihat kalender atau metrik milik Brand B.
   - *Mitigasi*: Pengamanan ganda via PostgreSQL RLS di level basis data. Meskipun ada bug logika di frontend, database menolak query data yang tidak bersesuaian dengan keanggotaan `brand_members`.
2. **Pencurian Kuota AI (API abuse & exhaustion)**:
   - *Risiko*: User memanipulasi request frontend untuk melakukan spam ekstraksi gambar OCR hingga kuota habis atau biaya API melonjak.
   - *Mitigasi*: Frontend tidak memiliki akses langsung ke Gemini API. Endpoint `/api/ai/*` di server Express memverifikasi token sesi pengguna, memotong kuota lewat RPC atomik `consume_ai_credit`, dan menerapkan rate limiter per IP/User. Jika panggilan Gemini gagal, kredit dikembalikan berdasarkan `log_id` yang spesifik.
3. **Penyalahgunaan Pembayaran**:
   - *Risiko*: Client memanipulasi harga/paket atau memalsukan notifikasi pembayaran.
   - *Mitigasi*: Harga diambil dari katalog server; notifikasi Midtrans diverifikasi dengan signature SHA-512 (`order_id + status_code + gross_amount + server_key`) dan nominal dicocokkan dengan transaksi. Aktivasi lisensi bersifat idempoten.
4. **Penyuntikan Role Admin Palsu**:
   - *Risiko*: Pengguna mengirim payload `{ "role": "admin" }` saat mendaftar.
   - *Mitigasi*: Trigger database `handle_new_user` secara paksa menetapkan `system_role = 'user'`, mengabaikan metadata buatan client.

### B. Biaya Operasional & Model Keberlanjutan (Sekali Bayar)
1. **Biaya Hosting & Database**:
   - Supabase Free Tier mencakup 500MB database, 50.000 Monthly Active Users. Cukup untuk fase awal.
   - Cloud Run / Node hosting berskala sesuai beban serverless.
2. **Biaya Token AI (Gemini 2.5/Flash)**:
   - Kuota AI dibatasi per paket: Trial 50, Starter 150, Pro 350, Ultra 2.000 kredit.
   - Gemini 2.5 Flash memiliki biaya input/output token yang sangat efisien (~$0.075 per juta token input teks/gambar). Dengan 150 panggilan OCR per pengguna, biaya AI diperkirakan < $0.05 (Rp 800), mempertahankan margin keuntungan yang sehat.
   - Opsi pembelian *top-up credit pack* dapat disediakan setelah kuota awal habis.

---

## 6. Alur Pembayaran Midtrans

1. Pengguna memilih paket di halaman **Paket & Kuota**.
2. Klien memanggil `POST /api/payments/midtrans/create` dengan `{ planId }` dan Bearer token Supabase.
3. Server memvalidasi paket dari katalog, membuat baris `transactions` berstatus `pending`, lalu memanggil Snap API Midtrans.
4. Server mengembalikan `redirectUrl`; browser diarahkan ke halaman pembayaran Midtrans.
5. Setelah pembayaran, Midtrans mengirim notifikasi ke `POST /api/webhook/midtrans`.
6. Server memverifikasi signature, mencocokkan nominal, memetakan status, lalu memanggil RPC `activate_license_from_payment` (idempoten).
7. Klien dapat memeriksa status via `GET /api/payments/midtrans/status/:orderId`.

Status internal transaksi: `pending`, `success`, `failed`, `expired`, `refunded`.

**Penting:** daftarkan `https://domain-anda.com/api/webhook/midtrans` di Dashboard Midtrans → Settings → Configuration → Payment Notification URL. Untuk development, gunakan tunnel publik atau `ALLOW_SANDBOX_CHECKOUT=true` (jangan di production).
