import { useState, useEffect, useCallback } from 'react';
import { licenseService } from '../services/license/licenseService.ts';
import { LicenseQuotaInfo } from '../types/license.ts';
import { TRIAL_PLAN } from '../config/plans.ts';

export function useLicense(userId: string | undefined) {
  const [quotaInfo, setQuotaInfo] = useState<LicenseQuotaInfo>({
    hasActiveLicense: false,
    license: null,
    aiCreditsTotal: TRIAL_PLAN.aiQuota,
    aiCreditsUsed: 0,
    aiCreditsRemaining: TRIAL_PLAN.aiQuota,
    percentageUsed: 0,
    maxBrands: TRIAL_PLAN.maxBrands,
    currentBrandCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLicense = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const info = await licenseService.getLicenseInfo();
      setQuotaInfo(info);
    } catch (err) {
      console.warn('Gagal memuat info lisensi:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  const activate = useCallback(async (key: string) => {
    const res = await licenseService.activateLicense(key);
    await fetchLicense();
    return res;
  }, [fetchLicense]);

  return {
    ...quotaInfo,
    loading,
    refreshLicense: fetchLicense,
    activateLicense: activate,
  };
}
