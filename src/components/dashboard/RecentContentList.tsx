import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import { ContentPost } from '../../types/database.ts';
import { StatusBadge, FormatBadge } from '../common/Badges.tsx';

interface RecentContentListProps {
  posts: ContentPost[];
  onOpenNewPost: () => void;
}

export const RecentContentList: React.FC<RecentContentListProps> = ({ posts, onOpenNewPost }) => {
  const formatScheduledDate = (isoString?: string | null) => {
    if (!isoString) return 'Belum terjadwal';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] mb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Antrean Konten Terbaru</h2>
          <p className="text-xs text-slate-500 mt-0.5">Draf dan jadwal publikasi mendatang</p>
        </div>
        <button
          onClick={onOpenNewPost}
          className="text-xs font-medium text-[#007AFF] hover:text-[#0055B3] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ios-button cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Tambah Konten</span>
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-black/10 rounded-xl bg-black/[0.01]">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-xs font-medium text-slate-700">Belum ada konten dalam antrean</p>
          <p className="text-xs text-slate-400 mt-0.5">Mulai dengan mencatat ide atau draf konten pertama Anda</p>
          <button
            onClick={onOpenNewPost}
            className="mt-3.5 text-xs font-medium text-white bg-[#007AFF] hover:bg-[#0066D6] px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,122,255,0.25)] transition-all ios-button cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Buat Konten Pertama</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.05]">
          {posts.map((post) => (
            <div key={post.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-black/[0.02] -mx-2 px-2.5 rounded-xl transition-colors">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 hover:text-[#007AFF] cursor-pointer line-clamp-1 truncate">
                    {post.title}
                  </span>
                  <StatusBadge status={post.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <FormatBadge format={post.format} />
                  <span className="text-slate-300">·</span>
                  <span>Pilar: <strong className="text-slate-700 font-medium">{post.pillar}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                    <Calendar className="w-3 h-3 text-slate-400" strokeWidth={1.75} />
                    {formatScheduledDate(post.scheduled_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 self-start sm:self-center shrink-0">
                {post.channels.map((ch) => (
                  <span
                    key={ch}
                    className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-lg border border-black/[0.06] bg-black/[0.03] text-slate-600"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
