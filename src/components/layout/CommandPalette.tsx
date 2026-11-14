import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Plus, Search } from '../common/icons/lucide-compat.tsx';
import { getVisibleNavSections } from '../../config/navigation.tsx';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  onOpenNewPost: () => void;
  onOpenNewBrand: () => void;
  onOpenBrandSettings?: () => void;
  canCreateBrand?: boolean;
  isSuperAdmin?: boolean;
}

interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  group: string;
  icon?: React.ComponentType<any>;
  keywords: string[];
  run: () => void;
}

const GROUP_ORDER = ['Navigasi', 'Aksi Cepat'];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onSelectTab,
  onOpenNewPost,
  onOpenNewBrand,
  onOpenBrandSettings,
  canCreateBrand = true,
  isSuperAdmin = false,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<PaletteCommand[]>(() => {
    const navCommands: PaletteCommand[] = getVisibleNavSections(isSuperAdmin).flatMap((section) =>
      section.items.map((item) => ({
        id: `nav:${item.id}`,
        label: item.label,
        hint: item.description,
        group: 'Navigasi',
        icon: item.icon,
        keywords: [item.section, item.label, item.description, ...(item.keywords || [])],
        run: () => onSelectTab(item.id),
      }))
    );

    const actions: PaletteCommand[] = [
      {
        id: 'action:new-post',
        label: 'Buat Konten Baru',
        hint: 'Tambahkan draft konten ke workspace aktif',
        group: 'Aksi Cepat',
        icon: Plus,
        keywords: ['konten', 'post', 'baru', 'tambah', 'draft'],
        run: onOpenNewPost,
      },
    ];

    if (canCreateBrand) {
      actions.push({
        id: 'action:new-brand',
        label: 'Tambah Brand Baru',
        hint: 'Buat workspace brand baru',
        group: 'Aksi Cepat',
        icon: Plus,
        keywords: ['brand', 'workspace', 'baru', 'tambah'],
        run: onOpenNewBrand,
      });
    }

    if (onOpenBrandSettings) {
      actions.push({
        id: 'action:brand-settings',
        label: 'Pengaturan Brand',
        hint: 'Ubah profil, pilar, dan platform brand aktif',
        group: 'Aksi Cepat',
        icon: undefined,
        keywords: ['brand', 'pengaturan', 'setting', 'pilar', 'platform'],
        run: onOpenBrandSettings,
      });
    }

    return [...navCommands, ...actions];
  }, [canCreateBrand, isSuperAdmin, onOpenBrandSettings, onOpenNewBrand, onOpenNewPost, onSelectTab]);

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return commands;
    return commands.filter((command) =>
      normalize([command.label, command.hint, ...command.keywords].join(' ')).includes(needle)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: filtered.filter((command) => command.group === group),
    })).filter((entry) => entry.items.length > 0);
  }, [filtered]);

  const flatFiltered = useMemo(() => grouped.flatMap((entry) => entry.items), [grouped]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const runCommand = useCallback(
    (command?: PaletteCommand) => {
      if (!command) return;
      onClose();
      // Tunggu overlay tertutup agar transisi tidak bertabrakan dengan render view baru.
      window.setTimeout(() => command.run(), 0);
    },
    [onClose]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (flatFiltered.length ? (index + 1) % flatFiltered.length : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        flatFiltered.length ? (index - 1 + flatFiltered.length) % flatFiltered.length : 0
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runCommand(flatFiltered[activeIndex]);
    }
  };

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian cepat"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.28)] backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari halaman atau aksi..."
            aria-label="Cari halaman atau aksi"
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto px-2 py-2">
          {flatFiltered.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-slate-400">
              Tidak ada hasil untuk “{query}”.
            </p>
          )}

          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-1.5">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group}
              </p>
              {items.map((command) => {
                runningIndex += 1;
                const index = runningIndex;
                const isActive = index === activeIndex;
                const Icon = command.icon;

                return (
                  <button
                    key={command.id}
                    type="button"
                    data-active={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isActive ? 'bg-blue-50/90 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isActive ? 'bg-white text-[#2563EB]' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {Icon ? (
                        <Icon className="h-4 w-4" strokeWidth={1.9} />
                      ) : (
                        <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {command.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">{command.hint}</span>
                    </span>
                    {isActive && (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" strokeWidth={2} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/70 px-4 py-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">↑</kbd>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">↓</kbd>
            untuk memilih
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">↵</kbd>
            buka
          </span>
        </div>
      </div>
    </div>
  );
};
