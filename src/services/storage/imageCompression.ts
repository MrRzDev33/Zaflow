export const CONTENT_IMAGE_MAX_BYTES = 1024 * 1024;
export const CONTENT_IMAGE_TARGET_BYTES = 900 * 1024;
export const CONTENT_IMAGE_MAX_EDGE = 1920;

const WEBP_QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];
const RESIZE_STEPS = [1, 0.85, 0.72, 0.6];

export interface ImageCompressionResult {
  file: File;
  originalBytes: number;
  uploadedBytes: number;
  wasCompressed: boolean;
  width: number;
  height: number;
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

function isGif(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
}

function isSvg(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
}

function isSupportedImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(file.name || '');
}

function replaceExtension(name: string, extension: string): string {
  const base = (name || 'gambar').replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '-').slice(0, 80);
  return `${base || 'gambar'}.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fallback ke elemen gambar di bawah.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function drawToCanvas(
  image: LoadedImage,
  targetWidth: number,
  targetHeight: number,
  background: string | null
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetWidth));
  canvas.height = Math.max(1, Math.round(targetHeight));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Gambar tidak dapat diproses di perangkat ini.');

  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function scaledSize(width: number, height: number, maxEdge: number, scale: number) {
  const longest = Math.max(width, height);
  const edgeScale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(width * edgeScale * scale)),
    height: Math.max(1, Math.round(height * edgeScale * scale)),
  };
}

/**
 * Menyiapkan gambar konten sebelum diunggah:
 * - maksimal sisi terpanjang 1920 px;
 * - target akhir <= 900 KB;
 * - format WebP, dengan JPEG sebagai cadangan;
 * - GIF di atas 1 MB ditolak dan GIF kecil dibiarkan apa adanya;
 * - SVG kecil dibiarkan apa adanya karena bukan gambar raster.
 */
export async function compressContentImage(file: File): Promise<ImageCompressionResult> {
  if (!isSupportedImage(file)) {
    throw new Error('Hanya file gambar yang dapat diunggah.');
  }

  if (isGif(file)) {
    if (file.size > CONTENT_IMAGE_MAX_BYTES) {
      throw new Error('Ukuran GIF maksimal 1 MB. Silakan kecilkan file terlebih dahulu.');
    }
    return {
      file,
      originalBytes: file.size,
      uploadedBytes: file.size,
      wasCompressed: false,
      width: 0,
      height: 0,
    };
  }

  if (isSvg(file)) {
    if (file.size > CONTENT_IMAGE_MAX_BYTES) {
      throw new Error('Ukuran gambar maksimal 1 MB.');
    }
    return {
      file,
      originalBytes: file.size,
      uploadedBytes: file.size,
      wasCompressed: false,
      width: 0,
      height: 0,
    };
  }

  const image = await loadImage(file);
  try {
    const originalWidth = image.width;
    const originalHeight = image.height;
    const needsResize = Math.max(originalWidth, originalHeight) > CONTENT_IMAGE_MAX_EDGE;
    const needsCompression = file.size > CONTENT_IMAGE_TARGET_BYTES;

    if (!needsResize && !needsCompression && file.type !== 'image/avif') {
      return {
        file,
        originalBytes: file.size,
        uploadedBytes: file.size,
        wasCompressed: false,
        width: originalWidth,
        height: originalHeight,
      };
    }

    let bestBlob: Blob | null = null;
    let bestExtension = 'webp';
    let bestWidth = originalWidth;
    let bestHeight = originalHeight;

    for (const scale of RESIZE_STEPS) {
      const size = scaledSize(originalWidth, originalHeight, CONTENT_IMAGE_MAX_EDGE, scale);
      const canvas = drawToCanvas(image, size.width, size.height, 'transparent');

      for (const quality of WEBP_QUALITIES) {
        const webp = await canvasToBlob(canvas, 'image/webp', quality);
        if (webp && webp.type === 'image/webp' && (!bestBlob || webp.size < bestBlob.size)) {
          bestBlob = webp;
          bestExtension = 'webp';
          bestWidth = size.width;
          bestHeight = size.height;
        }
        if (webp && webp.size <= CONTENT_IMAGE_TARGET_BYTES) {
          return {
            file: new File([webp], replaceExtension(file.name, 'webp'), {
              type: 'image/webp',
              lastModified: Date.now(),
            }),
            originalBytes: file.size,
            uploadedBytes: webp.size,
            wasCompressed: true,
            width: size.width,
            height: size.height,
          };
        }
      }

      // Browser lama yang belum mendukung WebP: gunakan JPEG.
      if (!bestBlob) {
        const jpegCanvas = drawToCanvas(image, size.width, size.height, '#ffffff');
        for (const quality of WEBP_QUALITIES) {
          const jpeg = await canvasToBlob(jpegCanvas, 'image/jpeg', quality);
          if (jpeg && (!bestBlob || jpeg.size < bestBlob.size)) {
            bestBlob = jpeg;
            bestExtension = 'jpg';
            bestWidth = size.width;
            bestHeight = size.height;
          }
          if (jpeg && jpeg.size <= CONTENT_IMAGE_TARGET_BYTES) {
            return {
              file: new File([jpeg], replaceExtension(file.name, 'jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }),
              originalBytes: file.size,
              uploadedBytes: jpeg.size,
              wasCompressed: true,
              width: size.width,
              height: size.height,
            };
          }
        }
      }
    }

    if (!bestBlob || bestBlob.size > CONTENT_IMAGE_MAX_BYTES) {
      throw new Error('Gambar belum dapat diperkecil di bawah 1 MB. Silakan gunakan gambar lain.');
    }

    return {
      file: new File([bestBlob], replaceExtension(file.name, bestExtension), {
        type: bestBlob.type || (bestExtension === 'webp' ? 'image/webp' : 'image/jpeg'),
        lastModified: Date.now(),
      }),
      originalBytes: file.size,
      uploadedBytes: bestBlob.size,
      wasCompressed: true,
      width: bestWidth,
      height: bestHeight,
    };
  } finally {
    image.close?.();
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
