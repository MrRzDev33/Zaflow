import app from '../src/server/app.ts';

/**
 * Entry point Vercel Function untuk seluruh endpoint `/api/*`.
 *
 * - File `api/[...path].ts` menangkap semua path, sehingga Express menerima
 *   URL asli, mis. `/api/admin/overview`.
 * - `bodyParser: false` mematikan parser bawaan Vercel agar `express.json()`
 *   dapat membaca stream body dan menyimpan `rawBody` untuk verifikasi webhook.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
