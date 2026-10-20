import { supabase, isConfigured } from '../../config/supabase.ts';

export const CONTENT_MEDIA_BUCKET = 'content-media';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 jam
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function isExternalUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}

function sanitizeFileName(name: string): string {
  const fallback = `image-${Date.now()}.jpg`;
  const safe = (name || fallback)
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();

  return safe || fallback;
}

function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/avif') return 'avif';
  return 'jpg';
}

function assertImageFile(file: File): void {
  const looksLikeImage = /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name || '');
  if (!file.type.startsWith('image/') && !looksLikeImage) {
    throw new Error('Hanya file gambar yang dapat diunggah ke media konten.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ukuran gambar maksimal 10 MB.');
  }
}

export const mediaService = {
  /**
   * Upload gambar ke bucket Supabase Storage `content-media`.
   * Path selalu diawali brandId agar policy Storage dapat memvalidasi akses brand.
   * Nilai yang dikembalikan adalah path storage (bukan URL sementara).
   */
  async uploadContentImage(file: File, brandId: string): Promise<string> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');
    if (!brandId) throw new Error('Brand tidak ditemukan.');

    assertImageFile(file);

    const extension = fileExtension(file);
    const fileName = sanitizeFileName(file.name);
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
    const objectPath = `${brandId}/${uniqueName}`;

    const { error } = await supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      });

    if (error) {
      console.error('Gagal mengunggah gambar konten:', error);
      throw new Error(
        `Gagal mengunggah gambar ke Supabase Storage: ${error.message}. Pastikan bucket "${CONTENT_MEDIA_BUCKET}" dan policy Storage sudah dibuat.`
      );
    }

    return objectPath;
  },

  /**
   * Mengubah path storage menjadi signed URL. URL eksternal/data URL dikembalikan apa adanya.
   * Bucket `content-media` bersifat privat, jadi gambar harus dibaca melalui signed URL.
   */
  async resolveMediaUrl(value: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
    if (!value) return '';
    if (isExternalUrl(value)) return value;

    const cached = signedUrlCache.get(value);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;

    const { data, error } = await supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .createSignedUrl(value, expiresIn);

    if (error || !data?.signedUrl) {
      console.warn('Gagal membuat signed URL media konten:', error?.message || error);
      return '';
    }

    signedUrlCache.set(value, {
      url: data.signedUrl,
      expiresAt: Date.now() + Math.max(60, expiresIn - 300) * 1000,
    });

    return data.signedUrl;
  },

  async removeContentImage(path: string): Promise<void> {
    if (!path || isExternalUrl(path) || !isConfigured) return;
    const { error } = await supabase.storage.from(CONTENT_MEDIA_BUCKET).remove([path]);
    if (error) {
      console.warn('Gagal menghapus gambar konten:', error.message);
    }
    signedUrlCache.delete(path);
  },
};
