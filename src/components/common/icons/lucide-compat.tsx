import React from 'react';
import {
  IconAnalytics,
  IconArrowRight,
  IconBase,
  IconBuilding,
  IconCalendar,
  IconChat,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconClose,
  IconCollection,
  IconDashboard,
  IconHistory,
  IconKanban,
  IconLayers,
  IconLicense,
  IconLogout,
  IconPieChart,
  IconPlus,
  IconRefresh,
  IconScanAI,
  IconSettings,
  IconShare,
  IconShield,
  IconSpark,
  IconStrategy,
  IconTeam,
  IconUser,
  type ZaIconProps,
} from './ZaflowIcons.tsx';

/**
 * Jembatan nama ikon lucide ke set ikon duotone ZaFlow.
 *
 * Semua komponen diekspor dengan nama yang sama seperti lucide agar pemakaian
 * di seluruh aplikasi tidak perlu diubah—hanya sumber impornya.
 */

/* ------------------------------------------------------------------ */
/* Nama lucide yang sudah punya padanan duotone inti                   */
/* ------------------------------------------------------------------ */

export const LayoutGrid: React.FC<ZaIconProps> = IconDashboard;
export const Library: React.FC<ZaIconProps> = IconCollection;
export const Calendar: React.FC<ZaIconProps> = IconCalendar;
export const CalendarDays: React.FC<ZaIconProps> = IconCalendar;
export const Kanban: React.FC<ZaIconProps> = IconKanban;
export const BarChart3: React.FC<ZaIconProps> = IconAnalytics;
export const ScanEye: React.FC<ZaIconProps> = IconScanAI;
export const BrainCircuit: React.FC<ZaIconProps> = IconStrategy;
export const Users: React.FC<ZaIconProps> = IconTeam;
export const History: React.FC<ZaIconProps> = IconHistory;
export const Key: React.FC<ZaIconProps> = IconLicense;
export const Shield: React.FC<ZaIconProps> = IconShield;
export const ShieldCheck: React.FC<ZaIconProps> = IconShield;
export const MessageCircle: React.FC<ZaIconProps> = IconChat;
export const X: React.FC<ZaIconProps> = IconClose;
export const Sliders: React.FC<ZaIconProps> = IconSettings;
export const LogOut: React.FC<ZaIconProps> = IconLogout;
export const User: React.FC<ZaIconProps> = IconUser;
export const UserRound: React.FC<ZaIconProps> = IconUser;
export const ChevronDown: React.FC<ZaIconProps> = IconChevronDown;
export const Sparkles: React.FC<ZaIconProps> = IconSpark;
export const Plus: React.FC<ZaIconProps> = IconPlus;
export const RefreshCw: React.FC<ZaIconProps> = IconRefresh;
export const Layers: React.FC<ZaIconProps> = IconLayers;
export const Clock: React.FC<ZaIconProps> = IconClock;
export const Check: React.FC<ZaIconProps> = IconCheck;
export const Share2: React.FC<ZaIconProps> = IconShare;
export const ArrowRight: React.FC<ZaIconProps> = IconArrowRight;
export const Building2: React.FC<ZaIconProps> = IconBuilding;
export const PieChart: React.FC<ZaIconProps> = IconPieChart;

/* ------------------------------------------------------------------ */
/* Panah & navigasi                                                    */
/* ------------------------------------------------------------------ */

export const ArrowUp: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 19.4V4.6M6.4 10.2 12 4.6l5.6 5.6" />
  </IconBase>
);

export const ArrowDown: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 4.6v14.8M6.4 13.8 12 19.4l5.6-5.6" />
  </IconBase>
);

export const ArrowUpRight: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M6.6 17.4 17.4 6.6M8.8 6.6h8.6v8.6" />
  </IconBase>
);

export const ArrowDownRight: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M6.6 6.6l10.8 10.8M8.8 17.4h8.6V8.8" />
  </IconBase>
);

export const ChevronUp: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M6.4 14.6 12 9l5.6 5.6" />
  </IconBase>
);

export const ChevronLeft: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M14.6 6.4 9 12l5.6 5.6" />
  </IconBase>
);

export const ChevronRight: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M9.4 6.4 15 12l-5.6 5.6" />
  </IconBase>
);

export const ChevronsLeft: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M11.6 6.4 6 12l5.6 5.6M18.4 6.4 12.8 12l5.6 5.6" />
  </IconBase>
);

export const ChevronsRight: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M5.6 6.4 11.2 12l-5.6 5.6M12.4 6.4 18 12l-5.6 5.6" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Status & umpan balik                                                */
/* ------------------------------------------------------------------ */

export const CheckCircle2: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M8.2 12.2l2.6 2.6 5-5.4" />
  </IconBase>
);

export const CheckCircle: React.FC<ZaIconProps> = CheckCircle2;

export const XCircle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
  </IconBase>
);

export const AlertCircle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6v5.2" />
    <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

export const CircleAlert: React.FC<ZaIconProps> = AlertCircle;

export const AlertTriangle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M10.7 4.4 2.9 18a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.3 4.4a1.5 1.5 0 0 0-2.6 0Z"
      fill="currentColor"
      stroke="none"
      opacity="0.13"
    />
    <path d="M10.7 4.4 2.9 18a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.3 4.4a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9.4v4.4" />
    <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

export const Info: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v5.2" />
    <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

export const HelpCircle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M9.5 9.2a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4" />
    <circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

export const Ban: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M6.4 17.6 17.6 6.4" />
  </IconBase>
);

export const Loader2: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.1" />
    <path d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4" />
    <path d="M20.4 12a8.4 8.4 0 0 1-4.2 7.3" opacity="0.55" />
  </IconBase>
);

export const Minus: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M5.4 12h13.2" />
  </IconBase>
);

export const PlusCircle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 8v8M8 12h8" />
  </IconBase>
);

export const Search: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="10.6" cy="10.6" r="6.4" fill="currentColor" stroke="none" opacity="0.13" />
    <circle cx="10.6" cy="10.6" r="6.4" />
    <path d="M15.4 15.4 20.4 20.4" />
  </IconBase>
);

export const Filter: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.6 5.6a1.4 1.4 0 0 1 1.4-1.4h14a1.4 1.4 0 0 1 1.4 1.4v1.5c0 .4-.2.8-.5 1.1l-5.5 5.5v5.6l-4 2.2v-7.8L4.1 8.2a1.4 1.4 0 0 1-.5-1.1V5.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.13"
    />
    <path d="M3.6 5.6a1.4 1.4 0 0 1 1.4-1.4h14a1.4 1.4 0 0 1 1.4 1.4v1.5c0 .4-.2.8-.5 1.1l-5.5 5.5v5.6l-4 2.2v-7.8L4.1 8.2a1.4 1.4 0 0 1-.5-1.1V5.6Z" />
  </IconBase>
);

export const RotateCcw: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8" />
    <path d="M3.4 4.4v4.2h4.2" />
  </IconBase>
);

export const Repeat: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4.6 9.4V8a3.2 3.2 0 0 1 3.2-3.2h9.8M14.8 2.4l2.8 2.4-2.8 2.4" />
    <path d="M19.4 14.6V16a3.2 3.2 0 0 1-3.2 3.2H6.4M9.2 21.6 6.4 19.2l2.8-2.4" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Aksi & berkas                                                       */
/* ------------------------------------------------------------------ */

export const Save: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.4 7.2a2.8 2.8 0 0 1 2.8-2.8h8.2l4 4v8.4a2.8 2.8 0 0 1-2.8 2.8H7.2a2.8 2.8 0 0 1-2.8-2.8V7.2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M4.4 7.2a2.8 2.8 0 0 1 2.8-2.8h8.2l4 4v8.4a2.8 2.8 0 0 1-2.8 2.8H7.2a2.8 2.8 0 0 1-2.8-2.8V7.2Z" />
    <path d="M8 4.4v5h6.4v-5M8.2 19.4v-4.8h7.6v4.8" />
  </IconBase>
);

export const Copy: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2.8" />
    <path d="M15.4 5.6a2.8 2.8 0 0 0-2.8-2H6.4a2.8 2.8 0 0 0-2.8 2.8v6.2a2.8 2.8 0 0 0 2 2.8" />
  </IconBase>
);

export const Pencil: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 19.8v-3.2L15.8 5a2.6 2.6 0 0 1 3.6 3.6L7.4 19.8H4.2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M4.2 19.8v-3.2L15.8 5a2.6 2.6 0 0 1 3.6 3.6L7.4 19.8H4.2Z" />
    <path d="M14 6.8l3.6 3.6" />
  </IconBase>
);

export const Edit: React.FC<ZaIconProps> = Pencil;

export const Trash2: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M5.4 7.6h13.2l-.8 11a2.6 2.6 0 0 1-2.6 2.4H8.8a2.6 2.6 0 0 1-2.6-2.4l-.8-11Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M4 6.6h16M9.4 6.6V4.4h5.2v2.2M5.4 7.6h13.2l-.8 11a2.6 2.6 0 0 1-2.6 2.4H8.8a2.6 2.6 0 0 1-2.6-2.4l-.8-11Z" />
    <path d="M10 11v6M14 11v6" />
  </IconBase>
);

export const Download: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 3.6v11.2M7.2 10l4.8 4.8 4.8-4.8" />
    <path d="M4.4 16.4v2.2a2.4 2.4 0 0 0 2.4 2.4h10.4a2.4 2.4 0 0 0 2.4-2.4v-2.2" />
  </IconBase>
);

export const Upload: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 15.4V4.2M7.2 8.6 12 3.8l4.8 4.8" />
    <path d="M4.4 16.4v2.2a2.4 2.4 0 0 0 2.4 2.4h10.4a2.4 2.4 0 0 0 2.4-2.4v-2.2" />
  </IconBase>
);

export const UploadCloud: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M7 18.4a4.4 4.4 0 0 1-.6-8.8 5.6 5.6 0 0 1 10.8-1.2 3.9 3.9 0 0 1 1 7.6"
      fill="currentColor"
      stroke="none"
      opacity="0.1"
    />
    <path d="M7 18.4a4.4 4.4 0 0 1-.6-8.8 5.6 5.6 0 0 1 10.8-1.2 3.9 3.9 0 0 1 1 7.6" />
    <path d="M12 21v-7.4M9.2 15.8 12 13l2.8 2.8" />
  </IconBase>
);

export const Printer: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M7 8.2V3.6h10v4.6" />
    <path
      d="M7 17H5.2a2.6 2.6 0 0 1-2.6-2.6v-3.8A2.6 2.6 0 0 1 5.2 8h13.6a2.6 2.6 0 0 1 2.6 2.6v3.8a2.6 2.6 0 0 1-2.6 2.6H17"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M7 8.2V3.6h10v4.6M7 17H5.2a2.6 2.6 0 0 1-2.6-2.6v-3.8A2.6 2.6 0 0 1 5.2 8h13.6a2.6 2.6 0 0 1 2.6 2.6v3.8a2.6 2.6 0 0 1-2.6 2.6H17" />
    <rect x="7" y="14" width="10" height="6.4" rx="1.4" />
  </IconBase>
);

export const ExternalLink: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M13.4 4.4h6.2v6.2M19.6 4.4l-8.2 8.2" />
    <path d="M18.6 14v4.2a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4V7.8a2.4 2.4 0 0 1 2.4-2.4H10" />
  </IconBase>
);

export const Link: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M9.6 14.4 14.4 9.6" />
    <path d="M10.4 6.6l1.4-1.4a4 4 0 0 1 5.6 5.6l-1.4 1.4M13.6 17.4l-1.4 1.4a4 4 0 0 1-5.6-5.6l1.4-1.4" />
  </IconBase>
);

export const Link2: React.FC<ZaIconProps> = Link;

export const Mail: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.8" />
    <path d="m4.4 7 6.4 5.2a2 2 0 0 0 2.4 0L19.6 7" />
  </IconBase>
);

export const MapPin: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.2c3.7 0 6.6 2.9 6.6 6.5 0 4.7-6.6 11.1-6.6 11.1S5.4 14.4 5.4 9.7c0-3.6 2.9-6.5 6.6-6.5Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M12 3.2c3.7 0 6.6 2.9 6.6 6.5 0 4.7-6.6 11.1-6.6 11.1S5.4 14.4 5.4 9.7c0-3.6 2.9-6.5 6.6-6.5Z" />
    <circle cx="12" cy="9.7" r="2.2" />
  </IconBase>
);

export const Tag: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.8 5.6a1.8 1.8 0 0 1 1.8-1.8h5.2c.5 0 .9.2 1.3.5l7.1 7.1a1.8 1.8 0 0 1 0 2.6l-5.6 5.6a1.8 1.8 0 0 1-2.6 0L3.9 12.5a1.8 1.8 0 0 1-.5-1.3V5.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M3.8 5.6a1.8 1.8 0 0 1 1.8-1.8h5.2c.5 0 .9.2 1.3.5l7.1 7.1a1.8 1.8 0 0 1 0 2.6l-5.6 5.6a1.8 1.8 0 0 1-2.6 0L3.9 12.5a1.8 1.8 0 0 1-.5-1.3V5.6Z" />
    <circle cx="8.2" cy="8.2" r="1.3" />
  </IconBase>
);

export const Lock: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="2.8" />
    <path d="M8.2 10V7.8a3.8 3.8 0 0 1 7.6 0V10" />
    <circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

export const LockKeyhole: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="2.8" />
    <path d="M8.2 10V7.8a3.8 3.8 0 0 1 7.6 0V10" />
    <path d="M12 14.2v2.6" />
  </IconBase>
);

export const LogIn: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M10.4 4.4h6.4a2.8 2.8 0 0 1 2.8 2.8v9.6a2.8 2.8 0 0 1-2.8 2.8h-6.4" />
    <path d="M13.2 12H4M7.6 8.6 4 12l3.6 3.4" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Media & visual                                                      */
/* ------------------------------------------------------------------ */

export const Eye: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M2.8 12S6 6.4 12 6.4 21.2 12 21.2 12 18 17.6 12 17.6 2.8 12 2.8 12Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M2.8 12S6 6.4 12 6.4 21.2 12 21.2 12 18 17.6 12 17.6 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </IconBase>
);

export const EyeOff: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4.4 4.4 19.6 19.6" />
    <path d="M9.8 5.2A10.6 10.6 0 0 1 12 5c6 0 9.2 7 9.2 7a16.6 16.6 0 0 1-3.1 4M6.2 7.3A16.4 16.4 0 0 0 2.8 12S6 19 12 19a9.8 9.8 0 0 0 4-.8" />
    <path d="M10 10.2a2.6 2.6 0 0 0 3.6 3.6" />
  </IconBase>
);

export const Image: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="3" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="3" />
    <circle cx="8.6" cy="9" r="1.4" />
    <path d="m4.4 17 4.2-4.4 2.6 2.6 1.8-1.8 4.6 4.2" />
  </IconBase>
);

export const ImagePlus: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="3" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="3" />
    <path d="M4.4 17l4.2-4.4 2.6 2.6 1.8-1.8 4.6 4.2" />
    <path d="M16.6 7.2v4.4M14.4 9.4h4.4" />
  </IconBase>
);

export const Video: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="2.8" y="6.2" width="12.8" height="11.6" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="2.8" y="6.2" width="12.8" height="11.6" rx="2.8" />
    <path d="M15.6 10.4 21.2 7.2v9.6l-5.6-3.2" />
  </IconBase>
);

export const Play: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M7.2 4.9a1.4 1.4 0 0 1 2.1-1.2l10 6.1a1.4 1.4 0 0 1 0 2.4l-10 6.1a1.4 1.4 0 0 1-2.1-1.2V4.9Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M7.2 4.9a1.4 1.4 0 0 1 2.1-1.2l10 6.1a1.4 1.4 0 0 1 0 2.4l-10 6.1a1.4 1.4 0 0 1-2.1-1.2V4.9Z" />
  </IconBase>
);

export const PlayCircle: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.12" />
    <circle cx="12" cy="12" r="8.4" />
    <path d="M10 8.8 15.4 12 10 15.2V8.8Z" fill="currentColor" stroke="none" opacity="0.7" />
    <path d="M10 8.8 15.4 12 10 15.2V8.8Z" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Kalender lanjutan                                                   */
/* ------------------------------------------------------------------ */

export const CalendarPlus: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 9.6h15.6v8.6a2.8 2.8 0 0 1-2.8 2.8H7a2.8 2.8 0 0 1-2.8-2.8V9.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <rect x="4.2" y="5.2" width="15.6" height="15.6" rx="3" />
    <path d="M8.4 3.4v3.4M15.6 3.4v3.4M4.2 9.6h15.6M12 12.8v5.2M9.4 15.4h5.2" />
  </IconBase>
);

export const CalendarRange: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 9.6h15.6v8.6a2.8 2.8 0 0 1-2.8 2.8H7a2.8 2.8 0 0 1-2.8-2.8V9.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <rect x="4.2" y="5.2" width="15.6" height="15.6" rx="3" />
    <path d="M8.4 3.4v3.4M15.6 3.4v3.4M4.2 9.6h15.6M7.6 13.6h8.8M7.6 17.2h5.2" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Grafik & data                                                       */
/* ------------------------------------------------------------------ */

export const TrendingUp: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.4 16.4 9 10.8l3.4 3.4 7.8-7.8v10a2.6 2.6 0 0 1-2.6 2.6H3.4Z"
      fill="currentColor"
      stroke="none"
      opacity="0.1"
    />
    <path d="M3.4 19h16.8M3.4 16.4 9 10.8l3.4 3.4 7.8-7.8" />
    <path d="M15 6.4h5.2v5.2" />
  </IconBase>
);

export const Activity: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M2.8 12h4.4l2.6-6.4 4 12.8 2.6-6.4h4.8" />
  </IconBase>
);

export const BarChart2: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="4" y="12.4" width="4.4" height="7.2" rx="1.4" />
    <rect x="9.8" y="8" width="4.4" height="11.6" rx="1.4" fill="currentColor" stroke="none" opacity="0.16" />
    <rect x="9.8" y="8" width="4.4" height="11.6" rx="1.4" />
    <rect x="15.6" y="4.4" width="4.4" height="15.2" rx="1.4" />
  </IconBase>
);

export const FileBarChart2: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z" />
    <path d="M13.4 3.8V9H19" />
    <path d="M8.2 17v-3.4M11.8 17v-5.4M15.4 17v-2" />
  </IconBase>
);

export const FileText: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z" />
    <path d="M13.4 3.8V9H19M7.8 12.6h7.4M7.8 16.2h5.4" />
  </IconBase>
);

export const FileSpreadsheet: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M6 3.6h7.6L19 9v10.6a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6Z" />
    <path d="M13.4 3.8V9H19" />
    <path d="M7.6 12.2h7.8v6H7.6zM7.6 15.2h7.8M11.5 12.2v6" />
  </IconBase>
);

export const FileStack: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="7.4" y="3.6" width="12" height="12" rx="2.4" fill="currentColor" stroke="none" opacity="0.1" />
    <rect x="7.4" y="3.6" width="12" height="12" rx="2.4" />
    <path d="M15.8 18.6a2.4 2.4 0 0 1-2.4 1.8H6a2.4 2.4 0 0 1-2.4-2.4V9.4A2.4 2.4 0 0 1 5.4 7" />
    <path d="M10.6 7.2h5.6M10.6 10.4h3.8" />
  </IconBase>
);

export const ScrollText: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6.2 3.6h11a2.2 2.2 0 0 1 2.2 2.2v12.4a2.2 2.2 0 0 0 2.2 2.2H8.4a2.2 2.2 0 0 1-2.2-2.2V3.6Z"
      fill="currentColor"
      stroke="none"
      opacity="0.1"
    />
    <path d="M6.2 3.6h11a2.2 2.2 0 0 1 2.2 2.2v12.4a2.2 2.2 0 0 0 2.2 2.2H8.4a2.2 2.2 0 0 1-2.2-2.2V3.6Z" />
    <path d="M6.2 3.6A2.2 2.2 0 0 0 4 5.8v2.4h2.2M9.4 8h7.2M9.4 11.6h7.2M9.4 15.2h4.6" />
  </IconBase>
);

export const Database: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <ellipse cx="12" cy="6" rx="7.6" ry="2.8" fill="currentColor" stroke="none" opacity="0.14" />
    <ellipse cx="12" cy="6" rx="7.6" ry="2.8" />
    <path d="M4.4 6v12c0 1.5 3.4 2.8 7.6 2.8s7.6-1.3 7.6-2.8V6" />
    <path d="M4.4 12c0 1.5 3.4 2.8 7.6 2.8s7.6-1.3 7.6-2.8" />
  </IconBase>
);

export const List: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M9 6.4h11M9 12h11M9 17.6h11" />
    <circle cx="4.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.6" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.6" cy="17.6" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

export const Columns: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="2.8" />
    <path d="M9.2 4.2v15.6M14.8 4.2v15.6" />
    <rect x="9.2" y="4.2" width="5.6" height="15.6" fill="currentColor" stroke="none" opacity="0.12" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Pengguna & sosial                                                   */
/* ------------------------------------------------------------------ */

export const UserPlus: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="9.6" cy="8.2" r="3.4" fill="currentColor" stroke="none" opacity="0.14" />
    <circle cx="9.6" cy="8.2" r="3.4" />
    <path d="M3.4 19.8c0-3.4 2.8-5.8 6.2-5.8s6.2 2.4 6.2 5.8" />
    <path d="M18.4 8v5.6M15.6 10.8H21.2" />
  </IconBase>
);

export const UserCog: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="9.2" cy="7.6" r="3.2" fill="currentColor" stroke="none" opacity="0.14" />
    <circle cx="9.2" cy="7.6" r="3.2" />
    <path d="M3.4 19.8c0-3.3 2.6-5.6 5.8-5.6 1.2 0 2.4.3 3.3.9" />
    <circle cx="17.6" cy="16.6" r="2.2" />
    <path d="M17.6 12.6v1.8M17.6 18.8v1.8M13.9 14.4l1.6.9M19.7 17.9l1.6.9M21.3 14.4l-1.6.9M15.5 17.9l-1.6.9" />
  </IconBase>
);

export const Heart: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 20.2S3.4 15 3.4 9.4a4.6 4.6 0 0 1 8.6-2.4 4.6 4.6 0 0 1 8.6 2.4c0 5.6-8.6 10.8-8.6 10.8Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M12 20.2S3.4 15 3.4 9.4a4.6 4.6 0 0 1 8.6-2.4 4.6 4.6 0 0 1 8.6 2.4c0 5.6-8.6 10.8-8.6 10.8Z" />
  </IconBase>
);

export const HeartHandshake: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 19.4S4.6 15 4.6 10a4 4 0 0 1 7.4-2.1A4 4 0 0 1 19.4 10c0 1.3-.5 2.5-1.3 3.6"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M12 19.4S4.6 15 4.6 10a4 4 0 0 1 7.4-2.1A4 4 0 0 1 19.4 10c0 1.3-.5 2.5-1.3 3.6" />
    <path d="m12.4 15.2 2.2-2.1a1.7 1.7 0 0 1 2.4 2.4l-3.6 3.5-2.4-2.3" />
    <path d="M19.2 16.8h2.2" />
  </IconBase>
);

export const Bookmark: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6.4 5.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15l-5.6-3.8-5.6 3.8v-15Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M6.4 5.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15l-5.6-3.8-5.6 3.8v-15Z" />
  </IconBase>
);

export const BookmarkCheck: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M6.4 5.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15l-5.6-3.8-5.6 3.8v-15Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M6.4 5.6a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v15l-5.6-3.8-5.6 3.8v-15Z" />
    <path d="M9.4 8.6l1.8 1.8 3.4-3.4" />
  </IconBase>
);

export const MessageSquare: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.2 7.4a3.2 3.2 0 0 1 3.2-3.2h9.2a3.2 3.2 0 0 1 3.2 3.2v6.4a3.2 3.2 0 0 1-3.2 3.2H10l-4.6 3.4v-3.7a3.2 3.2 0 0 1-1.2-2.5V7.4Z"
      fill="currentColor"
      stroke="none"
      opacity="0.13"
    />
    <path d="M4.2 7.4a3.2 3.2 0 0 1 3.2-3.2h9.2a3.2 3.2 0 0 1 3.2 3.2v6.4a3.2 3.2 0 0 1-3.2 3.2H10l-4.6 3.4v-3.7a3.2 3.2 0 0 1-1.2-2.5V7.4Z" />
    <path d="M8.6 9.2h6.8M8.6 12.4h4.6" />
  </IconBase>
);

export const MousePointer: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M5.4 3.9a.9.9 0 0 1 1.5-.7l12.3 8.3a.9.9 0 0 1-.4 1.6l-5.2 1-2.9 4.5a.9.9 0 0 1-1.6-.4L5.4 3.9Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M5.4 3.9a.9.9 0 0 1 1.5-.7l12.3 8.3a.9.9 0 0 1-.4 1.6l-5.2 1-2.9 4.5a.9.9 0 0 1-1.6-.4L5.4 3.9Z" />
  </IconBase>
);

export const MousePointerClick: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path d="M8.4 12.6a.9.9 0 0 1 1.4-.7l9.3 6.2a.9.9 0 0 1-.4 1.6l-3.9.8-2.2 3.4a.9.9 0 0 1-1.6-.4l-2.6-10.9Z" />
    <path d="M9.6 3.4v2.4M4.8 5.6l1.7 1.7M3.2 10.4h2.4M14.4 4.8l-1.7 1.7" />
  </IconBase>
);

/* ------------------------------------------------------------------ */
/* Simbol & penghargaan                                                */
/* ------------------------------------------------------------------ */

export const Zap: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M13.4 2.6 4.8 13.4h5.4l-1.6 8 8.6-10.8h-5.4l1.6-8Z"
      fill="currentColor"
      stroke="none"
      opacity="0.16"
    />
    <path d="M13.4 2.6 4.8 13.4h5.4l-1.6 8 8.6-10.8h-5.4l1.6-8Z" />
  </IconBase>
);

export const Flame: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 2.8c3.4 4 6.4 6.3 6.4 10.4a6.4 6.4 0 0 1-12.8 0c0-2 .9-3.6 2.2-5.2.4 1.6 1.2 2.6 2.4 3.2.4-3.4.8-6 1.8-8.4Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M12 2.8c3.4 4 6.4 6.3 6.4 10.4a6.4 6.4 0 0 1-12.8 0c0-2 .9-3.6 2.2-5.2.4 1.6 1.2 2.6 2.4 3.2.4-3.4.8-6 1.8-8.4Z" />
    <path d="M12 21.2a3 3 0 0 1-3-3c0-1.6 1.3-2.8 3-4.6 1.7 1.8 3 3 3 4.6a3 3 0 0 1-3 3Z" />
  </IconBase>
);

export const Award: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="9" r="5.4" fill="currentColor" stroke="none" opacity="0.14" />
    <circle cx="12" cy="9" r="5.4" />
    <path d="M8.6 13.4 7.2 21l4.8-2.6L16.8 21l-1.4-7.6" />
  </IconBase>
);

export const Target: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.4" fill="currentColor" stroke="none" opacity="0.1" />
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

export const Ticket: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M3.4 7.6a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v2a2.4 2.4 0 0 0 0 4.8v2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-2a2.4 2.4 0 0 0 0-4.8v-2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M3.4 7.6a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v2a2.4 2.4 0 0 0 0 4.8v2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-2a2.4 2.4 0 0 0 0-4.8v-2Z" />
    <path d="M13.6 5.8v12.4" />
  </IconBase>
);

export const Wallet: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3.4" y="6.2" width="17.2" height="13.4" rx="3" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="3.4" y="6.2" width="17.2" height="13.4" rx="3" />
    <path d="M3.4 10.4h17.2M16.4 15.4h1.6" />
  </IconBase>
);

export const CreditCard: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="2.8" y="5.4" width="18.4" height="13.2" rx="3" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="2.8" y="5.4" width="18.4" height="13.2" rx="3" />
    <path d="M2.8 9.6h18.4M6.4 15.4h4.2" />
  </IconBase>
);

export const ShoppingBag: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M4.8 8.2h14.4l-1 11a2.4 2.4 0 0 1-2.4 2.2H8.2a2.4 2.4 0 0 1-2.4-2.2l-1-11Z"
      fill="currentColor"
      stroke="none"
      opacity="0.12"
    />
    <path d="M4.8 8.2h14.4l-1 11a2.4 2.4 0 0 1-2.4 2.2H8.2a2.4 2.4 0 0 1-2.4-2.2l-1-11Z" />
    <path d="M8.6 10V7.4a3.4 3.4 0 0 1 6.8 0V10" />
  </IconBase>
);

export const ShieldAlert: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <path
      d="M12 3.2l7.2 2.7v5.8c0 4.2-2.9 7.7-7.2 9.1-4.3-1.4-7.2-4.9-7.2-9.1V5.9L12 3.2Z"
      fill="currentColor"
      stroke="none"
      opacity="0.14"
    />
    <path d="M12 3.2l7.2 2.7v5.8c0 4.2-2.9 7.7-7.2 9.1-4.3-1.4-7.2-4.9-7.2-9.1V5.9L12 3.2Z" />
    <path d="M12 8.4v4.2" />
    <circle cx="12" cy="15.6" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

export const Calculator: React.FC<ZaIconProps> = (props) => (
  <IconBase {...props}>
    <rect x="5" y="2.8" width="14" height="18.4" rx="2.8" fill="currentColor" stroke="none" opacity="0.12" />
    <rect x="5" y="2.8" width="14" height="18.4" rx="2.8" />
    <rect x="7.8" y="5.6" width="8.4" height="3.6" rx="1.2" />
    <path d="M8.4 12.6h.01M12 12.6h.01M15.6 12.6h.01M8.4 16h.01M12 16h.01M15.6 16h.01M8.4 19.2h.01M12 19.2h.01M15.6 19.2h.01" strokeWidth={2.3} />
  </IconBase>
);
