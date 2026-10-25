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

export interface DeepMetricsData {
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: {
    reels?: number;
    feed?: number;
    explore?: number;
    profile?: number;
    other?: number;
  } | null;
  audience_breakdown?: {
    followers?: number;
    non_followers?: number;
  } | null;
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
  source: MetricSource;
  raw_ai_analysis?: (Record<string, unknown> & DeepMetricsData) | null;
  recorded_at: string;
  watch_time?: string | null;
  drop_off_rate?: number | null;
  reposts?: number | null;
  traffic_sources?: {
    reels?: number;
    feed?: number;
    explore?: number;
    profile?: number;
    other?: number;
  } | null;
  audience_breakdown?: {
    followers?: number;
    non_followers?: number;
  } | null;
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
