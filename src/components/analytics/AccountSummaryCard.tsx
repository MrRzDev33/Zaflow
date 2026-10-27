import React from 'react';
import {
  UserRound,
  Eye,
  Users,
  Heart,
  UserPlus,
  TrendingUp,
  Calendar,
  Plus,
  Info,
  MousePointerClick,
} from 'lucide-react';
import type { AccountSummary } from '../../services/database/metricsService.ts';
import { TrafficSourceBars } from './insights/TrafficSourceBars.tsx';
import { formatCount, formatPercent } from '../../utils/number.ts';

interface AccountSummaryCardProps {
  summary: AccountSummary;
  onOpenRecord: () => void;
}

function formatMonth(periodMonth: string | null): string {
  if (!periodMonth) return 'Belum ada periode';
  try {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
      new Date(`${periodMonth}-01T00:00:00`)
    );
  } catch {
    return periodMonth;
  }
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
 * Ringkasan akun bulanan — sumber angka total utama di halaman Analitik.
 * Tidak pernah dijumlahkan dengan akumulasi konten.
 */
export const AccountSummaryCard: React.FC<AccountSummaryCardProps> = ({
  summary,
  onOpenRecord,
}) => {
  const channel = summary.channel || 'instagram';
  const isInstagram = channel === 'instagram';
  const followerShare = Number(summary.audienceBreakdown.followers) || 0;
  const nonFollowerShare = Number(summary.audienceBreakdown.nonFollowers) || 0;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
              <UserRound className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Ringkasan Akun</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Sumber angka total
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Total bulanan dari dashboard {isInstagram ? 'profesional Instagram' : channel}. Tidak
            dijumlahkan dengan akumulasi konten.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            <Calendar className="h-3 w-3" />
            {formatMonth(summary.periodMonth)}
          </span>
          <button
            type="button"
            onClick={onOpenRecord}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
          >
            {summary.hasData ? <TrendingUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{summary.hasData ? 'Perbarui' : 'Catat Ringkasan'}</span>
          </button>
        </div>
      </div>

      {!summary.hasData ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs">
            <Info className="h-5 w-5" />
          </span>
          <div className="max-w-sm">
            <p className="text-xs font-semibold text-slate-700">Belum ada ringkasan akun</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Catat total tayangan, reach, dan interaksi akun per bulan. Gunakan AI Metrics
              Extractor mode Ringkasan Akun agar lebih cepat.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRecord}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Catat Ringkasan Akun
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatBox icon={Eye} label="Tayangan" value={formatCount(summary.views)} color="text-blue-600" />
            <StatBox icon={Users} label="Reach" value={formatCount(summary.reach)} color="text-indigo-600" />
            <StatBox icon={Heart} label="Interaksi" value={formatCount(summary.interactions)} color="text-rose-600" />
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
            <StatBox icon={UserPlus} label="Pengikut Baru" value={formatCount(summary.follows)} color="text-teal-600" />
            <StatBox icon={Users} label="Total Pengikut" value={formatCount(summary.followersTotal)} color="text-slate-600" />
            <StatBox
              icon={Calendar}
              label="Diperbarui"
              value={
                summary.updatedAt
                  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(
                      new Date(summary.updatedAt)
                    )
                  : '-'
              }
              color="text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Sumber Tayangan
              </h3>
              <TrafficSourceBars
                items={summary.trafficSources}
                compact
                emptyText="Sumber tayangan akun belum dicatat."
              />
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Pemirsa: Pengikut vs Bukan Pengikut
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
                  Komposisi pemirsa akun pada periode ini, bukan per postingan.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
