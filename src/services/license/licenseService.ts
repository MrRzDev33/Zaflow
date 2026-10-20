import { supabase, isConfigured } from '../../config/supabase.ts';
import { apiFetchJson } from '../http/apiClient.ts';
import { LicenseQuotaInfo } from '../../types/license.ts';
import { License } from '../../types/database.ts';
import { TRIAL_PLAN } from '../../config/plans.ts';

const trialInfo = (): LicenseQuotaInfo => ({
  hasActiveLicense: false,
  license: null,
  aiCreditsTotal: TRIAL_PLAN.aiQuota,
  aiCreditsUsed: 0,
  aiCreditsRemaining: TRIAL_PLAN.aiQuota,
  percentageUsed: 0,
  maxBrands: TRIAL_PLAN.maxBrands,
  currentBrandCount: 0,
});

export const licenseService = {
  /**
   * Mengambil informasi lisensi dan sisa kuota AI pengguna
   */
  async getLicenseInfo(): Promise<LicenseQuotaInfo> {
    if (!isConfigured) {
      return trialInfo();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        hasActiveLicense: false,
        license: null,
        aiCreditsTotal: 0,
        aiCreditsUsed: 0,
        aiCreditsRemaining: 0,
        percentageUsed: 0,
        maxBrands: 0,
        currentBrandCount: 0,
      };
    }

    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) {
      // Lisensi trial dibuat otomatis oleh trigger/RPC saat AI pertama kali dipakai.
      // UI menampilkan kuota trial tanpa mengklaim lisensi berbayar.
      return trialInfo();
    }

    const license = data as License;
    const remaining = Math.max(0, license.ai_quota_total - license.ai_quota_used);
    const percentage = license.ai_quota_total > 0
      ? Math.min(100, Math.round((license.ai_quota_used / license.ai_quota_total) * 100))
      : 0;

    return {
      hasActiveLicense: true,
      license,
      aiCreditsTotal: license.ai_quota_total,
      aiCreditsUsed: license.ai_quota_used,
      aiCreditsRemaining: remaining,
      percentageUsed: percentage,
      maxBrands: license.max_brands,
      currentBrandCount: 0,
    };
  },

  /**
   * Mengaktifkan lisensi sekali bayar melalui endpoint backend server
   */
  async activateLicense(licenseKey: string): Promise<{ success: boolean; message: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Sesi tidak ditemukan. Harap masuk terlebih dahulu.');
    }

    return apiFetchJson<{ success: boolean; message: string }>('/api/license/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ licenseKey }),
    });
  },
};
