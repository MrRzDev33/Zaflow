import React, { ReactNode, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';
import { ConfigNotice } from '../common/ConfigNotice.tsx';
import { Brand, Profile } from '../../types/database.ts';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  brands: Brand[];
  activeBrand: Brand | null;
  profile: Profile | null;
  isSuperAdmin?: boolean;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  onSelectBrand: (brandId: string) => void;
  onOpenNewBrand: () => void;
  canCreateBrand?: boolean;
  onOpenBrandSettings?: () => void;
  onOpenNewPost: () => void;
  onSignOut: () => void;
  customerService?: { whatsappUrl: string | null; label: string } | null;
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  brands,
  activeBrand,
  profile,
  isSuperAdmin = false,
  aiCreditsRemaining,
  aiCreditsTotal,
  onSelectBrand,
  onOpenNewBrand,
  canCreateBrand = true,
  onOpenBrandSettings,
  onOpenNewPost,
  onSignOut,
  customerService,
  children,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen h-screen w-full flex bg-gradient-to-br from-[#D9E4F9] via-[#E8ECF9] to-[#DEE6F8] relative overflow-hidden">
      {/* Soft Ambient Color Spheres in Background (Astra Mesh) */}
      <div className="fixed -top-32 -left-20 w-[600px] h-[600px] bg-gradient-to-br from-[#93C5FD]/40 to-[#818CF8]/30 rounded-full blur-[120px] pointer-events-none -z-0" />
      <div className="fixed top-1/3 -right-28 w-[550px] h-[550px] bg-gradient-to-br from-[#C4B5FD]/35 to-[#F472B6]/25 rounded-full blur-[130px] pointer-events-none -z-0" />
      <div className="fixed -bottom-24 left-1/3 w-[650px] h-[650px] bg-gradient-to-tr from-[#6EE7B7]/25 to-[#60A5FA]/35 rounded-full blur-[140px] pointer-events-none -z-0" />

      {/* Full Width Workspace Layout */}
      <div className="w-full h-full flex flex-row overflow-hidden relative z-10">
        {/* Sidebar Kiri - Translucent Frosted Glass */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          aiCreditsRemaining={aiCreditsRemaining}
          aiCreditsTotal={aiCreditsTotal}
          isCollapsed={isSidebarCollapsed}
          isSuperAdmin={isSuperAdmin}
          whatsappUrl={customerService?.whatsappUrl || null}
          whatsappLabel={customerService?.label || 'Bantuan'}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Banner Konfigurasi Supabase jika env vars belum diisi */}
          <ConfigNotice />

          {/* Topbar Terpadu Frosted Glass */}
          <Topbar
            currentTab={currentTab}
            brands={brands}
            activeBrand={activeBrand}
            profile={profile}
            onSelectBrand={onSelectBrand}
            onOpenNewBrand={onOpenNewBrand}
            canCreateBrand={canCreateBrand}
            onOpenBrandSettings={onOpenBrandSettings}
            onOpenNewPost={onOpenNewPost}
            onSignOut={onSignOut}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            customerService={customerService}
          />

          {/* Workspace Canvas Full Width */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
            <div className="w-full space-y-5">
              {children}
            </div>
            <footer className="mt-8 flex flex-col gap-2 border-t border-white/50 pt-4 pb-1 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>© {new Date().getFullYear()} ZaFlow</span>
              {customerService?.whatsappUrl && (
                <a
                  href={customerService.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {customerService.label || 'Bantuan'} via WhatsApp
                </a>
              )}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
