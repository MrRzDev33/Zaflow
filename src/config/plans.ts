/**
 * Katalog paket ZaFlow.
 *
 * Satu sumber kebenaran untuk harga, kuota AI, dan batas brand/anggota.
 * File ini sengaja tidak mengimpor apa pun agar aman dipakai di browser
 * maupun di server (BFF).
 */

export type PlanId = 'trial' | 'starter' | 'pro' | 'ultra';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
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
    aiQuota: 50,
    maxBrands: 1,
    maxTeamMembers: 1,
    purchasable: false,
    tagline: 'Coba ZaFlow tanpa biaya',
    highlights: ['50 kredit AI', '1 brand', '1 anggota (solo)'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 60000,
    aiQuota: 150,
    maxBrands: 1,
    maxTeamMembers: 2,
    purchasable: true,
    tagline: 'Untuk kreator solo yang mulai serius',
    highlights: ['150 kredit AI', '1 brand', '2 anggota tim'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99000,
    aiQuota: 350,
    maxBrands: 3,
    maxTeamMembers: 5,
    purchasable: true,
    tagline: 'Untuk tim konten yang berkembang',
    highlights: ['350 kredit AI', '3 brand', '5 anggota tim'],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    price: 150000,
    aiQuota: 2000,
    maxBrands: 999,
    maxTeamMembers: 999,
    purchasable: true,
    tagline: 'Untuk agensi dan tim besar',
    highlights: ['2.000 kredit AI', 'Brand & anggota hampir tanpa batas'],
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
