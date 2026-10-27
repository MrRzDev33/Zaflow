/**
 * Definisi TypeScript untuk skema database Supabase PostgreSQL ZaFlow
 */

export type SystemRole = 'user' | 'super_admin';
export type BrandMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type ContentStatus = 'idea' | 'draft' | 'in_review' | 'approved' | 'scheduled' | 'published' | string;
export type ContentFormat = 'single_image' | 'carousel' | 'reel_short' | 'video' | 'story' | 'text_thread';
export type LicenseStatus = 'active' | 'trialing' | 'past_due' | 'expired' | 'revoked' | 'canceled';
export type AccountStatus = 'active' | 'suspended' | 'pending_deletion';
export type MetricSource = 'manual' | 'ai_screenshot' | 'ai_video';

export interface WorkflowStatusConfig {
  id: string;
  title: string;
  dotColor: string;
  headerBg: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  system_role: SystemRole;
  status?: AccountStatus;
  deleted_at?: string | null;
  trial_used_at?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  license_key: string;
  plan_id?: 'trial' | 'starter' | 'pro' | 'ultra' | string | null;
  plan_name: string;
  max_brands: number;
  max_team_members: number;
  ai_quota_total: number;
  ai_quota_used: number;
  status: LicenseStatus;
  owner_user_id?: string | null;
  activated_at?: string | null;
  billing_cycle?: 'semiannual' | 'monthly' | 'trial' | 'lifetime' | string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  auto_renew?: boolean;
  cancel_at_period_end?: boolean;
  is_legacy_lifetime?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialAccounts {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  facebook?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  description?: string | null;
  logo_url?: string | null;
  color_hex: string;
  social_accounts: SocialAccounts;
  platforms?: string[];
  content_pillars?: string[];
  workflow_statuses?: WorkflowStatusConfig[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandMember {
  id: string;
  brand_id: string;
  user_id: string;
  role: BrandMemberRole;
  created_at: string;
  profile?: Profile;
}

export interface ContentPost {
  id: string;
  brand_id: string;
  title: string;
  caption?: string | null;
  hashtags: string[];
  channels: string[];
  format: ContentFormat;
  pillar: string;
  status: ContentStatus;
  scheduled_at?: string | null;
  posted_at?: string | null;
  production_date?: string | null;
  brief?: string | null;
  post_url?: string | null;
  media_urls: string[];
  author_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sumber tayangan teratas. Untuk Instagram memakai enam kategori resmi,
 * platform lain memakai subset yang sama agar tetap bisa dibandingkan.
 */
export interface TrafficSourceBreakdown {
  stories?: number;
  profile?: number;
  feed?: number;
  reels?: number;
  explore?: number;
  other?: number;
}

export interface AudienceBreakdown {
  followers?: number;
  non_followers?: number;
}

/** Faktor yang memengaruhi tayangan, berurutan sesuai prioritas Instagram. */
export interface ViewFactorItem {
  key: string;
  label: string;
  value: number;
  rank: number;
}

export interface InsightSeriesPoint {
  label: string;
  value: number;
}

/** Titik kurva retensi: percent = posisi video (0-100), retention = penonton tersisa (0-100). */
export interface RetentionPoint {
  percent: number;
  retention: number;
}

export interface AudienceAgeBucket {
  range: string;
  percentage: number;
}

export interface AudienceCountryItem {
  country: string;
  percentage: number;
}

export interface AudienceGenderBreakdown {
  male: number;
  female: number;
  other: number;
}

export interface AudienceDetails {
  ages: AudienceAgeBucket[];
  countries: AudienceCountryItem[];
  gender: AudienceGenderBreakdown | null;
}

export interface ContentInsightsSeries {
  views: InsightSeriesPoint[];
  likes: InsightSeriesPoint[];
  retention: RetentionPoint[];
}

/** Detail insight per postingan (khusus Instagram). */
export interface ContentInsightsDetail {
  viewFactors: ViewFactorItem[];
  trafficSources: TrafficSourceBreakdown;
  audience: AudienceBreakdown;
  audienceDetails: AudienceDetails;
  series: ContentInsightsSeries;
  /** true jika deret grafik diestimasi AI dari gambar, bukan angka pasti. */
  approximate: boolean;
}

export type ContentInsightType = 'reel' | 'feed' | 'carousel' | 'story';

export interface DeepMetricsData {
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  profile_visits?: number | null;
  follows?: number | null;
  content_type?: ContentInsightType | string | null;
  traffic_sources?: TrafficSourceBreakdown | null;
  audience_breakdown?: AudienceBreakdown | null;
  insights_detail?: ContentInsightsDetail | null;
}

export interface ContentMetric {
  id: string;
  post_id?: string | null;
  brand_id: string;
  channel: string;
  impressions: number;
  reach: number;
  engagement_rate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  profile_visits?: number | null;
  follows?: number | null;
  content_type?: ContentInsightType | string | null;
  source: MetricSource;
  raw_ai_analysis?: (Record<string, unknown> & DeepMetricsData) | null;
  recorded_at: string;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: TrafficSourceBreakdown | null;
  audience_breakdown?: AudienceBreakdown | null;
  insights_detail?: ContentInsightsDetail | null;
}

/**
 * Ringkasan akun bulanan dari dashboard profesional Instagram.
 * Disimpan terpisah dari metrik per konten agar tidak tercampur saat agregasi.
 */
export interface AccountMetric {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export interface AiUsageLog {
  id: string;
  user_id: string;
  brand_id?: string | null;
  action_type: 'metrics_extractor' | 'strategy_assistant' | 'caption_writer';
  tokens_consumed: number;
  credits_deducted: number;
  prompt_summary?: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  brand_id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}
