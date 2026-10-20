import { supabase, isConfigured } from '../../config/supabase.ts';
import { ContentMetric, MetricSource, ContentPost } from '../../types/database.ts';

export interface CreateMetricInput {
  brand_id: string;
  post_id?: string | null;
  channel: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks?: number;
  source?: MetricSource;
  recorded_at?: string;
  raw_ai_analysis?: Record<string, unknown> | null;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: Record<string, number> | null;
  audience_breakdown?: Record<string, number> | null;
}

export interface UpdateMetricInput {
  channel?: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  source?: MetricSource;
  recorded_at?: string;
  raw_ai_analysis?: Record<string, unknown> | null;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: Record<string, number> | null;
  audience_breakdown?: Record<string, number> | null;
}

export interface MetricsFilterOptions {
  periodDays?: number | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
  channel?: string;
  postId?: string;
  postIds?: string[];
}

export interface MetricAggregation {
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalClicks: number;
  engagementRate: number;
  saveRate: number;
  shareRate: number;
  postCount: number;
}

export interface PeriodComparison {
  current: MetricAggregation;
  previous: MetricAggregation;
  changes: {
    impressionsPercent: number;
    reachPercent: number;
    engagementsPercent: number;
    engagementRateDelta: number;
    savesPercent: number;
    sharesPercent: number;
  };
}

export interface DailyTrendPoint {
  date: string;
  formattedDate: string;
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface PillarPerformance {
  pillar: string;
  postCount: number;
  totalReach: number;
  totalEngagements: number;
  averageER: number;
}

export interface TopPostItem {
  post: ContentPost;
  metric: ContentMetric;
  totalEngagements: number;
  engagementRate: number;
}

export interface DeepInsightsSummary {
  avgWatchTime: string;
  dropOffRate: string;
  totalReposts: number;
  hasVideoData: boolean;
  trafficSources: { name: string; percentage: number; color: string }[];
  audienceBreakdown: { followers: number; nonFollowers: number };
}

export interface AnalyticsReportData {
  comparison: PeriodComparison;
  dailyTrends: DailyTrendPoint[];
  pillarPerformances: PillarPerformance[];
  topPosts: TopPostItem[];
  recentSnapshots: (ContentMetric & { post?: ContentPost | null })[];
  deepInsights?: DeepInsightsSummary;
}

/**
 * Formula Helpers & Safe Calculation
 */
export const metricFormulas = {
  /**
   * Total Engagements = Likes + Comments + Shares + Saves
   */
  totalEngagements(likes: number, comments: number, shares: number, saves: number): number {
    return Math.max(0, (likes || 0) + (comments || 0) + (shares || 0) + (saves || 0));
  },

  /**
   * Engagement Rate (ER%) = (Total Engagements / Reach) * 100
   * Jika Reach = 0, fallback ke Impressions. Jika keduanya 0, hasil 0.
   */
  engagementRate(engagements: number, reach: number, impressions: number): number {
    const base = reach > 0 ? reach : (impressions > 0 ? impressions : 0);
    if (base <= 0) return 0;
    return Number(((engagements / base) * 100).toFixed(2));
  },

  /**
   * Save Rate (%) = (Saves / Reach) * 100
   */
  saveRate(saves: number, reach: number): number {
    if (!reach || reach <= 0) return 0;
    return Number(((saves / reach) * 100).toFixed(2));
  },

  /**
   * Share Rate (%) = (Shares / Reach) * 100
   */
  shareRate(shares: number, reach: number): number {
    if (!reach || reach <= 0) return 0;
    return Number(((shares / reach) * 100).toFixed(2));
  },

  /**
   * Percentage Change: ((Current - Previous) / Previous) * 100
   */
  percentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  },
};

export const metricsService = {
  /**
   * Mencatat snapshot metrik konten baru ke Supabase
   */
  async createMetric(input: CreateMetricInput): Promise<ContentMetric> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const engagements = metricFormulas.totalEngagements(
      input.likes,
      input.comments,
      input.shares,
      input.saves
    );
    const er = metricFormulas.engagementRate(engagements, input.reach, input.impressions);

    const deepAnalysis: Record<string, unknown> = {
      ...(input.raw_ai_analysis || {}),
      ...(input.watch_time !== undefined ? { watch_time: input.watch_time } : {}),
      ...(input.drop_off_rate !== undefined ? { drop_off_rate: input.drop_off_rate } : {}),
      ...(input.reposts !== undefined ? { reposts: input.reposts } : {}),
      ...(input.traffic_sources !== undefined ? { traffic_sources: input.traffic_sources } : {}),
      ...(input.audience_breakdown !== undefined ? { audience_breakdown: input.audience_breakdown } : {}),
    };

    const { data, error } = await supabase
      .from('content_metrics')
      .insert({
        brand_id: input.brand_id,
        post_id: input.post_id || null,
        channel: input.channel || 'instagram',
        impressions: Math.max(0, input.impressions || 0),
        reach: Math.max(0, input.reach || 0),
        engagement_rate: er,
        likes: Math.max(0, input.likes || 0),
        comments: Math.max(0, input.comments || 0),
        shares: Math.max(0, input.shares || 0),
        saves: Math.max(0, input.saves || 0),
        clicks: Math.max(0, input.clicks || 0),
        source: input.source || 'manual',
        raw_ai_analysis: deepAnalysis,
        recorded_at: input.recorded_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Gagal mencatat metrik:', error);
      throw error;
    }

    return data as ContentMetric;
  },

  /**
   * Mengupdate metrik yang sudah ada
   */
  async updateMetric(metricId: string, input: UpdateMetricInput): Promise<ContentMetric> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const payload: Record<string, unknown> = {};
    if (input.channel !== undefined) payload.channel = input.channel;
    if (input.impressions !== undefined) payload.impressions = Math.max(0, input.impressions);
    if (input.reach !== undefined) payload.reach = Math.max(0, input.reach);
    if (input.likes !== undefined) payload.likes = Math.max(0, input.likes);
    if (input.comments !== undefined) payload.comments = Math.max(0, input.comments);
    if (input.shares !== undefined) payload.shares = Math.max(0, input.shares);
    if (input.saves !== undefined) payload.saves = Math.max(0, input.saves);
    if (input.clicks !== undefined) payload.clicks = Math.max(0, input.clicks);
    if (input.source !== undefined) payload.source = input.source;
    if (input.recorded_at !== undefined) payload.recorded_at = input.recorded_at;

    // Ambil data sekarang untuk merge raw_ai_analysis dan ER
    const { data: current } = await supabase
      .from('content_metrics')
      .select('*')
      .eq('id', metricId)
      .single();

    if (current) {
      const mergedLikes = input.likes !== undefined ? input.likes : current.likes;
      const mergedComments = input.comments !== undefined ? input.comments : current.comments;
      const mergedShares = input.shares !== undefined ? input.shares : current.shares;
      const mergedSaves = input.saves !== undefined ? input.saves : current.saves;
      const mergedReach = input.reach !== undefined ? input.reach : current.reach;
      const mergedImpressions = input.impressions !== undefined ? input.impressions : current.impressions;

      const totalEng = metricFormulas.totalEngagements(mergedLikes, mergedComments, mergedShares, mergedSaves);
      payload.engagement_rate = metricFormulas.engagementRate(totalEng, mergedReach, mergedImpressions);

      const existingRaw = (current.raw_ai_analysis || {}) as Record<string, unknown>;
      payload.raw_ai_analysis = {
        ...existingRaw,
        ...(input.raw_ai_analysis || {}),
        ...(input.watch_time !== undefined ? { watch_time: input.watch_time } : {}),
        ...(input.drop_off_rate !== undefined ? { drop_off_rate: input.drop_off_rate } : {}),
        ...(input.reposts !== undefined ? { reposts: input.reposts } : {}),
        ...(input.traffic_sources !== undefined ? { traffic_sources: input.traffic_sources } : {}),
        ...(input.audience_breakdown !== undefined ? { audience_breakdown: input.audience_breakdown } : {}),
      };
    }

    const { data, error } = await supabase
      .from('content_metrics')
      .update(payload)
      .eq('id', metricId)
      .select()
      .single();

    if (error) {
      console.error('Gagal memperbarui metrik:', error);
      throw error;
    }

    return data as ContentMetric;
  },

  /**
   * Menghapus snapshot metrik
   */
  async deleteMetric(metricId: string): Promise<void> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const { error } = await supabase
      .from('content_metrics')
      .delete()
      .eq('id', metricId);

    if (error) throw error;
  },

  /**
   * Mengambil semua metrik snapshot untuk brand dengan filter
   */
  async getMetrics(brandId: string, filter?: MetricsFilterOptions): Promise<(ContentMetric & { post?: ContentPost | null })[]> {
    if (!isConfigured || !brandId) return [];

    let query = supabase
      .from('content_metrics')
      .select(`
        *,
        post:content_posts(*)
      `)
      .eq('brand_id', brandId)
      .order('recorded_at', { ascending: false });

    if (filter?.channel && filter.channel !== 'all') {
      query = query.eq('channel', filter.channel);
    }
    if (filter?.postId) {
      query = query.eq('post_id', filter.postId);
    }
    if (filter?.postIds && filter.postIds.length > 0) {
      query = query.in('post_id', filter.postIds);
    }
    if (filter?.startDate) {
      query = query.gte('recorded_at', filter.startDate);
    }
    if (filter?.endDate) {
      query = query.lte('recorded_at', filter.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Gagal mengambil metrik:', error);
      throw error;
    }

    return (data || []) as unknown as (ContentMetric & { post?: ContentPost | null })[];
  },

  /**
   * Menghasilkan laporan analitik komprehensif: agregasi, perbandingan periode,
   * tren harian, performa pilar, dan ranking top content
   */
  async getAnalyticsReport(
    brandId: string,
    periodDays: number | 'custom' = 30,
    channel: string = 'all',
    customStartDate?: string,
    customEndDate?: string
  ): Promise<AnalyticsReportData> {
    if (!isConfigured || !brandId) {
      const emptyAgg: MetricAggregation = {
        totalImpressions: 0,
        totalReach: 0,
        totalEngagements: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        totalClicks: 0,
        engagementRate: 0,
        saveRate: 0,
        shareRate: 0,
        postCount: 0,
      };
      return {
        comparison: {
          current: emptyAgg,
          previous: emptyAgg,
          changes: {
            impressionsPercent: 0,
            reachPercent: 0,
            engagementsPercent: 0,
            engagementRateDelta: 0,
            savesPercent: 0,
            sharesPercent: 0,
          },
        },
        dailyTrends: [],
        pillarPerformances: [],
        topPosts: [],
        recentSnapshots: [],
      };
    }

    let currentStart: Date;
    let now: Date;
    let spanDays: number;

    if (periodDays === 'custom' && customStartDate && customEndDate) {
      currentStart = new Date(customStartDate);
      now = new Date(customEndDate);
      now.setHours(23, 59, 59, 999);
      spanDays = Math.max(1, Math.round((now.getTime() - currentStart.getTime()) / 86400000));
    } else {
      const numDays = typeof periodDays === 'number' ? periodDays : 30;
      now = new Date();
      currentStart = new Date(now.getTime() - numDays * 86400000);
      spanDays = numDays;
    }

    const previousStart = new Date(currentStart.getTime() - spanDays * 86400000);

    // Ambil data dari rentang waktu gabungan (previousStart sampai now)
    const allMetrics = await this.getMetrics(brandId, {
      startDate: previousStart.toISOString(),
      channel: channel !== 'all' ? channel : undefined,
    });

    // Pisahkan metrik periode saat ini dan sebelumnya
    const currentMetrics = allMetrics.filter((m) => {
      const rec = new Date(m.recorded_at).getTime();
      return rec >= currentStart.getTime() && rec <= now.getTime();
    });

    const previousMetrics = allMetrics.filter((m) => {
      const rec = new Date(m.recorded_at).getTime();
      return rec >= previousStart.getTime() && rec < currentStart.getTime();
    });

    // Helper kalkulasi agregasi
    const aggregate = (items: typeof allMetrics): MetricAggregation => {
      let impressions = 0;
      let reach = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;
      let saves = 0;
      let clicks = 0;
      const uniquePosts = new Set<string>();

      for (const item of items) {
        impressions += item.impressions || 0;
        reach += item.reach || 0;
        likes += item.likes || 0;
        comments += item.comments || 0;
        shares += item.shares || 0;
        saves += item.saves || 0;
        clicks += item.clicks || 0;
        if (item.post_id) uniquePosts.add(item.post_id);
      }

      const totalEng = metricFormulas.totalEngagements(likes, comments, shares, saves);
      const er = metricFormulas.engagementRate(totalEng, reach, impressions);
      const svRate = metricFormulas.saveRate(saves, reach);
      const shRate = metricFormulas.shareRate(shares, reach);

      return {
        totalImpressions: impressions,
        totalReach: reach,
        totalEngagements: totalEng,
        totalLikes: likes,
        totalComments: comments,
        totalShares: shares,
        totalSaves: saves,
        totalClicks: clicks,
        engagementRate: er,
        saveRate: svRate,
        shareRate: shRate,
        postCount: uniquePosts.size,
      };
    };

    const currentAgg = aggregate(currentMetrics);
    const prevAgg = aggregate(previousMetrics);

    const changes = {
      impressionsPercent: metricFormulas.percentageChange(currentAgg.totalImpressions, prevAgg.totalImpressions),
      reachPercent: metricFormulas.percentageChange(currentAgg.totalReach, prevAgg.totalReach),
      engagementsPercent: metricFormulas.percentageChange(currentAgg.totalEngagements, prevAgg.totalEngagements),
      engagementRateDelta: Number((currentAgg.engagementRate - prevAgg.engagementRate).toFixed(2)),
      savesPercent: metricFormulas.percentageChange(currentAgg.totalSaves, prevAgg.totalSaves),
      sharesPercent: metricFormulas.percentageChange(currentAgg.totalShares, prevAgg.totalShares),
    };

    // Tren harian (Daily Trends)
    const trendMap = new Map<string, DailyTrendPoint>();
    // Inisialisasi setiap hari dalam rentang periode saat ini
    for (let i = 0; i <= spanDays; i++) {
      const d = new Date(currentStart.getTime() + i * 86400000);
      if (d.getTime() > now.getTime()) break;
      const dateKey = d.toISOString().split('T')[0];
      const formatted = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
      trendMap.set(dateKey, {
        date: dateKey,
        formattedDate: formatted,
        impressions: 0,
        reach: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
      });
    }

    for (const m of currentMetrics) {
      const dateKey = m.recorded_at.split('T')[0];
      const point = trendMap.get(dateKey);
      if (point) {
        point.impressions += m.impressions || 0;
        point.reach += m.reach || 0;
        point.likes += m.likes || 0;
        point.comments += m.comments || 0;
        point.shares += m.shares || 0;
        point.saves += m.saves || 0;
        point.engagements += metricFormulas.totalEngagements(m.likes, m.comments, m.shares, m.saves);
      }
    }

    const dailyTrends = Array.from(trendMap.values());

    // Analisis Performa per Pilar Konten
    const pillarMap = new Map<string, { count: number; reach: number; eng: number; erSum: number }>();
    for (const m of currentMetrics) {
      const pillar = m.post?.pillar || 'Lainnya';
      const existing = pillarMap.get(pillar) || { count: 0, reach: 0, eng: 0, erSum: 0 };
      const eng = metricFormulas.totalEngagements(m.likes, m.comments, m.shares, m.saves);
      existing.count += 1;
      existing.reach += m.reach || 0;
      existing.eng += eng;
      existing.erSum += Number(m.engagement_rate || 0);
      pillarMap.set(pillar, existing);
    }

    const pillarPerformances: PillarPerformance[] = Array.from(pillarMap.entries()).map(([pillar, data]) => ({
      pillar,
      postCount: data.count,
      totalReach: data.reach,
      totalEngagements: data.eng,
      averageER: data.count > 0 ? Number((data.erSum / data.count).toFixed(2)) : 0,
    })).sort((a, b) => b.totalEngagements - a.totalEngagements);

    // Top Content Ranking (Posting dengan performa terbaik)
    const topPostsMap = new Map<string, TopPostItem>();
    for (const m of currentMetrics) {
      if (m.post) {
        const eng = metricFormulas.totalEngagements(m.likes, m.comments, m.shares, m.saves);
        const er = Number(m.engagement_rate) || metricFormulas.engagementRate(eng, m.reach, m.impressions);

        // Ambil snapshot dengan engagement tertinggi per post
        const existing = topPostsMap.get(m.post.id);
        if (!existing || eng > existing.totalEngagements) {
          topPostsMap.set(m.post.id, {
            post: m.post,
            metric: m,
            totalEngagements: eng,
            engagementRate: er,
          });
        }
      }
    }

    const topPosts = Array.from(topPostsMap.values())
      .sort((a, b) => b.totalEngagements - a.totalEngagements)
      .slice(0, 5);

    // Kalkulasi Metrik Mendalam (Deep Insights) dari data nyata snapshot
    let watchTimeCount = 0;
    let totalWatchTimeSeconds = 0;
    let dropOffSum = 0;
    let dropOffCount = 0;
    let totalReposts = 0;
    let reelsTrafficSum = 0;
    let feedTrafficSum = 0;
    let exploreTrafficSum = 0;
    let profileTrafficSum = 0;
    let trafficCount = 0;
    let followersSum = 0;
    let nonFollowersSum = 0;
    let audienceCount = 0;

    for (const m of currentMetrics) {
      const raw = (m.raw_ai_analysis || {}) as Record<string, unknown>;
      const wt = (m.watch_time || raw.watch_time) as string | number | undefined;
      if (wt) {
        let sec = 0;
        if (typeof wt === 'number') {
          sec = wt;
        } else if (typeof wt === 'string') {
          const match = wt.match(/(?:(\d+):)?(\d+)/);
          if (match) {
            sec = match[1] ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : parseInt(match[2], 10);
          }
        }
        if (sec > 0) {
          totalWatchTimeSeconds += sec;
          watchTimeCount++;
        }
      }

      const dor = m.drop_off_rate ?? raw.drop_off_rate;
      if (dor !== undefined && dor !== null && !isNaN(Number(dor))) {
        dropOffSum += Number(dor);
        dropOffCount++;
      }

      const rep = m.reposts ?? raw.reposts;
      if (rep !== undefined && rep !== null && !isNaN(Number(rep))) {
        totalReposts += Number(rep);
      }

      const ts = (m.traffic_sources || raw.traffic_sources) as Record<string, number> | undefined;
      if (ts) {
        reelsTrafficSum += Number(ts.reels || 0);
        feedTrafficSum += Number(ts.feed || 0);
        exploreTrafficSum += Number(ts.explore || 0);
        profileTrafficSum += Number(ts.profile || 0);
        trafficCount++;
      }

      const aud = (m.audience_breakdown || raw.audience_breakdown) as Record<string, number> | undefined;
      if (aud) {
        followersSum += Number(aud.followers || 0);
        nonFollowersSum += Number(aud.non_followers || 0);
        audienceCount++;
      }
    }

    const avgSec = watchTimeCount > 0 ? Math.round(totalWatchTimeSeconds / watchTimeCount) : 0;
    const formattedAvgWatchTime = watchTimeCount > 0
      ? `${Math.floor(avgSec / 60)}:${(avgSec % 60).toString().padStart(2, '0')} detik`
      : 'Belum dicatat';
    const formattedDropOffRate = dropOffCount > 0
      ? `${(dropOffSum / dropOffCount).toFixed(1)}%`
      : 'Belum dicatat';

    // Label sumber tayangan disesuaikan dengan saluran yang difilter
    let src1 = 'Shorts / Reels / FYP';
    let src2 = 'Beranda (Feed)';
    let src3 = 'Jelajahi (Explore)';
    let src4 = 'Profil Akun';

    if (channel === 'tiktok') {
      src1 = 'Untuk Anda (FYP)';
      src2 = 'Mengikuti (Following)';
      src3 = 'Suara / Pencarian';
      src4 = 'Profil Akun';
    } else if (channel === 'instagram') {
      src1 = 'Tab Reels';
      src2 = 'Beranda (Feed)';
      src3 = 'Jelajahi (Explore)';
      src4 = 'Profil Akun';
    } else if (channel === 'youtube') {
      src1 = 'Shorts Feed';
      src2 = 'Beranda / Browse';
      src3 = 'Penelusuran YouTube';
      src4 = 'Halaman Channel';
    }

    const trafficSources = [
      { name: src1, percentage: trafficCount > 0 ? Math.round(reelsTrafficSum / trafficCount) : 0, color: 'bg-pink-600' },
      { name: src2, percentage: trafficCount > 0 ? Math.round(feedTrafficSum / trafficCount) : 0, color: 'bg-purple-600' },
      { name: src3, percentage: trafficCount > 0 ? Math.round(exploreTrafficSum / trafficCount) : 0, color: 'bg-blue-600' },
      { name: src4, percentage: trafficCount > 0 ? Math.round(profileTrafficSum / trafficCount) : 0, color: 'bg-emerald-600' },
    ];

    const audienceBreakdown = audienceCount > 0 ? {
      followers: Number((followersSum / audienceCount).toFixed(1)),
      nonFollowers: Number((nonFollowersSum / audienceCount).toFixed(1)),
    } : {
      followers: 0,
      nonFollowers: 0,
    };

    const hasVideoData = watchTimeCount > 0 || dropOffCount > 0 || totalReposts > 0 || trafficCount > 0 || audienceCount > 0;

    const deepInsights: DeepInsightsSummary = {
      avgWatchTime: formattedAvgWatchTime,
      dropOffRate: formattedDropOffRate,
      totalReposts,
      hasVideoData,
      trafficSources,
      audienceBreakdown,
    };

    return {
      comparison: {
        current: currentAgg,
        previous: prevAgg,
        changes,
      },
      dailyTrends,
      pillarPerformances,
      topPosts,
      recentSnapshots: currentMetrics.slice(0, 15),
      deepInsights,
    };
  },

  /**
   * Seeder data metrik contoh untuk lingkungan pengujian:
   * Membantu memverifikasi rumus, perbandingan periode, grafik, dan laporan PDF
   */
  async seedDemoMetrics(brandId: string): Promise<number> {
    if (!isConfigured || !brandId) throw new Error('Supabase belum terkonfigurasi.');

    // 1. Ambil postingan brand
    const { data: posts } = await supabase
      .from('content_posts')
      .select('id, channels, pillar, title')
      .eq('brand_id', brandId)
      .limit(10);

    let targetPosts = posts || [];

    // Jika belum ada post, buat 3 post contoh dulu
    if (targetPosts.length === 0) {
      const sampleTitles = [
        '5 Rahasia Meningkatkan Omzet Bisnis Tanpa Iklan',
        'Review Produk: Cara Pakai yang Benar',
        'Behind The Scenes: Proses Produksi Kami',
      ];
      for (const t of sampleTitles) {
        const { data: p } = await supabase
          .from('content_posts')
          .insert({
            brand_id: brandId,
            title: t,
            channels: ['instagram'],
            format: 'carousel',
            pillar: 'Edukatif',
            status: 'published',
          })
          .select('id, channels, pillar, title')
          .single();
        if (p) targetPosts.push(p);
      }
    }

    const now = Date.now();
    let seededCount = 0;

    // Masukkan snapshots selama 30 hari ke belakang
    for (let dayOffset = 28; dayOffset >= 0; dayOffset -= 4) {
      const snapshotTime = new Date(now - dayOffset * 86400000).toISOString();

      for (const post of targetPosts) {
        // Angka realistis dengan variasi
        const baseReach = Math.floor(800 + Math.random() * 2500);
        const baseImpressions = Math.floor(baseReach * (1.2 + Math.random() * 0.5));
        const likes = Math.floor(baseReach * (0.04 + Math.random() * 0.05));
        const comments = Math.floor(likes * (0.08 + Math.random() * 0.1));
        const shares = Math.floor(likes * (0.05 + Math.random() * 0.1));
        const saves = Math.floor(likes * (0.1 + Math.random() * 0.15));
        const clicks = Math.floor(baseReach * 0.02);

        const reposts = Math.floor(shares * 0.4);
        const watchSeconds = Math.floor(25 + Math.random() * 25);
        const dropOff = Number((20 + Math.random() * 15).toFixed(1));

        await this.createMetric({
          brand_id: brandId,
          post_id: post.id,
          channel: post.channels?.[0] || 'instagram',
          impressions: baseImpressions,
          reach: baseReach,
          likes,
          comments,
          shares,
          saves,
          clicks,
          source: 'manual',
          recorded_at: snapshotTime,
          watch_time: `0:${watchSeconds.toString().padStart(2, '0')} detik`,
          drop_off_rate: dropOff,
          reposts,
          traffic_sources: {
            reels: 54,
            feed: 26,
            explore: 14,
            profile: 6,
          },
          audience_breakdown: {
            followers: 67.2,
            non_followers: 32.8,
          },
        });

        seededCount++;
      }
    }

    return seededCount;
  },
};
