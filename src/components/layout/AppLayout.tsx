import React, { ReactNode, useState } from 'react';
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
          />

          {/* Workspace Canvas Full Width */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
            <div className="w-full space-y-5">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
