import React from 'react';
import {
  LayoutDashboard,
  Library,
  CalendarDays,
  Kanban,
  BarChart3,
  FileImage,
  ScanEye,
  BrainCircuit,
  Users,
  History,
  Key,
  ShieldCheck,
  Zap,
  MessageCircle,
  X,
} from 'lucide-react';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.ts';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  isCollapsed: boolean;
  isSuperAdmin?: boolean;
  whatsappUrl?: string | null;
  whatsappLabel?: string;
  /** Drawer navigasi terbuka di HP/tablet. */
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  aiCreditsRemaining,
  aiCreditsTotal,
  isCollapsed,
  isSuperAdmin = false,
  whatsappUrl,
  whatsappLabel = 'Bantuan',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Di HP/tablet drawer selalu tampil penuh, tombol ciutkan hanya berlaku di desktop.
  const collapsed = isDesktop && isCollapsed;
  const handleSelectTab = (tabId: string) => {
    onSelectTab(tabId);
    onCloseMobile?.();
  };

  const navSections: NavSection[] = [
    {
      title: 'Perencanaan',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'content_db', label: 'Koleksi Konten', icon: Library },
        { id: 'calendar', label: 'Kalender Konten', icon: CalendarDays },
        { id: 'kanban', label: 'Alur Konten', icon: Kanban },
      ],
    },
    {
      title: 'Analitik & Strategi',
      items: [
        { id: 'analytics', label: 'Analitik & Laporan', icon: BarChart3 },
        { id: 'content_posts', label: 'Konten Post', icon: FileImage },
        { id: 'ai_extractor', label: 'Ambil Metrik AI', icon: ScanEye },
        { id: 'ai_strategy', label: 'Asisten Strategi', icon: BrainCircuit },
      ],
    },
    {
      title: 'Akses & Tim',
      items: [
        { id: 'team', label: 'Anggota & Tim', icon: Users },
        { id: 'activity_logs', label: 'Riwayat Aktivitas', icon: History },
        { id: 'license', label: 'Paket & Kuota', icon: Key },
        ...(isSuperAdmin
          ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }]
          : []),
      ],
    },
  ];

  return (
    <aside
      aria-label="Navigasi utama"
      className={`fixed inset-y-0 left-0 z-50 h-full lg:static lg:z-auto lg:h-auto bg-white/95 lg:bg-white/20 backdrop-blur-md flex flex-col shrink-0 border-r border-white/60 select-none shadow-2xl lg:shadow-none transition-all duration-200 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${collapsed ? 'w-72 lg:w-16' : 'w-72 lg:w-56 xl:w-60'}`}
    >
      {/* Brand logo & workspace branding */}
      <div
        className={`h-16 flex items-center border-b border-white/40 ${
          collapsed ? 'justify-center px-4.5' : 'justify-between gap-2 px-4.5'
        }`}
      >
        <ZaFlowLogo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-2 -mr-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/70 transition"
        >
          <X className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Navigation menu */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-1 pt-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      collapsed ? 'justify-center px-2' : 'justify-start px-3.5'
                    } py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'astra-pill-active font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.05)] border border-white/90 text-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#2563EB]' : 'text-slate-500'
                      } ${!collapsed ? 'mr-3' : ''}`}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bantuan pelanggan */}
      {whatsappUrl && (
        <div className={`shrink-0 px-3 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? whatsappLabel : undefined}
            className={`inline-flex items-center rounded-xl border border-emerald-200/70 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 transition ${
              collapsed ? 'justify-center p-2' : 'w-full justify-start gap-2 px-3 py-2 text-xs font-semibold'
            }`}
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{whatsappLabel}</span>}
          </a>
        </div>
      )}

      {/* Quota box: Astra frosted glass widget */}
      {!collapsed ? (
        <div className="shrink-0 p-3.5 border-t border-white/40">
          <div className="p-3 rounded-2xl bg-white/50 backdrop-blur-md border border-white/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="text-[11px] text-slate-500 font-medium">Kredit AI</span>
              <span className="text-[11px] font-mono text-slate-800">
                {aiCreditsRemaining} / {aiCreditsTotal}
              </span>
            </div>

            <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] rounded-full transition-all duration-300 shadow-xs"
                style={{
                  width: `${aiCreditsTotal > 0 ? Math.min(100, (aiCreditsRemaining / aiCreditsTotal) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 p-3 border-t border-white/40 flex justify-center"
          title={`Kredit AI: ${aiCreditsRemaining}/${aiCreditsTotal}`}
        >
          <div className="p-2 rounded-xl bg-white/60 text-[#2563EB] shadow-2xs">
            <Zap className="w-4 h-4" strokeWidth={2} />
          </div>
        </div>
      )}
    </aside>
  );
};
