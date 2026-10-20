import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  LayoutGrid,
  List,
  Edit,
  Copy,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  Database,
  CheckCircle2,
  Clock,
  Video,
  Sliders,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { Brand, ContentPost, WorkflowStatusConfig } from '../../types/database.ts';
import { contentService, isPublishedStatus } from '../../services/database/contentService.ts';
import { workflowSettingsService } from '../../services/database/workflowSettingsService.ts';
import { ContentFilterBar, FilterState } from './ContentFilterBar.tsx';
import { StatusBadge, FormatBadge } from '../common/Badges.tsx';
import { EditPostModal } from './EditPostModal.tsx';
import { WorkflowSettingsModal } from './WorkflowSettingsModal.tsx';
import { ContentThumbnail } from './ContentThumbnail.tsx';

interface ContentDatabaseViewProps {
  brand: Brand | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpenNewPost: () => void;
}

const initialFilters: FilterState = {
  search: '',
  channel: 'all',
  pillar: 'all',
  status: 'all',
  format: 'all',
};

export const ContentDatabaseView: React.FC<ContentDatabaseViewProps> = ({
  brand,
  canEdit = true,
  canDelete = true,
  onOpenNewPost,
}) => {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Fitur Pengelompokan Konten per Bulan
  const [groupByMonth, setGroupByMonth] = useState<boolean>(true);
  const [monthGroupByField, setMonthGroupByField] = useState<'scheduled' | 'production'>('scheduled');
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // Pilar & Status Kustom Brand
  const [customPillars, setCustomPillars] = useState<string[]>([]);
  const [customStatuses, setCustomStatuses] = useState<WorkflowStatusConfig[]>([]);

  const loadBrandWorkflow = useCallback(() => {
    if (brand) {
      setCustomPillars(workflowSettingsService.getPillars(brand));
      setCustomStatuses(workflowSettingsService.getWorkflowStatuses(brand));
    }
  }, [brand]);

  useEffect(() => {
    loadBrandWorkflow();
    const handleUpdate = () => loadBrandWorkflow();
    window.addEventListener('zaflow_workflow_updated', handleUpdate);
    return () => window.removeEventListener('zaflow_workflow_updated', handleUpdate);
  }, [loadBrandWorkflow]);

  const fetchPosts = useCallback(async () => {
    if (!brand) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await contentService.getPosts(brand.id, filters);
      setPosts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat database konten.');
    } finally {
      setLoading(false);
    }
  }, [brand, filters]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleEditClick = (post: ContentPost) => {
    if (!canEdit) return;
    setSelectedPost(post);
    setIsEditModalOpen(true);
  };

  const handleDuplicateClick = async (postId: string) => {
    if (!canEdit) return;
    try {
      const cloned = await contentService.duplicatePost(postId);
      setActionSuccessMessage(`Postingan "${cloned.title}" berhasil diduplikasi ke draf.`);
      fetchPosts();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menduplikasi konten.');
    }
  };

  const handleDeleteClick = async (post: ContentPost) => {
    if (!canDelete) return;
    if (!window.confirm(`Yakin ingin menghapus postingan "${post.title}"?`)) return;

    try {
      await contentService.deletePost(post.id);
      setActionSuccessMessage(`Postingan "${post.title}" berhasil dihapus.`);
      fetchPosts();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus konten.');
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  // Toggle Collapse Grup Bulan
  const toggleMonthCollapse = (key: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Kalkulasi pengelompokan per bulan
  const monthGroups = useMemo(() => {
    if (!groupByMonth) return null;

    const groupsMap: Record<string, { label: string; posts: ContentPost[]; sortDate: number }> = {};

    posts.forEach((post) => {
      const targetDateStr =
        monthGroupByField === 'production'
          ? (post.production_date || post.scheduled_at)
          : (post.scheduled_at || post.production_date);

      if (!targetDateStr) {
        if (!groupsMap['unscheduled']) {
          groupsMap['unscheduled'] = {
            label: 'Belum Dijadwalkan',
            posts: [],
            sortDate: 0,
          };
        }
        groupsMap['unscheduled'].posts.push(post);
        return;
      }

      try {
        const d = new Date(targetDateStr);
        if (isNaN(d.getTime())) throw new Error();
        const year = d.getFullYear();
        const monthNum = d.getMonth() + 1;
        const key = `${year}-${monthNum.toString().padStart(2, '0')}`;
        const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);

        if (!groupsMap[key]) {
          groupsMap[key] = {
            label,
            posts: [],
            sortDate: new Date(year, d.getMonth(), 1).getTime(),
          };
        }
        groupsMap[key].posts.push(post);
      } catch {
        if (!groupsMap['unscheduled']) {
          groupsMap['unscheduled'] = {
            label: 'Belum Dijadwalkan',
            posts: [],
            sortDate: 0,
          };
        }
        groupsMap['unscheduled'].posts.push(post);
      }
    });

    const sortedKeys = Object.keys(groupsMap).sort((a, b) => {
      if (a === 'unscheduled') return 1;
      if (b === 'unscheduled') return -1;
      return groupsMap[b].sortDate - groupsMap[a].sortDate;
    });

    return sortedKeys.map((key) => ({
      key,
      label: groupsMap[key].label,
      count: groupsMap[key].posts.length,
      posts: groupsMap[key].posts,
    }));
  }, [posts, groupByMonth, monthGroupByField]);

  // Helper render tabel konten
  const renderTable = (items: ContentPost[]) => (
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <th className="py-3 px-3">Gambar</th>
              <th className="py-3 px-4">Judul & Copywriting</th>
              <th className="py-3 px-3">Saluran</th>
              <th className="py-3 px-3">Format</th>
              <th className="py-3 px-3">Pilar</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Tgl Produksi</th>
              <th className="py-3 px-3">Jadwal Tayang</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((post) => (
              <tr key={post.id} className="hover:bg-slate-50/60 transition-colors group">
                <td className="py-3 px-3">
                  <ContentThumbnail
                    mediaPath={post.media_urls?.[0]}
                    alt={post.title}
                    className="w-12 h-12"
                    onClick={() => handleEditClick(post)}
                  />
                </td>
                <td className="py-3 px-4 max-w-xs sm:max-w-md">
                  <div className="flex items-center gap-1.5">
                    <p
                      onClick={() => handleEditClick(post)}
                      className="font-bold text-slate-900 group-hover:text-blue-600 cursor-pointer line-clamp-1 text-xs"
                    >
                      {post.title}
                    </p>
                    {post.post_url && isPublishedStatus(post.status) && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-500 hover:text-blue-700 shrink-0"
                        title="Buka link postingan"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  {post.brief && (
                    <p className="text-[10px] text-indigo-600 line-clamp-1 mt-0.5 font-medium">
                      Brief: {post.brief}
                    </p>
                  )}
                  {post.caption && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                      {post.caption}
                    </p>
                  )}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {post.hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] text-blue-600 font-medium">
                          {tag}
                        </span>
                      ))}
                      {post.hashtags.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{post.hashtags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {post.channels.map((ch) => (
                      <span
                        key={ch}
                        className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <FormatBadge format={post.format} />
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {post.pillar}
                  </span>
                </td>

                <td className="py-3 px-3 whitespace-nowrap">
                  <StatusBadge status={post.status} />
                </td>

                {/* Kolom Tanggal Produksi */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {post.production_date ? (
                    <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-md text-[11px] font-medium inline-flex">
                      <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{formatDateTime(post.production_date)}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">-</span>
                  )}
                </td>

                {/* Kolom Jadwal Tayang */}
                <td className="py-3 px-3 whitespace-nowrap">
                  {post.scheduled_at ? (
                    <div className="flex items-center gap-1.5 text-purple-700 bg-purple-50/80 px-2 py-1 rounded-md text-[11px] font-medium inline-flex">
                      <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span>{formatDateTime(post.scheduled_at)}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">Belum terjadwal</span>
                  )}
                </td>

                <td className="py-3 px-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    {post.post_url && isPublishedStatus(post.status) && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Lihat Postingan"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {canEdit && (
                      <>
                        <button
                          onClick={() => handleEditClick(post)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Post"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateClick(post.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Duplikasi Konten"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteClick(post)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Konten"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Helper render kartu grid konten
  const renderGrid = (items: ContentPost[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((post) => (
        <div
          key={post.id}
          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between group"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                {post.channels.map((ch) => (
                  <span
                    key={ch}
                    className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <StatusBadge status={post.status} />
            </div>

            <ContentThumbnail
              mediaPath={post.media_urls?.[0]}
              alt={post.title}
              className="w-full aspect-video"
              onClick={() => handleEditClick(post)}
            />

            <div>
              <div className="flex items-start gap-1.5">
                <h3
                  onClick={() => handleEditClick(post)}
                  className="font-bold text-slate-900 group-hover:text-blue-600 cursor-pointer text-sm line-clamp-2"
                >
                  {post.title}
                </h3>
                {post.post_url && isPublishedStatus(post.status) && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 shrink-0 mt-0.5"
                    title="Lihat Postingan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {post.brief && (
                <p className="text-[11px] text-indigo-600 line-clamp-2 mt-1 font-medium">
                  Brief: {post.brief}
                </p>
              )}
              {post.caption && (
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-normal">
                  {post.caption}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs">
              <FormatBadge format={post.format} />
              <span className="text-slate-300">•</span>
              <span className="text-slate-700 text-xs font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                {post.pillar}
              </span>
            </div>

            {/* Indikator Tanggal Produksi & Tanggal Tayang */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              {post.production_date && (
                <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded text-[11px] font-medium">
                  <Video className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Prod: {formatDateTime(post.production_date)}</span>
                </div>
              )}
              {post.scheduled_at && (
                <div className="flex items-center gap-1.5 text-purple-700 bg-purple-50/70 px-2 py-0.5 rounded text-[11px] font-medium">
                  <Calendar className="w-3 h-3 text-purple-500 shrink-0" />
                  <span>Tayang: {formatDateTime(post.scheduled_at)}</span>
                </div>
              )}
              {!post.production_date && !post.scheduled_at && (
                <span className="text-[11px] text-slate-400 italic">Belum dijadwalkan</span>
              )}
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-1">
              {canEdit && (
                <>
                  <button
                    onClick={() => handleEditClick(post)}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicateClick(post.id)}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                    title="Duplikasi"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDeleteClick(post)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (!brand) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto">
        <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800">Pilih atau buat brand terlebih dahulu</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* View Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">Perencanaan & Database Konten</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              {posts.length} Konten
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola arsip konten, jadwal produksi, jadwal tayang, pilar, dan tahapan alur kerja untuk <strong>{brand.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Tombol Toggle Kelompokkan per Bulan */}
          <button
            onClick={() => setGroupByMonth(!groupByMonth)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              groupByMonth
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Kelompokkan konten per bulan"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{groupByMonth ? 'Dikelompokkan per Bulan' : 'Tampilan Datar'}</span>
          </button>

          {/* Pemilih dasar pengelompokan (Posting vs Produksi) jika mode bulan aktif */}
          {groupByMonth && (
            <select
              value={monthGroupByField}
              onChange={(e) => setMonthGroupByField(e.target.value as 'scheduled' | 'production')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Dasar tanggal pengelompokan bulan"
            >
              <option value="scheduled">Bulan Tayang</option>
              <option value="production">Bulan Produksi</option>
            </select>
          )}

          {/* Tombol Buka Modal Pengaturan Pilar & Alur Kerja */}
          {canEdit && (
            <button
              onClick={() => setIsWorkflowModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Kustomisasi pilar konten dan status alur kerja kanban"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span>Atur Pilar & Status</span>
            </button>
          )}

          {/* Switch View Mode */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Kartu (Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {canEdit && (
            <button
              onClick={onOpenNewPost}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Konten</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPosts}
            className="text-xs font-semibold underline text-red-800 hover:text-red-900 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Filter Bar dengan Pilar & Status Kustom */}
      <ContentFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(initialFilters)}
        customPillars={customPillars}
        customStatuses={customStatuses}
      />

      {/* Content Area */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Memuat data konten dari Supabase...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-slate-800">Tidak Ada Konten Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {filters.search || filters.channel !== 'all' || filters.pillar !== 'all' || filters.status !== 'all'
              ? 'Tidak ada konten yang sesuai dengan filter yang Anda tentukan. Coba ubah atau reset kata kunci pencarian.'
              : 'Belum ada konten di database brand ini. Buat konten pertama Anda sekarang.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {filters.search || filters.channel !== 'all' || filters.pillar !== 'all' || filters.status !== 'all' ? (
              <button
                onClick={() => setFilters(initialFilters)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Reset Semua Filter
              </button>
            ) : canEdit ? (
              <button
                onClick={onOpenNewPost}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Konten Pertama</span>
              </button>
            ) : (
              <p className="text-xs text-slate-400">Hubungi owner/admin untuk menambahkan konten.</p>
            )}
          </div>
        </div>
      ) : groupByMonth && monthGroups ? (
        /* KELOMPOK PER BULAN VIEW */
        <div className="space-y-6">
          {monthGroups.map((group) => {
            const isCollapsed = !!collapsedMonths[group.key];

            return (
              <div key={group.key} className="space-y-3">
                {/* Header Seksi Bulan */}
                <div
                  onClick={() => toggleMonthCollapse(group.key)}
                  className="flex items-center justify-between px-4 py-2.5 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-blue-600" />
                      <h2 className="text-sm font-bold text-slate-900">{group.label}</h2>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-700 font-bold border border-slate-200 shadow-2xs">
                      {group.count} Konten
                    </span>
                  </div>

                  <span className="text-[11px] font-medium text-slate-500">
                    {isCollapsed ? 'Klik untuk membuka' : 'Klik untuk menutup'}
                  </span>
                </div>

                {/* Konten Bulan Ini */}
                {!isCollapsed && (
                  <div>
                    {viewMode === 'table' ? renderTable(group.posts) : renderGrid(group.posts)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* TAMPILAN DATAR (NON-GROUPED) */
        viewMode === 'table' ? renderTable(posts) : renderGrid(posts)
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

      {/* Workflow & Pillar Settings Modal */}
      <WorkflowSettingsModal
        isOpen={isWorkflowModalOpen}
        brand={brand}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSaved={() => {
          loadBrandWorkflow();
          fetchPosts();
        }}
      />
    </div>
  );
};
