import { supabase, isConfigured } from '../../config/supabase.ts';
import {
  CONTENT_IMAGE_MAX_BYTES,
  compressContentImage,
  type ImageCompressionResult,
} from './imageCompression.ts';

export const CONTENT_MEDIA_BUCKET = 'content-media';

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
  const looksLikeImage = /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(file.name || '');
  if (!file.type.startsWith('image/') && !looksLikeImage) {
    throw new Error('Hanya file gambar yang dapat diunggah ke media konten.');
  }
}

export interface UploadedContentImage {
  path: string;
  originalBytes: number;
  uploadedBytes: number;
  wasCompressed: boolean;
}

export const mediaService = {
  /**
   * Upload gambar ke media konten. Gambar dikompresi terlebih dahulu agar
   * ukuran akhir maksimal 1 MB dan sisi terpanjang maksimal 1920 px.
   * Path selalu diawali brandId.
   */
  async uploadContentImageDetailed(file: File, brandId: string): Promise<UploadedContentImage> {
    if (!isConfigured) throw new Error('Layanan media belum siap.');
    if (!brandId) throw new Error('Brand tidak ditemukan.');

    assertImageFile(file);

    const compressed: ImageCompressionResult = await compressContentImage(file);
    if (compressed.file.size > CONTENT_IMAGE_MAX_BYTES) {
      throw new Error('Ukuran gambar maksimal 1 MB.');
    }

    const extension = fileExtension(compressed.file);
    const fileName = sanitizeFileName(compressed.file.name);
    const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
    const objectPath = `${brandId}/${uniqueName}`;

    const { error } = await supabase.storage
      .from(CONTENT_MEDIA_BUCKET)
      .upload(objectPath, compressed.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: compressed.file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      });

    if (error) {
      console.error('Gagal mengunggah gambar konten:', error);
      throw new Error('Gambar belum dapat diunggah. Silakan coba lagi.');
    }

    return {
      path: objectPath,
      originalBytes: compressed.originalBytes,
      uploadedBytes: compressed.uploadedBytes,
      wasCompressed: compressed.wasCompressed,
    };
  },

  async uploadContentImage(file: File, brandId: string): Promise<string> {
    const result = await this.uploadContentImageDetailed(file, brandId);
    return result.path;
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
