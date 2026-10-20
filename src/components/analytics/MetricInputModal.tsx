import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, BarChart2, Calculator, AlertCircle, Calendar } from 'lucide-react';
import { ContentMetric, ContentPost } from '../../types/database.ts';
import { metricsService, metricFormulas, CreateMetricInput, UpdateMetricInput } from '../../services/database/metricsService.ts';

interface MetricInputModalProps {
  isOpen: boolean;
  brandId: string;
  posts: ContentPost[];
  initialMetric?: ContentMetric | null;
  initialPostId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export const MetricInputModal: React.FC<MetricInputModalProps> = ({
  isOpen,
  brandId,
  posts,
  initialMetric,
  initialPostId = null,
  onClose,
  onSaved,
}) => {
  const [postId, setPostId] = useState<string>('');
  const [channel, setChannel] = useState<string>('instagram');
  const [impressions, setImpressions] = useState<number>(0);
  const [reach, setReach] = useState<number>(0);
  const [likes, setLikes] = useState<number>(0);
  const [comments, setComments] = useState<number>(0);
  const [shares, setShares] = useState<number>(0);
  const [saves, setSaves] = useState<number>(0);
  const [clicks, setClicks] = useState<number>(0);
  const [recordedAt, setRecordedAt] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });
  // Deep metrics states
  const [watchTime, setWatchTime] = useState<string>('');
  const [dropOffRate, setDropOffRate] = useState<string | number>('');
  const [reposts, setReposts] = useState<number>(0);
  const [trafficReels, setTrafficReels] = useState<number>(0);
  const [trafficFeed, setTrafficFeed] = useState<number>(0);
  const [trafficExplore, setTrafficExplore] = useState<number>(0);
  const [trafficProfile, setTrafficProfile] = useState<number>(0);
  const [audienceFollowers, setAudienceFollowers] = useState<number>(0);
  const [audienceNonFollowers, setAudienceNonFollowers] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMetric) {
      setPostId(initialMetric.post_id || '');
      setChannel(initialMetric.channel || 'instagram');
      setImpressions(initialMetric.impressions || 0);
      setReach(initialMetric.reach || 0);
      setLikes(initialMetric.likes || 0);
      setComments(initialMetric.comments || 0);
      setShares(initialMetric.shares || 0);
      setSaves(initialMetric.saves || 0);
      setClicks(initialMetric.clicks || 0);

      const raw = (initialMetric.raw_ai_analysis || {}) as Record<string, any>;
      setWatchTime(String(initialMetric.watch_time || raw.watch_time || ''));
      setDropOffRate(initialMetric.drop_off_rate ?? raw.drop_off_rate ?? '');
      setReposts(Number(initialMetric.reposts ?? raw.reposts ?? 0));
      const ts = initialMetric.traffic_sources || raw.traffic_sources || {};
      setTrafficReels(Number(ts.reels || 0));
      setTrafficFeed(Number(ts.feed || 0));
      setTrafficExplore(Number(ts.explore || 0));
      setTrafficProfile(Number(ts.profile || 0));
      const aud = initialMetric.audience_breakdown || raw.audience_breakdown || {};
      setAudienceFollowers(Number(aud.followers || 0));
      setAudienceNonFollowers(Number(aud.non_followers || 0));

      if (initialMetric.recorded_at) {
        try {
          const d = new Date(initialMetric.recorded_at);
          const tzOffset = d.getTimezoneOffset() * 60000;
          setRecordedAt(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
        } catch {
          setRecordedAt(new Date().toISOString().slice(0, 16));
        }
      }
    } else {
      const preferredPostId =
        initialPostId && posts.some((post) => post.id === initialPostId)
          ? initialPostId
          : posts[0]?.id || '';
      setPostId(preferredPostId);
      setChannel('instagram');
      setImpressions(0);
      setReach(0);
      setLikes(0);
      setComments(0);
      setShares(0);
      setSaves(0);
      setClicks(0);
      setWatchTime('');
      setDropOffRate('');
      setReposts(0);
      setTrafficReels(0);
      setTrafficFeed(0);
      setTrafficExplore(0);
      setTrafficProfile(0);
      setAudienceFollowers(0);
      setAudienceNonFollowers(0);
      setRecordedAt(new Date().toISOString().slice(0, 16));
    }
    setError(null);
  }, [initialMetric, initialPostId, posts]);

  if (!isOpen) return null;

  // Real-time formula preview calculation
  const totalEng = metricFormulas.totalEngagements(likes, comments, shares, saves);
  const previewER = metricFormulas.engagementRate(totalEng, reach, impressions);
  const previewSaveRate = metricFormulas.saveRate(saves, reach);
  const previewShareRate = metricFormulas.shareRate(shares, reach);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const recordedISO = recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString();
      const deepFields = {
        watch_time: watchTime.trim() ? watchTime.trim() : null,
        drop_off_rate: dropOffRate !== '' ? Number(dropOffRate) : null,
        reposts: Number(reposts) || 0,
        traffic_sources: {
          reels: Number(trafficReels) || 0,
          feed: Number(trafficFeed) || 0,
          explore: Number(trafficExplore) || 0,
          profile: Number(trafficProfile) || 0,
        },
        audience_breakdown: {
          followers: Number(audienceFollowers) || 0,
          non_followers: Number(audienceNonFollowers) || 0,
        },
      };

      if (initialMetric) {
        // Update existing snapshot
        const updatePayload: UpdateMetricInput = {
          channel,
          impressions: Number(impressions),
          reach: Number(reach),
          likes: Number(likes),
          comments: Number(comments),
          shares: Number(shares),
          saves: Number(saves),
          clicks: Number(clicks),
          recorded_at: recordedISO,
          ...deepFields,
        };
        await metricsService.updateMetric(initialMetric.id, updatePayload);
      } else {
        // Create new snapshot
        const createPayload: CreateMetricInput = {
          brand_id: brandId,
          post_id: postId || null,
          channel,
          impressions: Number(impressions),
          reach: Number(reach),
          likes: Number(likes),
          comments: Number(comments),
          shares: Number(shares),
          saves: Number(saves),
          clicks: Number(clicks),
          source: 'manual',
          recorded_at: recordedISO,
          ...deepFields,
        };
        await metricsService.createMetric(createPayload);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan metrik ke database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialMetric ? 'Edit Snapshot Metrik' : 'Catat Snapshot Metrik Konten'}
              </h2>
              <p className="text-xs text-slate-500">
                Data akan tersimpan dengan tanggal snapshot untuk pelacakan tren historis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Post Selection & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tautkan ke Postingan
              </label>
              <select
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Metrik Umum Akun / Tanpa Post --</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.pillar})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saluran Media Sosial *
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white capitalize"
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
          </div>

          {/* Snapshot Date Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tanggal & Waktu Snapshot * (Untuk Analisis Historis)
            </label>
            <input
              type="datetime-local"
              required
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Impressions (Views)
              </label>
              <input
                type="number"
                min="0"
                value={impressions}
                onChange={(e) => setImpressions(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reach (Jangkauan)
              </label>
              <input
                type="number"
                min="0"
                value={reach}
                onChange={(e) => setReach(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Likes (Suka)
              </label>
              <input
                type="number"
                min="0"
                value={likes}
                onChange={(e) => setLikes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comments
              </label>
              <input
                type="number"
                min="0"
                value={comments}
                onChange={(e) => setComments(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shares (Dibagikan)
              </label>
              <input
                type="number"
                min="0"
                value={shares}
                onChange={(e) => setShares(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saves (Disimpan)
              </label>
              <input
                type="number"
                min="0"
                value={saves}
                onChange={(e) => setSaves(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clicks (Klik Link)
              </label>
              <input
                type="number"
                min="0"
                value={clicks}
                onChange={(e) => setClicks(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Deep Video & Channel Specific Insights Section */}
          {(() => {
            const isTikTok = channel === 'tiktok';
            const isInstagram = channel === 'instagram';
            const isYouTube = channel === 'youtube';

            const sectionTitle = isTikTok
              ? 'Metrik Mendalam Video TikTok'
              : isInstagram
              ? 'Metrik Mendalam Video & Instagram Insights'
              : isYouTube
              ? 'Metrik Mendalam YouTube Shorts & Video'
              : `Metrik Mendalam Video & Konten (${channel})`;

            const labelSource1 = isTikTok ? 'Untuk Anda (FYP) %' : isInstagram ? 'Tab Reels %' : isYouTube ? 'Shorts Feed %' : 'Reels / Video %';
            const labelSource2 = isTikTok ? 'Mengikuti (Following) %' : isInstagram ? 'Beranda (Feed) %' : isYouTube ? 'Beranda / Browse %' : 'Feed / Beranda %';
            const labelSource3 = isTikTok ? 'Suara / Pencarian %' : isInstagram ? 'Jelajahi (Explore) %' : isYouTube ? 'Penelusuran %' : 'Explore / Cari %';
            const labelSource4 = isTikTok ? 'Profil Akun %' : isInstagram ? 'Profil %' : isYouTube ? 'Halaman Channel %' : 'Profil %';

            return (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${isTikTok ? 'bg-cyan-500' : isInstagram ? 'bg-pink-500' : isYouTube ? 'bg-red-500' : 'bg-blue-500'}`} />
                    {sectionTitle}
                  </span>
                  <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Opsional / Analisis Video
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Average Watch Time
                    </label>
                    <input
                      type="text"
                      placeholder={isTikTok ? 'Contoh: 0:14 detik atau 14s' : 'Contoh: 0:34 detik atau 45s'}
                      value={watchTime}
                      onChange={(e) => setWatchTime(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Drop-off / Skip Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="Contoh: 28.4"
                      value={dropOffRate}
                      onChange={(e) => setDropOffRate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reposts (Posting Ulang)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={reposts}
                      onChange={(e) => setReposts(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Traffic Sources Breakdown */}
                <div className="pt-2 border-t border-slate-200/60">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Sumber Tayangan Teratas (%)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] truncate block">{labelSource1}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={trafficReels}
                        onChange={(e) => setTrafficReels(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] truncate block">{labelSource2}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={trafficFeed}
                        onChange={(e) => setTrafficFeed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] truncate block">{labelSource3}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={trafficExplore}
                        onChange={(e) => setTrafficExplore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] truncate block">{labelSource4}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={trafficProfile}
                        onChange={(e) => setTrafficProfile(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>

            {/* Audience Breakdown */}
            <div className="pt-2 border-t border-slate-200/60">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Pemirsa (Audience Breakdown %)
              </label>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 text-[10px]">Pengikut (Followers %)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={audienceFollowers}
                    onChange={(e) => setAudienceFollowers(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Bukan Pengikut (Non-Followers %)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={audienceNonFollowers}
                    onChange={(e) => setAudienceNonFollowers(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

          {/* Live Calculated Formula Preview Box */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <span>Kalkulasi Otomatis Indikator (Real-Time Formula)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-[10px] text-slate-500 block">Total Engagements</span>
                <span className="font-extrabold text-blue-700 text-sm">
                  {totalEng.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-[10px] text-slate-500 block">Engagement Rate</span>
                <span className="font-extrabold text-purple-700 text-sm">
                  {previewER}%
                </span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-[10px] text-slate-500 block">Save Rate</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {previewSaveRate}%
                </span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-blue-100">
                <span className="text-[10px] text-slate-500 block">Share Rate</span>
                <span className="font-extrabold text-amber-700 text-sm">
                  {previewShareRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{initialMetric ? 'Perbarui Metrik' : 'Simpan Snapshot'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
