/**
 * Klien HTTP kecil untuk endpoint BFF (`/api/*`).
 *
 * Tujuan utama: jangan pernah memanggil `response.json()` secara langsung.
 * Saat backend tidak berjalan (static hosting, `vite preview`, Live Server,
 * atau server.ts crash), endpoint `/api/*` bisa mengembalikan halaman HTML.
 * `response.json()` lalu melempar error membingungkan seperti:
 *   Unexpected token '<', "<!doctype "... is not valid JSON
 *
 * Helper ini membaca body sebagai teks terlebih dahulu, memvalidasi JSON,
 * dan menghasilkan pesan yang menjelaskan penyebab sebenarnya.
 */

export type ApiErrorCode = 'NETWORK' | 'INVALID_JSON' | 'HTTP';

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

function looksLikeHtml(contentType: string, body: string): boolean {
  return (
    contentType.includes('text/html') ||
    /^\s*<!doctype/i.test(body) ||
    /^\s*<html/i.test(body)
  );
}

function buildInvalidJsonMessage(
  url: string,
  status: number,
  contentType: string,
  body: string
): string {
  if (looksLikeHtml(contentType, body)) {
    if (status === 404) {
      return (
        `Endpoint ${url} tidak ditemukan (HTTP 404) dan server mengembalikan halaman HTML. ` +
        'Backend API belum aktif. Jalankan aplikasi dengan "npm run dev" atau "npm start" ' +
        '(yang menjalankan server.ts), bukan "npm run preview", Live Server, atau hosting statis.'
      );
    }
    return (
      `Respons dari ${url} berupa halaman HTML, bukan JSON (HTTP ${status}). ` +
      'Pastikan server.ts (Express BFF) berjalan di domain yang sama dengan frontend. ' +
      'Hosting statis saja tidak cukup karena endpoint /api/* tidak akan tersedia.'
    );
  }

  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 160);
  return (
    `Respons dari ${url} bukan JSON yang valid (HTTP ${status}).` +
    (preview ? ` Cuplikan respons: "${preview}"` : '')
  );
}

async function parseBody(response: Response, url: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      buildInvalidJsonMessage(url, response.status, contentType, text),
      response.status,
      'INVALID_JSON'
    );
  }
}

/**
 * Fetch endpoint API dan kembalikan `{ ok, status, data }` tanpa melempar
 * error untuk status HTTP non-2xx (kecuali respons bukan JSON).
 */
export async function apiRequest<T = any>(
  url: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(
      `Tidak dapat terhubung ke server API (${url}). ` +
      'Pastikan backend ZaFlow sedang berjalan dan koneksi internet stabil.',
      0,
      'NETWORK'
    );
  }

  const data = (await parseBody(response, url)) as T;
  return { ok: response.ok, status: response.status, data };
}

/**
 * Versi yang melempar `ApiError` jika status HTTP bukan 2xx.
 * Gunakan untuk endpoint yang kegagalannya harus terlihat oleh pengguna.
 */
export async function apiFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const { ok, status, data } = await apiRequest<T>(url, init);

  if (!ok) {
    const payload: any = data;
    const message =
      payload?.error ||
      payload?.message ||
      `Permintaan ke ${url} gagal (HTTP ${status}).`;

    throw new ApiError(message, status, 'HTTP');
  }

  return data;
}

/** Ambil pesan error yang aman untuk ditampilkan di UI. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
