import { supabase, isConfigured } from '../../config/supabase.ts';
import { apiFetchJson } from '../http/apiClient.ts';

export interface AccessPlan {
  id: 'starter' | 'pro' | 'ultra';
  name: string;
  tagline: string;
  highlights: string[];
  aiQuota: number;
  maxBrands: number;
  maxTeamMembers: number;
  normalPrice: number;
  promoPrice: number;
  effectivePrice: number;
  isPromo: boolean;
  promoLabel: string | null;
  promoEndsAt: string | null;
  isRenewal: boolean;
}

export interface AccessLicense {
  id: string;
  license_key: string;
  plan_id: string;
  plan_name: string;
  max_brands: number;
  max_team_members: number;
  ai_quota_total: number;
  ai_quota_used: number;
  ai_quota_remaining: number;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  is_legacy_lifetime: boolean;
  days_remaining: number | null;
  grace_ends_at: string | null;
  is_expired: boolean;
}

export interface CustomerServiceInfo {
  whatsapp: string;
  label: string;
  message: string;
  active: boolean;
  whatsappUrl: string | null;
}

export interface PublicCustomerServiceInfo {
  active: boolean;
  whatsappUrl: string | null;
  label: string;
}

export interface AccessStatus {
  hasAccess: boolean;
  reason: 'owner' | 'subscription' | 'trial' | 'workspace' | 'none' | 'suspended' | 'pending_deletion' | string;
  accountStatus: string;
  isSuperAdmin: boolean;
  license: AccessLicense | null;
  trial: {
    available: boolean;
    requestOnly: boolean;
    reason: 'available' | 'admin' | 'account' | 'used' | 'paid' | 'workspace' | 'active';
    days: number;
    credits: number;
    maxBrands: number;
    maxTeamMembers: number;
  };
  plans: AccessPlan[];
  customerService: CustomerServiceInfo;
  workspace: { ownerId: string; brandId: string } | null;
  isRenewal: boolean;
  gracePeriodDays: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export const accessService = {
  async getStatus(): Promise<AccessStatus> {
    if (!isConfigured) {
      throw new Error('Layanan akun belum siap.');
    }
    const headers = await authHeaders();
    return apiFetchJson<AccessStatus>('/api/access/status', { headers });
  },

  async redeemCode(code: string): Promise<{ success: boolean; message: string }> {
    const headers = await authHeaders();
    return apiFetchJson<{ success: boolean; message: string }>('/api/activation/redeem', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
  },

  async createPayment(planId: string): Promise<{
    sandbox?: boolean;
    message?: string;
    redirectUrl?: string;
  }> {
    const headers = await authHeaders();
    return apiFetchJson('/api/payments/midtrans/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planId }),
    });
  },

  async getPublicCustomerService(): Promise<PublicCustomerServiceInfo> {
    return apiFetchJson<PublicCustomerServiceInfo>('/api/public/customer-service');
  },
};
