import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { Brand, ContentPost } from '../../types/database.ts';
import { contentService } from '../../services/database/contentService.ts';
import { EditPostModal } from './EditPostModal.tsx';
import { NewPostModal } from '../dashboard/NewPostModal.tsx';
import { ContentThumbnail } from './ContentThumbnail.tsx';

interface ContentCalendarViewProps {
  brand: Brand | null;
  canEdit?: boolean;
}

export const ContentCalendarView: React.FC<ContentCalendarViewProps> = ({ brand, canEdit = true }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const fetchMonthPosts = useCallback(async () => {
    if (!brand) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Fetch all posts for the brand to populate calendar
      const data = await contentService.getPosts(brand.id);
      setPosts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal kalender.');
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    fetchMonthPosts();
  }, [fetchMonthPosts]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  // Days in current month
  const firstDayOfMonth = new Date(year, month, 1);
  // In JS, getDay() returns 0 for Sunday, 1 for Monday. Convert to 0 for Monday, 6 for Sunday:
  const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter !== 'all' && !p.channels.includes(platformFilter)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = p.title.toLowerCase().includes(q);
        const captionMatch = p.caption?.toLowerCase().includes(q);
        const pillarMatch = p.pillar.toLowerCase().includes(q);
        if (!titleMatch && !captionMatch && !pillarMatch) return false;
      }
      return true;
    });
  }, [posts, platformFilter, searchQuery]);

  // Group posts by YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentPost[]>();
    for (const post of filteredPosts) {
      if (post.scheduled_at) {
        try {
          const d = new Date(post.scheduled_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(post);
        } catch {
          // ignore invalid date
        }
      }
    }
    return map;
  }, [filteredPosts]);

  // Unscheduled posts
  const unscheduledPosts = useMemo(() => {
    return filteredPosts.filter((p) => !p.scheduled_at);
  }, [filteredPosts]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, post: ContentPost) => {
    setDraggedPostId(post.id);
    e.dataTransfer.setData('text/plain', post.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDateKey !== dateKey) {
      setDragOverDateKey(dateKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverDateKey(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDateKey: string) => {
    e.preventDefault();
    setDragOverDateKey(null);
    if (!canEdit) return;
    const postId = e.dataTransfer.getData('text/plain') || draggedPostId;
    setDraggedPostId(null);

    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Build new scheduled date with default 10:00 AM or preserve existing time
    let hours = 10;
    let minutes = 0;
    if (post.scheduled_at) {
      try {
        const prev = new Date(post.scheduled_at);
        hours = prev.getHours();
        minutes = prev.getMinutes();
      } catch {
        // default
      }
    }

    const [tYear, tMonth, tDay] = targetDateKey.split('-').map(Number);
    const targetDate = new Date(tYear, tMonth - 1, tDay, hours, minutes, 0);
    const newScheduledISO = targetDate.toISOString();

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduled_at: newScheduledISO } : p))
    );

    try {
      await contentService.updatePostSchedule(postId, newScheduledISO);
      setActionNotice(`Jadwal "${post.title}" berhasil dipindahkan ke ${tDay} ${monthNames[tMonth - 1]}.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: unknown) {
      // Revert if error
      fetchMonthPosts();
      setError(err instanceof Error ? err.message : 'Gagal memindahkan jadwal.');
    }
  };

  const [selectedDayModalDate, setSelectedDayModalDate] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const handleDayClick = (dateKey: string) => {
    setSelectedDayModalDate(dateKey);
    setIsDayModalOpen(true);
  };

  const handlePostClick = (e: React.MouseEvent, post: ContentPost) => {
    e.stopPropagation();
    if (!canEdit) return;
    setSelectedPost(post);
    setIsEditModalOpen(true);
  };

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  // Today check
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Calendar Header with Navigation & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                {monthNames[month]} {year}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {filteredPosts.length} Post
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Drag-and-drop konten antar tanggal untuk mengatur jadwal tayang otomatis
            </p>
          </div>
        </div>

        {/* Controls: Prev, Today, Next, Platform filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month buttons */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 transition cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-white rounded-md text-slate-700 transition cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 transition cursor-pointer"
              title="Bulan Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Platform filter tabs */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            {['all', 'instagram', 'tiktok', 'linkedin'].map((pf) => (
              <button
                key={pf}
                onClick={() => setPlatformFilter(pf)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer capitalize ${
                  platformFilter === pf
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pf === 'all' ? 'Semua' : pf}
              </button>
            ))}
          </div>

          {canEdit && (
            <button
              onClick={() => {
                setPrefilledDate('');
                setIsNewPostModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Jadwalkan Konten</span>
            </button>
          )}
        </div>
      </div>

      {/* Action feedback banner */}
      {actionNotice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchMonthPosts}
            className="font-semibold underline cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* CALENDAR GRID */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-slate-600 text-[11px] font-bold uppercase tracking-wider text-center py-2.5">
          {daysOfWeek.map((day) => (
            <div key={day} className="truncate px-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Memuat kalender dari Supabase...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[580px]">
            {/* Previous month filler cells */}
            {Array.from({ length: startDayIndex }).map((_, idx) => {
              const dayNum = daysInPrevMonth - startDayIndex + idx + 1;
              return (
                <div
                  key={`prev-${idx}`}
                  className="bg-slate-50/40 p-1.5 min-h-[105px] text-slate-300 text-xs select-none"
                >
                  <span className="font-medium text-[11px]">{dayNum}</span>
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dateKey === todayKey;
              const dayPosts = postsByDate.get(dateKey) || [];
              const isDragOver = dragOverDateKey === dateKey;

              return (
                <div
                  key={dateKey}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateKey)}
                  onClick={() => handleDayClick(dateKey)}
                  className={`p-1.5 min-h-[105px] flex flex-col justify-between transition-colors cursor-pointer group ${
                    isDragOver
                      ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset'
                      : isToday
                      ? 'bg-blue-50/20'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Top row: day number + add button */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(dateKey);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition"
                        title="Tambah konten di tanggal ini"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Day posts list */}
                  <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                    {dayPosts.map((post) => {
                      const channelBadge = post.channels[0] || 'post';
                      const statusColor =
                        post.status === 'published'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : post.status === 'scheduled'
                          ? 'border-purple-300 bg-purple-50 text-purple-800'
                          : 'border-blue-200 bg-white text-slate-800';

                      return (
                        <div
                          key={post.id}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, post)}
                          onClick={(e) => handlePostClick(e, post)}
                          className={`p-1 rounded-md text-[10px] border shadow-2xs font-medium ${
                            canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                          } hover:shadow-xs transition truncate ${statusColor}`}
                          title={canEdit ? `${post.title} (${post.status}) - Drag untuk memindahkan tanggal` : `${post.title} (${post.status})`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="uppercase text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-700 shrink-0">
                              {channelBadge}
                            </span>
                            <span className="truncate font-semibold">{post.title}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty state bottom indicator if no posts */}
                  {dayPosts.length === 0 && (
                    <div className="h-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer: Konten Belum Terjadwal (Unscheduled Backlog) */}
      {unscheduledPosts.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Antrean Belum Terjadwal ({unscheduledPosts.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Drag kartu ke tanggal kalender di atas untuk menjadwalkan
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {unscheduledPosts.map((post) => (
              <div
                key={post.id}
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, post)}
                onClick={(e) => handlePostClick(e, post)}
                className={`bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg p-2.5 min-w-[200px] max-w-[220px] text-xs ${
                  canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                } transition shrink-0`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {post.channels[0] || 'Umum'}
                  </span>
                  <span className="text-[10px] text-slate-500">{post.pillar}</span>
                </div>
                <p className="font-bold text-slate-800 truncate">{post.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <EditPostModal
        isOpen={isEditModalOpen}
        post={selectedPost}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPost(null);
        }}
        onUpdated={fetchMonthPosts}
        onDeleted={fetchMonthPosts}
        onDuplicated={() => fetchMonthPosts()}
      />

      {/* Day Posts List Modal */}
      {isDayModalOpen && selectedDayModalDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  <span>Jadwal Konten: {selectedDayModalDate}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar konten yang terjadwal pada tanggal ini. Klik untuk mengedit atau buat baru.
                </p>
              </div>
              <button
                onClick={() => setIsDayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(postsByDate.get(selectedDayModalDate) || []).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada konten terjadwal di tanggal ini.
                </div>
              ) : (
                (postsByDate.get(selectedDayModalDate) || []).map((post) => (
                  <div
                    key={post.id}
                    onClick={() => {
                      setIsDayModalOpen(false);
                      setSelectedPost(post);
                      setIsEditModalOpen(true);
                    }}
                    className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ContentThumbnail
                        mediaPath={post.media_urls?.[0]}
                        alt={post.title}
                        className="w-12 h-12"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {post.channels[0] || 'Umum'}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">{post.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-xs">{post.caption || 'Tanpa kepsyen'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">Edit →</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setIsDayModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    setIsDayModalOpen(false);
                    setPrefilledDate(`${selectedDayModalDate}T10:00`);
                    setIsNewPostModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Konten di Tanggal Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isNewPostModalOpen && (
        <NewPostModal
          isOpen={isNewPostModalOpen}
          brandId={brand.id}
          onClose={() => {
            setIsNewPostModalOpen(false);
            setPrefilledDate('');
          }}
          onSubmit={async (input) => {
            await contentService.createPost({
              ...input,
              scheduled_at: prefilledDate ? new Date(prefilledDate).toISOString() : input.scheduled_at,
            });
            fetchMonthPosts();
          }}
        />
      )}
    </div>
  );
};
