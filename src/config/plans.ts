/**
 * Katalog paket ZaFlow.
 *
 * Satu sumber kebenaran untuk harga dasar, kuota AI, dan batas brand/anggota.
 * File ini sengaja tidak mengimpor apa pun agar aman dipakai di browser
 * maupun di server.
 */

export type PlanId = 'trial' | 'starter' | 'pro' | 'ultra';

export const TRIAL_DAYS = 3;
export const GRACE_PERIOD_DAYS = 3;
export const SOFT_DELETE_DAYS = 7;

export interface Plan {
  id: PlanId;
  name: string;
  /** Harga normal bulanan dalam Rupiah. */
  price: number;
  /** Harga promo bulanan dalam Rupiah. */
  promoPrice: number;
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
    promoPrice: 0,
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
    price: 29000,
    promoPrice: 19000,
    aiQuota: 100,
    maxBrands: 1,
    maxTeamMembers: 2,
    purchasable: true,
    tagline: 'Untuk kreator solo yang mulai serius',
    highlights: ['100 kredit AI/bulan', '1 brand', '2 anggota tim'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 59000,
    promoPrice: 39000,
    aiQuota: 300,
    maxBrands: 3,
    maxTeamMembers: 5,
    purchasable: true,
    tagline: 'Untuk tim konten yang berkembang',
    highlights: ['300 kredit AI/bulan', '3 brand', '5 anggota tim'],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    price: 119000,
    promoPrice: 79000,
    aiQuota: 1000,
    maxBrands: 10,
    maxTeamMembers: 15,
    purchasable: true,
    tagline: 'Untuk agensi dan tim besar',
    highlights: ['1.000 kredit AI/bulan', '10 brand', '15 anggota tim'],
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
  normalPrice: number;
  promoPrice: number;
  promoActive: boolean;
  promoStartsAt?: string | null;
  promoEndsAt?: string | null;
  promoLabel?: string | null;
}

export interface PricingSettings {
  currency: 'IDR';
  plans: Record<'starter' | 'pro' | 'ultra', PlanPricingOverride>;
}

export interface ResolvedPlanPrice {
  normalPrice: number;
  promoPrice: number;
  effectivePrice: number;
  isPromo: boolean;
  promoLabel: string | null;
  promoEndsAt: string | null;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  currency: 'IDR',
  plans: {
    starter: {
      normalPrice: PLAN_CATALOG.starter.price,
      promoPrice: PLAN_CATALOG.starter.promoPrice,
      promoActive: false,
      promoStartsAt: null,
      promoEndsAt: null,
      promoLabel: 'Promo Peluncuran',
    },
    pro: {
      normalPrice: PLAN_CATALOG.pro.price,
      promoPrice: PLAN_CATALOG.pro.promoPrice,
      promoActive: false,
      promoStartsAt: null,
      promoEndsAt: null,
      promoLabel: 'Promo Peluncuran',
    },
    ultra: {
      normalPrice: PLAN_CATALOG.ultra.price,
      promoPrice: PLAN_CATALOG.ultra.promoPrice,
      promoActive: false,
      promoStartsAt: null,
      promoEndsAt: null,
      promoLabel: 'Promo Peluncuran',
    },
  },
};

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isPromoWindowActive(promo: PlanPricingOverride, now = Date.now()): boolean {
  if (!promo.promoActive) return false;
  const startsAt = toTime(promo.promoStartsAt);
  const endsAt = toTime(promo.promoEndsAt);
  // Promo harus selalu punya batas waktu agar tidak berjalan tanpa akhir.
  if (endsAt === null) return false;
  if (startsAt !== null && now < startsAt) return false;
  if (now > endsAt) return false;
  return true;
}

export function resolvePlanPrice(
  planId: 'starter' | 'pro' | 'ultra',
  settings: PricingSettings | null | undefined,
  options?: { isRenewal?: boolean; now?: number }
): ResolvedPlanPrice {
  const plan = PLAN_CATALOG[planId];
  const override = settings?.plans?.[planId];
  const normalPrice = Math.max(
    0,
    Number(override?.normalPrice ?? plan.price) || plan.price
  );
  const promoPrice = Math.max(
    0,
    Number(override?.promoPrice ?? plan.promoPrice) || plan.promoPrice
  );
  const promo = override || DEFAULT_PRICING_SETTINGS.plans[planId];
  const promoWindowActive = isPromoWindowActive(promo, options?.now ?? Date.now());
  const promoValid = promoPrice > 0 && promoPrice < normalPrice;
  const isRenewal = Boolean(options?.isRenewal);
  const isPromo = promoWindowActive && promoValid && !isRenewal;

  return {
    normalPrice,
    promoPrice,
    effectivePrice: isPromo ? promoPrice : normalPrice,
    isPromo,
    promoLabel: isPromo ? (promo.promoLabel || 'Promo') : null,
    promoEndsAt: isPromo ? (promo.promoEndsAt || null) : null,
  };
}
