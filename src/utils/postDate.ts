import type { ContentPost } from '../types/database.ts';

type PostDateSource = Pick<ContentPost, 'posted_at' | 'scheduled_at' | 'created_at'>;

/**
 * Tanggal acuan laporan: tanggal tayang, lalu jadwal, lalu tanggal dibuat.
 * Semua agregasi analitik memakai tanggal ini, bukan tanggal snapshot.
 */
export function resolvePostDate(post?: PostDateSource | null): Date | null {
  if (!post) return null;

  for (const value of [post.posted_at, post.scheduled_at, post.created_at]) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }

  return null;
}

export function resolvePostTimestamp(post?: PostDateSource | null): number {
  const date = resolvePostDate(post);
  return date ? date.getTime() : 0;
}

/** Kunci bulan lokal dalam format YYYY-MM. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(date: Date = new Date()): string {
  return toMonthKey(date);
}

export function postMonthKey(post?: PostDateSource | null): string | null {
  const date = resolvePostDate(post);
  return date ? toMonthKey(date) : null;
}

/** Kunci tanggal lokal dalam format YYYY-MM-DD. */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function formatMonthKey(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return monthKey;

  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, 1)
  );
}
