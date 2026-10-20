import { supabase } from '../../config/supabase.ts';

async function readJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export interface ExtractedMetricsData {
  channel: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  confidence: number;
  detected_title?: string | null;
  summary: string;
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

export interface ExtractMetricsResponse {
  success: boolean;
  data: ExtractedMetricsData;
  remainingCredits: number;
  totalCredits?: number;
}

export interface ContentActionPlanItem {
  hook: string;
  pillar: string;
  format: string;
  channel: string;
  rationale: string;
}

export interface StrategyResultData {
  brand_overview: string;
  verified_historical_facts: string[];
  key_insights: string[];
  strategic_recommendations: string[];
  content_action_plan: ContentActionPlanItem[];
  disclaimer: string;
}

export interface StrategyResponse {
  success: boolean;
  strategy: StrategyResultData;
  remainingCredits: number;
  totalCredits?: number;
}

export const aiClientService = {
  /**
   * Ekstraksi metrik gambar insight melalui backend Express & Gemini 3.8 Flash
   * Server memeriksa otorisasi brand, batasan file, dan memotong 1 kredit kuota
   */
  async extractMetricsFromImage(
    brandId: string,
    imageBase64: string,
    mimeType: string,
    channel: string = 'Instagram'
  ): Promise<ExtractMetricsResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Anda harus masuk untuk menggunakan fitur AI.');
    }

    const response = await fetch('/api/ai/metrics-extractor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        brandId,
        imageBase64,
        mimeType,
        channel,
      }),
    });

    const result = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(result.error || result.message || `Gagal memproses gambar analitik dengan AI (HTTP ${response.status}).`);
    }

    return {
      success: result.success,
      data: result.data || result.metrics || {},
      remainingCredits: result.remainingCredits,
      totalCredits: result.totalCredits,
    } as ExtractMetricsResponse;
  },

  /**
   * Pembuatan rekomendasi strategi konten berbasis data historis nyata di Supabase
   * Menghasilkan pemisahan tegas antara fakta data dan rekomendasi strategis
   */
  async generateStrategyAdvice(
    brandId: string,
    objective: string,
    customNotes?: string
  ): Promise<StrategyResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Anda harus masuk untuk menggunakan fitur AI.');
    }

    const response = await fetch('/api/ai/strategy-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        brandId,
        objective,
        customNotes,
      }),
    });

    const result = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(result.error || result.message || `Gagal menghasilkan rekomendasi strategi AI (HTTP ${response.status}).`);
    }

    return result as StrategyResponse;
  },

  /**
   * Mengambil status saldo kuota kredit AI terkini dari server
   */
  async getQuota(): Promise<{ remaining: number; total: number; used: number; hasLicense: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { remaining: 0, total: 0, used: 0, hasLicense: false };
    }

    const response = await fetch('/api/ai/quota', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return { remaining: 0, total: 0, used: 0, hasLicense: false };
    }

    return response.json();
  },
};
