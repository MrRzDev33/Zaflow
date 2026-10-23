import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { isConfigured } from '../../config/supabase.ts';

/**
 * Penanda netral saat layanan belum siap. Detail teknis sengaja tidak
 * ditampilkan di antarmuka pengguna.
 */
export const ConfigNotice: React.FC = () => {
  if (isConfigured) return null;

  return (
    <div className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-xs font-bold">Layanan belum siap</p>
          <p className="mt-1 text-[11px] leading-relaxed">
            Aplikasi sedang disiapkan. Silakan hubungi admin ZaFlow untuk informasi lebih lanjut.
          </p>
        </div>
      </div>
    </div>
  );
};
