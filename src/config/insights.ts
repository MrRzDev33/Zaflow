import type {
  ContentInsightType,
  ContentInsightsDetail,
  TrafficSourceBreakdown,
} from '../types/database.ts';

/**
 * Katalog sumber tayangan Instagram. Urutan di sini adalah urutan tampilan
 * bawaan; saat ditampilkan, daftar diurutkan dari persentase terbesar dan
 * kategori bernilai 0 disembunyikan.
 */
export const TRAFFIC_SOURCE_CATALOG: { key: keyof TrafficSourceBreakdown; label: string }[] = [
  { key: 'stories', label: 'Cerita' },
  { key: 'profile', label: 'Profil' },
  { key: 'feed', label: 'Beranda (Feed)' },
  { key: 'reels', label: 'Tab Reels' },
  { key: 'explore', label: 'Jelajahi (Explore)' },
  { key: 'other', label: 'Lainnya' },
];

/**
 * Faktor yang memengaruhi tayangan, berurutan sesuai prioritas jangkauan
 * yang ditampilkan Instagram.
 */
export const VIEW_FACTOR_CATALOG: { key: string; label: string }[] = [
  { key: 'skip', label: 'Jumlah Lewati' },
  { key: 'share', label: 'Jumlah Bagikan' },
  { key: 'like', label: 'Jumlah Suka' },
  { key: 'save', label: 'Jumlah Simpan' },
  { key: 'repost', label: 'Jumlah Posting Ulang' },
  { key: 'comment', label: 'Jumlah Komentar' },
];

export const CONTENT_TYPE_OPTIONS: { value: ContentInsightType; label: string }[] = [
  { value: 'reel', label: 'Reels / Video' },
  { value: 'feed', label: 'Single Post (Feed)' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'story', label: 'Story' },
];

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  reel: 'Reels / Video',
  feed: 'Single Post',
  carousel: 'Carousel',
  story: 'Story',
};

/** Rentang usia yang dipakai Instagram Insights. */
export const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];

/** Membuat detail insight kosong dengan struktur lengkap. */
export function createEmptyInsightsDetail(): ContentInsightsDetail {
  return {
    viewFactors: VIEW_FACTOR_CATALOG.map((factor, index) => ({
      key: factor.key,
      label: factor.label,
      value: 0,
      rank: index + 1,
    })),
    trafficSources: {},
    audience: { followers: 0, non_followers: 0 },
    audienceDetails: { ages: [], countries: [], gender: null },
    series: { views: [], likes: [], retention: [] },
    approximate: false,
  };
}

export interface TrafficSourceItem {
  key: string;
  name: string;
  percentage: number;
}

/**
 * Mengubah objek sumber tayangan menjadi daftar siap tampil.
 * Kategori 0 atau kosong dibuang, lalu diurutkan dari terbesar.
 */
export function buildTrafficSourceItems(
  raw: TrafficSourceBreakdown | null | undefined
): TrafficSourceItem[] {
  if (!raw) return [];

  return TRAFFIC_SOURCE_CATALOG.map(({ key, label }) => ({
    key: String(key),
    name: label,
    percentage: Number(raw[key] || 0),
  }))
    .filter((item) => item.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

/** Normalisasi input sumber tayangan menjadi angka 0–100. */
export function normalizeTrafficSources(
  raw: Record<string, unknown> | null | undefined
): TrafficSourceBreakdown | null {
  if (!raw) return null;

  const result: TrafficSourceBreakdown = {};
  let hasValue = false;

  for (const { key } of TRAFFIC_SOURCE_CATALOG) {
    const value = Number(raw[String(key)] ?? 0);
    if (!Number.isFinite(value)) continue;

    const clamped = Math.min(100, Math.max(0, value));
    result[key] = clamped;
    if (clamped > 0) hasValue = true;
  }

  return hasValue ? result : null;
}

/** Apakah jenis konten ini punya metrik video (faktor tayangan, durasi, kapan disukai). */
export function isVideoContentType(type: string | null | undefined): boolean {
  return (type || '').toLowerCase() === 'reel';
}

/**
 * Daftar field sumber tayangan sesuai saluran.
 * Instagram memakai enam kategori resmi; platform lain memakai empat kategori
 * yang paling relevan agar form tidak membingungkan.
 */
export function getTrafficSourceFields(
  channel: string
): { key: keyof TrafficSourceBreakdown; label: string }[] {
  const normalized = (channel || '').toLowerCase();

  if (normalized === 'tiktok') {
    return [
      { key: 'reels', label: 'Untuk Anda (FYP)' },
      { key: 'feed', label: 'Mengikuti (Following)' },
      { key: 'explore', label: 'Suara / Pencarian' },
      { key: 'profile', label: 'Profil Akun' },
    ];
  }

  if (normalized === 'youtube') {
    return [
      { key: 'reels', label: 'Shorts Feed' },
      { key: 'feed', label: 'Beranda / Browse' },
      { key: 'explore', label: 'Penelusuran' },
      { key: 'profile', label: 'Halaman Channel' },
    ];
  }

  return TRAFFIC_SOURCE_CATALOG;
}
