import { supabase } from '../../config/supabase.ts';
import { apiRequest } from '../http/apiClient.ts';

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
   * Ekstraksi metrik gambar/video insight melalui backend Express & Gemini
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

    const { ok, status, data: result } = await apiRequest<any>('/api/ai/metrics-extractor', {
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

    if (!ok) {
      const baseMessage = result.error || result.message || `Gagal memproses gambar analitik dengan AI (HTTP ${status}).`;
      const detail = typeof result.details === 'string'
        ? result.details.replace(/key=[^&\s]+/gi, 'key=***').slice(0, 400)
        : '';
      throw new Error(detail ? `${baseMessage} Detail: ${detail}` : baseMessage);
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

    const { ok, status, data: result } = await apiRequest<any>('/api/ai/strategy-assistant', {
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

    if (!ok) {
      throw new Error(result.error || result.message || `Gagal menghasilkan rekomendasi strategi AI (HTTP ${status}).`);
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

    try {
      const { ok, data } = await apiRequest('/api/ai/quota', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!ok) {
        return { remaining: 0, total: 0, used: 0, hasLicense: false };
      }

      return data;
    } catch {
      // Backend tidak aktif atau respons tidak valid: jangan hentikan UI.
      return { remaining: 0, total: 0, used: 0, hasLicense: false };
    }
  },
};
