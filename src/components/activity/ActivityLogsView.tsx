import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Filter, RefreshCw } from 'lucide-react';
import { Brand, ActivityLog } from '../../types/database.ts';
import { activityService } from '../../services/database/activityService.ts';
import { Pagination } from '../common/Pagination.tsx';

interface ActivityLogsViewProps {
  brand: Brand | null;
}

const entityLabels: Record<string, string> = {
  content_post: 'Konten',
  brand: 'Brand',
  brand_member: 'Anggota Tim',
  brand_invitation: 'Undangan Tim',
  metric: 'Metrik',
  workflow_status: 'Status Alur Kerja',
};

const statusLabels: Record<string, string> = {
  idea: 'Ide',
  draft: 'Draf',
  in_review: 'Ditinjau',
  approved: 'Disetujui',
  scheduled: 'Terjadwal',
  published: 'Terbit',
};

const roleLabels: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Anggota',
};

function formatLogDetails(details: Record<string, unknown> | null | undefined): string {
  if (!details) return 'Perubahan tersimpan';

  const data = details as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof data.title === 'string' && data.title.trim()) parts.push(data.title.trim());
  if (typeof data.status === 'string' && data.status.trim()) {
    parts.push(statusLabels[data.status] || data.status);
  }
  if (typeof data.name === 'string' && data.name.trim() && !parts.includes(data.name.trim())) {
    parts.push(data.name.trim());
  }
  if (typeof data.role === 'string' && data.role.trim()) {
    parts.push(roleLabels[data.role] || data.role);
  }
  if (typeof data.new_role === 'string' && data.new_role.trim()) {
    parts.push(`Peran: ${roleLabels[data.new_role] || data.new_role}`);
  }
  if (typeof data.removed_role === 'string' && data.removed_role.trim()) {
    parts.push(`Peran: ${roleLabels[data.removed_role] || data.removed_role}`);
  }

  return parts.length ? parts.join(' · ') : 'Perubahan tersimpan';
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ brand }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [actionOptions, setActionOptions] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAction]);

  useEffect(() => {
    if (!brand) {
      setActionOptions([]);
      return;
    }
    let active = true;
    activityService.getActionOptions(brand.id)
      .then((actions) => {
        if (active) setActionOptions(actions);
      })
      .catch(() => {
        if (active) setActionOptions([]);
      });
    return () => {
      active = false;
    };
  }, [brand]);

  const fetchLogs = useCallback(async () => {
    if (!brand) {
      setLogs([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await activityService.getActivities(brand.id, {
        page,
        pageSize,
        search: debouncedSearch,
        action: filterAction,
      });
      setLogs(result.items);
      setTotal(result.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [brand, page, pageSize, debouncedSearch, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [total, pageSize, page]);

  if (!brand) {
    return (
      <div className="p-8 text-center text-slate-500">
        <History className="w-12 h-12 mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Pilih Brand Terlebih Dahulu</h2>
        <p className="text-sm text-slate-500 mt-1">Riwayat perubahan akan tampil di sini untuk setiap brand.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color_hex }} />
            <h1 className="text-xl font-extrabold text-slate-900">Riwayat Aktivitas: {brand.name}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Catatan perubahan konten, brand, dan aktivitas tim.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari tindakan atau bagian aktivitas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-blue-600 cursor-pointer"
          >
            <option value="all">Semua Tindakan</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table / Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Riwayat Peristiwa ({total})</h3>
          <span className="text-[11px] text-slate-400">Waktu Tercatat</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Memuat riwayat aktivitas...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Belum ada catatan aktivitas untuk kriteria ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3">Waktu</th>
                  <th className="px-6 py-3">Pelaku</th>
                  <th className="px-6 py-3">Tindakan</th>
                  <th className="px-6 py-3">Bagian</th>
                  <th className="px-6 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => {
                  const profile = (log as any).profiles;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors text-[11px]">
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-sans font-semibold">
                        {profile?.full_name || 'Sistem'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {entityLabels[log.entity_type] || 'Aktivitas'}
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {formatLogDetails(log.details)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="log"
          />
        )}
      </div>
    </div>
  );
};
