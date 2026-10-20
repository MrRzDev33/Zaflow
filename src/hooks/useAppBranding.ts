import { useState, useEffect, useCallback } from 'react';
import { brandingService, AppBranding, DEFAULT_BRANDING } from '../services/brandingService.ts';

export function useAppBranding() {
  const [branding, setBranding] = useState<AppBranding>(() => brandingService.getBranding());

  useEffect(() => {
    return brandingService.subscribe((updated) => {
      setBranding(updated);
    });
  }, []);

  const updateLogoUrl = useCallback((url: string | null) => {
    const updated = brandingService.setLogoUrl(url);
    setBranding(updated);
    return updated;
  }, []);

  const uploadLogoFile = useCallback(async (file: File) => {
    const dataUrl = await brandingService.uploadLogoFile(file);
    setBranding(brandingService.getBranding());
    return dataUrl;
  }, []);

  const resetLogo = useCallback(() => {
    const updated = brandingService.resetLogo();
    setBranding(updated);
    return updated;
  }, []);

  return {
    branding,
    logoUrl: branding.logoUrl,
    appName: branding.appName || 'ZaFlow',
    isCustomLogo: Boolean(branding.logoUrl),
    updateLogoUrl,
    uploadLogoFile,
    resetLogo,
  };
}
