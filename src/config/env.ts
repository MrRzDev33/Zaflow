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

export const env = {
  rawSupabaseUrl,
  supabaseUrl: sanitizeSupabaseUrl(rawSupabaseUrl),
  supabaseAnonKey: rawAnonKey?.trim(),
  appUrl: (import.meta.env.VITE_APP_URL || window.location.origin) as string,
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
