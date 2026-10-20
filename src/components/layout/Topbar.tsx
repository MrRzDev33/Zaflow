import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  User as UserIcon,
  Settings2,
  Menu,
  ShieldCheck,
  ChevronDown,
  Headphones,
} from 'lucide-react';
import { BrandSwitcher } from './BrandSwitcher.tsx';
import { Brand, Profile } from '../../types/database.ts';

interface TopbarProps {
  currentTab: string;
  brands: Brand[];
  activeBrand: Brand | null;
  profile: Profile | null;
  onSelectBrand: (brandId: string) => void;
  onOpenNewBrand: () => void;
  canCreateBrand?: boolean;
  onOpenBrandSettings?: () => void;
  onOpenNewPost: () => void;
  onSignOut: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  brands,
  activeBrand,
  profile,
  onSelectBrand,
  onOpenNewBrand,
  canCreateBrand = true,
  onOpenBrandSettings,
  onSignOut,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const userName = profile?.full_name?.trim() || 'Pengguna ZaFlow';
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 border-b border-white/40 bg-white/20 backdrop-blur-md z-20">
      {/* Left: Mobile Sidebar toggle & Workspace Brand Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Buka Sidebar' : 'Ciutkan Sidebar'}
          className="p-2 text-slate-600 hover:text-slate-900 astra-icon-btn rounded-xl cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" strokeWidth={1.8} />
        </button>

        {/* Brand Switcher */}
        <div className="flex items-center gap-1.5">
          <BrandSwitcher
            brands={brands}
            activeBrand={activeBrand}
            onSelectBrand={onSelectBrand}
            onOpenNewBrand={onOpenNewBrand}
            canCreateBrand={canCreateBrand}
          />

          {activeBrand && onOpenBrandSettings && (
            <button
              onClick={onOpenBrandSettings}
              title="Pengaturan Workspace"
              className="p-2 text-slate-500 hover:text-slate-800 astra-icon-btn rounded-xl cursor-pointer shrink-0"
            >
              <Settings2 className="w-4 h-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Right: WhatsApp / Customer Service, Notifications, and Unified Profile + Logout */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* WhatsApp Customer Service Button */}
        <a
          href="https://wa.me/6281234567890?text=Halo%20ZaFlow%20Customer%20Service,%20saya%20butuh%20bantuan."
          target="_blank"
          rel="noopener noreferrer"
          title="Customer Service (WhatsApp Resmi)"
          className="h-8 px-2.5 rounded-xl astra-icon-btn flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 bg-white/60 hover:bg-white/90 cursor-pointer text-xs font-semibold"
        >
          {/* Authentic WhatsApp Icon */}
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 fill-emerald-600 shrink-0"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="hidden md:inline">Customer Service</span>
        </a>

        {/* Unified Profile Card with Interactive Dropdown (Includes Logout) */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2.5 p-1 sm:pr-2.5 rounded-2xl bg-white/50 hover:bg-white/80 border border-white/80 shadow-2xs transition-all cursor-pointer select-none astra-icon-btn"
          >
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#93C5FD] to-[#C084FC] p-0.5 shadow-xs shrink-0">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-slate-800 font-bold text-xs overflow-hidden">
                {profile?.full_name ? (
                  profile.full_name.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-600" strokeWidth={2} />
                )}
              </div>
            </div>

            {/* User Name & Role (Hidden on mobile) */}
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-bold text-slate-800 tracking-tight truncate max-w-[120px]">
                {userName}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {profile?.system_role === 'super_admin' ? 'Super Admin' : 'Member'}
              </p>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" strokeWidth={2} />
          </button>

          {/* Unified Profile & Logout Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 astra-card p-2 z-50 overflow-hidden shadow-[0_12px_40px_rgba(79,70,229,0.12)] animate-in fade-in-50 zoom-in-95 duration-150">
              {/* Profile Overview */}
              <div className="px-3 py-2.5 border-b border-slate-100/80">
                <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  Akun ZaFlow Terverifikasi
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {profile?.system_role === 'super_admin' ? (
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-[#818CF8]/15 text-[#4F46E5] border border-[#818CF8]/25">
                      <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
                      <span>Super Admin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[9px] uppercase font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Workspace Member
                    </span>
                  )}
                </div>
              </div>

              {/* Action: Sign Out */}
              <div className="p-1 pt-1.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" strokeWidth={1.8} />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
