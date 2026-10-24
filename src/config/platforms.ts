/**
 * Katalog platform sosial yang didukung ZaFlow.
 *
 * Brand hanya memakai platform yang dipilih saat dibuat. Semua formulir
 * konten, filter, dan kolom username mengikuti daftar tersebut agar tidak
 * menampilkan platform yang tidak digunakan.
 */

export type PlatformId = 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook';

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  handleLabel: string;
  placeholder: string;
}

export const PLATFORM_ORDER: PlatformId[] = [
  'instagram',
  'tiktok',
  'linkedin',
  'youtube',
  'facebook',
];

export const PLATFORM_CATALOG: Record<PlatformId, PlatformDefinition> = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    handleLabel: 'Username Instagram',
    placeholder: '@nama.brand',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    handleLabel: 'Username TikTok',
    placeholder: '@nama.brand',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    handleLabel: 'Username LinkedIn',
    placeholder: 'nama-brand',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    handleLabel: 'Nama Channel YouTube',
    placeholder: '@namabrand',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    handleLabel: 'Username Facebook',
    placeholder: '@nama.brand',
  },
};

export const DEFAULT_BRAND_PLATFORMS: PlatformId[] = ['instagram'];

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && value in PLATFORM_CATALOG;
}

export function normalizePlatforms(value: unknown): PlatformId[] {
  if (!Array.isArray(value)) return [...DEFAULT_BRAND_PLATFORMS];
  const seen = new Set<PlatformId>();
  for (const item of value) {
    if (isPlatformId(item)) seen.add(item);
  }
  return seen.size > 0 ? PLATFORM_ORDER.filter((id) => seen.has(id)) : [...DEFAULT_BRAND_PLATFORMS];
}

type BrandPlatformSource = {
  platforms?: string[] | null;
  social_accounts?: {
    instagram?: string;
    tiktok?: string;
    linkedin?: string;
    youtube?: string;
    facebook?: string;
  } | null;
};

/**
 * Mengambil platform aktif brand. Data lama yang belum memiliki kolom
 * `platforms` diturunkan dari akun sosial yang sudah terisi.
 */
export function getBrandPlatforms(brand: BrandPlatformSource | null | undefined): PlatformId[] {
  if (!brand) return [...DEFAULT_BRAND_PLATFORMS];

  if (Array.isArray(brand.platforms) && brand.platforms.length > 0) {
    return normalizePlatforms(brand.platforms);
  }

  const fromSocial = PLATFORM_ORDER.filter((id) => {
    const value = brand.social_accounts?.[id];
    return typeof value === 'string' && value.trim().length > 0;
  });

  return fromSocial.length > 0 ? fromSocial : [...DEFAULT_BRAND_PLATFORMS];
}

export function getPlatformName(platformId: string): string {
  return isPlatformId(platformId)
    ? PLATFORM_CATALOG[platformId].name
    : platformId.charAt(0).toUpperCase() + platformId.slice(1);
}

export function getPlatformHandleLabel(platformId: string): string {
  return isPlatformId(platformId)
    ? PLATFORM_CATALOG[platformId].handleLabel
    : `Username ${getPlatformName(platformId)}`;
}

export function getPlatformPlaceholder(platformId: string): string {
  return isPlatformId(platformId)
    ? PLATFORM_CATALOG[platformId].placeholder
    : '@username';
}
