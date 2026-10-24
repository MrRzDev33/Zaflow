import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { accessService, type PublicCustomerServiceInfo } from '../../services/access/accessService.ts';

interface SupportContactProps {
  className?: string;
  label?: string;
}

/**
 * Tautan bantuan publik. Hanya tampil jika admin mengaktifkan customer service.
 * Dipakai pada halaman login dan layar akun yang tidak dapat dimuat.
 */
export const SupportContact: React.FC<SupportContactProps> = ({
  className = '',
  label,
}) => {
  const [info, setInfo] = useState<PublicCustomerServiceInfo | null>(null);

  useEffect(() => {
    let active = true;
    accessService.getPublicCustomerService()
      .then((result) => {
        if (active) setInfo(result);
      })
      .catch(() => {
        if (active) setInfo(null);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!info?.active || !info.whatsappUrl) return null;

  return (
    <a
      href={info.whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className={
        className ||
        'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700'
      }
    >
      <MessageCircle className="h-4 w-4" />
      {label || info.label || 'Hubungi Customer Service'}
    </a>
  );
};
