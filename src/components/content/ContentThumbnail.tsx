import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { mediaService } from '../../services/storage/mediaService.ts';

interface ContentThumbnailProps {
  mediaPath?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  onClick?: () => void;
  rounded?: string;
}

/**
 * Menampilkan gambar konten dari bucket privat `content-media` melalui signed URL.
 * Nilai media_urls lama yang berupa URL eksternal tetap didukung.
 */
export const ContentThumbnail: React.FC<ContentThumbnailProps> = ({
  mediaPath,
  alt,
  className = '',
  imageClassName = '',
  onClick,
  rounded = 'rounded-xl',
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!mediaPath) {
      setSrc(null);
      setFailed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailed(false);

    mediaService
      .resolveMediaUrl(mediaPath)
      .then((url) => {
        if (cancelled) return;
        setSrc(url || null);
        setFailed(!url);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaPath]);

  const content = loading ? (
    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
  ) : src && !failed ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`w-full h-full object-cover ${imageClassName}`}
    />
  ) : (
    <ImageIcon className="w-5 h-5 text-slate-300" />
  );

  return (
    <div
      className={`bg-slate-100/80 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0 ${rounded} ${className} ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
      title={mediaPath ? alt : 'Belum ada gambar konten'}
    >
      {content}
    </div>
  );
};
