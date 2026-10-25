/**
 * Katalog paket ZaFlow.
 *
 * Satu sumber kebenaran untuk harga paket 6 bulan, kuota AI, dan batas
 * brand/anggota. File ini sengaja tidak mengimpor apa pun agar aman dipakai di
 * browser maupun di server.
 *
 * Catatan:
 * - Tidak ada lagi promo. Harga di bawah adalah harga paket 6 bulan.
 * - Kuota AI adalah kuota total selama 6 bulan (bukan kuota bulanan).
 */

export type PlanId = 'trial' | 'starter' | 'pro' | 'ultra';

export const TRIAL_DAYS = 3;
export const PLAN_DURATION_DAYS = 180;
export const PLAN_DURATION_MONTHS = 6;
export const GRACE_PERIOD_DAYS = 3;
export const SOFT_DELETE_DAYS = 7;

export interface Plan {
  id: PlanId;
  name: string;
  /** Harga paket 6 bulan dalam Rupiah. */
  price: number;
  /** Kuota AI total selama 6 bulan. */
  aiQuota: number;
  maxBrands: number;
  maxTeamMembers: number;
  purchasable: boolean;
  tagline: string;
  highlights: string[];
}

export const PLAN_CATALOG: Record<PlanId, Plan> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: 0,
    aiQuota: 20,
    maxBrands: 1,
    maxTeamMembers: 1,
    purchasable: false,
    tagline: 'Coba ZaFlow selama 3 hari',
    highlights: ['20 kredit AI', '1 brand', '1 anggota (solo)', 'Aktif 3 hari'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 69000,
    aiQuota: 300,
    maxBrands: 1,
    maxTeamMembers: 2,
    purchasable: true,
    tagline: 'Untuk kreator solo yang mulai serius',
    highlights: ['300 kredit AI / 6 bulan', '1 brand', '2 anggota tim'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99000,
    aiQuota: 600,
    maxBrands: 3,
    maxTeamMembers: 5,
    purchasable: true,
    tagline: 'Untuk tim konten yang berkembang',
    highlights: ['600 kredit AI / 6 bulan', '3 brand', '5 anggota tim'],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    price: 130000,
    aiQuota: 1200,
    maxBrands: 10,
    maxTeamMembers: 15,
    purchasable: true,
    tagline: 'Untuk agensi dan tim besar',
    highlights: ['1.200 kredit AI / 6 bulan', '10 brand', '15 anggota tim'],
  },
};

export const TRIAL_PLAN = PLAN_CATALOG.trial;

export const PURCHASABLE_PLANS: Plan[] = [
  PLAN_CATALOG.starter,
  PLAN_CATALOG.pro,
  PLAN_CATALOG.ultra,
];

export function getPlan(planId: string | null | undefined): Plan | null {
  if (!planId) return null;
  const normalized = String(planId).trim().toLowerCase();
  return (PLAN_CATALOG as Record<string, Plan>)[normalized] || null;
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface PlanPricingOverride {
  /** Harga paket 6 bulan. */
  price: number;
}

export interface PricingSettings {
  currency: 'IDR';
  plans: Record<'starter' | 'pro' | 'ultra', PlanPricingOverride>;
}

export interface ResolvedPlanPrice {
  price: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  currency: 'IDR',
  plans: {
    starter: { price: PLAN_CATALOG.starter.price },
    pro: { price: PLAN_CATALOG.pro.price },
    ultra: { price: PLAN_CATALOG.ultra.price },
  },
};

export function resolvePlanPrice(
  planId: 'starter' | 'pro' | 'ultra',
  settings: PricingSettings | null | undefined
): ResolvedPlanPrice {
  const plan = PLAN_CATALOG[planId];
  const override = settings?.plans?.[planId];
  const price = Math.max(
    0,
    Number(override?.price ?? plan.price) || plan.price
  );
  return { price };
}
