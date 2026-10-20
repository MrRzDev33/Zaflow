import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  Calendar,
  Video,
  Copy,
  Trash2,
  Edit,
  Sliders,
} from 'lucide-react';
import { Brand, ContentPost, ContentStatus, WorkflowStatusConfig } from '../../types/database.ts';
import { contentService } from '../../services/database/contentService.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';
import { FormatBadge } from '../common/Badges.tsx';
import { EditPostModal } from './EditPostModal.tsx';
import { NewPostModal } from '../dashboard/NewPostModal.tsx';
import { WorkflowSettingsModal } from './WorkflowSettingsModal.tsx';
import { ContentThumbnail } from './ContentThumbnail.tsx';

interface ContentKanbanViewProps {
  brand: Brand | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ContentKanbanView: React.FC<ContentKanbanViewProps> = ({
  brand,
  canEdit = true,
  canDelete = true,
}) => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ContentStatus | null>(null);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [newPostStatus, setNewPostStatus] = useState<ContentStatus>('idea');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [kanbanColumns, setKanbanColumns] = useState<WorkflowStatusConfig[]>([]);

  const loadWorkflow = useCallback(() => {
    if (brand) {
      setKanbanColumns(workflowSettingsService.getWorkflowStatuses(brand));
    }
  }, [brand]);

  useEffect(() => {
    loadWorkflow();
    const handleUpdate = () => loadWorkflow();
    window.addEventListener('zaflow_workflow_updated', handleUpdate);
    return () => window.removeEventListener('zaflow_workflow_updated', handleUpdate);
  }, [loadWorkflow]);

  const fetchPosts = useCallback(async () => {
    if (!brand) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await contentService.getPosts(brand.id);
      setPosts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat Kanban workflow.');
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (channelFilter !== 'all' && !p.channels.includes(channelFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchCaption = p.caption?.toLowerCase().includes(q);
        const matchPillar = p.pillar.toLowerCase().includes(q);
        if (!matchTitle && !matchCaption && !matchPillar) return false;
      }
      return true;
    });
  }, [posts, channelFilter, search]);

  // Posts grouped by status
  const postsByStatus = useMemo(() => {
    const map: Record<string, ContentPost[]> = {};
    for (const col of kanbanColumns) {
      map[col.id] = [];
    }
    const defaultColId = kanbanColumns[0]?.id || 'idea';
    for (const post of filteredPosts) {
      if (map[post.status]) {
        map[post.status].push(post);
      } else {
        if (!map[defaultColId]) map[defaultColId] = [];
        map[defaultColId].push(post);
      }
    }
    return map;
  }, [filteredPosts, kanbanColumns]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, post: ContentPost) => {
    setDraggedPostId(post.id);
    e.dataTransfer.setData('text/plain', post.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: ContentStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: ContentStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!canEdit) return;
    const postId = e.dataTransfer.getData('text/plain') || draggedPostId;
    setDraggedPostId(null);

    if (!postId) return;

    const currentPost = posts.find((p) => p.id === postId);
    if (!currentPost || currentPost.status === newStatus) return;

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p))
    );

    try {
      await contentService.updatePostStatus(postId, newStatus);
      const col = kanbanColumns.find((c) => c.id === newStatus);
      setActionNotice(`Status "${currentPost.title}" diubah ke ${col?.title || newStatus}.`);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: unknown) {
      fetchPosts();
      setError(err instanceof Error ? err.message : 'Gagal memperbarui status alur kerja.');
    }
  };

  const handleDuplicate = async (postId: string) => {
    if (!canEdit) return;
    try {
      const cloned = await contentService.duplicatePost(postId);
      setActionNotice(`Konten "${cloned.title}" berhasil diduplikasi.`);
      fetchPosts();
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menduplikasi konten.');
    }
  };

  const handleDelete = async (postId: string, title: string) => {
    if (!canDelete) return;
    if (!window.confirm(`Hapus konten "${title}"?`)) return;
    try {
      await contentService.deletePost(postId);
      setActionNotice(`Konten "${title}" berhasil dihapus.`);
      fetchPosts();
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus konten.');
    }
  };

  const formatScheduledTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return null;
    }
  };

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kanban Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Kanban Workflow</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredPosts.length} Konten
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tarik dan lepas kartu konten antar kolom alur kerja untuk memperbarui status di database Supabase
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari konten..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white w-44"
            />
          </div>

          {/* Platform filter tabs */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            {['all', 'instagram', 'tiktok', 'linkedin'].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer capitalize ${
                  channelFilter === ch
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ch === 'all' ? 'Semua' : ch}
              </button>
            ))}
          </div>

          {canEdit && (
            <>
              <button
                onClick={() => setIsWorkflowModalOpen(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Kustomisasi tahapan dan kolom alur kerja Kanban"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Atur Alur Kerja</span>
              </button>

              <button
                onClick={() => {
                  setNewPostStatus(kanbanColumns[0]?.id || 'idea');
                  setIsNewPostModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Ide</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Notice Banner */}
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
          <button onClick={fetchPosts} className="font-semibold underline cursor-pointer">
            Coba Lagi
          </button>
        </div>
      )}

      {/* KANBAN BOARD COLUMNS */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-16 text-center shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memuat alur kerja dari Supabase...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start overflow-x-auto pb-4">
          {kanbanColumns.map((col) => {
            const colPosts = postsByStatus[col.id] || [];
            const isTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`bg-slate-100/70 border rounded-xl flex flex-col max-h-[78vh] transition-all min-w-[240px] ${
                  isTarget
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-200/80 flex items-center justify-between bg-white/70 rounded-t-xl shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h2 className="text-xs font-bold text-slate-800">{col.title}</h2>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
                      {colPosts.length}
                    </span>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setNewPostStatus(col.id);
                        setIsNewPostModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition cursor-pointer"
                      title={`Tambah di ${col.title}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Column Cards Container */}
                <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
                  {colPosts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      <p className="text-[11px]">Tarik kartu ke sini</p>
                    </div>
                  ) : (
                    colPosts.map((post) => (
                      <div
                        key={post.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, post)}
                        onClick={() => {
                          if (!canEdit) return;
                          setSelectedPost(post);
                          setIsEditModalOpen(true);
                        }}
                        className={`bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all ${
                          canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                        } group space-y-2`}
                      >
                        {/* Channels & Format */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {post.channels.map((ch) => (
                              <span
                                key={ch}
                                className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-700"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                          <FormatBadge format={post.format} />
                        </div>

                        <ContentThumbnail
                          mediaPath={post.media_urls?.[0]}
                          alt={post.title}
                          className="w-full aspect-video"
                        />

                        {/* Title & Caption snippet */}
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 text-xs line-clamp-2">
                            {post.title}
                          </p>
                          {post.caption && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                              {post.caption}
                            </p>
                          )}
                        </div>

                        {/* Pillar and Date */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {post.pillar}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 pt-0.5">
                            {post.production_date && (
                              <span className="flex items-center gap-1 text-indigo-700 font-medium bg-indigo-50/80 px-1.5 py-0.5 rounded">
                                <Video className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>Prod: {formatScheduledTime(post.production_date)}</span>
                              </span>
                            )}
                            {post.scheduled_at && (
                              <span className="flex items-center gap-1 text-purple-700 font-medium bg-purple-50/80 px-1.5 py-0.5 rounded">
                                <Calendar className="w-3 h-3 text-purple-500 shrink-0" />
                                <span>Tayang: {formatScheduledTime(post.scheduled_at)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Hover Action Bar */}
                        {(canEdit || canDelete) && (
                          <div
                            className="pt-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedPost(post);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                                  title="Edit"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDuplicate(post.id)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                                  title="Duplikasi"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(post.id, post.title)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                                title="Hapus"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={isEditModalOpen}
        post={selectedPost}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPost(null);
        }}
        onUpdated={fetchPosts}
        onDeleted={fetchPosts}
        onDuplicated={() => fetchPosts()}
      />

      {/* New Post in Specific Status Modal */}
      {isNewPostModalOpen && (
        <NewPostModal
          isOpen={isNewPostModalOpen}
          brandId={brand.id}
          onClose={() => setIsNewPostModalOpen(false)}
          onSubmit={async (input) => {
            await contentService.createPost({
              ...input,
              status: newPostStatus,
            });
            fetchPosts();
          }}
        />
      )}

      {/* Workflow Settings Modal */}
      <WorkflowSettingsModal
        isOpen={isWorkflowModalOpen}
        brand={brand}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSaved={loadWorkflow}
      />
    </div>
  );
};
