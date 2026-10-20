import React, { useState } from 'react';
import { useAppBranding } from '../../hooks/useAppBranding.ts';

interface ZaFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  theme?: 'dark' | 'light';
  customLogoUrl?: string | null;
  className?: string;
}

export const ZaFlowLogo: React.FC<ZaFlowLogoProps> = ({
  size = 'md',
  showText = true,
  customLogoUrl,
  className = '',
}) => {
  const { logoUrl: globalLogoUrl, appName } = useAppBranding();
  const effectiveLogo = customLogoUrl !== undefined ? customLogoUrl : globalLogoUrl;
  const [imageError, setImageError] = useState(false);

  const sizeDimensions = {
    sm: {
      box: 'w-7 h-7 rounded-xl',
      svg: 'w-5 h-5',
      text: 'text-sm font-bold',
      sub: 'text-[9px]',
      img: 'w-7 h-7 rounded-xl',
    },
    md: {
      box: 'w-9 h-9 rounded-2xl',
      svg: 'w-6 h-6',
      text: 'text-sm font-bold',
      sub: 'text-[10px]',
      img: 'w-9 h-9 rounded-2xl',
    },
    lg: {
      box: 'w-11 h-11 rounded-2xl',
      svg: 'w-7 h-7',
      text: 'text-lg font-extrabold',
      sub: 'text-[11px]',
      img: 'w-11 h-11 rounded-2xl',
    },
    xl: {
      box: 'w-14 h-14 rounded-2xl',
      svg: 'w-9 h-9',
      text: 'text-2xl font-extrabold',
      sub: 'text-xs',
      img: 'w-14 h-14 rounded-2xl',
    },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className} select-none`}>
      {effectiveLogo && !imageError ? (
        <div
          className={`${sizeDimensions.img} overflow-hidden border border-white/80 bg-white/80 p-1 flex items-center justify-center shrink-0 shadow-sm`}
        >
          <img
            src={effectiveLogo}
            alt={appName || 'ZaFlow'}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        /* Astra style vibrant gradient ribbon logo */
        <div
          className={`${sizeDimensions.box} relative flex items-center justify-center shrink-0 shadow-[0_4px_16px_rgba(37,99,235,0.25)]`}
        >
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className={`${sizeDimensions.svg} shrink-0 filter drop-shadow-[0_2px_4px_rgba(37,99,235,0.2)]`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="astra-grad-1" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="35%" stopColor="#2563EB" />
                <stop offset="75%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
              <linearGradient id="astra-grad-2" x1="16" y1="20" x2="48" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            {/* Dynamic folded ribbon monogram inspired by Astra logo */}
            <path
              d="M16 16C16 14.8954 16.8954 14 18 14H46C47.1046 14 48 14.8954 48 16V21C48 22.1046 47.1046 23 46 23H28L47 41.5C47.6 42.1 48 43 48 44V48C48 49.1046 47.1046 50 46 50H18C16.8954 50 16 49.1046 16 48V43C16 41.8954 16.8954 41 18 41H36L17 22.5C16.4 21.9 16 21 16 20V16Z"
              fill="url(#astra-grad-1)"
            />
            {/* Light facet highlight */}
            <path
              d="M27 23L48 43.5V41.5L29 23H27Z"
              fill="url(#astra-grad-2)"
              fillOpacity="0.8"
            />
          </svg>
        </div>
      )}

      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`tracking-tight ${sizeDimensions.text} text-slate-800 font-extrabold`}
          >
            {appName || 'ZaFlow'}
          </span>
          <span
            className={`font-semibold tracking-[0.16em] uppercase ${sizeDimensions.sub} text-slate-400 mt-1`}
          >
            Workspace
          </span>
        </div>
      )}
    </div>
  );
};
