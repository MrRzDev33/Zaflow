import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { Brand } from '../../types/database.ts';

interface BrandSwitcherProps {
  brands: Brand[];
  activeBrand: Brand | null;
  onSelectBrand: (brandId: string) => void;
  onOpenNewBrand: () => void;
  canCreateBrand?: boolean;
}

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({
  brands,
  activeBrand,
  onSelectBrand,
  onOpenNewBrand,
  canCreateBrand = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/80 shadow-2xs transition-all text-left cursor-pointer max-w-[200px]"
      >
        <div
          className="w-3 h-3 rounded-md shrink-0 shadow-xs ring-1 ring-white"
          style={{ backgroundColor: activeBrand?.color_hex || '#2563EB' }}
        />
        <div className="truncate flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">
            {activeBrand ? activeBrand.name : 'Pilih Brand'}
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 astra-card p-1.5 z-50 overflow-hidden shadow-[0_12px_40px_rgba(79,70,229,0.12)]">
          <div className="px-3 py-2 border-b border-slate-100/80">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
              Workspace Brand
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {brands.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-500 text-center">
                Belum ada workspace brand
              </div>
            ) : (
              brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectBrand(b.id);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/70 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: b.color_hex || '#2563EB' }}
                    />
                    <div className="truncate">
                      <p className="font-semibold text-slate-800 truncate">{b.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{b.industry || 'Umum'}</p>
                    </div>
                  </div>
                  {activeBrand?.id === b.id && (
                    <Check className="w-4 h-4 text-[#2563EB] shrink-0 ml-2" strokeWidth={2.2} />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-1.5 border-t border-slate-100/80">
            {canCreateBrand ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewBrand();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/80 hover:bg-white text-[#2563EB] border border-white/90 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Tambah Workspace Baru</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewBrand();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all cursor-pointer"
                title="Batas brand pada paket Anda sudah tercapai"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Batas brand tercapai — Upgrade paket</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
