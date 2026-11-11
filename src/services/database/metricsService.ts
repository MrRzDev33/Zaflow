import { supabase, isConfigured } from '../../config/supabase.ts';
import {
  ContentMetric,
  MetricSource,
  ContentPost,
  AccountMetric,
  AudienceBreakdown,
  ContentInsightType,
  ContentInsightsDetail,
  TrafficSourceBreakdown,
} from '../../types/database.ts';
import {
  buildTrafficSourceItems,
  normalizeTrafficSources,
  TRAFFIC_SOURCE_CATALOG,
  type TrafficSourceItem,
} from '../../config/insights.ts';
import {
  resolvePostDate,
  resolvePostTimestamp,
  toLocalDateKey,
} from '../../utils/postDate.ts';

export interface CreateMetricInput {
  brand_id: string;
  /** Wajib: setiap snapshot harus terhubung ke satu postingan. */
  post_id: string;
  channel: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks?: number;
  profile_visits?: number;
  follows?: number;
  content_type?: ContentInsightType | string | null;
  source?: MetricSource;
  recorded_at?: string;
  raw_ai_analysis?: Record<string, unknown> | null;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: TrafficSourceBreakdown | null;
  audience_breakdown?: AudienceBreakdown | null;
  insights_detail?: ContentInsightsDetail | null;
}

export interface UpdateMetricInput {
  post_id?: string;
  channel?: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  profile_visits?: number;
  follows?: number;
  content_type?: ContentInsightType | string | null;
  source?: MetricSource;
  recorded_at?: string;
  raw_ai_analysis?: Record<string, unknown> | null;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: TrafficSourceBreakdown | null;
  audience_breakdown?: AudienceBreakdown | null;
  insights_detail?: ContentInsightsDetail | null;
}

export interface UpsertAccountMetricInput {
  brand_id: string;
  channel: string;
  /** Format YYYY-MM. */
  period_month: string;
  views: number;
  reach: number;
  interactions_total: number;
  profile_visits: number;
  follows: number;
  followers_total: number;
  traffic_sources?: TrafficSourceBreakdown | null;
  audience_breakdown?: AudienceBreakdown | null;
  raw_ai_analysis?: Record<string, unknown> | null;
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
  totalReposts: number;
  totalClicks: number;
  totalProfileVisits: number;
  totalFollows: number;
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
  postCount: number;
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
  /** Snapshot terbaru per saluran untuk postingan ini. */
  metrics: ContentMetric[];
  channels: string[];
  scheduledAt: string | null;
  impressions: number;
  reach: number;
  saves: number;
  shares: number;
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
  /** Ringkasan akun (dashboard Instagram) — sumber angka total utama. */
  accountSummary: AccountSummary;
  /** Akumulasi dari snapshot per konten — pelengkap, bukan reach unik. */
  contentSummary: ContentAggregateSummary;
}

export interface AccountSummary {
  hasData: boolean;
  periodMonth: string | null;
  channel: string | null;
  views: number;
  reach: number;
  interactions: number;
  profileVisits: number;
  follows: number;
  followersTotal: number;
  engagementRate: number;
  trafficSources: TrafficSourceItem[];
  audienceBreakdown: { followers: number; nonFollowers: number };
  updatedAt: string | null;
}

export interface ContentAggregateSummary {
  postCount: number;
  snapshotCount: number;
  impressions: number;
  reach: number;
  engagements: number;
  engagementRate: number;
  profileVisits: number;
  follows: number;
  trafficSources: TrafficSourceItem[];
  audienceBreakdown: { followers: number; nonFollowers: number };
}

const EMPTY_ACCOUNT_SUMMARY: AccountSummary = {
  hasData: false,
  periodMonth: null,
  channel: null,
  views: 0,
  reach: 0,
  interactions: 0,
  profileVisits: 0,
  follows: 0,
  followersTotal: 0,
  engagementRate: 0,
  trafficSources: [],
  audienceBreakdown: { followers: 0, nonFollowers: 0 },
  updatedAt: null,
};

const EMPTY_CONTENT_SUMMARY: ContentAggregateSummary = {
  postCount: 0,
  snapshotCount: 0,
  impressions: 0,
  reach: 0,
  engagements: 0,
  engagementRate: 0,
  profileVisits: 0,
  follows: 0,
  trafficSources: [],
  audienceBreakdown: { followers: 0, nonFollowers: 0 },
};

/**
 * Formula Helpers & Safe Calculation
 */
export const metricFormulas = {
  /**
   * Total Engagements = Likes + Comments + Shares + Saves + Reposts
   */
  totalEngagements(
    likes: number,
    comments: number,
    shares: number,
    saves: number,
    reposts: number = 0
  ): number {
    return Math.max(
      0,
      (likes || 0) + (comments || 0) + (shares || 0) + (saves || 0) + (reposts || 0)
    );
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

/**
 * Mengambil satu snapshot terbaru untuk setiap kombinasi postingan + saluran.
 * Mencegah snapshot berulang dijumlahkan berkali-kali pada laporan.
 */
export function getLatestMetricPerPostChannel<T extends ContentMetric>(metrics: T[]): T[] {
  const latest = new Map<string, T>();

  for (const metric of metrics) {
    if (!metric.post_id) continue;
    const key = `${metric.post_id}|${(metric.channel || 'lainnya').toLowerCase()}`;
    const existing = latest.get(key);
    if (
      !existing ||
      new Date(metric.recorded_at).getTime() > new Date(existing.recorded_at).getTime()
    ) {
      latest.set(key, metric);
    }
  }

  return Array.from(latest.values());
}

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
      input.saves,
      Number(input.reposts) || 0
    );
    const er = metricFormulas.engagementRate(engagements, input.reach, input.impressions);

    const trafficSources = normalizeTrafficSources(input.traffic_sources as Record<string, unknown>);
    const deepAnalysis: Record<string, unknown> = {
      ...(input.raw_ai_analysis || {}),
      ...(input.watch_time !== undefined ? { watch_time: input.watch_time } : {}),
      ...(input.drop_off_rate !== undefined ? { drop_off_rate: input.drop_off_rate } : {}),
      ...(input.reposts !== undefined ? { reposts: input.reposts } : {}),
      ...(input.profile_visits !== undefined ? { profile_visits: input.profile_visits } : {}),
      ...(input.follows !== undefined ? { follows: input.follows } : {}),
      ...(input.content_type !== undefined ? { content_type: input.content_type } : {}),
      ...(trafficSources ? { traffic_sources: trafficSources } : {}),
      ...(input.audience_breakdown !== undefined ? { audience_breakdown: input.audience_breakdown } : {}),
      ...(input.insights_detail !== undefined ? { insights_detail: input.insights_detail } : {}),
    };

    const { data, error } = await supabase
      .from('content_metrics')
      .insert({
        brand_id: input.brand_id,
        post_id: input.post_id,
        channel: input.channel || 'instagram',
        impressions: Math.max(0, input.impressions || 0),
        reach: Math.max(0, input.reach || 0),
        engagement_rate: er,
        likes: Math.max(0, input.likes || 0),
        comments: Math.max(0, input.comments || 0),
        shares: Math.max(0, input.shares || 0),
        saves: Math.max(0, input.saves || 0),
        clicks: Math.max(0, input.clicks || 0),
        profile_visits: Math.max(0, input.profile_visits || 0),
        follows: Math.max(0, input.follows || 0),
        content_type: input.content_type || null,
        source: input.source || 'manual',
        watch_time: input.watch_time ?? null,
        drop_off_rate: input.drop_off_rate ?? null,
        reposts: Math.max(0, Number(input.reposts) || 0),
        traffic_sources: trafficSources,
        audience_breakdown: input.audience_breakdown ?? null,
        insights_detail: input.insights_detail ?? null,
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
    if (input.post_id !== undefined) payload.post_id = input.post_id;
    if (input.channel !== undefined) payload.channel = input.channel;
    if (input.impressions !== undefined) payload.impressions = Math.max(0, input.impressions);
    if (input.reach !== undefined) payload.reach = Math.max(0, input.reach);
    if (input.likes !== undefined) payload.likes = Math.max(0, input.likes);
    if (input.comments !== undefined) payload.comments = Math.max(0, input.comments);
    if (input.shares !== undefined) payload.shares = Math.max(0, input.shares);
    if (input.saves !== undefined) payload.saves = Math.max(0, input.saves);
    if (input.clicks !== undefined) payload.clicks = Math.max(0, input.clicks);
    if (input.profile_visits !== undefined) payload.profile_visits = Math.max(0, input.profile_visits);
    if (input.follows !== undefined) payload.follows = Math.max(0, input.follows);
    if (input.content_type !== undefined) payload.content_type = input.content_type;
    if (input.source !== undefined) payload.source = input.source;
    if (input.recorded_at !== undefined) payload.recorded_at = input.recorded_at;
    if (input.watch_time !== undefined) payload.watch_time = input.watch_time;
    if (input.drop_off_rate !== undefined) payload.drop_off_rate = input.drop_off_rate;
    if (input.reposts !== undefined) payload.reposts = Math.max(0, Number(input.reposts) || 0);
    if (input.traffic_sources !== undefined) {
      payload.traffic_sources = normalizeTrafficSources(
        input.traffic_sources as Record<string, unknown>
      );
    }
    if (input.audience_breakdown !== undefined) payload.audience_breakdown = input.audience_breakdown;
    if (input.insights_detail !== undefined) payload.insights_detail = input.insights_detail;

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
      const mergedReposts = input.reposts !== undefined ? input.reposts : current.reposts;
      const mergedReach = input.reach !== undefined ? input.reach : current.reach;
      const mergedImpressions = input.impressions !== undefined ? input.impressions : current.impressions;

      const totalEng = metricFormulas.totalEngagements(
        mergedLikes,
        mergedComments,
        mergedShares,
        mergedSaves,
        Number(mergedReposts) || 0
      );
      payload.engagement_rate = metricFormulas.engagementRate(totalEng, mergedReach, mergedImpressions);

      const existingRaw = (current.raw_ai_analysis || {}) as Record<string, unknown>;
      payload.raw_ai_analysis = {
        ...existingRaw,
        ...(input.raw_ai_analysis || {}),
        ...(input.watch_time !== undefined ? { watch_time: input.watch_time } : {}),
        ...(input.drop_off_rate !== undefined ? { drop_off_rate: input.drop_off_rate } : {}),
        ...(input.reposts !== undefined ? { reposts: input.reposts } : {}),
        ...(input.profile_visits !== undefined ? { profile_visits: input.profile_visits } : {}),
        ...(input.follows !== undefined ? { follows: input.follows } : {}),
        ...(input.content_type !== undefined ? { content_type: input.content_type } : {}),
        ...(input.traffic_sources !== undefined
          ? { traffic_sources: normalizeTrafficSources(input.traffic_sources as Record<string, unknown>) }
          : {}),
        ...(input.audience_breakdown !== undefined ? { audience_breakdown: input.audience_breakdown } : {}),
        ...(input.insights_detail !== undefined ? { insights_detail: input.insights_detail } : {}),
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
   * Mengambil ringkasan akun bulanan (dashboard Instagram).
   * Diurutkan dari bulan terbaru.
   */
  async getAccountMetrics(
    brandId: string,
    filter?: { channel?: string; startMonth?: string; endMonth?: string }
  ): Promise<AccountMetric[]> {
    if (!isConfigured || !brandId) return [];

    let query = supabase
      .from('account_metrics')
      .select('*')
      .eq('brand_id', brandId)
      .order('period_month', { ascending: false });

    if (filter?.channel && filter.channel !== 'all') {
      // Nama channel dapat tersimpan dengan kapitalisasi berbeda (Instagram vs instagram).
      query = query.ilike('channel', filter.channel);
    }
    if (filter?.startMonth) query = query.gte('period_month', filter.startMonth);
    if (filter?.endMonth) query = query.lte('period_month', filter.endMonth);

    const { data, error } = await query;
    if (error) {
      console.error('Gagal mengambil ringkasan akun:', error);
      throw error;
    }

    return (data || []) as unknown as AccountMetric[];
  },

  /**
   * Menyimpan ringkasan akun bulanan. Satu bulan hanya punya satu baris,
   * sehingga input ulang akan memperbarui data bulan tersebut.
   */
  async upsertAccountMetric(input: UpsertAccountMetricInput): Promise<AccountMetric> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const payload = {
      brand_id: input.brand_id,
      channel: input.channel || 'instagram',
      period_month: input.period_month,
      views: Math.max(0, Math.round(input.views || 0)),
      reach: Math.max(0, Math.round(input.reach || 0)),
      interactions_total: Math.max(0, Math.round(input.interactions_total || 0)),
      profile_visits: Math.max(0, Math.round(input.profile_visits || 0)),
      follows: Math.max(0, Math.round(input.follows || 0)),
      followers_total: Math.max(0, Math.round(input.followers_total || 0)),
      traffic_sources: normalizeTrafficSources(input.traffic_sources as Record<string, unknown>),
      audience_breakdown: input.audience_breakdown ?? null,
      raw_ai_analysis: input.raw_ai_analysis ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('account_metrics')
      .upsert(payload, { onConflict: 'brand_id,channel,period_month' })
      .select()
      .single();

    if (error) {
      console.error('Gagal menyimpan ringkasan akun:', error);
      throw error;
    }

    return data as AccountMetric;
  },

  async deleteAccountMetric(id: string): Promise<void> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const { error } = await supabase.from('account_metrics').delete().eq('id', id);
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
      query = query.ilike('channel', filter.channel);
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
        totalReposts: 0,
        totalClicks: 0,
        totalProfileVisits: 0,
        totalFollows: 0,
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
        accountSummary: EMPTY_ACCOUNT_SUMMARY,
        contentSummary: EMPTY_CONTENT_SUMMARY,
      };
    }

    let currentStart: Date;
    let currentEnd: Date;
    let spanDays: number;

    if (periodDays === 'custom' && customStartDate && customEndDate) {
      currentStart = new Date(`${customStartDate}T00:00:00`);
      currentEnd = new Date(`${customEndDate}T23:59:59.999`);
      spanDays = Math.max(
        1,
        Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000)
      );
    } else {
      const numDays = typeof periodDays === 'number' ? periodDays : 30;
      currentEnd = new Date();
      currentEnd.setHours(23, 59, 59, 999);
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() - (numDays - 1));
      currentStart.setHours(0, 0, 0, 0);
      spanDays = numDays;
    }

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - spanDays);
    previousStart.setHours(0, 0, 0, 0);

    // Semua snapshot brand. Periode ditentukan oleh tanggal posting, bukan recorded_at.
    const allMetrics = await this.getMetrics(brandId, {
      channel: channel !== 'all' ? channel : undefined,
    });

    type MetricWithPost = ContentMetric & { post: ContentPost };
    const metricsWithPost = allMetrics.filter(
      (metric): metric is MetricWithPost => Boolean(metric.post_id && metric.post)
    );

    const postTimestampOf = (metric: MetricWithPost) => resolvePostTimestamp(metric.post);

    // Satu angka per postingan+saluran: snapshot terbaru secara keseluruhan.
    const latestMetrics = getLatestMetricPerPostChannel(metricsWithPost);

    const currentMetrics = latestMetrics.filter((metric) => {
      const ts = postTimestampOf(metric);
      return ts >= currentStart.getTime() && ts <= currentEnd.getTime();
    });

    const previousMetrics = latestMetrics.filter((metric) => {
      const ts = postTimestampOf(metric);
      return ts >= previousStart.getTime() && ts < currentStart.getTime();
    });

    // Riwayat snapshot tetap menampilkan semua snapshot milik postingan periode ini.
    const currentSnapshots = metricsWithPost.filter((metric) => {
      const ts = postTimestampOf(metric);
      return ts >= currentStart.getTime() && ts <= currentEnd.getTime();
    });

    // Helper kalkulasi agregasi (input sudah satu snapshot terbaru per post+saluran)
    const aggregate = (items: ContentMetric[]): MetricAggregation => {
      let impressions = 0;
      let reach = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;
      let saves = 0;
      let reposts = 0;
      let clicks = 0;
      let profileVisits = 0;
      let follows = 0;
      const uniquePosts = new Set<string>();

      for (const item of items) {
        impressions += item.impressions || 0;
        reach += item.reach || 0;
        likes += item.likes || 0;
        comments += item.comments || 0;
        shares += item.shares || 0;
        saves += item.saves || 0;
        reposts += Number(item.reposts || 0);
        clicks += item.clicks || 0;
        profileVisits += Number(item.profile_visits || 0);
        follows += Number(item.follows || 0);
        if (item.post_id) uniquePosts.add(item.post_id);
      }

      const totalEng = metricFormulas.totalEngagements(likes, comments, shares, saves, reposts);
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
        totalReposts: reposts,
        totalClicks: clicks,
        totalProfileVisits: profileVisits,
        totalFollows: follows,
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

    // Tren harian berdasarkan jadwal posting (fallback tanggal dibuat), bukan tanggal snapshot
    const trendMap = new Map<string, DailyTrendPoint>();
    for (
      let cursor = new Date(currentStart);
      cursor.getTime() <= currentEnd.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const dateKey = toLocalDateKey(cursor);
      const formatted = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
      }).format(cursor);
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
        postCount: 0,
      });
    }

    for (const m of currentMetrics) {
      const postDate = resolvePostDate(m.post);
      if (!postDate) continue;
      const point = trendMap.get(toLocalDateKey(postDate));
      if (!point) continue;

      point.impressions += m.impressions || 0;
      point.reach += m.reach || 0;
      point.likes += m.likes || 0;
      point.comments += m.comments || 0;
      point.shares += m.shares || 0;
      point.saves += m.saves || 0;
      point.engagements += metricFormulas.totalEngagements(
        m.likes,
        m.comments,
        m.shares,
        m.saves,
        Number(m.reposts) || 0
      );
      point.postCount += 1;
    }

    const dailyTrends = Array.from(trendMap.values());

    // Analisis Performa per Pilar Konten (satu hitungan per postingan)
    const pillarMap = new Map<
      string,
      { posts: Set<string>; reach: number; impressions: number; eng: number }
    >();
    for (const m of currentMetrics) {
      const pillar = m.post.pillar || 'Lainnya';
      const entry =
        pillarMap.get(pillar) || {
          posts: new Set<string>(),
          reach: 0,
          impressions: 0,
          eng: 0,
        };
      entry.posts.add(m.post.id);
      entry.reach += m.reach || 0;
      entry.impressions += m.impressions || 0;
      entry.eng += metricFormulas.totalEngagements(
        m.likes,
        m.comments,
        m.shares,
        m.saves,
        Number(m.reposts) || 0
      );
      pillarMap.set(pillar, entry);
    }

    const pillarPerformances: PillarPerformance[] = Array.from(pillarMap.entries())
      .map(([pillar, data]) => ({
        pillar,
        postCount: data.posts.size,
        totalReach: data.reach,
        totalEngagements: data.eng,
        averageER: metricFormulas.engagementRate(data.eng, data.reach, data.impressions),
      }))
      .sort((a, b) => b.totalEngagements - a.totalEngagements);

    // Top Content Ranking: agregasi seluruh saluran per postingan
    const topPostsMap = new Map<string, TopPostItem>();
    for (const m of currentMetrics) {
      const post = m.post;
      const engagements = metricFormulas.totalEngagements(
        m.likes,
        m.comments,
        m.shares,
        m.saves,
        Number(m.reposts) || 0
      );
      const existing = topPostsMap.get(post.id);

      if (!existing) {
        topPostsMap.set(post.id, {
          post,
          metrics: [m],
          channels: [m.channel],
          scheduledAt: resolvePostDate(post)?.toISOString() || null,
          impressions: m.impressions || 0,
          reach: m.reach || 0,
          saves: m.saves || 0,
          shares: m.shares || 0,
          totalEngagements: engagements,
          engagementRate: 0,
        });
        continue;
      }

      existing.metrics.push(m);
      if (!existing.channels.includes(m.channel)) existing.channels.push(m.channel);
      existing.impressions += m.impressions || 0;
      existing.reach += m.reach || 0;
      existing.saves += m.saves || 0;
      existing.shares += m.shares || 0;
      existing.totalEngagements += engagements;
    }

    for (const item of topPostsMap.values()) {
      item.engagementRate = metricFormulas.engagementRate(
        item.totalEngagements,
        item.reach,
        item.impressions
      );
    }

    // Kandidat Top Content: ambil 5 teratas untuk tiap metrik agar filter
    // "Urutkan" di UI tetap akurat, bukan hanya 5 besar berdasarkan engagements.
    const rankedPosts = Array.from(topPostsMap.values());
    const candidateIds = new Set<string>();
    const rankingKeys: (keyof TopPostItem)[] = [
      'impressions',
      'reach',
      'engagementRate',
      'saves',
      'shares',
    ];
    for (const key of rankingKeys) {
      [...rankedPosts]
        .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
        .slice(0, 5)
        .forEach((item) => candidateIds.add(item.post.id));
    }

    const topPosts = rankedPosts
      .filter((item) => candidateIds.has(item.post.id))
      .sort((a, b) => b.impressions - a.impressions);

    // Kalkulasi Metrik Mendalam (Deep Insights) dari data nyata snapshot
    let watchTimeCount = 0;
    let totalWatchTimeSeconds = 0;
    let dropOffSum = 0;
    let dropOffCount = 0;
    let totalReposts = 0;
    const trafficSums: Record<string, number> = {};
    const trafficCounts: Record<string, number> = {};
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

      const ts = (m.traffic_sources || raw.traffic_sources) as Record<string, unknown> | undefined;
      if (ts) {
        for (const { key } of TRAFFIC_SOURCE_CATALOG) {
          const value = Number(ts[String(key)] || 0);
          if (value > 0) {
            trafficSums[String(key)] = (trafficSums[String(key)] || 0) + value;
            trafficCounts[String(key)] = (trafficCounts[String(key)] || 0) + 1;
          }
        }
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

    // Rata-rata sumber tayangan dari snapshot konten (hanya kategori bernilai > 0)
    const averageTraffic: TrafficSourceBreakdown = {};
    for (const { key } of TRAFFIC_SOURCE_CATALOG) {
      const count = trafficCounts[String(key)] || 0;
      if (count > 0) {
        averageTraffic[key] = Number(((trafficSums[String(key)] || 0) / count).toFixed(2));
      }
    }
    const trafficSourceItems = buildTrafficSourceItems(averageTraffic);

    const SOURCE_COLORS: Record<string, string> = {
      stories: 'bg-amber-500',
      profile: 'bg-emerald-600',
      feed: 'bg-purple-600',
      reels: 'bg-pink-600',
      explore: 'bg-blue-600',
      other: 'bg-slate-500',
    };

    const trafficSources = trafficSourceItems.map((item) => ({
      name: item.name,
      percentage: item.percentage,
      color: SOURCE_COLORS[item.key] || 'bg-slate-500',
    }));

    const audienceBreakdown = audienceCount > 0 ? {
      followers: Number((followersSum / audienceCount).toFixed(1)),
      nonFollowers: Number((nonFollowersSum / audienceCount).toFixed(1)),
    } : {
      followers: 0,
      nonFollowers: 0,
    };

    const hasVideoData = watchTimeCount > 0 || dropOffCount > 0 || totalReposts > 0
      || trafficSourceItems.length > 0 || audienceCount > 0;

    const deepInsights: DeepInsightsSummary = {
      avgWatchTime: formattedAvgWatchTime,
      dropOffRate: formattedDropOffRate,
      totalReposts,
      hasVideoData,
      trafficSources,
      audienceBreakdown,
    };

    // Ringkasan akun bulanan: sumber angka total utama di halaman Analitik.
    const accountMetrics = await this.getAccountMetrics(brandId, {
      channel: channel !== 'all' ? channel : undefined,
    });
    const accountInPeriod = accountMetrics.filter((item) => {
      const monthStart = new Date(`${item.period_month}-01T00:00:00`);
      const monthEnd = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      return monthEnd.getTime() >= currentStart.getTime() && monthStart.getTime() <= currentEnd.getTime();
    });
    const latestAccount = accountInPeriod[0] || null;
    const accountRows = latestAccount
      ? channel !== 'all'
        ? [latestAccount]
        : accountInPeriod.filter((item) => item.period_month === latestAccount.period_month)
      : [];

    const sumAccountField = (
      field: 'views' | 'reach' | 'interactions_total' | 'profile_visits' | 'follows' | 'followers_total'
    ) => accountRows.reduce((total, item) => total + (Number(item[field]) || 0), 0);

    const accountAudience = accountRows.reduce(
      (acc, item) => {
        acc.followers += Number(item.audience_breakdown?.followers || 0);
        acc.nonFollowers += Number(item.audience_breakdown?.non_followers || 0);
        return acc;
      },
      { followers: 0, nonFollowers: 0 }
    );

    const accountSummary: AccountSummary = latestAccount
      ? {
          hasData: true,
          periodMonth: latestAccount.period_month,
          // Saat filter "semua channel", angka total adalah gabungan channel
          // pada bulan terbaru agar tidak hanya mewakili satu platform.
          channel: channel !== 'all' ? latestAccount.channel : 'all',
          views: sumAccountField('views'),
          reach: sumAccountField('reach'),
          interactions: sumAccountField('interactions_total'),
          profileVisits: sumAccountField('profile_visits'),
          follows: sumAccountField('follows'),
          followersTotal: sumAccountField('followers_total'),
          engagementRate: metricFormulas.engagementRate(
            sumAccountField('interactions_total'),
            sumAccountField('reach'),
            sumAccountField('views')
          ),
          trafficSources: buildTrafficSourceItems(latestAccount.traffic_sources),
          audienceBreakdown: accountAudience,
          updatedAt: latestAccount.updated_at,
        }
      : EMPTY_ACCOUNT_SUMMARY;

    // Akumulasi konten: pelengkap, bukan reach unik.
    const contentSummary: ContentAggregateSummary = {
      postCount: currentAgg.postCount,
      snapshotCount: currentSnapshots.length,
      impressions: currentAgg.totalImpressions,
      reach: currentAgg.totalReach,
      engagements: currentAgg.totalEngagements,
      engagementRate: currentAgg.engagementRate,
      profileVisits: currentAgg.totalProfileVisits,
      follows: currentAgg.totalFollows,
      trafficSources: trafficSourceItems,
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
      recentSnapshots: currentSnapshots.slice(0, 15),
      deepInsights,
      accountSummary,
      contentSummary,
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
      // Gunakan pilar resmi brand agar data contoh tidak memunculkan pilar
      // yang tidak pernah diinput pengguna.
      const { data: brandRow } = await supabase
        .from('brands')
        .select('content_pillars')
        .eq('id', brandId)
        .maybeSingle();
      const brandPillars: string[] = Array.isArray(brandRow?.content_pillars)
        ? brandRow.content_pillars.map((pillar: unknown) => String(pillar || '').trim()).filter(Boolean)
        : [];
      const samplePillar = brandPillars[0] || '';

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
            pillar: samplePillar,
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
