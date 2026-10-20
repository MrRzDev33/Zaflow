import React from 'react';
import {
  LayoutDashboard,
  Database,
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
} from 'lucide-react';
import { ZaFlowLogo } from '../common/ZaFlowLogo.tsx';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  isCollapsed: boolean;
  isSuperAdmin?: boolean;
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
}) => {
  const navSections: NavSection[] = [
    {
      title: 'Perencanaan',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'content_db', label: 'Database Konten', icon: Database },
        { id: 'calendar', label: 'Kalender Konten', icon: CalendarDays },
        { id: 'kanban', label: 'Kanban Workflow', icon: Kanban },
      ],
    },
    {
      title: 'Analitik & Strategi',
      items: [
        { id: 'analytics', label: 'Analitik & Laporan', icon: BarChart3 },
        { id: 'content_posts', label: 'Konten Post', icon: FileImage },
        { id: 'ai_extractor', label: 'Metrics Extractor', icon: ScanEye },
        { id: 'ai_strategy', label: 'Strategy Assistant', icon: BrainCircuit },
      ],
    },
    {
      title: 'Akses & Tim',
      items: [
        { id: 'team', label: 'Anggota & Tim', icon: Users },
        { id: 'activity_logs', label: 'Log Aktivitas', icon: History },
        { id: 'license', label: 'Paket & Kuota', icon: Key },
        ...(isSuperAdmin
          ? [{ id: 'admin', label: 'Platform Admin', icon: ShieldCheck }]
          : []),
      ],
    },
  ];

  return (
    <aside
      className={`bg-white/20 backdrop-blur-md flex flex-col shrink-0 border-r border-white/60 select-none transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-56 lg:w-60'
      }`}
    >
      {/* Brand logo & workspace branding */}
      <div
        className={`h-16 flex items-center px-4.5 border-b border-white/40 ${
          isCollapsed ? 'justify-center' : 'justify-start'
        }`}
      >
        <ZaFlowLogo size={isCollapsed ? 'sm' : 'md'} showText={!isCollapsed} />
      </div>

      {/* Navigation menu */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
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
                    onClick={() => onSelectTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-2' : 'justify-start px-3.5'
                    } py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'astra-pill-active font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.05)] border border-white/90 text-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#2563EB]' : 'text-slate-500'
                      } ${!isCollapsed ? 'mr-3' : ''}`}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quota box: Astra frosted glass widget */}
      {!isCollapsed ? (
        <div className="p-3.5 border-t border-white/40">
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
          className="p-3 border-t border-white/40 flex justify-center"
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
