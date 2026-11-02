import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Search } from '../common/icons/lucide-compat.tsx';
import type { ContentPost } from '../../types/database.ts';
import {
  currentMonthKey,
  formatMonthKey,
  postMonthKey,
  resolvePostDate,
} from '../../utils/postDate.ts';

interface PostPickerProps {
  posts: ContentPost[];
  value: string;
  onChange: (postId: string) => void;
  disabled?: boolean;
  error?: string | null;
  hint?: string;
}

function formatPostDate(post: ContentPost): string {
  const date = resolvePostDate(post);
  if (!date) return 'Tanggal belum diisi';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Pemilih postingan dua tahap: pilih bulan lebih dulu, lalu cari judul.
 * Dipakai form Catat Metrik dan verifikasi AI Metrics Extractor.
 */
export const PostPicker: React.FC<PostPickerProps> = ({
  posts,
  value,
  onChange,
  disabled = false,
  error,
  hint,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(() => {
    const selected = posts.find((post) => post.id === value);
    return postMonthKey(selected) || currentMonthKey();
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return;
    const selected = posts.find((post) => post.id === value);
    const key = postMonthKey(selected);
    if (key) setMonth(key);
  }, [value, posts]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.clearTimeout(timer);
    };
  }, [open]);

  const months = useMemo(() => {
    const keys = new Set<string>([currentMonthKey()]);
    for (const post of posts) {
      const key = postMonthKey(post);
      if (key) keys.add(key);
    }

    if (value) {
      const selectedKey = postMonthKey(posts.find((post) => post.id === value));
      if (selectedKey) keys.add(selectedKey);
    }

    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [posts, value]);

  const monthPosts = useMemo(
    () => posts.filter((post) => postMonthKey(post) === month),
    [posts, month]
  );

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = keyword
      ? monthPosts.filter((post) =>
          [post.title, post.pillar, post.brief, post.caption].some((field) =>
            field?.toLowerCase().includes(keyword)
          )
        )
      : monthPosts;

    return [...list].sort(
      (a, b) => (resolvePostDate(b)?.getTime() || 0) - (resolvePostDate(a)?.getTime() || 0)
    );
  }, [monthPosts, query]);

  const selectedPost = posts.find((post) => post.id === value) || null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 ${
          error ? 'border-red-300' : 'border-slate-300'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span
              className={`block truncate ${
                selectedPost ? 'font-semibold text-slate-900' : 'text-slate-400'
              }`}
            >
              {selectedPost ? selectedPost.title : 'Pilih postingan...'}
            </span>
            {selectedPost && (
              <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                {selectedPost.pillar || 'Tanpa pilar'} • {formatPostDate(selectedPost)}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 min-w-[18rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Bulan Postingan
              </span>
              <select
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setQuery('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {months.map((key) => (
                  <option key={key} value={key}>
                    {formatMonthKey(key)}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul, pilar, atau brief..."
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredPosts.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-slate-400">
                Tidak ada postingan pada {formatMonthKey(month)}.
              </p>
            ) : (
              filteredPosts.map((post) => {
                const isSelected = post.id === value;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      onChange(post.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-900">
                        {post.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                        <span>{post.pillar || 'Tanpa pilar'}</span>
                        <span>•</span>
                        <span>{formatPostDate(post)}</span>
                        <span>•</span>
                        <span className="uppercase">
                          {(post.channels || []).join(', ') || 'tanpa saluran'}
                        </span>
                      </span>
                    </span>
                    {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
            {filteredPosts.length} dari {monthPosts.length} postingan di {formatMonthKey(month)}
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-1 text-[10px] text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
      )}
    </div>
  );
};
