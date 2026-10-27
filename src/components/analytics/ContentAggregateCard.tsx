import React from 'react';
import {
  Layers,
  Eye,
  Users,
  Heart,
  TrendingUp,
  MousePointerClick,
  UserPlus,
  FileStack,
} from 'lucide-react';
import type { ContentAggregateSummary } from '../../services/database/metricsService.ts';
import { TrafficSourceBars } from './insights/TrafficSourceBars.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface ContentAggregateCardProps {
  summary: ContentAggregateSummary;
}

const StatBox: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
  </div>
);

/**
 * Akumulasi snapshot per konten. Bersifat pelengkap: reach bisa tumpang tindih,
 * jadi angkanya tidak boleh dianggap reach unik atau dijumlahkan dengan akun.
 */
export const ContentAggregateCard: React.FC<ContentAggregateCardProps> = ({ summary }) => {
  const followerShare = Number(summary.audienceBreakdown.followers) || 0;
  const nonFollowerShare = Number(summary.audienceBreakdown.nonFollowers) || 0;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Akumulasi Konten</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Dari snapshot
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Penjumlahan snapshot per postingan pada periode ini. Reach bisa tumpang tindih, jadi
            bukan reach unik.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            <FileStack className="h-3 w-3" />
            {formatCount(summary.snapshotCount)} snapshot
          </span>
          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            <Layers className="h-3 w-3" />
            {formatCount(summary.postCount)} postingan
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatBox icon={Eye} label="Impressions" value={formatCount(summary.impressions)} color="text-blue-600" />
        <StatBox icon={Users} label="Reach" value={formatCount(summary.reach)} color="text-indigo-600" />
        <StatBox icon={Heart} label="Engagements" value={formatCount(summary.engagements)} color="text-rose-600" />
        <StatBox
          icon={TrendingUp}
          label="Engagement Rate"
          value={formatPercent(summary.engagementRate)}
          color="text-emerald-600"
        />
        <StatBox
          icon={MousePointerClick}
          label="Kunjungan Profil"
          value={formatCount(summary.profileVisits)}
          color="text-amber-600"
        />
        <StatBox icon={UserPlus} label="Follow" value={formatCount(summary.follows)} color="text-teal-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Rata-rata Sumber Tayangan
          </h3>
          <TrafficSourceBars
            items={summary.trafficSources}
            compact
            emptyText="Sumber tayangan konten belum dicatat."
          />
        </div>

        <div>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Rata-rata Pemirsa
          </h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
              <span>Pengikut {formatPercent(followerShare)}</span>
              <span>Bukan Pengikut {formatPercent(nonFollowerShare)}</span>
            </div>
            <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="bg-indigo-600" style={{ width: `${Math.min(100, Math.max(0, followerShare))}%` }} />
              <div
                className="bg-purple-500"
                style={{ width: `${Math.min(100, Math.max(0, nonFollowerShare))}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Rata-rata persentase dari snapshot yang mencatat data pemirsa.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
