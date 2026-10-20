import React from 'react';
import { Eye, Clock, Share2, Heart, Bookmark, Repeat, MessageSquare, TrendingUp, Users, Plus, Info } from 'lucide-react';
import { AnalyticsReportData } from '../../services/database/metricsService.ts';

interface InstagramInsightsCardProps {
  reportData: AnalyticsReportData | null;
  channel?: string;
  onOpenRecord?: () => void;
}

export const InstagramInsightsCard: React.FC<InstagramInsightsCardProps> = ({
  reportData,
  channel = 'all',
  onOpenRecord,
}) => {
  const deep = reportData?.deepInsights;
  const totalReach = reportData?.comparison?.current?.totalReach || 0;
  const avgWatchTime = deep?.avgWatchTime || 'Belum dicatat';
  const dropOffRate = deep?.dropOffRate || 'Belum dicatat';
  const likesCount = reportData?.comparison?.current?.totalLikes || 0;
  const commentsCount = reportData?.comparison?.current?.totalComments || 0;
  const savesCount = reportData?.comparison?.current?.totalSaves || 0;
  const sharesCount = reportData?.comparison?.current?.totalShares || 0;
  const repostsCount = deep?.totalReposts || 0;
  const hasRealData = Boolean(deep?.hasVideoData);

  // Platform styling & text configuration
  const lowerChannel = channel.toLowerCase();
  const isTikTok = lowerChannel === 'tiktok';
  const isInstagram = lowerChannel === 'instagram';
  const isYouTube = lowerChannel === 'youtube';
  const isAll = lowerChannel === 'all';

  let title = 'Analisis Mendalam Seluruh Platform';
  let subtitle = 'Metrik performa video & interaksi terakumulasi dari seluruh saluran aktif';
  let badgeText = 'Semua Platform Terakumulasi';
  let badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
  let dotClass = 'bg-blue-600';
  let watchTimeLabel = 'Average Watch Time (Video)';
  let dropOffLabel = 'Tingkat Lewati (Drop-off Rate)';

  if (isTikTok) {
    title = 'Analisis Mendalam & Ringkasan TikTok';
    subtitle = 'Metrik khusus video TikTok (Waktu tonton, retensi penonton, repost, dan sumber tayangan FYP)';
    badgeText = 'Fokus Platform: TikTok';
    badgeClass = 'bg-slate-900 text-cyan-300 border-slate-700';
    dotClass = 'bg-gradient-to-r from-cyan-400 to-pink-500';
    watchTimeLabel = 'Waktu Tonton Rata-rata (TikTok)';
    dropOffLabel = 'Tingkat Lewati / Drop-off (TikTok)';
  } else if (isInstagram) {
    title = 'Analisis Mendalam & Ringkasan Instagram';
    subtitle = 'Metrik khusus performa Reels & Feed Instagram (Watch time, drop-off, interaksi, dan pemirsa)';
    badgeText = 'Fokus Platform: Instagram';
    badgeClass = 'bg-pink-50 text-pink-700 border-pink-200';
    dotClass = 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600';
    watchTimeLabel = 'Average Watch Time (Reels / Video)';
    dropOffLabel = 'Tingkat Lewati (Drop-off / Skip Rate)';
  } else if (isYouTube) {
    title = 'Analisis Mendalam & Ringkasan YouTube';
    subtitle = 'Metrik khusus performa Shorts & Video YouTube (Watch time, penelusuran, dan interaksi)';
    badgeText = 'Fokus Platform: YouTube';
    badgeClass = 'bg-red-50 text-red-700 border-red-200';
    dotClass = 'bg-red-600';
    watchTimeLabel = 'Average Watch Time (Shorts / Video)';
    dropOffLabel = 'Tingkat Penonton Keluar (Drop-off)';
  } else if (!isAll) {
    const formattedChannelName = channel.charAt(0).toUpperCase() + channel.slice(1);
    title = `Analisis Mendalam & Ringkasan ${formattedChannelName}`;
    subtitle = `Metrik performa konten dan interaksi untuk saluran ${formattedChannelName}`;
    badgeText = `Fokus Platform: ${formattedChannelName}`;
    badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    dotClass = 'bg-slate-600';
    watchTimeLabel = `Average Watch Time (${formattedChannelName})`;
    dropOffLabel = `Tingkat Drop-off (${formattedChannelName})`;
  }

  const trafficSources = deep?.trafficSources || [];
  const audienceBreakdown = deep?.audienceBreakdown || { followers: 0, nonFollowers: 0 };

  // Calculate real accounts reached
  const followerAccounts = audienceBreakdown.followers > 0 && totalReach > 0
    ? Math.round(totalReach * (audienceBreakdown.followers / 100))
    : 0;
  const nonFollowerAccounts = audienceBreakdown.nonFollowers > 0 && totalReach > 0
    ? Math.round(totalReach * (audienceBreakdown.nonFollowers / 100))
    : 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${dotClass}`} />
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-xs px-3 py-1 font-semibold rounded-full border self-start sm:self-auto ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      {/* Info Notice jika belum ada input metrik mendalam */}
      {!hasRealData && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Belum ada metrik mendalam video tercatat untuk {badgeText.replace('Fokus Platform: ', '')}</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Nilai watch time, drop-off rate, dan traffic sources tidak menggunakan data dummy. Catat nilai riil dari dashboard analitik Anda atau ekstrak instan lewat AI Metrics Extractor.
              </p>
            </div>
          </div>
          {onOpenRecord && (
            <button
              onClick={onOpenRecord}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shrink-0 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Metrik Sekarang</span>
            </button>
          )}
        </div>
      )}

      {/* Video Watch Time & Drop-off Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              {watchTimeLabel}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white">{avgWatchTime}</span>
              {hasRealData && avgWatchTime !== 'Belum dicatat' && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center">
                  Data Aktual
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Durasi rata-rata penonton menghabiskan waktu pada konten video Anda.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-pink-400 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
              {dropOffLabel}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{dropOffRate}</span>
              {hasRealData && dropOffRate !== 'Belum dicatat' && (
                <span className="text-xs text-slate-600 font-semibold">
                  Retensi: {(100 - parseFloat(dropOffRate)).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Persentase penonton yang melewati video pada detik-detik awal.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-200/60 flex items-center justify-center text-slate-700 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Ringkasan Lengkap Interaksi */}
      <div>
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Ringkasan Interaksi Nyata ({badgeText})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Jumlah Suka</span>
            <span className="text-sm font-extrabold text-slate-900">{likesCount.toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <MessageSquare className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Komentar</span>
            <span className="text-sm font-extrabold text-slate-900">{commentsCount.toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <Bookmark className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Simpan / Favorit</span>
            <span className="text-sm font-extrabold text-slate-900">{savesCount.toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <Share2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Bagikan</span>
            <span className="text-sm font-extrabold text-slate-900">{sharesCount.toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <Repeat className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Posting Ulang / Repost</span>
            <span className="text-sm font-extrabold text-slate-900">{repostsCount.toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
            <Eye className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
            <span className="text-[10px] text-slate-500 block font-medium">Total Jangkauan</span>
            <span className="text-sm font-extrabold text-slate-900">{totalReach.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Sumber Tayangan Teratas & Analisis Pemirsa (Pengikut vs Bukan Pengikut) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Sumber Tayangan Teratas */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Sumber Tayangan Teratas ({isTikTok ? 'FYP / Following / Profile' : isInstagram ? 'Reels / Feed / Explore' : 'Top Traffic Sources'})
          </h3>
          <div className="space-y-2.5">
            {trafficSources.map((source) => (
              <div key={source.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{source.name}</span>
                  <span className="font-bold text-slate-900">{source.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${source.color}`}
                    style={{ width: `${Math.min(100, Math.max(0, source.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pemirsa: Pengikut vs Bukan Pengikut */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Demografi Pemirsa: Pengikut vs Bukan Pengikut</span>
          </h3>

          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Pengikut: {audienceBreakdown.followers}%</span>
                <span>Bukan Pengikut: {audienceBreakdown.nonFollowers}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-indigo-600 h-full transition-all"
                  style={{ width: `${audienceBreakdown.followers}%` }}
                  title="Pengikut"
                />
                <div
                  className="bg-purple-500 h-full transition-all"
                  style={{ width: `${audienceBreakdown.nonFollowers}%` }}
                  title="Bukan Pengikut"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">Jangkauan Pengikut</span>
                  <span className="font-bold text-slate-800">
                    {followerAccounts > 0 ? `${followerAccounts.toLocaleString('id-ID')} akun` : '0 akun'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">Jangkauan Baru (Bukan Pengikut)</span>
                  <span className="font-bold text-slate-800">
                    {nonFollowerAccounts > 0 ? `${nonFollowerAccounts.toLocaleString('id-ID')} akun` : '0 akun'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
