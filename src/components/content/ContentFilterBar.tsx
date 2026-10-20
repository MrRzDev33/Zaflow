import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { ContentFormat, ContentStatus } from '../../types/database.ts';

export interface FilterState {
  search: string;
  channel: string;
  pillar: string;
  status: ContentStatus | 'all';
  format: ContentFormat | 'all';
}

interface ContentFilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  showStatusFilter?: boolean;
  customPillars?: string[];
  customStatuses?: { id: string; title: string }[];
}

export const ContentFilterBar: React.FC<ContentFilterBarProps> = ({
  filters,
  onChange,
  onReset,
  showStatusFilter = true,
  customPillars,
  customStatuses,
}) => {
  const channels = [
    { id: 'all', label: 'Semua Saluran' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'facebook', label: 'Facebook' },
  ];

  const defaultPillars = [
    'Edukatif',
    'Promosi',
    'Interaktif',
    'Inspiratif',
    'Behind The Scenes',
    'Hiburan',
  ];

  const pillars = customPillars && customPillars.length > 0 ? customPillars : defaultPillars;

  const hasActiveFilter =
    filters.search.trim().length > 0 ||
    filters.channel !== 'all' ||
    filters.pillar !== 'all' ||
    filters.status !== 'all' ||
    filters.format !== 'all';

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3">
      {/* Top row: Search input & Platform quick pill tabs */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Cari judul, hook, caption, atau hashtag..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Platform Quick Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onChange({ ...filters, channel: ch.id })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filters.channel === ch.id
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: Dropdowns for Pillar, Format, Status, and Reset */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1 text-slate-400 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">Filter:</span>
        </div>

        {/* Pilar Konten */}
        <select
          value={filters.pillar}
          onChange={(e) => onChange({ ...filters, pillar: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs"
        >
          <option value="all">Semua Pilar</option>
          {pillars.filter((p) => p !== 'all').map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Format Konten */}
        <select
          value={filters.format}
          onChange={(e) => onChange({ ...filters, format: e.target.value as ContentFormat | 'all' })}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs"
        >
          <option value="all">Semua Format</option>
          <option value="carousel">Carousel</option>
          <option value="single_image">Gambar Tunggal</option>
          <option value="reel_short">Reels / Shorts</option>
          <option value="video">Video Panjang</option>
          <option value="story">Story</option>
          <option value="text_thread">Thread / Teks</option>
        </select>

        {/* Status Konten */}
        {showStatusFilter && (
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value as ContentStatus | 'all' })}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs"
          >
            <option value="all">Semua Status</option>
            {customStatuses && customStatuses.length > 0 ? (
              customStatuses.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))
            ) : (
              <>
                <option value="idea">Ide (Backlog)</option>
                <option value="draft">Draf</option>
                <option value="in_review">Perlu Review</option>
                <option value="approved">Disetujui</option>
                <option value="scheduled">Terjadwal</option>
                <option value="published">Dipublikasikan</option>
              </>
            )}
          </select>
        )}

        {/* Tombol Reset Filter */}
        {hasActiveFilter && (
          <button
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>
    </div>
  );
};
