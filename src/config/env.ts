/**
 * Konfigurasi Environment & Validasi Kunci
 */

/**
 * Membersihkan URL Supabase dari trailing slash atau path REST API yang tidak sengaja tercopy
 * Contoh: "https://xyz.supabase.co/rest/v1/" -> "https://xyz.supabase.co"
 * Contoh: "https://xyz.supabase.co/" -> "https://xyz.supabase.co"
 */
export function sanitizeSupabaseUrl(url?: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  // Hilangkan path /rest/v1 atau /rest/v1/ jika tercopy dari dashboard API REST
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  // Hilangkan trailing slash di akhir URL
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getStoredSupabaseConfig() {
  try {
    return {
      url: localStorage.getItem('ZAFLOW_SUPABASE_URL') || '',
      anonKey: localStorage.getItem('ZAFLOW_SUPABASE_ANON_KEY') || '',
    };
  } catch {
    return { url: '', anonKey: '' };
  }
}

const stored = getStoredSupabaseConfig();
const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || stored.url;
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || stored.anonKey;

/**
 * Domain produksi yang dipakai sebagai fallback bila `VITE_APP_URL` belum diisi.
 * Ini mencegah tautan verifikasi email dan reset kata sandi jatuh ke localhost.
 */
export const DEFAULT_PRODUCTION_APP_URL = 'https://zaaflow.vercel.app';

/**
 * Menormalkan URL aplikasi: menambah protokol bila hilang dan menghapus
 * trailing slash agar penggabungan path tidak menghasilkan `//`.
 */
export function normalizeAppUrl(url?: string | null): string {
  if (!url) return '';
  let cleaned = url.trim();
  if (!cleaned) return '';
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
  return cleaned.replace(/\/+$/, '');
}

/**
 * URL publik aplikasi untuk tautan email Supabase (konfirmasi & reset).
 * Prioritas: `VITE_APP_URL` -> origin browser saat ini -> domain produksi.
 */
export function getPublicAppUrl(): string {
  const configured = normalizeAppUrl(import.meta.env.VITE_APP_URL as string | undefined);
  if (configured) return configured;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = normalizeAppUrl(window.location.origin);
    if (origin) return origin;
  }

  return DEFAULT_PRODUCTION_APP_URL;
}

export const env = {
  rawSupabaseUrl,
  supabaseUrl: sanitizeSupabaseUrl(rawSupabaseUrl),
  supabaseAnonKey: rawAnonKey?.trim(),
  appUrl: getPublicAppUrl(),
  isDev: import.meta.env.DEV,
};

/**
 * Memeriksa apakah Supabase telah dikonfigurasi dengan URL & Anon Key yang valid
 */
export function isSupabaseConfigured(): boolean {
  const stored = getStoredSupabaseConfig();
  const url = env.supabaseUrl || stored.url;
  const key = env.supabaseAnonKey || stored.anonKey;
  return Boolean(
    url &&
    key &&
    url.length > 0 &&
    key.length > 0 &&
    url.startsWith('http')
  );
}
