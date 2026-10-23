import { supabase, isConfigured } from '../../config/supabase.ts';
import { apiFetchJson } from '../http/apiClient.ts';
import { LicenseQuotaInfo } from '../../types/license.ts';
import { License } from '../../types/database.ts';
import { accessService } from '../access/accessService.ts';

const emptyInfo = (): LicenseQuotaInfo => ({
  hasActiveLicense: false,
  license: null,
  aiCreditsTotal: 0,
  aiCreditsUsed: 0,
  aiCreditsRemaining: 0,
  percentageUsed: 0,
  maxBrands: 1,
  currentBrandCount: 0,
});

export const licenseService = {
  /**
   * Mengambil informasi lisensi dan sisa kuota AI pengguna.
   * Sumber utama adalah status akses agar anggota tim juga membaca paket
   * pemilik workspace.
   */
  async getLicenseInfo(): Promise<LicenseQuotaInfo> {
    if (!isConfigured) return emptyInfo();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return emptyInfo();

    try {
      const access = await accessService.getStatus();
      const license = access.license as License | null;
      if (!license) return emptyInfo();

      const total = Number(license.ai_quota_total) || 0;
      const used = Number(license.ai_quota_used) || 0;
      const remaining = Math.max(0, total - used);

      return {
        hasActiveLicense: access.hasAccess,
        license,
        aiCreditsTotal: total,
        aiCreditsUsed: used,
        aiCreditsRemaining: remaining,
        percentageUsed: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
        maxBrands: Number(license.max_brands) || 1,
        currentBrandCount: 0,
      };
    } catch {
      return emptyInfo();
    }
  },

  /**
   * Menukarkan kode aktivasi.
   */
  async activateLicense(licenseKey: string): Promise<{ success: boolean; message: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Sesi tidak ditemukan. Harap masuk terlebih dahulu.');
    }

    return apiFetchJson<{ success: boolean; message: string }>('/api/activation/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code: licenseKey }),
    });
  },
};
