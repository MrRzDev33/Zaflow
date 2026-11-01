import React from 'react';

/**
 * Set ikon duotone geometris ZaFlow.
 *
 * Ciri khas:
 * - Satu bidang tonal (fill currentColor, opasitas rendah) sebagai "bayangan" bentuk.
 * - Garis depan tegas dengan ujung membulat dan rasio geometris 24x24.
 * - Warna mengikuti `currentColor`, jadi aman dipakai di tema terang/gelap.
 *
 * Tidak memakai library ikon eksternal agar bobot bundle tetap ringan dan
 * tampilan tidak terasa seperti template.
 */
export interface ZaIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'strokeWidth'> {
  strokeWidth?: number;
}

interface IconBaseProps extends ZaIconProps {
  children: React.ReactNode;
}

export const IconBase: React.FC<IconBaseProps> = ({
  children,
  className,
  strokeWidth = 1.7,
  ...rest
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className ?? 'h-4 w-4'}
    {...rest}
  >
    {children}
  </svg>
);

/* ------------------------------------------------------------------ */
/* Navigasi utama                                                      */
/* ------------------------------------------------------------------ */

export const IconDashboard: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.6" y="3.6" width="7.3" height="7.3" rx="2.4" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="13.1" y="13.1" width="7.3" height="7.3" rx="2.4" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="3.6" y="3.6" width="7.3" height="7.3" rx="2.4" />
    <rect x="13.1" y="3.6" width="7.3" height="7.3" rx="2.4" />
    <rect x="3.6" y="13.1" width="7.3" height="7.3" rx="2.4" />
    <rect x="13.1" y="13.1" width="7.3" height="7.3" rx="2.4" />
  </IconBase>
);

export const IconCollection: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.6 7.4a2.8 2.8 0 0 1 2.8-2.8h3.3l2.2 2.6h5.7a2.8 2.8 0 0 1 2.8 2.8v7.4a2.8 2.8 0 0 1-2.8 2.8H6.4a2.8 2.8 0 0 1-2.8-2.8V7.4Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M3.6 7.4a2.8 2.8 0 0 1 2.8-2.8h3.3l2.2 2.6h5.7a2.8 2.8 0 0 1 2.8 2.8v7.4a2.8 2.8 0 0 1-2.8 2.8H6.4a2.8 2.8 0 0 1-2.8-2.8V7.4Z" />
    <path d="M3.6 10.4h16.8" />
    <path d="M8.2 14.4h4.6" />
  </IconBase>
);

export const IconCalendar: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 9.6h15.6v8.6a2.8 2.8 0 0 1-2.8 2.8H7A2.8 2.8 0 0 1 4.2 18.2V9.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <rect x="4.2" y="5.2" width="15.6" height="15.6" rx="3" />
    <path d="M8.4 3.4v3.4M15.6 3.4v3.4M4.2 9.6h15.6" />
    <path d="M8.4 13.4h.01M12 13.4h.01M15.6 13.4h.01M8.4 17.2h.01M12 17.2h.01" strokeWidth={2.3} />
  </IconBase>
);

export const IconKanban: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="9.7" y="3.8" width="4.6" height="16.4" rx="1.9" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="3.4" y="3.8" width="4.6" height="9.4" rx="1.9" />
    <rect x="9.7" y="3.8" width="4.6" height="16.4" rx="1.9" />
    <rect x="16" y="3.8" width="4.6" height="12.6" rx="1.9" />
  </IconBase>
);

export const IconAnalytics: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="9.8" y="7" width="4.4" height="13.4" rx="1.6" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="16.2" y="3.6" width="4.4" height="16.8" rx="1.6" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="3.4" y="12" width="4.4" height="8.4" rx="1.6" />
    <rect x="9.8" y="7" width="4.4" height="13.4" rx="1.6" />
    <rect x="16.2" y="3.6" width="4.4" height="16.8" rx="1.6" />
  </IconBase>
);

export const IconPost: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.4" y="3.8" width="17.2" height="16.4" rx="3.2" fill="currentColor" stroke="none" opacity="0.13" />
    <rect x="3.4" y="3.8" width="17.2" height="16.4" rx="3.2" />
    <circle cx="8.8" cy="8.8" r="1.5" />
    <path d="M4.6 17.4l4.2-4.5 2.6 2.6 1.9-1.9 4.5 4.3" />
  </IconBase>
);

export const IconScanAI: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 2.5l.75 1.85 1.85.75-1.85.75L12 7.7l-.75-1.85L9.4 5.1l1.85-.75L12 2.5Z"
      fill="currentColor"
      stroke="none"
      opacity="0.35"
    />
    <path d="M8.2 3.6H6.4a2.8 2.8 0 0 0-2.8 2.8v1.8M15.8 3.6h1.8a2.8 2.8 0 0 1 2.8 2.8v1.8M20.4 15.8v1.8a2.8 2.8 0 0 1-2.8 2.8h-1.8M8.2 20.4H6.4a2.8 2.8 0 0 1-2.8-2.8v-1.8" />
    <path d="M6.6 12s2.1-3.3 5.4-3.3S17.4 12 17.4 12s-2.1 3.3-5.4 3.3S6.6 12 6.6 12Z" />
    <circle cx="12" cy="12" r="1.4" />
  </IconBase>
);

export const IconStrategy: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.2l7.4 4.3v9l-7.4 4.3-7.4-4.3v-9L12 3.2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.11"
    />
    <path d="M12 3.2l7.4 4.3v9l-7.4 4.3-7.4-4.3v-9L12 3.2Z" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 9.6V6.5M10 13.2 7.4 14.7M14 13.2l2.6 1.5" />
    <circle cx="12" cy="6.5" r="1.05" fill="currentColor" stroke="none" opacity="0.8" />
    <circle cx="7.4" cy="14.7" r="1.05" fill="currentColor" stroke="none" opacity="0.8" />
    <circle cx="16.6" cy="14.7" r="1.05" fill="currentColor" stroke="none" opacity="0.8" />
  </IconBase>
);

export const IconTeam: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="9.2" cy="8.2" r="3.4" fill="currentColor" stroke="none" opacity="0.16" />
    <path d="M3.2 19.6c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" fill="currentColor" stroke="none" opacity="0.1" />
    <circle cx="9.2" cy="8.2" r="3.4" />
    <path d="M3.2 19.6c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" />
    <path d="M15.6 5.4a3.2 3.2 0 0 1 0 6" />
    <path d="M17.4 14.4c2.1.5 3.4 2.3 3.4 4.6" />
  </IconBase>
);

export const IconHistory: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.12" />
    <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
    <path d="M3.2 4.6v4.2h4.2" />
    <path d="M12 7.6v4.7l3.1 1.8" />
  </IconBase>
);

export const IconLicense: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="8.4" cy="8.4" r="4.4" fill="currentColor" stroke="none" opacity="0.16" />
    <circle cx="8.4" cy="8.4" r="4.4" />
    <path d="M11.6 11.6 20.4 20.4" />
    <path d="M17.2 17.2l2.2-2.2M14.6 14.6l2.2-2.2" />
  </IconBase>
);

export const IconShield: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.2l7.2 2.7v5.8c0 4.2-2.9 7.7-7.2 9.1-4.3-1.4-7.2-4.9-7.2-9.1V5.9L12 3.2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M12 3.2l7.2 2.7v5.8c0 4.2-2.9 7.7-7.2 9.1-4.3-1.4-7.2-4.9-7.2-9.1V5.9L12 3.2Z" />
    <path d="M8.9 12.1l2.2 2.2 4-4.2" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Aksi & antarmuka                                                    */
/* ------------------------------------------------------------------ */

export const IconChat: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.8 8.6A4.2 4.2 0 0 1 8 4.4h8a4.2 4.2 0 0 1 4.2 4.2v4.6a4.2 4.2 0 0 1-4.2 4.2H9.6L5.4 20.6v-3.5A4.2 4.2 0 0 1 3.8 13.9V8.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M3.8 8.6A4.2 4.2 0 0 1 8 4.4h8a4.2 4.2 0 0 1 4.2 4.2v4.6a4.2 4.2 0 0 1-4.2 4.2H9.6L5.4 20.6v-3.5A4.2 4.2 0 0 1 3.8 13.9V8.6Z" />
    <path d="M8.4 10.9h.01M12 10.9h.01M15.6 10.9h.01" strokeWidth={2.3} />
  </IconBase>
);

export const IconClose: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.08" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </IconBase>
);

export const IconMenu: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4.6 12h11.2" strokeWidth="3.6" opacity="0.14" />
    <path d="M4.6 7.2h14.8M4.6 12h11.2M4.6 16.8h14.8" />
  </IconBase>
);

export const IconSettings: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="9.2" cy="7.2" r="2.2" fill="currentColor" stroke="none" opacity="0.16" />
    <circle cx="15" cy="16.8" r="2.2" fill="currentColor" stroke="none" opacity="0.16" />
    <path d="M4.2 7.2h2.8M11.4 7.2h8.4M4.2 16.8h8.6M17.2 16.8h2.6" />
    <circle cx="9.2" cy="7.2" r="2.2" />
    <circle cx="15" cy="16.8" r="2.2" />
  </IconBase>
);

export const IconLogout: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M13.6 4.4H7.2A2.8 2.8 0 0 0 4.4 7.2v9.6a2.8 2.8 0 0 0 2.8 2.8h6.4"
      fill="currentColor"
      stroke="none"
      opacity="0.1"
    />
    <path d="M13.6 4.4H7.2A2.8 2.8 0 0 0 4.4 7.2v9.6a2.8 2.8 0 0 0 2.8 2.8h6.4" />
    <path d="M10.8 12h9.2M16.6 8.6 20 12l-3.4 3.4" />
  </IconBase>
);

export const IconUser: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="3.6" fill="currentColor" stroke="none" opacity="0.16" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" fill="currentColor" stroke="none" opacity="0.1" />
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </IconBase>
);

export const IconChevronDown: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M6.4 9.4 12 15l5.6-5.6" />
  </IconBase>
);

export const IconSpark: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 2.8l1.9 5.5 5.5 1.9-5.5 1.9L12 17.6l-1.9-5.5-5.5-1.9 5.5-1.9L12 2.8Z"
      fill="currentColor"
      stroke="none"
      opacity="0.16"
    />
    <path d="M12 2.8l1.9 5.5 5.5 1.9-5.5 1.9L12 17.6l-1.9-5.5-5.5-1.9 5.5-1.9L12 2.8Z" />
    <path
      d="M18.2 16.2l.75 1.85 1.85.75-1.85.75-.75 1.85-.75-1.85-1.85-.75 1.85-.75.75-1.85Z"
      fill="currentColor"
      stroke="none"
      opacity="0.45"
    />
  </IconBase>
);

export const IconPlus: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.6" fill="currentColor" stroke="none" opacity="0.1" />
    <path d="M12 7.8v8.4M7.8 12h8.4" />
  </IconBase>
);

export const IconRefresh: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M20.2 12a8.2 8.2 0 1 1-2.4-5.8" />
    <path d="M20.6 4.4v4.2h-4.2" />
  </IconBase>
);

export const IconLayers: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.4l8.4 4.4-8.4 4.4L3.6 7.8 12 3.4Z"
      fill="currentColor"
      stroke="none"
      opacity="0.16"
    />
    <path d="M12 3.4l8.4 4.4-8.4 4.4L3.6 7.8 12 3.4Z" />
    <path d="M3.6 12.2 12 16.6l8.4-4.4" />
    <path d="M3.6 16.6 12 21l8.4-4.4" />
  </IconBase>
);

export const IconClock: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.12" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.4V12l3.2 1.9" />
  </IconBase>
);

export const IconCheck: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.12" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M8.2 12.2l2.6 2.6 5-5.4" />
  </IconBase>
);

export const IconShare: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="6.4" cy="12" r="2.6" fill="currentColor" stroke="none" opacity="0.16" />
    <circle cx="17.6" cy="6.4" r="2.6" fill="currentColor" stroke="none" opacity="0.16" />
    <circle cx="17.6" cy="17.6" r="2.6" fill="currentColor" stroke="none" opacity="0.16" />
    <circle cx="6.4" cy="12" r="2.6" />
    <circle cx="17.6" cy="6.4" r="2.6" />
    <circle cx="17.6" cy="17.6" r="2.6" />
    <path d="M8.7 10.8l6.6-3.2M8.7 13.2l6.6 3.2" />
  </IconBase>
);

export const IconArrowRight: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4.6 12h14.8M13.6 6.4 19.2 12l-5.6 5.6" />
  </IconBase>
);

export const IconBuilding: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 20.4V6.4a2.4 2.4 0 0 1 2.4-2.4h6a2.4 2.4 0 0 1 2.4 2.4v14"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M4.2 20.4V6.4a2.4 2.4 0 0 1 2.4-2.4h6a2.4 2.4 0 0 1 2.4 2.4v14" />
    <path d="M15 9.6h2.4a2.4 2.4 0 0 1 2.4 2.4v8.4" />
    <path d="M2.8 20.4h18.4" />
    <path d="M7.6 8.2h4M7.6 12h4M7.6 15.8h4" />
  </IconBase>
);

export const IconPieChart: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4H12V3.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4H12V3.6Z" />
    <path
      d="M14.6 3.1a8.3 8.3 0 0 1 6.3 6.3h-6.3V3.1Z"
      fill="currentColor"
      stroke="none"
      opacity="0.38"
    />
    <path d="M14.6 3.1a8.3 8.3 0 0 1 6.3 6.3h-6.3V3.1Z" />
  </IconBase>
);

export const IconMoreVertical: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="5.6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.4" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);
