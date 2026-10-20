import { License } from './database.ts';

export interface LicenseQuotaInfo {
  hasActiveLicense: boolean;
  license: License | null;
  aiCreditsTotal: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  percentageUsed: number;
  maxBrands: number;
  currentBrandCount: number;
}

export interface ActivateLicenseRequest {
  licenseKey: string;
}

export interface ActivateLicenseResponse {
  success: boolean;
  message: string;
  license?: License;
}
