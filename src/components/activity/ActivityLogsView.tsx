import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Filter, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Brand, ActivityLog } from '../../types/database.ts';
import { activityService } from '../../services/database/activityService.ts';

interface ActivityLogsViewProps {
  brand: Brand | null;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({ brand }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    if (!brand) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await activityService.getRecentActivities(brand.id, 50);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!brand) {
    return (
      <div className="p-8 text-center text-slate-500">
        <History className="w-12 h-12 mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Pilih Brand Terlebih Dahulu</h2>
        <p className="text-sm text-slate-500 mt-1">Log aktivitas dicatat secara real-time untuk setiap brand.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color_hex }} />
            <h1 className="text-xl font-extrabold text-slate-900">Log Aktivitas & Audit Trail: {brand.name}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan timestamp server untuk autentikasi, perubahan konten, revisi brand, dan operasional tim.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari aktivitas atau tindakan..."
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
            {uniqueActions.map((action) => (
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
          <h3 className="font-bold text-sm text-slate-800">Riwayat Peristiwa ({filteredLogs.length})</h3>
          <span className="text-[11px] text-slate-400">Timestamp Server Terverifikasi</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Memuat log aktivitas...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Belum ada catatan aktivitas untuk kriteria ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3">Waktu Server</th>
                  <th className="px-6 py-3">Aktor / User</th>
                  <th className="px-6 py-3">Jenis Tindakan</th>
                  <th className="px-6 py-3">Entitas</th>
                  <th className="px-6 py-3">Ringkasan Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => {
                  const profile = (log as any).profiles;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors font-mono text-[11px]">
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-sans font-semibold">
                        {profile?.full_name || log.user_id?.slice(0, 8) || 'Sistem / Anonim'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{log.entity_type}</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
