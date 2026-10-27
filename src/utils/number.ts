/**
 * Utilitas angka untuk input metrik.
 *
 * Data insight Instagram memakai format Indonesia (`29,8%`), sementara input
 * HTML `type="number"` hanya menerima titik desimal. Helper di sini menerima
 * kedua format, membatasi nilai persentase ke 0–100, dan menampilkan hasil
 * dengan satu desimal sesuai format Indonesia.
 */

const PERCENT_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

/**
 * Mengubah teks angka menjadi number.
 * Menerima "29,8", "29.8", "29,8%", "1.234,5", dan "1,234.5".
 * Mengembalikan null jika tidak bisa dibaca.
 */
export function parseDecimalInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = value
    .replace(/%/g, '')
    .replace(/[\s\u00a0]/g, '')
    .trim();
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;

  if (lastComma >= 0 && lastDot >= 0) {
    // Pemisah yang muncul terakhir adalah pemisah desimal.
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = raw.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    // Hanya koma: anggap desimal (format Indonesia).
    normalized = raw.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Angka persentase 0–100 dengan maksimal 2 desimal.
 */
export function parsePercentInput(value: string | number | null | undefined): number | null {
  const parsed = parseDecimalInput(value);
  if (parsed === null) return null;
  const clamped = Math.min(100, Math.max(0, parsed));
  return roundTo(clamped, 2);
}

/**
 * Angka persentase 0–100, nilai kosong dianggap 0.
 */
export function parsePercentOrZero(value: string | number | null | undefined): number {
  return parsePercentInput(value) ?? 0;
}

/**
 * Bilangan bulat >= 0 untuk jumlah like, komentar, dsb.
 */
export function parseCountInput(value: string | number | null | undefined): number {
  const parsed = parseDecimalInput(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.round(parsed));
}

export function roundTo(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Format persen satu desimal: 29.8 -> "29,8%".
 */
export function formatPercent(value: number | string | null | undefined, digits = 1): string {
  const parsed = typeof value === 'string' ? parseDecimalInput(value) : value;
  if (parsed === null || parsed === undefined || !Number.isFinite(Number(parsed))) return '-';
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(parsed))}%`;
}

/**
 * Format angka desimal tanpa satuan: 29.8 -> "29,8".
 */
export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

/**
 * Format bilangan bulat dengan pemisah ribuan: 12345 -> "12.345".
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '0';
  return NUMBER_FORMATTER.format(Math.max(0, Math.round(Number(value))));
}

export function formatPercentOneDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `${PERCENT_FORMATTER.format(Number(value))}%`;
}
