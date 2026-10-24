import React, { useState } from 'react';
import { History, Eye, Edit, Trash2 } from 'lucide-react';
import { ContentMetric, ContentPost } from '../../types/database.ts';
import { MetricDetailModal } from './MetricDetailModal.tsx';
import { Pagination } from '../common/Pagination.tsx';
import { usePagination } from '../../hooks/usePagination.ts';

interface MetricHistoryTableProps {
  snapshots: (ContentMetric & { post?: ContentPost | null })[];
  onEdit: (metric: ContentMetric) => void;
  onDelete: (metricId: string) => void;
}

export const MetricHistoryTable: React.FC<MetricHistoryTableProps> = ({
  snapshots,
  onEdit,
  onDelete,
}) => {
  const [selectedMetricForView, setSelectedMetricForView] = useState<
    (ContentMetric & { post?: ContentPost | null }) | null
  >(null);
  const {
    page,
    pageSize,
    totalItems,
    pageItems,
    goToPage,
    changePageSize,
  } = usePagination(snapshots, { initialPageSize: 10 });

  const formatDate = (isoString: string) => {
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

  const channelBadgeClass = (ch: string) => {
    switch (ch.toLowerCase()) {
      case 'instagram':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'tiktok':
        return 'bg-slate-900 text-cyan-300 border-slate-700';
      case 'youtube':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Riwayat Snapshot Metrik (Data Historis)</h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {snapshots.length} Snapshot Tercatat
        </span>
      </div>

      {snapshots.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Belum ada snapshot metrik tercatat pada periode ini. Gunakan tombol &quot;Catat Metrik&quot; atau &quot;AI Metrics Extractor&quot; untuk mencatat data performa pertama Anda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-3">Waktu Snapshot</th>
                <th className="py-2.5 px-3">Postingan / Hook</th>
                <th className="py-2.5 px-3">Saluran</th>
                <th className="py-2.5 px-2 text-right">Impressions</th>
                <th className="py-2.5 px-2 text-right">Reach</th>
                <th className="py-2.5 px-2 text-right">Likes</th>
                <th className="py-2.5 px-2 text-right">Comments</th>
                <th className="py-2.5 px-2 text-right">Shares</th>
                <th className="py-2.5 px-2 text-right">Saves</th>
                <th className="py-2.5 px-2 text-right">ER (%)</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                    <span className="font-mono text-[11px]">{formatDate(item.recorded_at)}</span>
                  </td>

                  <td className="py-2.5 px-3 max-w-[200px]">
                    <span className="font-semibold text-slate-800 line-clamp-1">
                      {item.post?.title || 'Metrik Umum Akun/Brand'}
                    </span>
                    {item.post?.pillar && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {item.post.pillar}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`uppercase text-[9px] font-bold px-1.5 py-0.5 rounded border ${channelBadgeClass(
                        item.channel
                      )}`}
                    >
                      {item.channel}
                    </span>
                  </td>

                  <td className="py-2.5 px-2 text-right font-medium text-slate-700">
                    {(item.impressions || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                    {(item.reach || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right text-slate-600">
                    {(item.likes || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right text-slate-600">
                    {(item.comments || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right text-slate-600">
                    {(item.shares || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right text-slate-600">
                    {(item.saves || 0).toLocaleString('id-ID')}
                  </td>

                  <td className="py-2.5 px-2 text-right font-bold text-purple-700">
                    {item.engagement_rate}%
                  </td>

                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Tombol Lihat Semua Data yang Diinput */}
                      <button
                        onClick={() => setSelectedMetricForView(item)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-blue-200"
                        title="Lihat seluruh data yang telah diinput untuk snapshot ini"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>

                      <button
                        onClick={() => onEdit(item)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer"
                        title="Edit Snapshot"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition cursor-pointer"
                        title="Hapus Snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        itemLabel="snapshot"
      />

      {/* Modal Detail Melihat Semua Data Snapshot */}
      <MetricDetailModal
        isOpen={Boolean(selectedMetricForView)}
        metric={selectedMetricForView}
        onClose={() => setSelectedMetricForView(null)}
        onEdit={(metric) => {
          setSelectedMetricForView(null);
          onEdit(metric);
        }}
        onDelete={(metricId) => {
          setSelectedMetricForView(null);
          onDelete(metricId);
        }}
      />
    </div>
  );
};
