import type { ComponentType } from 'react';
import {
  IconAnalytics,
  IconCalendar,
  IconCollection,
  IconDashboard,
  IconHistory,
  IconKanban,
  IconLicense,
  IconPost,
  IconScanAI,
  IconShield,
  IconStrategy,
  IconTeam,
  type ZaIconProps,
} from '../components/common/icons/ZaflowIcons.tsx';

export interface NavItem {
  id: string;
  label: string;
  description: string;
  section: string;
  icon: ComponentType<ZaIconProps>;
  adminOnly?: boolean;
  /** Kata kunci tambahan untuk pencarian cepat. */
  keywords?: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Perencanaan',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Ringkasan performa dan antrean konten',
        section: 'Perencanaan',
        icon: IconDashboard,
        keywords: ['beranda', 'home', 'ringkasan'],
      },
      {
        id: 'content_db',
        label: 'Koleksi Konten',
        description: 'Cari, filter, dan kelola semua konten',
        section: 'Perencanaan',
        icon: IconCollection,
        keywords: ['database', 'konten', 'library'],
      },
      {
        id: 'calendar',
        label: 'Kalender Konten',
        description: 'Lihat jadwal publikasi per tanggal',
        section: 'Perencanaan',
        icon: IconCalendar,
        keywords: ['jadwal', 'tanggal', 'kalender'],
      },
      {
        id: 'kanban',
        label: 'Alur Konten',
        description: 'Pantau proses produksi konten',
        section: 'Perencanaan',
        icon: IconKanban,
        keywords: ['kanban', 'alur', 'produksi', 'status'],
      },
    ],
  },
  {
    title: 'Analitik & Strategi',
    items: [
      {
        id: 'analytics',
        label: 'Analitik & Laporan',
        description: 'Tren metrik, performa pilar, dan laporan',
        section: 'Analitik & Strategi',
        icon: IconAnalytics,
        keywords: ['laporan', 'metrik', 'statistik', 'grafik'],
      },
      {
        id: 'content_posts',
        label: 'Konten Post',
        description: 'Performa setiap postingan',
        section: 'Analitik & Strategi',
        icon: IconPost,
        keywords: ['postingan', 'post', 'performa'],
      },
      {
        id: 'ai_extractor',
        label: 'Ambil Metrik AI',
        description: 'Ekstrak metrik dari screenshot insight',
        section: 'Analitik & Strategi',
        icon: IconScanAI,
        keywords: ['ai', 'screenshot', 'insight', 'ekstrak'],
      },
      {
        id: 'ai_strategy',
        label: 'Asisten Strategi',
        description: 'Rencana strategi dan chat konsultasi AI',
        section: 'Analitik & Strategi',
        icon: IconStrategy,
        keywords: ['ai', 'strategi', 'chat', 'konsultasi'],
      },
    ],
  },
  {
    title: 'Akses & Tim',
    items: [
      {
        id: 'team',
        label: 'Anggota & Tim',
        description: 'Kelola anggota dan hak akses',
        section: 'Akses & Tim',
        icon: IconTeam,
        keywords: ['tim', 'anggota', 'undangan', 'akses'],
      },
      {
        id: 'activity_logs',
        label: 'Riwayat Aktivitas',
        description: 'Jejak perubahan di workspace',
        section: 'Akses & Tim',
        icon: IconHistory,
        keywords: ['log', 'riwayat', 'aktivitas', 'audit'],
      },
      {
        id: 'license',
        label: 'Paket & Kuota',
        description: 'Langganan, masa aktif, dan kredit AI',
        section: 'Akses & Tim',
        icon: IconLicense,
        keywords: ['paket', 'kuota', 'kredit', 'lisensi', 'langganan'],
      },
      {
        id: 'admin',
        label: 'Admin Platform',
        description: 'Pengaturan platform dan pengguna',
        section: 'Akses & Tim',
        icon: IconShield,
        adminOnly: true,
        keywords: ['admin', 'platform', 'super admin'],
      },
    ],
  },
];

export function getVisibleNavSections(isSuperAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isSuperAdmin),
  })).filter((section) => section.items.length > 0);
}

export function getNavItem(tabId: string): NavItem | null {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.id === tabId);
    if (item) return item;
  }
  return null;
}
