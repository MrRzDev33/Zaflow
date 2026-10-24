import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_PRICING_SETTINGS,
  GRACE_PERIOD_DAYS,
  PURCHASABLE_PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  getPlan,
  resolvePlanPrice,
  type PricingSettings,
} from '../config/plans.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local menang atas .env, lalu .env menjadi fallback.
// Path dihitung dari lokasi app.ts (src/server) menuju root proyek.
// Di Vercel, variabel environment sudah disuntikkan oleh platform.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);

// Vercel dapat menyediakan req.body yang sudah diparse. Tandai agar
// express.json() tidak mencoba membaca stream yang sudah habis.
app.use((req, _res, next) => {
  if (
    req.body !== undefined &&
    req.body !== null &&
    typeof req.body === 'object' &&
    !Buffer.isBuffer(req.body)
  ) {
    (req as any)._body = true;
  }
  next();
});

// Simpan raw body untuk verifikasi webhook generik, tanpa mengganggu parser JSON.
// 4.5mb disesuaikan dengan batas request body Vercel Functions.
app.use(express.json({
  limit: '4.5mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));

// Header keamanan dasar. CSP tidak dipasang agar tidak memblokir aset Vite/Supabase.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const hasSupabaseAdmin = Boolean(supabaseUrl && supabaseServiceKey);

const supabaseAdmin = hasSupabaseAdmin
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const hasGeminiKey = geminiApiKey.length > 0;

// Model lama seperti gemini-2.5-flash / gemini-2.0-flash sudah ditolak untuk
// API key baru (404). Model modern diletakkan lebih dulu, lalu daftar dari env
// tetap dipakai sebagai fallback agar deployment lama tidak langsung rusak.
const modernGeminiModels = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];
const configuredGeminiModels = (process.env.GEMINI_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const geminiModels = Array.from(new Set([...modernGeminiModels, ...configuredGeminiModels]));

const requestedGeminiTimeout = Math.max(
  10_000,
  Number(process.env.GEMINI_TIMEOUT_MS) || (process.env.VERCEL ? 50_000 : 120_000)
);
// Vercel Functions dibatasi maxDuration 60 detik (lihat vercel.json).
// Cap 55 detik agar Gemini tidak melewati batas function.
const geminiTimeoutMs = process.env.VERCEL
  ? Math.min(requestedGeminiTimeout, 55_000)
  : requestedGeminiTimeout;
// Batas total seluruh percobaan fallback. Satu model yang menggantung tidak
// boleh menghabiskan seluruh durasi function sebelum model lain dicoba.
const geminiTotalBudgetMs = process.env.VERCEL
  ? Math.min(geminiTimeoutMs, 52_000)
  : Math.min(geminiTimeoutMs, 180_000);

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!hasGeminiKey) {
    throw new Error('Layanan AI belum tersedia.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'zaflow-server',
        },
      },
    });
  }
  return aiClient;
}

function normalizeSecret(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');
}

function detectMidtransKeyMode(key: string): 'sandbox' | 'production' | 'unknown' {
  if (!key) return 'unknown';
  if (key.startsWith('SB-Mid-')) return 'sandbox';
  if (key.startsWith('Mid-')) return 'production';
  return 'unknown';
}

// Konfigurasi Midtrans.
const midtransServerKey = normalizeSecret(process.env.MIDTRANS_SERVER_KEY);
const midtransClientKey = normalizeSecret(process.env.MIDTRANS_CLIENT_KEY);
const midtransIsProduction = String(process.env.MIDTRANS_IS_PRODUCTION || 'false').trim().toLowerCase() === 'true';
const midtransBaseUrl = midtransIsProduction
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';
const hasMidtrans = midtransServerKey.length > 0;
const midtransServerKeyMode = detectMidtransKeyMode(midtransServerKey);
const midtransClientKeyMode = detectMidtransKeyMode(midtransClientKey);
const midtransKeyModeMismatch =
  hasMidtrans &&
  midtransServerKeyMode !== 'unknown' &&
  ((midtransIsProduction && midtransServerKeyMode === 'sandbox') ||
    (!midtransIsProduction && midtransServerKeyMode === 'production'));
const midtransClientKeyModeMismatch =
  midtransClientKey.length > 0 &&
  midtransClientKeyMode !== 'unknown' &&
  midtransClientKeyMode !== midtransServerKeyMode;
const appUrl = (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const allowSandboxCheckout = String(process.env.ALLOW_SANDBOX_CHECKOUT || 'false').trim().toLowerCase() === 'true';

if (!hasSupabaseAdmin) {
  console.warn(
    '[ZaFlow] SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL belum diisi. ' +
    'Isi file .env.local di root proyek (sejajar package.json), lalu restart server.'
  );
}
if (!hasMidtrans) {
  console.warn('[ZaFlow] MIDTRANS_SERVER_KEY belum diisi. Checkout Midtrans tidak akan tersedia.');
} else if (midtransKeyModeMismatch) {
  console.warn(
    `[ZaFlow] Konfigurasi Midtrans tidak cocok: MIDTRANS_IS_PRODUCTION=${midtransIsProduction} ` +
    `tetapi MIDTRANS_SERVER_KEY terdeteksi ${midtransServerKeyMode}. ` +
    (midtransIsProduction
      ? 'Gunakan Server Key Production (prefix Mid-server-) atau set MIDTRANS_IS_PRODUCTION=false untuk sandbox.'
      : 'Gunakan Server Key Sandbox (prefix SB-Mid-server-) atau set MIDTRANS_IS_PRODUCTION=true untuk production.')
  );
}
if (midtransClientKeyModeMismatch) {
  console.warn(
    `[ZaFlow] MIDTRANS_CLIENT_KEY terdeteksi ${midtransClientKeyMode}, ` +
    `berbeda dengan MIDTRANS_SERVER_KEY (${midtransServerKeyMode}). Gunakan key dari environment Midtrans yang sama.`
  );
}

type MidtransNotification = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  [key: string]: unknown;
};

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyMidtransSignature(payload: MidtransNotification): boolean {
  if (!hasMidtrans) return false;
  const orderId = String(payload.order_id || '');
  const statusCode = String(payload.status_code || '');
  const grossAmount = String(payload.gross_amount || '');
  const signature = String(payload.signature_key || '');
  if (!orderId || !statusCode || !grossAmount || !signature) return false;

  const expected = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${midtransServerKey}`)
    .digest('hex');

  return safeEqualHex(expected, signature);
}

function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): string {
  switch (transactionStatus) {
    case 'settlement':
      return 'success';
    case 'capture':
      if (fraudStatus === 'challenge') return 'pending';
      return 'success';
    case 'pending':
    case 'authorize':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    case 'expire':
      return 'expired';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    default:
      return 'pending';
  }
}

function generateOrderId(): string {
  return `ZF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generateLicenseKey(planId: string): string {
  const segment = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ZF-${planId.toUpperCase()}-${segment()}-${segment()}-${segment()}`;
}

function generateActivationCode(planId: string): string {
  const segment = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ZF-${planId.toUpperCase()}-${segment()}-${segment()}`;
}

interface AppSettingsRow {
  key: string;
  value: any;
  updated_at?: string | null;
}

async function readAppSetting<T>(key: string, fallback: T): Promise<T> {
  if (!supabaseAdmin) return fallback;
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data?.value) return fallback;
    return data.value as T;
  } catch {
    return fallback;
  }
}

async function writeAppSetting(key: string, value: unknown, updatedBy?: string | null): Promise<void> {
  if (!supabaseAdmin) throw new Error('Layanan pengaturan belum siap.');
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert(
      {
        key,
        value,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  if (error) throw error;
}

async function getPricingSettings(): Promise<PricingSettings> {
  const stored = await readAppSetting<any>('pricing', DEFAULT_PRICING_SETTINGS);
  if (!stored || typeof stored !== 'object' || !stored.plans) return DEFAULT_PRICING_SETTINGS;
  return {
    currency: 'IDR',
    plans: {
      starter: { ...DEFAULT_PRICING_SETTINGS.plans.starter, ...(stored.plans.starter || {}) },
      pro: { ...DEFAULT_PRICING_SETTINGS.plans.pro, ...(stored.plans.pro || {}) },
      ultra: { ...DEFAULT_PRICING_SETTINGS.plans.ultra, ...(stored.plans.ultra || {}) },
    },
  };
}

export interface CustomerServiceSettings {
  whatsapp: string;
  label: string;
  message: string;
  active: boolean;
}

const DEFAULT_CUSTOMER_SERVICE: CustomerServiceSettings = {
  whatsapp: '',
  label: 'Bantuan ZaFlow',
  message: 'Halo, saya ingin bertanya tentang ZaFlow.',
  active: false,
};

async function getCustomerServiceSettings(): Promise<CustomerServiceSettings> {
  const stored = await readAppSetting<any>('customer_service', DEFAULT_CUSTOMER_SERVICE);
  return {
    whatsapp: String(stored?.whatsapp || ''),
    label: String(stored?.label || DEFAULT_CUSTOMER_SERVICE.label),
    message: String(stored?.message || DEFAULT_CUSTOMER_SERVICE.message),
    active: Boolean(stored?.active),
  };
}

function normalizeWhatsAppNumber(value: string): string {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function buildWhatsAppUrl(settings: CustomerServiceSettings): string | null {
  const number = normalizeWhatsAppNumber(settings.whatsapp);
  if (!settings.active || !number) return null;
  const text = encodeURIComponent(settings.message || DEFAULT_CUSTOMER_SERVICE.message);
  return `https://wa.me/${number}?text=${text}`;
}

interface NormalizedLicense {
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

function normalizeLicense(license: any): NormalizedLicense | null {
  if (!license) return null;
  const now = Date.now();
  const periodEnd = license.current_period_end ? new Date(license.current_period_end).getTime() : null;
  const isLegacy = Boolean(license.is_legacy_lifetime);
  const isTrial = license.plan_id === 'trial' || license.status === 'trialing';
  const graceMs = isTrial ? 0 : GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const hasEnded = !isLegacy && periodEnd !== null && periodEnd < now;
  const graceEnds = hasEnded && graceMs > 0 ? periodEnd + graceMs : null;
  const isExpired = hasEnded && (now > periodEnd + graceMs);
  const daysRemaining = periodEnd === null
    ? null
    : Math.max(0, Math.ceil((periodEnd - now) / (24 * 60 * 60 * 1000)));

  return {
    id: license.id,
    license_key: license.license_key,
    plan_id: license.plan_id || 'trial',
    plan_name: license.plan_name || 'Trial',
    max_brands: Number(license.max_brands) || 1,
    max_team_members: Number(license.max_team_members) || 1,
    ai_quota_total: Number(license.ai_quota_total) || 0,
    ai_quota_used: Number(license.ai_quota_used) || 0,
    ai_quota_remaining: Math.max(0, (Number(license.ai_quota_total) || 0) - (Number(license.ai_quota_used) || 0)),
    status: license.status,
    billing_cycle: license.billing_cycle || (license.plan_id === 'trial' ? 'trial' : 'monthly'),
    current_period_start: license.current_period_start || null,
    current_period_end: license.current_period_end || null,
    is_legacy_lifetime: isLegacy,
    days_remaining: isLegacy ? null : daysRemaining,
    grace_ends_at: graceEnds ? new Date(graceEnds).toISOString() : null,
    is_expired: isExpired,
  };
}

async function getProfileRow(userId: string): Promise<any | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

async function isPlatformOwner(userId: string): Promise<boolean> {
  const profile = await getProfileRow(userId);
  return profile?.system_role === 'super_admin';
}

async function requirePlatformOwner(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk kembali.' });
    return null;
  }
  if (!(await isPlatformOwner(user.id))) {
    res.status(403).json({ error: 'Anda tidak memiliki akses ke halaman ini.' });
    return null;
  }
  return user;
}

async function writeAdminAudit(params: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId || null,
      details: params.details || {},
    });
  } catch (error) {
    console.warn('Gagal menulis audit admin:', error);
  }
}

async function getAuthEmailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAdmin) return map;
  try {
    let page = 1;
    while (page <= 10) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const user of data.users) {
        if (user.id) map.set(user.id, user.email || '');
      }
      if (data.users.length < 1000) break;
      page += 1;
    }
  } catch {
    // Abaikan; email hanya pelengkap tampilan admin.
  }
  return map;
}

/**
 * Trial lama yang dibuat otomatis oleh trigger pendaftaran versi sebelumnya
 * memakai kuota 50. Trial yang dipilih manual dari halaman paket memakai 20.
 * Lisensi lama ini tidak boleh memberi akses dan tidak boleh menghalangi
 * pengguna memulai trial secara manual.
 */
function isLegacyAutoTrialLicense(license: any): boolean {
  if (!license || license.is_legacy_lifetime) return false;
  const isTrial = license.plan_id === 'trial' || /^trial$/i.test(String(license.plan_name || '').trim());
  return isTrial && Number(license.ai_quota_total) === 50;
}

function isTrialLicenseRow(license: any): boolean {
  if (!license) return false;
  return (
    license.plan_id === 'trial' ||
    license.status === 'trialing' ||
    /^trial$/i.test(String(license.plan_name || '').trim())
  );
}

/**
 * Trial hanya boleh diberikan lewat kode aktivasi dari customer service.
 * Lisensi trial yang tidak berasal dari penukaran kode (misalnya sisa trial
 * otomatis dari trigger pendaftaran versi lama) tidak boleh membuka Workspace.
 */
async function isTrialFromActivationCode(userId: string): Promise<boolean> {
  if (!supabaseAdmin || !userId) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('activation_codes')
      .select('id')
      .eq('plan_id', 'trial')
      .eq('redeemed_by', userId)
      .limit(1);
    if (error) {
      console.warn('Gagal memeriksa kode trial:', error.message);
      return false;
    }
    return Boolean(data && data.length);
  } catch (error) {
    console.warn('Gagal memeriksa kode trial:', error);
    return false;
  }
}

/**
 * Menentukan lisensi yang benar-benar boleh memberi akses. Trial otomatis lama
 * dan trial yang tidak berasal dari kode aktivasi selalu ditolak.
 */
async function resolveGrantedLicense(userId: string, license: any): Promise<any | null> {
  if (!license) return null;
  if (isLegacyAutoTrialLicense(license)) return null;
  if (isTrialLicenseRow(license) && !(await isTrialFromActivationCode(userId))) {
    return null;
  }
  return license;
}

async function markLegacyAutoTrials(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data: userLicenses } = await supabaseAdmin
      .from('licenses')
      .select('id, plan_id, plan_name, ai_quota_total, ai_quota_used, is_legacy_lifetime')
      .eq('owner_user_id', userId);

    const autoTrialLicenses = (userLicenses || [])
      .filter((license: any) => isLegacyAutoTrialLicense(license));
    const autoTrialIds = autoTrialLicenses.map((license: any) => license.id);
    const autoTrialWasUsed = autoTrialLicenses.some((license: any) => Number(license.ai_quota_used) > 0);

    if (autoTrialIds.length === 0) return false;

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('licenses')
      .update({
        plan_id: 'legacy_auto_trial',
        plan_name: 'Trial lama',
        status: 'expired',
        billing_cycle: 'legacy',
        current_period_end: now,
        auto_renew: false,
        cancel_at_period_end: true,
        is_legacy_lifetime: false,
        updated_at: now,
      })
      .in('id', autoTrialIds);

    if (error) return false;

    const { data: realTrialRows, error: realTrialError } = await supabaseAdmin
      .from('licenses')
      .select('id')
      .eq('owner_user_id', userId)
      .eq('plan_id', 'trial')
      .limit(1);

    if (!realTrialError && (!realTrialRows || realTrialRows.length === 0) && !autoTrialWasUsed) {
      await supabaseAdmin
        .from('profiles')
        .update({ trial_used_at: null, updated_at: now })
        .eq('id', userId);
    }

    return true;
  } catch (error) {
    console.warn('Gagal membersihkan trial otomatis lama:', error);
    return false;
  }
}

async function hasPriorPaidAccess(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data: licenses } = await supabaseAdmin
    .from('licenses')
    .select('id, plan_id')
    .eq('owner_user_id', userId)
    .limit(30);
  if ((licenses || []).some((license: any) => (
    license.plan_id
    && license.plan_id !== 'trial'
    && license.plan_id !== 'legacy_auto_trial'
  ))) return true;

  const { data: paidTx } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['success', 'settlement'])
    .limit(1)
    .maybeSingle();
  return Boolean(paidTx?.id);
}

async function getBrandOwnerId(brandId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data } = await supabaseAdmin
      .from('brands')
      .select('created_by')
      .eq('id', brandId)
      .maybeSingle();
    if (data?.created_by) return data.created_by;

    const { data: ownerMember } = await supabaseAdmin
      .from('brand_members')
      .select('user_id')
      .eq('brand_id', brandId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    return ownerMember?.user_id || null;
  } catch {
    return null;
  }
}

async function getWorkspaceAccessOwner(userId: string): Promise<{ ownerId: string; brandId: string } | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data: memberships } = await supabaseAdmin
      .from('brand_members')
      .select('brand_id, role')
      .eq('user_id', userId)
      .neq('role', 'owner');
    if (!memberships?.length) return null;

    const brandIds = memberships.map((row: any) => row.brand_id).filter(Boolean);
    if (!brandIds.length) return null;

    const { data: brands } = await supabaseAdmin
      .from('brands')
      .select('id, created_by')
      .in('id', brandIds);
    if (!brands?.length) return null;

    for (const brand of brands) {
      if (!brand.created_by || brand.created_by === userId) continue;
      const ownerProfile = await getProfileRow(brand.created_by);
      if (ownerProfile?.status && ownerProfile.status !== 'active') continue;
      const license = await resolveGrantedLicense(brand.created_by, await getActiveLicenseRow(brand.created_by));
      if (license) return { ownerId: brand.created_by, brandId: brand.id };
    }
  } catch {
    // Abaikan; gate akan menampilkan pilihan paket.
  }
  return null;
}

async function getActiveLicenseRow(userId: string): Promise<any | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc('get_active_license', { p_user_id: userId });
    if (!error) {
      if (!data) return null;
      return Array.isArray(data) ? (data[0] || null) : data;
    }
    if (!isMissingRpcError(error)) return null;
  } catch {
    // Fallback ke query langsung untuk database lama.
  }

  const { data: rows } = await supabaseAdmin
    .from('licenses')
    .select('*')
    .eq('owner_user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(5);

  const now = Date.now();
  const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return (rows || []).find((license: any) => {
    if (license.is_legacy_lifetime) return true;
    // Skema lama belum memiliki perioda langganan. Paket berbayar lama tetap
    // dianggap sebagai akses lama, tetapi trial lama tanpa perioda tidak boleh
    // memberi akses otomatis.
    if (!('current_period_end' in license)) {
      const isTrial = license.plan_id === 'trial' || /^trial$/i.test(String(license.plan_name || '').trim());
      return !isTrial;
    }
    if (!license.current_period_end) return false;
    const end = new Date(license.current_period_end).getTime();
    if (!Number.isFinite(end)) return false;
    const hasGrace = license.status === 'active' || license.status === 'past_due';
    return end > now - (hasGrace ? graceMs : 0);
  }) || null;
}

function buildPlanPayload(
  pricing: PricingSettings,
  options: { isRenewal: boolean }
) {
  return PURCHASABLE_PLANS.map((plan) => {
    const resolved = resolvePlanPrice(plan.id as 'starter' | 'pro' | 'ultra', pricing, {
      isRenewal: options.isRenewal,
    });
    return {
      id: plan.id,
      name: plan.name,
      tagline: plan.tagline,
      highlights: plan.highlights,
      aiQuota: plan.aiQuota,
      maxBrands: plan.maxBrands,
      maxTeamMembers: plan.maxTeamMembers,
      normalPrice: resolved.normalPrice,
      promoPrice: resolved.promoPrice,
      effectivePrice: resolved.effectivePrice,
      isPromo: resolved.isPromo,
      promoLabel: resolved.promoLabel,
      promoEndsAt: resolved.promoEndsAt,
      isRenewal: options.isRenewal,
    };
  });
}

function friendlyLicenseError(message: string): string {
  const text = String(message || '').toLowerCase();
  if (text.includes('trial sudah')) return 'Trial sudah pernah digunakan oleh akun ini.';
  if (text.includes('belum pernah berlangganan')) return 'Trial hanya untuk akun yang belum pernah berlangganan.';
  if (text.includes('sudah memiliki akses')) return 'Akun ini sudah memiliki akses aktif.';
  if (text.includes('kode aktivasi tidak ditemukan')) return 'Kode aktivasi tidak ditemukan.';
  if (text.includes('kode aktivasi sudah')) return 'Kode aktivasi sudah tidak dapat digunakan.';
  if (text.includes('ditujukan untuk akun lain')) return 'Kode aktivasi ini ditujukan untuk akun lain.';
  if (text.includes('masa aktif')) return 'Masa aktif akun telah berakhir. Silakan perpanjang paket.';
  if (text.includes('profil')) return 'Akun belum siap. Silakan masuk kembali.';
  return 'Permintaan belum dapat diproses. Silakan coba lagi.';
}

async function createMidtransSnapTransaction(params: {
  orderId: string;
  amount: number;
  planName: string;
  planId: string;
  userEmail?: string | null;
  userName?: string | null;
}): Promise<{ token: string; redirect_url: string }> {
  if (!hasMidtrans) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi di server.');
  }
  if (midtransKeyModeMismatch) {
    throw new Error(
      `Konfigurasi Midtrans tidak cocok: MIDTRANS_IS_PRODUCTION=${midtransIsProduction}, ` +
      `tetapi server key terdeteksi ${midtransServerKeyMode}. ` +
      (midtransIsProduction
        ? 'Gunakan Server Key Production (prefix Mid-server-) atau ubah MIDTRANS_IS_PRODUCTION menjadi false untuk sandbox.'
        : 'Gunakan Server Key Sandbox (prefix SB-Mid-server-) atau ubah MIDTRANS_IS_PRODUCTION menjadi true untuk production.')
    );
  }

  const response = await fetch(`${midtransBaseUrl}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${midtransServerKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.amount,
      },
      item_details: [
        {
          id: params.planId,
          price: params.amount,
          quantity: 1,
          name: `ZaFlow ${params.planName}`,
        },
      ],
      customer_details: {
        email: params.userEmail || undefined,
        first_name: (params.userName || 'ZaFlow User').slice(0, 50),
      },
      callbacks: {
        finish: `${appUrl}/?payment=finish&order_id=${encodeURIComponent(params.orderId)}`,
        error: `${appUrl}/?payment=error&order_id=${encodeURIComponent(params.orderId)}`,
      },
      expiry: { unit: 'hours', duration: 24 },
    }),
  });

  const json: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(json?.error_messages)
      ? json.error_messages.join(', ')
      : json?.status_message || 'Gagal membuat transaksi Midtrans.';
    throw new Error(detail);
  }

  if (!json?.redirect_url) {
    throw new Error('Midtrans tidak mengembalikan redirect_url.');
  }

  return {
    token: json.token || '',
    redirect_url: json.redirect_url,
  };
}

async function authenticateUser(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token autentikasi tidak ditemukan.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan akun belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Sesi kedaluwarsa atau token tidak valid.' });
      return;
    }

    const profile = await getProfileRow(user.id);
    (req as any).user = user;
    (req as any).profile = profile;

    // Halaman status akses tetap boleh dibuka agar akun nonaktif dapat melihat
    // alasan dan menghubungi customer service. Endpoint lain wajib akun aktif.
    const requestPath = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    const isAccessStatus = requestPath === '/api/access/status';
    if (!isAccessStatus) {
      if (!profile) {
        res.status(403).json({ error: 'Akun belum siap. Silakan masuk kembali.' });
        return;
      }
      if (profile.status && profile.status !== 'active') {
        res.status(403).json({
          error: 'Akun ini sedang tidak aktif. Hubungi customer service untuk bantuan.',
        });
        return;
      }
    }

    next();
  } catch (err: unknown) {
    res.status(500).json({ error: 'Gagal memverifikasi token pengguna.' });
  }
}

async function verifyBrandAccess(userId: string, brandId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_members')
      .select('role')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    return Boolean(data && !error);
  } catch {
    return false;
  }
}

const AI_ALLOWED_ROLES = ['owner', 'admin', 'editor'] as const;

/**
 * Memastikan pengguna boleh memakai fitur AI pada brand ini.
 * Viewer hanya boleh membaca, bukan memakai kredit AI.
 */
async function verifyBrandAiAccess(userId: string, brandId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_members')
      .select('role')
      .eq('brand_id', brandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    return (AI_ALLOWED_ROLES as readonly string[]).includes(data.role);
  } catch {
    return false;
  }
}

interface QuotaDeductResult {
  allowed: boolean;
  remaining: number;
  total: number;
  used: number;
  licenseId?: string;
  logId?: string;
  error?: string;
}

function isMissingRpcError(error: any): boolean {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return (
    message.includes('pgrst202') ||
    message.includes('could not find the function') ||
    message.includes('function public.consume_ai_credit') ||
    message.includes('function public.refund_ai_credit') ||
    message.includes('does not exist')
  );
}

async function checkAndDeductQuota(
  userId: string,
  brandId: string | null,
  actionType: 'metrics_extractor' | 'strategy_assistant',
  summary: string
): Promise<QuotaDeductResult> {
  if (!supabaseAdmin) {
    return {
      allowed: false,
      remaining: 0,
      total: 0,
      used: 0,
      error: 'Layanan paket belum siap. Silakan coba lagi.',
    };
  }

  // Anggota tim memakai kuota pemilik workspace, bukan kuota pribadi.
  const quotaOwnerId = (brandId ? await getBrandOwnerId(brandId) : null) || userId;

  // Jalur utama: RPC atomik dari migrasi 20261020_01.
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('consume_ai_credit', {
    p_user_id: quotaOwnerId,
    p_brand_id: brandId,
    p_action_type: actionType,
    p_summary: summary.slice(0, 300),
  });

  if (!rpcError && rpcData) {
    const row: any = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row) {
      return {
        allowed: Boolean(row.allowed),
        remaining: Number(row.remaining) || 0,
        total: Number(row.total) || 0,
        used: Number(row.used) || 0,
        licenseId: row.license_id || undefined,
        logId: row.log_id || undefined,
        error: row.error_message || undefined,
      };
    }
  }

  if (rpcError && !isMissingRpcError(rpcError)) {
    console.error('Gagal memotong kuota via RPC:', rpcError);
    return {
      allowed: false,
      remaining: 0,
      total: 0,
      used: 0,
      error: 'Gagal mencatat pemotongan kuota kredit AI. Silakan coba lagi.',
    };
  }

  // Fallback untuk database yang belum menjalankan migrasi.
  console.warn('[Quota] RPC consume_ai_credit belum tersedia; memakai fallback non-RPC.');
  const targetLicense = await getActiveLicenseRow(quotaOwnerId);

  if (!targetLicense) {
    return {
      allowed: false,
      remaining: 0,
      total: 0,
      used: 0,
      error: 'Workspace ini belum memiliki paket aktif. Silakan hubungi pemilik workspace.',
    };
  }

  const remaining = Math.max(0, targetLicense.ai_quota_total - targetLicense.ai_quota_used);
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      total: targetLicense.ai_quota_total,
      used: targetLicense.ai_quota_used,
      error: `Kuota kredit AI Anda telah habis (0 / ${targetLicense.ai_quota_total}). Silakan tingkatkan lisensi untuk menambah kredit.`,
    };
  }

  // Update bersyarat agar dua request paralel tidak memakai kredit yang sama.
  const { data: updatedLicense, error: updateErr } = await supabaseAdmin
    .from('licenses')
    .update({
      ai_quota_used: targetLicense.ai_quota_used + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetLicense.id)
    .in('status', ['active', 'trialing', 'past_due'])
    .lt('ai_quota_used', targetLicense.ai_quota_total)
    .select()
    .maybeSingle();

  if (updateErr || !updatedLicense) {
    return {
      allowed: false,
      remaining: 0,
      total: targetLicense.ai_quota_total,
      used: targetLicense.ai_quota_used,
      error: updateErr
        ? 'Gagal mencatat pemotongan kuota kredit AI.'
        : 'Kuota kredit AI Anda telah habis karena permintaan lain sedang berjalan.',
    };
  }

  const logPayload: Record<string, unknown> = {
    user_id: userId,
    brand_id: brandId || null,
    license_id: updatedLicense.id,
    action_type: actionType,
    tokens_consumed: 0,
    credits_deducted: 1,
    prompt_summary: summary.slice(0, 300),
  };

  let logId: string | undefined;
  const { data: logData, error: logError } = await supabaseAdmin
    .from('ai_usage_logs')
    .insert(logPayload)
    .select('id')
    .maybeSingle();

  if (logError) {
    // Kolom license_id belum ada pada database lama.
    if (`${logError.message || ''}`.includes('license_id')) {
      delete logPayload.license_id;
      const { data: fallbackLog } = await supabaseAdmin
        .from('ai_usage_logs')
        .insert(logPayload)
        .select('id')
        .maybeSingle();
      logId = fallbackLog?.id;
    } else {
      // Kembalikan kuota jika log gagal dibuat.
      await supabaseAdmin
        .from('licenses')
        .update({ ai_quota_used: Math.max(0, targetLicense.ai_quota_used), updated_at: new Date().toISOString() })
        .eq('id', updatedLicense.id);
      return {
        allowed: false,
        remaining: updatedLicense.ai_quota_total - updatedLicense.ai_quota_used,
        total: updatedLicense.ai_quota_total,
        used: updatedLicense.ai_quota_used,
        error: 'Gagal mencatat log penggunaan kuota AI.',
      };
    }
  } else {
    logId = logData?.id;
  }

  return {
    allowed: true,
    remaining: updatedLicense.ai_quota_total - updatedLicense.ai_quota_used,
    total: updatedLicense.ai_quota_total,
    used: updatedLicense.ai_quota_used,
    licenseId: updatedLicense.id,
    logId,
  };
}

async function refundQuota(
  _userId: string,
  licenseId: string | undefined,
  logId: string | undefined,
  _actionType: 'metrics_extractor' | 'strategy_assistant'
) {
  if (!supabaseAdmin || !licenseId || !logId) return;

  try {
    const { error: rpcError } = await supabaseAdmin.rpc('refund_ai_credit', {
      p_license_id: licenseId,
      p_log_id: logId,
    });

    if (!rpcError) return;
    if (!isMissingRpcError(rpcError)) {
      console.error('Gagal mengembalikan kuota via RPC:', rpcError);
      return;
    }

    // Fallback database lama: hapus log spesifik lalu kurangi kuota.
    const { data: deletedLog } = await supabaseAdmin
      .from('ai_usage_logs')
      .delete()
      .eq('id', logId)
      .select('id')
      .maybeSingle();

    if (!deletedLog) return;

    const { data: license } = await supabaseAdmin
      .from('licenses')
      .select('ai_quota_used')
      .eq('id', licenseId)
      .maybeSingle();

    if (license && license.ai_quota_used > 0) {
      await supabaseAdmin
        .from('licenses')
        .update({
          ai_quota_used: Math.max(0, license.ai_quota_used - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', licenseId);
    }
  } catch (err) {
    console.error('Gagal mengembalikan kuota AI:', err);
  }
}

function normalizeGeminiMimeType(value: string): string {
  const mime = (value || '').split(';')[0].trim().toLowerCase();
  if (!mime) return 'image/jpeg';

  // Browser memakai beberapa alias MIME yang tidak selalu dikenali Gemini.
  const aliases: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'video/quicktime': 'video/mov',
    'video/x-m4v': 'video/mp4',
    'video/x-msvideo': 'video/avi',
    'video/x-ms-wmv': 'video/wmv',
  };

  return aliases[mime] || mime;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} melebihi batas waktu ${timeoutMs} ms.`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function runGeminiWithFallback(params: {
  contents: any;
  config?: any;
}) {
  const client = getAiClient();
  let lastError: any = null;
  const startedAt = Date.now();

  for (const model of geminiModels) {
    const elapsed = Date.now() - startedAt;
    const remaining = geminiTotalBudgetMs - elapsed;

    if (remaining < 5_000) {
      lastError = lastError || new Error('Batas waktu total permintaan Gemini habis.');
      break;
    }

    // Beri ruang untuk fallback berikutnya, tetapi tetap izinkan video yang
    // butuh waktu lebih lama. Maksimal 35 detik per model di Vercel.
    const attemptTimeout = process.env.VERCEL
      ? Math.min(35_000, Math.max(8_000, remaining - 3_000))
      : Math.min(geminiTimeoutMs, remaining);

    try {
      console.info(`[Gemini] Mencoba model ${model} (timeout ${attemptTimeout} ms)`);
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        }),
        attemptTimeout,
        `Permintaan Gemini (${model})`
      );
      return { response, modelUsed: model, attempts: geminiModels.indexOf(model) + 1 };
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Percobaan model ${model} gagal:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Tidak ada model Gemini yang dapat digunakan.');
}

function parseJsonSafely(text: string): any {
  if (!text) throw new Error('AI tidak menghasilkan teks respons.');
  const trimmed = text.trim();
  const unbackticked = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(unbackticked);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    }
    throw new Error('Format balasan AI tidak dapat diparsing sebagai JSON.');
  }
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function aiRateLimiter(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  const identifier = user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  let record = rateLimitMap.get(identifier);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(identifier, record);
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    res.status(429).json({ error: 'Terlalu banyak permintaan (Rate limit exceeded). Harap tunggu 1 menit.' });
    return;
  }
  next();
}

const paymentRateLimitMap = new Map<string, { count: number; resetTime: number }>();
function paymentRateLimiter(req: Request, res: Response, next: () => void) {
  const user = (req as any).user;
  const identifier = user?.id || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;

  let record = paymentRateLimitMap.get(identifier);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    paymentRateLimitMap.set(identifier, record);
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    res.status(429).json({ error: 'Terlalu banyak permintaan pembayaran. Harap tunggu 1 menit.' });
    return;
  }
  next();
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Informasi bantuan publik. Dipakai halaman login/akun nonaktif agar pengguna
// tetap bisa menghubungi customer service meskipun sesinya sudah dibatasi.
app.get('/api/public/customer-service', async (_req: Request, res: Response) => {
  try {
    const customerService = await getCustomerServiceSettings();
    const whatsappUrl = buildWhatsAppUrl(customerService);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      active: Boolean(whatsappUrl),
      whatsappUrl,
      label: customerService.label || 'Bantuan ZaFlow',
    });
  } catch {
    res.status(200).json({ active: false, whatsappUrl: null, label: 'Bantuan ZaFlow' });
  }
});

app.get('/api/access/status', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan akun belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    // Akun lama mungkin masih membawa trial otomatis dari trigger pendaftaran
    // versi sebelumnya. Bersihkan lebih dulu agar tidak tampil sebagai paket
    // aktif dan agar pengguna bisa memilih trial secara manual.
    await markLegacyAutoTrials(user.id);

    const [profile, pricing, customerService] = await Promise.all([
      getProfileRow(user.id),
      getPricingSettings(),
      getCustomerServiceSettings(),
    ]);

    const isSuperAdmin = profile?.system_role === 'super_admin';
    const accountStatus = profile?.status || 'active';
    const rawOwnLicense = await getActiveLicenseRow(user.id);
    const ownLicense = await resolveGrantedLicense(user.id, rawOwnLicense);
    const workspaceOwner = ownLicense ? null : await getWorkspaceAccessOwner(user.id);
    const rawWorkspaceLicense = workspaceOwner ? await getActiveLicenseRow(workspaceOwner.ownerId) : null;
    const workspaceLicense = workspaceOwner
      ? await resolveGrantedLicense(workspaceOwner.ownerId, rawWorkspaceLicense)
      : null;
    const license = ownLicense || workspaceLicense;
    const normalized = normalizeLicense(license);

    let hasAccess = Boolean(normalized && !normalized.is_expired);
    let accessReason = 'none';

    if (accountStatus !== 'active') {
      hasAccess = false;
      accessReason = accountStatus === 'pending_deletion' ? 'pending_deletion' : 'suspended';
    } else if (isSuperAdmin) {
      hasAccess = true;
      accessReason = 'owner';
    } else if (ownLicense && normalized && !normalized.is_expired) {
      hasAccess = true;
      accessReason = normalized.status === 'trialing' ? 'trial' : 'subscription';
    } else if (workspaceOwner && workspaceLicense && normalized && !normalized.is_expired) {
      hasAccess = true;
      accessReason = 'workspace';
    }

    const priorPaid = await hasPriorPaidAccess(user.id);
    const trialUsed = Boolean(profile?.trial_used_at) && !isLegacyAutoTrialLicense(rawOwnLicense);
    let trialReason = 'available';
    if (isSuperAdmin) trialReason = 'admin';
    else if (accountStatus !== 'active') trialReason = 'account';
    else if (trialUsed) trialReason = 'used';
    else if (priorPaid) trialReason = 'paid';
    else if (workspaceOwner) trialReason = 'workspace';
    else if (ownLicense) trialReason = 'active';

    const trialEligible = trialReason === 'available';
    const plans = buildPlanPayload(pricing, { isRenewal: priorPaid });

    res.json({
      hasAccess,
      reason: accessReason,
      accountStatus,
      isSuperAdmin,
      license: normalized,
      trial: {
        // Trial tidak lagi diaktifkan sendiri dari aplikasi. Kode trial
        // diberikan customer service melalui permintaan manual.
        available: trialEligible,
        requestOnly: true,
        reason: trialReason,
        days: TRIAL_DAYS,
        credits: TRIAL_PLAN.aiQuota,
        maxBrands: TRIAL_PLAN.maxBrands,
        maxTeamMembers: TRIAL_PLAN.maxTeamMembers,
      },
      plans,
      customerService: {
        ...customerService,
        whatsappUrl: buildWhatsAppUrl(customerService),
      },
      workspace: workspaceOwner
        ? { ownerId: workspaceOwner.ownerId, brandId: workspaceOwner.brandId }
        : null,
      isRenewal: priorPaid,
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
  } catch (error) {
    console.error('Gagal memuat status akses:', error);
    res.status(500).json({ error: 'Status akun belum dapat dimuat. Silakan coba lagi.' });
  }
});

app.post('/api/trial/start', authenticateUser, async (_req: Request, res: Response) => {
  res.status(403).json({
    error:
      'Trial kini diberikan melalui customer service. Ajukan trial ke customer service untuk menerima kode aktivasi trial.',
    requestOnly: true,
  });
});

app.post('/api/activation/redeem', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Masukkan kode aktivasi terlebih dahulu.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan akun belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('redeem_activation_code', {
      p_user_id: user.id,
      p_user_email: user.email || '',
      p_code: code.trim(),
    });
    if (error) {
      res.status(400).json({ error: friendlyLicenseError(error.message) });
      return;
    }
    const license = Array.isArray(data) ? data[0] : data;
    res.json({
      success: true,
      message: 'Kode aktivasi berhasil digunakan.',
      license: normalizeLicense(license),
    });
  } catch (error: any) {
    res.status(500).json({ error: friendlyLicenseError(error?.message) });
  }
});

app.get('/api/billing/plans', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const [pricing, priorPaid] = await Promise.all([
      getPricingSettings(),
      hasPriorPaidAccess(user.id),
    ]);
    res.json({
      plans: buildPlanPayload(pricing, { isRenewal: priorPaid }),
      isRenewal: priorPaid,
    });
  } catch {
    res.status(500).json({ error: 'Daftar paket belum dapat dimuat.' });
  }
});

// Webhook generik (opsional, untuk provider selain Midtrans).
app.post('/api/webhook/payment', async (req: Request, res: Response) => {
  const webhookSecret = (process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    res.status(503).json({ success: false, error: 'Layanan pembayaran belum siap.' });
    return;
  }

  const signatureHeader = (req.headers['x-signature'] || req.headers['x-callback-signature'] || '') as string;
  const signature = String(signatureHeader).trim().replace(/^sha256=/i, '');
  if (!signature) {
    res.status(401).json({ success: false, error: 'Webhook signature header wajib disertakan.' });
    return;
  }

  // Gunakan byte mentah, bukan JSON.stringify yang bisa berubah urutan/whitespace.
  const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!safeEqualHex(signature.toLowerCase(), expectedSignature.toLowerCase())) {
    res.status(401).json({ success: false, error: 'Webhook signature tidak valid.' });
    return;
  }

  const { transaction_id, license_key, user_id, status } = req.body || {};
  if (!transaction_id || !status) {
    res.status(400).json({ success: false, error: 'transaction_id dan status wajib diisi.' });
    return;
  }

  const allowedStatuses = new Set(['pending', 'success', 'settlement', 'failed', 'expired', 'refunded']);
  if (!allowedStatuses.has(String(status))) {
    res.status(400).json({ success: false, error: 'Status transaksi tidak dikenal.' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({ success: false, error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id, status, user_id, license_key, amount')
      .eq('transaction_id', transaction_id)
      .maybeSingle();

    const isSuccess = status === 'success' || status === 'settlement';

    if (existingTx?.status === 'success' && isSuccess) {
      res.json({ success: true, message: 'Webhook sudah diproses sebelumnya.' });
      return;
    }

    if (existingTx) {
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({ status, raw_payload: req.body, updated_at: new Date().toISOString() })
        .eq('transaction_id', transaction_id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin.from('transactions').insert({
        transaction_id,
        user_id: user_id || null,
        license_key: license_key || null,
        status,
        amount: Number(req.body?.amount) || 0,
        raw_payload: req.body,
      });
      if (insertError) throw insertError;
    }

    if (isSuccess && license_key) {
      const { data: license, error: licenseError } = await supabaseAdmin
        .from('licenses')
        .select('id, owner_user_id, status')
        .eq('license_key', license_key)
        .maybeSingle();

      if (licenseError) throw licenseError;
      if (license) {
        if (license.owner_user_id && license.owner_user_id !== (user_id || existingTx?.user_id)) {
          res.status(409).json({ success: false, error: 'Lisensi sudah dimiliki akun lain.' });
          return;
        }
        if (license.status !== 'revoked') {
          const { error: activateError } = await supabaseAdmin
            .from('licenses')
            .update({
              status: 'active',
              owner_user_id: user_id || existingTx?.user_id || null,
              activated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', license.id);
          if (activateError) throw activateError;
        }
      }
    }

    res.json({ success: true, message: 'Webhook berhasil diproses.' });
  } catch (err: unknown) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ success: false, error: 'Internal webhook error' });
  }
});

// Webhook resmi Midtrans (HTTP Notification).
// URL ini didaftarkan di Dashboard Midtrans > Settings > Notification URL.
app.post('/api/webhook/midtrans', async (req: Request, res: Response) => {
  if (!hasMidtrans) {
    res.status(503).json({ success: false, error: 'Layanan pembayaran belum siap.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ success: false, error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  const payload = (req.body || {}) as MidtransNotification;
  if (!verifyMidtransSignature(payload)) {
    res.status(401).json({ success: false, error: 'Signature Midtrans tidak valid.' });
    return;
  }

  const orderId = String(payload.order_id || '');
  const transactionStatus = String(payload.transaction_status || '');
  if (!orderId || !transactionStatus) {
    res.status(400).json({ success: false, error: 'order_id dan transaction_status wajib diisi.' });
    return;
  }

  try {
    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, user_id, status, amount, license_key, plan_id, is_renewal, billing_cycle')
      .eq('transaction_id', orderId)
      .maybeSingle();

    if (txError) throw txError;
    if (!tx) {
      res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });
      return;
    }

    const grossAmount = Number(payload.gross_amount || 0);
    if (!Number.isFinite(grossAmount) || Math.round(grossAmount) !== Math.round(Number(tx.amount) || 0)) {
      res.status(400).json({ success: false, error: 'Nominal notifikasi tidak cocok dengan transaksi.' });
      return;
    }

    const mappedStatus = mapMidtransStatus(transactionStatus, payload.fraud_status);
    const isSuccess = mappedStatus === 'success';

    // Jangan pernah menurunkan transaksi yang sudah final karena notifikasi
    // yang datang tidak berurutan.
    if (tx.status === 'success' || tx.status === 'settlement') {
      res.json({ success: true, message: 'Notifikasi sudah diproses sebelumnya.' });
      return;
    }

    if (isSuccess) {
      const plan = getPlan(tx.plan_id);
      if (!plan) {
        res.status(500).json({ success: false, error: 'Paket pada transaksi tidak dikenal.' });
        return;
      }
      if (!tx.user_id) {
        res.status(400).json({ success: false, error: 'Transaksi tidak memiliki user_id.' });
        return;
      }

      const licenseKey = tx.license_key || generateLicenseKey(plan.id);
      const { data: activatedLicense, error: activationError } = await supabaseAdmin.rpc(
        'activate_subscription_from_payment',
        {
          p_user_id: tx.user_id,
          p_license_key: licenseKey,
          p_plan_id: plan.id,
          p_plan_name: plan.name,
          p_max_brands: plan.maxBrands,
          p_max_team_members: plan.maxTeamMembers,
          p_ai_quota: plan.aiQuota,
          p_period_days: 30,
        }
      );

      if (activationError) {
        throw activationError;
      }

      const activated = Array.isArray(activatedLicense) ? activatedLicense[0] : activatedLicense;
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'success',
          license_key: activated?.license_key || licenseKey,
          paid_at: new Date().toISOString(),
          payment_provider: 'midtrans',
          period_start: activated?.current_period_start || new Date().toISOString(),
          period_end: activated?.current_period_end || null,
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (updateError) throw updateError;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: mappedStatus,
          payment_provider: 'midtrans',
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (updateError) throw updateError;
    }

    res.json({ success: true, message: 'Notifikasi Midtrans berhasil diproses.' });
  } catch (err: unknown) {
    console.error('Midtrans webhook error:', err);
    res.status(500).json({ success: false, error: 'Gagal memproses notifikasi Midtrans.' });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConfigured: hasSupabaseAdmin,
    geminiConfigured: hasGeminiKey,
    midtransConfigured: hasMidtrans,
    midtransMode: midtransIsProduction ? 'production' : 'sandbox',
    midtransKeyMode: midtransServerKeyMode,
    midtransKeyModeMismatch,
    sandboxCheckoutEnabled: allowSandboxCheckout && !midtransIsProduction,
  });
});

app.post('/api/license/activate', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { licenseKey } = req.body;

  if (!licenseKey || typeof licenseKey !== 'string') {
    res.status(400).json({ success: false, message: 'Format lisensi tidak valid.' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({
      success: false,
      message: 'Layanan akun belum siap.',
    });
    return;
  }

  try {
    const { data: license, error: findError } = await supabaseAdmin
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey.trim())
      .single();

    if (findError || !license) {
      res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan.' });
      return;
    }

    if (license.status === 'revoked') {
      res.status(403).json({ success: false, message: 'Lisensi ini telah dicabut dan tidak dapat diaktivasi.' });
      return;
    }

    if (license.status === 'expired') {
      res.status(403).json({ success: false, message: 'Lisensi ini telah kedaluwarsa.' });
      return;
    }

    if (license.owner_user_id && license.owner_user_id !== user.id) {
      res.status(400).json({ success: false, message: 'Kunci lisensi ini sudah diaktivasi oleh akun lain.' });
      return;
    }

    // Jika user sudah punya lisensi aktif lain, jangan membuat konflik
    // dengan unique index satu lisensi aktif per pemilik.
    const { data: activeLicense } = await supabaseAdmin
      .from('licenses')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('status', 'active')
      .neq('id', license.id)
      .maybeSingle();

    if (activeLicense) {
      res.status(409).json({
        success: false,
        message: 'Akun Anda sudah memiliki lisensi aktif. Gunakan halaman paket untuk melakukan upgrade.',
      });
      return;
    }

    const { data: updatedLicense, error: updateError } = await supabaseAdmin
      .from('licenses')
      .update({
        owner_user_id: user.id,
        activated_at: license.activated_at || new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', license.id)
      .select()
      .maybeSingle();

    if (updateError || !updatedLicense) {
      res.status(500).json({ success: false, message: 'Gagal memperbarui status lisensi.' });
      return;
    }

    res.json({
      success: true,
      message: 'Lisensi berhasil diaktivasi untuk akun Anda.',
      license: updatedLicense,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: 'Aktivasi belum dapat diproses. Silakan coba lagi.' });
  }
});

// Team Invite endpoint
app.post('/api/team/invite', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { brand_id, email, role } = req.body;
  if (!brand_id || !email || typeof email !== 'string') {
    res.status(400).json({ error: 'Brand ID dan email wajib diisi.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: 'Format email undangan tidak valid.' });
    return;
  }

  const requestedRole = role || 'editor';
  if (!['admin', 'editor', 'viewer'].includes(requestedRole)) {
    res.status(400).json({ error: 'Role undangan tidak valid.' });
    return;
  }

  const { data: member } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || !['owner', 'admin'].includes(member.role)) {
    res.status(403).json({ error: 'Anda tidak memiliki hak untuk mengundang anggota ke brand ini.' });
    return;
  }

  if (member.role === 'admin' && requestedRole === 'admin') {
    res.status(403).json({ error: 'Admin tidak dapat mengundang anggota dengan role admin. Hanya owner yang dapat melakukannya.' });
    return;
  }

  if (user.email && String(user.email).toLowerCase() === normalizedEmail) {
    res.status(400).json({ error: 'Anda tidak dapat mengundang email Anda sendiri.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Jika sudah ada undangan pending untuk email yang sama, perbarui token
  // agar tidak menumpuk dan tautan lama otomatis tidak berlaku.
  const { data: existingInvite } = await supabaseAdmin
    .from('brand_invitations')
    .select('id')
    .eq('brand_id', brand_id)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  const invitePayload = {
    brand_id,
    email: normalizedEmail,
    role: requestedRole,
    token,
    status: 'pending',
    expires_at: expiresAt,
    invited_by: user.id,
  };

  const inviteQuery = existingInvite
    ? supabaseAdmin.from('brand_invitations').update(invitePayload).eq('id', existingInvite.id)
    : supabaseAdmin.from('brand_invitations').insert(invitePayload);

  const { error: inviteErr } = await inviteQuery;

  if (inviteErr) {
    res.status(500).json({ error: inviteErr.message || 'Gagal menyimpan undangan.' });
    return;
  }

  await supabaseAdmin.from('activity_logs').insert({
    brand_id,
    user_id: user.id,
    action: 'Mengundang Anggota',
    entity_type: 'brand_invitation',
    details: { role: requestedRole },
  });

  const inviteUrl = `${appUrl}/?invite_token=${token}`;

  res.json({
    success: true,
    message: `Undangan untuk ${normalizedEmail} berhasil dibuat!`,
    token,
    inviteUrl,
    expiresAt,
  });
});

// Endpoint melihat daftar undangan aktif per brand
app.get('/api/team/invitations', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const brand_id = req.query.brand_id as string;

  if (!brand_id) {
    res.status(400).json({ error: 'Brand ID wajib disertakan.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  // Verifikasi keanggotaan pemohon
  const { data: member } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || !['owner', 'admin'].includes(member.role)) {
    res.status(403).json({ error: 'Hanya Owner atau Admin yang dapat melihat daftar undangan.' });
    return;
  }

  const { data: invitations, error } = await supabaseAdmin
    .from('brand_invitations')
    .select('id, brand_id, email, role, token, status, expires_at, created_at')
    .eq('brand_id', brand_id)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message || 'Gagal memuat daftar undangan.' });
    return;
  }

  res.json(invitations || []);
});

// Endpoint publik melihat preview detail undangan via token
app.get('/api/team/invitations/preview', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token undangan wajib disertakan.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  const { data: invite, error } = await supabaseAdmin
    .from('brand_invitations')
    .select('id, brand_id, email, role, status, expires_at, brands:brand_id (id, name, logo_url)')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    res.status(404).json({ error: 'Undangan tidak ditemukan atau token tidak valid.' });
    return;
  }

  const isExpired = new Date(invite.expires_at) < new Date();
  const rawEmail = invite.email || '';
  const maskedEmail = rawEmail.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, rest: string) => {
    return first + '*'.repeat(Math.max(1, Math.min(middle.length, 5))) + rest;
  });

  res.json({
    success: true,
    id: invite.id,
    brand_id: invite.brand_id,
    brand_name: (invite.brands as any)?.name || 'Brand',
    role: invite.role,
    email_masked: maskedEmail,
    status: isExpired && invite.status === 'pending' ? 'expired' : invite.status,
    is_expired: isExpired,
  });
});

// Endpoint menerima undangan tim via token
app.post('/api/team/invitations/accept', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token undangan wajib disertakan.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  // 1. Cari undangan dengan status pending
  const { data: invite, error: fetchErr } = await supabaseAdmin
    .from('brand_invitations')
    .select('id, brand_id, email, role, status, expires_at, brands:brand_id (id, name)')
    .eq('token', token)
    .maybeSingle();

  if (fetchErr || !invite) {
    res.status(404).json({ error: 'Undangan tidak ditemukan atau token tidak valid.' });
    return;
  }

  if (invite.status !== 'pending') {
    const statusLabel: Record<string, string> = {
      accepted: 'sudah diterima',
      cancelled: 'sudah dibatalkan',
      rejected: 'sudah ditolak',
      expired: 'sudah kedaluwarsa',
    };
    res.status(400).json({
      error: `Undangan ini ${statusLabel[invite.status] || 'sudah tidak berlaku'}.`,
    });
    return;
  }

  // 2. Cek apakah undangan sudah kedaluwarsa
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin.from('brand_invitations').update({ status: 'expired' }).eq('id', invite.id);
    res.status(400).json({ error: 'Masa berlaku undangan ini telah kedaluwarsa.' });
    return;
  }

  // 3. Undangan hanya boleh diterima oleh pemilik email yang diundang.
  if (!user.email || String(user.email).trim().toLowerCase() !== String(invite.email).trim().toLowerCase()) {
    const email = String(invite.email || '');
    const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_: string, first: string, middle: string, rest: string) => {
      return first + '*'.repeat(Math.max(1, Math.min(middle.length, 5))) + rest;
    });
    res.status(403).json({
      error: `Undangan ini ditujukan untuk ${maskedEmail}. Masuk dengan akun email tersebut untuk menerima undangan.`,
    });
    return;
  }

  // 4. Pastikan workspace pemilik masih aktif sebelum anggota bergabung.
  const ownerId = await getBrandOwnerId(invite.brand_id);
  if (!ownerId) {
    res.status(403).json({ error: 'Workspace ini sudah tidak tersedia.' });
    return;
  }
  const ownerProfile = await getProfileRow(ownerId);
  if (!ownerProfile || (ownerProfile.status && ownerProfile.status !== 'active')) {
    res.status(403).json({ error: 'Workspace pemilik sedang tidak aktif.' });
    return;
  }
  if (!(await resolveGrantedLicense(ownerId, await getActiveLicenseRow(ownerId)))) {
    res.status(403).json({ error: 'Paket pemilik workspace belum aktif.' });
    return;
  }

  // 5. Masukkan ke tabel brand_members
  const { error: memberErr } = await supabaseAdmin
    .from('brand_members')
    .upsert({
      brand_id: invite.brand_id,
      user_id: user.id,
      role: invite.role,
    }, { onConflict: 'brand_id,user_id' });

  if (memberErr) {
    const isLimitError =
      memberErr.code === '42501' ||
      /batas anggota tim/i.test(memberErr.message || '');
    res.status(isLimitError ? 403 : 500).json({
      error: isLimitError
        ? memberErr.message
        : memberErr.message || 'Gagal menambahkan Anda ke dalam tim brand.',
    });
    return;
  }

  // 5. Ubah status undangan jadi accepted
  await supabaseAdmin
    .from('brand_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq('id', invite.id);

  // 5. Catat audit trail
  await supabaseAdmin.from('activity_logs').insert({
    brand_id: invite.brand_id,
    user_id: user.id,
    action: 'Bergabung ke Tim',
    entity_type: 'brand_member',
    details: { role: invite.role },
  });

  const brandName = (invite.brands as any)?.name || 'Brand';
  res.json({
    success: true,
    message: `Selamat! Anda berhasil bergabung ke dalam tim '${brandName}' sebagai ${
      invite.role === 'admin' ? 'Admin' : invite.role === 'editor' ? 'Editor' : 'Anggota'
    }.`,
    brand_id: invite.brand_id,
  });
});

// Endpoint membatalkan undangan
app.delete('/api/team/invitations/:id', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const inviteId = req.params.id;
  const brand_id = req.query.brand_id as string;

  if (!inviteId || !brand_id) {
    res.status(400).json({ error: 'ID undangan dan brand ID wajib disertakan.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  const { data: member } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || !['owner', 'admin'].includes(member.role)) {
    res.status(403).json({ error: 'Hanya Owner atau Admin yang dapat membatalkan undangan.' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('brand_invitations')
    .update({ status: 'cancelled' })
    .eq('id', inviteId)
    .eq('brand_id', brand_id);

  if (error) {
    res.status(500).json({ error: error.message || 'Gagal membatalkan undangan.' });
    return;
  }

  res.json({ success: true, message: 'Undangan berhasil dibatalkan.' });
});

app.patch('/api/team/members/:userId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const targetUserId = req.params.userId;
  const { brand_id, role } = req.body;

  if (!brand_id || !role || typeof brand_id !== 'string' || typeof role !== 'string') {
    res.status(400).json({ error: 'Brand ID dan role baru wajib diisi dengan format string yang valid.' });
    return;
  }

  // 1. Validasi payload: tolak role tidak dikenal dan penetapan role owner
  const ALLOWED_TARGET_ROLES = ['admin', 'editor', 'viewer'];
  if (role === 'owner') {
    res.status(400).json({ error: 'Role owner tidak dapat ditetapkan melalui endpoint ini. Penetapan owner memerlukan alur transfer kepemilikan resmi.' });
    return;
  }
  if (!ALLOWED_TARGET_ROLES.includes(role)) {
    res.status(400).json({ error: `Role '${role}' tidak valid. Role yang diizinkan adalah: ${ALLOWED_TARGET_ROLES.join(', ')}.` });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  // 2. Ambil data membership dan role pemanggil
  const { data: requester, error: reqErr } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (reqErr || !requester || !['owner', 'admin'].includes(requester.role)) {
    res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin mengelola anggota brand ini.' });
    return;
  }

  // 3. Ambil data membership target saat ini
  const { data: targetMember, error: targetErr } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (targetErr || !targetMember) {
    res.status(404).json({ error: 'Anggota target tidak ditemukan di brand ini.' });
    return;
  }

  // 4. Penegakan hierarki hak akses
  // Rule a: Target saat ini adalah owner -> DILARANG diubah melalui endpoint biasa
  if (targetMember.role === 'owner') {
    res.status(403).json({ error: 'Akses ditolak: Role owner tidak dapat diubah melalui endpoint ini.' });
    return;
  }

  // Rule b: Jika pemanggil adalah admin:
  // - Admin TIDAK BOLEH mengubah role sesama admin atau owner
  // - Admin HANYA BOLEH mengubah role editor dan viewer
  // - Admin TIDAK BOLEH mempromosikan anggota menjadi admin (hanya boleh editor atau viewer)
  if (requester.role === 'admin') {
    if (targetMember.role === 'admin') {
      res.status(403).json({ error: 'Akses ditolak: Admin tidak dapat mengubah role sesama admin.' });
      return;
    }

    if (!['editor', 'viewer'].includes(targetMember.role)) {
      res.status(403).json({ error: 'Akses ditolak: Admin hanya dapat mengelola anggota dengan role editor atau viewer.' });
      return;
    }

    if (role === 'admin') {
      res.status(403).json({ error: 'Akses ditolak: Admin tidak diizinkan mempromosikan anggota menjadi admin. Promosi admin hanya dapat dilakukan oleh owner.' });
      return;
    }

    if (!['editor', 'viewer'].includes(role)) {
      res.status(403).json({ error: 'Akses ditolak: Admin hanya dapat mengubah role menjadi editor atau viewer.' });
      return;
    }
  }

  // Rule c: Jika pemanggil adalah owner:
  // - Boleh mengubah anggota non-owner menjadi admin, editor, atau viewer (sudah divalidasi oleh ALLOWED_TARGET_ROLES)
  // - Kolom brand_id dan user_id tidak pernah diubah (hanya memperbarui kolom role)

  const { error: updateErr } = await supabaseAdmin
    .from('brand_members')
    .update({ role })
    .eq('brand_id', brand_id)
    .eq('user_id', targetUserId);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message || 'Gagal mengubah role anggota.' });
    return;
  }

  await supabaseAdmin.from('activity_logs').insert({
    brand_id,
    user_id: user.id,
    action: 'Mengubah Peran Anggota',
    entity_type: 'brand_member',
    entity_id: targetUserId,
    details: { previous_role: targetMember.role, new_role: role },
  });

  const roleLabel = role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : role === 'owner' ? 'Pemilik' : 'Anggota';
  res.json({ success: true, message: `Peran anggota berhasil diperbarui menjadi ${roleLabel}.` });
});

app.delete('/api/team/members/:userId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const targetUserId = req.params.userId;
  const brand_id = req.query.brand_id as string;

  if (!brand_id || typeof brand_id !== 'string') {
    res.status(400).json({ error: 'Brand ID wajib disertakan.' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  // 1. Ambil data keanggotaan target
  const { data: targetMember, error: targetErr } = await supabaseAdmin
    .from('brand_members')
    .select('role')
    .eq('brand_id', brand_id)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (targetErr || !targetMember) {
    res.status(404).json({ error: 'Anggota target tidak ditemukan di brand ini.' });
    return;
  }

  // Rule: Target adalah owner -> DILARANG dihapus selama brand aktif
  if (targetMember.role === 'owner') {
    res.status(403).json({ error: 'Akses ditolak: Anggota dengan role owner tidak dapat dikeluarkan dari brand.' });
    return;
  }

  const isSelf = user.id === targetUserId;

  // 2. Jika bukan mengeluarkan diri sendiri, validasi hak pemanggil
  if (!isSelf) {
    const { data: requester, error: reqErr } = await supabaseAdmin
      .from('brand_members')
      .select('role')
      .eq('brand_id', brand_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (reqErr || !requester || !['owner', 'admin'].includes(requester.role)) {
      res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin mengeluarkan anggota dari brand ini.' });
      return;
    }

    // Jika pemanggil adalah admin: Admin DILARANG menghapus sesama admin atau owner
    if (requester.role === 'admin') {
      if (targetMember.role === 'admin') {
        res.status(403).json({ error: 'Akses ditolak: Admin tidak memiliki wewenang mengeluarkan sesama admin.' });
        return;
      }
      if (!['editor', 'viewer'].includes(targetMember.role)) {
        res.status(403).json({ error: 'Akses ditolak: Admin hanya dapat mengeluarkan anggota dengan role editor atau viewer.' });
        return;
      }
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from('brand_members')
    .delete()
    .eq('brand_id', brand_id)
    .eq('user_id', targetUserId);

  if (delErr) {
    res.status(500).json({ error: delErr.message || 'Gagal menghapus anggota.' });
    return;
  }

  await supabaseAdmin.from('activity_logs').insert({
    brand_id,
    user_id: user.id,
    action: isSelf ? 'Keluar dari Brand' : 'Mengeluarkan Anggota',
    entity_type: 'brand_member',
    entity_id: targetUserId,
    details: { removed_role: targetMember.role },
  });

  res.json({ success: true, message: isSelf ? 'Anda berhasil keluar dari brand.' : 'Anggota berhasil dikeluarkan.' });
});


// Membuat transaksi pembayaran Midtrans Snap.
// Harga, paket, dan kuota SELALU diambil dari katalog server, bukan dari client.
app.post('/api/payments/midtrans/create', authenticateUser, paymentRateLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { planId } = req.body || {};
  const plan = getPlan(planId);

  if (!plan || !plan.purchasable || plan.id === 'trial') {
    res.status(400).json({ error: 'Paket tidak valid atau tidak dapat dibeli.' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan pembayaran belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    const profile = await getProfileRow(user.id);
    if (!profile) {
      res.status(403).json({ error: 'Akun belum siap. Silakan masuk kembali.' });
      return;
    }
    if (profile.status && profile.status !== 'active') {
      res.status(403).json({ error: 'Akun ini sedang tidak aktif. Hubungi customer service untuk bantuan.' });
      return;
    }

    const activeLicense = await getActiveLicenseRow(user.id);
    if (activeLicense?.is_legacy_lifetime) {
      res.status(409).json({ error: 'Akun ini sudah memiliki akses seumur hidup.' });
      return;
    }

    const [pricing, priorPaid] = await Promise.all([
      getPricingSettings(),
      hasPriorPaidAccess(user.id),
    ]);
    const resolved = resolvePlanPrice(plan.id as 'starter' | 'pro' | 'ultra', pricing, {
      isRenewal: priorPaid,
    });
    const amount = resolved.effectivePrice;

    const orderId = generateOrderId();
    const licenseKey = generateLicenseKey(plan.id);
    const userName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.email ? String(user.email).split('@')[0] : 'ZaFlow User');

    const { error: txInsertError } = await supabaseAdmin.from('transactions').insert({
      transaction_id: orderId,
      user_id: user.id,
      license_key: licenseKey,
      status: 'pending',
      amount,
      plan_id: plan.id,
      payment_provider: 'midtrans',
      billing_cycle: 'monthly',
      is_renewal: priorPaid,
      raw_payload: {
        plan_id: plan.id,
        plan_name: plan.name,
        normal_price: resolved.normalPrice,
        promo_price: resolved.promoPrice,
        effective_price: resolved.effectivePrice,
        is_promo: resolved.isPromo,
        is_renewal: priorPaid,
        sandbox_checkout: false,
      },
    });

    if (txInsertError) {
      console.error('Gagal membuat transaksi:', txInsertError);
      res.status(500).json({ error: 'Transaksi belum dapat dibuat. Silakan coba lagi.' });
      return;
    }

    // Mode sandbox lokal: aktif hanya jika ALLOW_SANDBOX_CHECKOUT=true dan
    // penyedia pembayaran belum disetel ke production.
    if (!hasMidtrans) {
      if (!allowSandboxCheckout || midtransIsProduction) {
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('transaction_id', orderId);
        res.status(503).json({
          error: 'Pembayaran belum tersedia. Silakan hubungi customer service.',
        });
        return;
      }

      const { data: activatedLicense, error: activationError } = await supabaseAdmin.rpc(
        'activate_subscription_from_payment',
        {
          p_user_id: user.id,
          p_license_key: licenseKey,
          p_plan_id: plan.id,
          p_plan_name: plan.name,
          p_max_brands: plan.maxBrands,
          p_max_team_members: plan.maxTeamMembers,
          p_ai_quota: plan.aiQuota,
          p_period_days: 30,
        }
      );

      if (activationError) {
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('transaction_id', orderId);
        res.status(503).json({ error: 'Aktivasi langganan belum dapat diproses. Silakan coba lagi.' });
        return;
      }

      const activated = Array.isArray(activatedLicense) ? activatedLicense[0] : activatedLicense;
      await supabaseAdmin
        .from('transactions')
        .update({
          status: 'success',
          paid_at: new Date().toISOString(),
          period_start: activated?.current_period_start || new Date().toISOString(),
          period_end: activated?.current_period_end || null,
          raw_payload: {
            sandbox_checkout: true,
            plan_id: plan.id,
            plan_name: plan.name,
            normal_price: resolved.normalPrice,
            effective_price: amount,
            is_promo: resolved.isPromo,
            is_renewal: priorPaid,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_id', orderId);

      res.json({
        success: true,
        sandbox: true,
        orderId,
        licenseKey,
        plan: {
          ...plan,
          normalPrice: resolved.normalPrice,
          promoPrice: resolved.promoPrice,
          effectivePrice: amount,
          isPromo: resolved.isPromo,
        },
        license: normalizeLicense(activated),
        message: `Pembayaran uji berhasil. Paket ${plan.name} aktif.`,
      });
      return;
    }

    const snap = await createMidtransSnapTransaction({
      orderId,
      amount,
      planName: plan.name,
      planId: plan.id,
      userEmail: user.email,
      userName,
    });

    await supabaseAdmin
      .from('transactions')
      .update({
        snap_token: snap.token,
        redirect_url: snap.redirect_url,
        raw_payload: {
          plan_id: plan.id,
          plan_name: plan.name,
          normal_price: resolved.normalPrice,
          effective_price: amount,
          is_promo: resolved.isPromo,
          is_renewal: priorPaid,
          snap_token: snap.token,
          redirect_url: snap.redirect_url,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    res.json({
      success: true,
      orderId,
      plan: {
        ...plan,
        normalPrice: resolved.normalPrice,
        promoPrice: resolved.promoPrice,
        effectivePrice: amount,
        isPromo: resolved.isPromo,
      },
      token: snap.token,
      redirectUrl: snap.redirect_url,
    });
  } catch (err: unknown) {
    console.error('Gagal membuat transaksi:', err);
    res.status(502).json({ error: 'Pembayaran belum dapat dibuat. Silakan coba lagi.' });
  }
});

// Status pembayaran untuk polling UI setelah kembali dari halaman Midtrans.
app.get('/api/payments/midtrans/status/:orderId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orderId = String(req.params.orderId || '');
  if (!orderId) {
    res.status(400).json({ error: 'Data pembayaran tidak lengkap.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  const { data: tx, error } = await supabaseAdmin
    .from('transactions')
    .select('transaction_id, status, amount, plan_id, paid_at, created_at')
    .eq('transaction_id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !tx) {
    res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    return;
  }

  res.json({
    orderId: tx.transaction_id,
    status: tx.status,
    amount: tx.amount,
    planId: tx.plan_id,
    paidAt: tx.paid_at,
    createdAt: tx.created_at,
  });
});

app.get('/api/admin/overview', authenticateUser, async (req: Request, res: Response) => {
  const user = await requirePlatformOwner(req, res);
  if (!user || !supabaseAdmin) return;

  // Akun yang sudah melewati masa simpan 7 hari dibersihkan saat panel dibuka.
  try {
    await cleanupExpiredUsers(user.id);
  } catch (error) {
    console.warn('Pembersihan akun terjadwal gagal dijalankan:', error);
  }

  const [usersRes, brandsRes, licensesRes, txRes, logsRes, codesRes, auditRes, pricing, customerService, emailMap] =
    await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('brands').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('licenses').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('ai_usage_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('activation_codes').select('*').order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      getPricingSettings(),
      getCustomerServiceSettings(),
      getAuthEmailMap(),
    ]);

  const licenses = licensesRes.data || [];
  const licenseByOwner = new Map<string, any>();
  for (const license of licenses) {
    if (!license.owner_user_id) continue;
    if (!licenseByOwner.has(license.owner_user_id)) {
      licenseByOwner.set(license.owner_user_id, license);
    }
  }

  const users = (usersRes.data || []).map((profile: any) => {
    const license = licenseByOwner.get(profile.id);
    return {
      ...profile,
      email: emailMap.get(profile.id) || '',
      license: normalizeLicense(license),
    };
  });

  res.json({
    users,
    brands: brandsRes.data || [],
    licenses: licenses.map((license: any) => normalizeLicense(license)),
    transactions: txRes.data || [],
    aiLogs: logsRes.data || [],
    activationCodes: codesRes.data || [],
    auditLogs: auditRes.data || [],
    pricing,
    customerService,
    summary: {
      users: users.length,
      activeSubscriptions: licenses.filter((l: any) => l.status === 'active' && !l.is_legacy_lifetime).length,
      legacyLifetime: licenses.filter((l: any) => l.is_legacy_lifetime).length,
      trials: licenses.filter((l: any) => l.status === 'trialing').length,
      pendingDeletion: users.filter((u: any) => u.status === 'pending_deletion').length,
      transactions: (txRes.data || []).length,
    },
  });
});

app.patch('/api/admin/users/:id', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;

  const targetId = String(req.params.id || '');
  const { full_name, email, system_role, status } = req.body || {};
  if (!targetId) {
    res.status(400).json({ error: 'Akun tidak valid.' });
    return;
  }

  const targetProfile = await getProfileRow(targetId);
  if (!targetProfile) {
    res.status(404).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  if (targetId === admin.id && system_role && system_role !== 'super_admin') {
    res.status(400).json({ error: 'Anda tidak dapat menurunkan akses akun sendiri.' });
    return;
  }

  if (targetId === admin.id && status && status !== 'active') {
    res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    return;
  }

  if (targetProfile.system_role === 'super_admin'
      && system_role === 'user'
      && (await countPlatformOwners()) <= 1) {
    res.status(400).json({ error: 'Pemilik platform terakhir tidak dapat diturunkan.' });
    return;
  }

  try {
    if (email && String(email).trim().toLowerCase() !== String((await getAuthEmailMap()).get(targetId) || '').toLowerCase()) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        email: String(email).trim(),
      });
      if (authError) {
        res.status(400).json({ error: 'Email akun belum dapat diperbarui.' });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (typeof full_name === 'string' && full_name.trim()) updates.full_name = full_name.trim();
    if (system_role === 'user' || system_role === 'super_admin') updates.system_role = system_role;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', targetId);
    if (error) throw error;

    if (status === 'active' || status === 'suspended' || status === 'pending_deletion') {
      await setAccountStatus(targetId, status);
    }

    await writeAdminAudit({
      adminId: admin.id,
      action: 'update_user',
      targetType: 'user',
      targetId,
      details: { fields: Object.keys(updates) },
    });

    res.json({ success: true, message: 'Data akun berhasil diperbarui.' });
  } catch (error) {
    console.error('Gagal memperbarui akun:', error);
    res.status(500).json({ error: 'Data akun belum dapat diperbarui.' });
  }
});

app.post('/api/admin/users/:id/reset-password', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const targetId = String(req.params.id || '');

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(targetId);
    if (error || !data?.user?.email) {
      res.status(404).json({ error: 'Email akun tidak ditemukan.' });
      return;
    }
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: appUrl,
    });
    if (resetError) throw resetError;
    await writeAdminAudit({
      adminId: admin.id,
      action: 'reset_password',
      targetType: 'user',
      targetId,
    });
    res.json({ success: true, message: 'Tautan reset kata sandi telah dikirim.' });
  } catch {
    res.status(500).json({ error: 'Tautan reset kata sandi belum dapat dikirim.' });
  }
});

async function setAccountStatus(userId: string, status: 'active' | 'suspended' | 'pending_deletion') {
  if (!supabaseAdmin) throw new Error('Layanan akun belum siap.');
  const updates: Record<string, unknown> = {
    status,
    deleted_at: status === 'pending_deletion' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: status === 'active' ? 'none' : '876000h',
    });
  } catch {
    // Status profil tetap menjadi sumber utama akses.
  }
}

app.post('/api/admin/users/:id/suspend', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const targetId = String(req.params.id || '');
  if (targetId === admin.id) {
    res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun sendiri.' });
    return;
  }
  try {
    await setAccountStatus(targetId, 'suspended');
    await writeAdminAudit({ adminId: admin.id, action: 'suspend_user', targetType: 'user', targetId });
    res.json({ success: true, message: 'Akun berhasil dinonaktifkan.' });
  } catch {
    res.status(500).json({ error: 'Akun belum dapat dinonaktifkan.' });
  }
});

app.post('/api/admin/users/:id/reactivate', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const targetId = String(req.params.id || '');
  try {
    await setAccountStatus(targetId, 'active');
    await writeAdminAudit({ adminId: admin.id, action: 'reactivate_user', targetType: 'user', targetId });
    res.json({
      success: true,
      message: 'Akun berhasil diaktifkan kembali. Akses mengikuti paket yang masih tersisa.',
    });
  } catch {
    res.status(500).json({ error: 'Akun belum dapat diaktifkan.' });
  }
});

app.post('/api/admin/users/:id/soft-delete', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const targetId = String(req.params.id || '');
  if (targetId === admin.id) {
    res.status(400).json({ error: 'Anda tidak dapat menghapus akun sendiri.' });
    return;
  }
  try {
    await setAccountStatus(targetId, 'pending_deletion');
    await writeAdminAudit({ adminId: admin.id, action: 'soft_delete_user', targetType: 'user', targetId });
    res.json({ success: true, message: 'Akun dijadwalkan terhapus dalam 7 hari.' });
  } catch {
    res.status(500).json({ error: 'Akun belum dapat dijadwalkan untuk dihapus.' });
  }
});

app.post('/api/admin/users/:id/restore', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const targetId = String(req.params.id || '');
  try {
    await setAccountStatus(targetId, 'active');
    await writeAdminAudit({ adminId: admin.id, action: 'restore_user', targetType: 'user', targetId });
    res.json({ success: true, message: 'Akun berhasil dipulihkan.' });
  } catch {
    res.status(500).json({ error: 'Akun belum dapat dipulihkan.' });
  }
});

async function countPlatformOwners(): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('system_role', 'super_admin');
  return count || 0;
}

async function permanentlyDeleteUser(targetId: string, force: boolean): Promise<void> {
  if (!supabaseAdmin) throw new Error('Layanan akun belum siap.');
  const { data: ownedBrands } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('created_by', targetId);

  if (ownedBrands?.length) {
    if (!force) {
      throw new Error('Akun masih memiliki brand. Pindahkan atau hapus brand terlebih dahulu.');
    }

    // Hapus media brand agar tidak ada berkas yatim setelah akun dihapus.
    for (const brand of ownedBrands) {
      try {
        const { data: files } = await supabaseAdmin.storage
          .from('content-media')
          .list(brand.id, { limit: 1000 });
        if (files?.length) {
          await supabaseAdmin.storage
            .from('content-media')
            .remove(files.map((file: any) => `${brand.id}/${file.name}`));
        }
      } catch (error) {
        console.warn('Gagal membersihkan media brand:', brand.id, error);
      }
    }

    const { error: brandError } = await supabaseAdmin
      .from('brands')
      .delete()
      .in('id', ownedBrands.map((brand: any) => brand.id));
    if (brandError) throw brandError;
  }

  // Simpan riwayat finansial tanpa data pribadi.
  const { error: transactionError } = await supabaseAdmin
    .from('transactions')
    .update({ user_id: null, raw_payload: { anonymized: true } })
    .eq('user_id', targetId);
  if (transactionError) throw transactionError;

  await supabaseAdmin.from('activation_codes').update({ assigned_email: null }).eq('redeemed_by', targetId);
  await supabaseAdmin.from('licenses').delete().eq('owner_user_id', targetId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) throw error;
}

app.delete('/api/admin/users/:id', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const targetId = String(req.params.id || '');
  if (targetId === admin.id) {
    res.status(400).json({ error: 'Anda tidak dapat menghapus akun sendiri.' });
    return;
  }

  const targetProfile = await getProfileRow(targetId);
  if (targetProfile?.system_role === 'super_admin' && (await countPlatformOwners()) <= 1) {
    res.status(400).json({ error: 'Pemilik platform terakhir tidak dapat dihapus.' });
    return;
  }

  try {
    await permanentlyDeleteUser(targetId, Boolean(req.body?.force));
    await writeAdminAudit({ adminId: admin.id, action: 'delete_user', targetType: 'user', targetId });
    res.json({ success: true, message: 'Akun dihapus permanen.' });
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Akun belum dapat dihapus.' });
  }
});

async function cleanupExpiredUsers(adminId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, deleted_at, system_role')
    .eq('status', 'pending_deletion')
    .lt('deleted_at', cutoff);

  let deleted = 0;
  let remainingPlatformOwners = await countPlatformOwners();
  for (const profile of pending || []) {
    if (profile.id === adminId) continue;
    if (profile.system_role === 'super_admin' && remainingPlatformOwners <= 1) continue;
    try {
      await permanentlyDeleteUser(profile.id, true);
      deleted += 1;
      if (profile.system_role === 'super_admin') remainingPlatformOwners -= 1;
    } catch (error) {
      console.warn('Gagal menghapus akun terjadwal:', profile.id, error);
    }
  }

  if (deleted > 0) {
    await writeAdminAudit({
      adminId,
      action: 'cleanup_deleted_users',
      targetType: 'system',
      details: { deleted },
    });
  }
  return deleted;
}

app.post('/api/admin/users/cleanup', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  try {
    const deleted = await cleanupExpiredUsers(admin.id);
    res.json({ success: true, message: `${deleted} akun dibersihkan.`, deleted });
  } catch {
    res.status(500).json({ error: 'Pembersihan akun belum dapat dijalankan.' });
  }
});

app.get('/api/admin/pricing', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  res.json({ pricing: await getPricingSettings() });
});

app.put('/api/admin/pricing', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const incoming = req.body?.pricing || req.body;
  if (!incoming?.plans) {
    res.status(400).json({ error: 'Pengaturan harga tidak lengkap.' });
    return;
  }

  try {
    const normalize = (planId: 'starter' | 'pro' | 'ultra') => {
      const fallback = DEFAULT_PRICING_SETTINGS.plans[planId];
      const row = incoming.plans[planId] || {};
      const normalPrice = Math.max(0, Math.round(Number(row.normalPrice ?? fallback.normalPrice) || fallback.normalPrice));
      const promoPrice = Math.max(0, Math.round(Number(row.promoPrice ?? fallback.promoPrice) || fallback.promoPrice));
      const promoActive = Boolean(row.promoActive);
      const promoStartsAt = row.promoStartsAt || null;
      const promoEndsAt = row.promoEndsAt || null;
      if (promoActive && !promoEndsAt) {
        throw new Error('Tanggal akhir promo wajib diisi agar promo tidak berjalan tanpa batas.');
      }
      if (promoStartsAt && promoEndsAt && new Date(promoStartsAt).getTime() >= new Date(promoEndsAt).getTime()) {
        throw new Error('Tanggal akhir promo harus setelah tanggal mulai.');
      }
      if (promoActive && (!promoEndsAt || !Number.isFinite(new Date(promoEndsAt).getTime()) || new Date(promoEndsAt).getTime() <= Date.now())) {
        throw new Error('Tanggal akhir promo harus di masa depan agar promo benar-benar berlaku.');
      }
      return {
        normalPrice,
        promoPrice: Math.min(promoPrice, normalPrice),
        promoActive,
        promoStartsAt,
        promoEndsAt,
        promoLabel: String(row.promoLabel || 'Promo'),
      };
    };

    const pricing: PricingSettings = {
      currency: 'IDR',
      plans: {
        starter: normalize('starter'),
        pro: normalize('pro'),
        ultra: normalize('ultra'),
      },
    };
    await writeAppSetting('pricing', pricing, admin.id);
    await writeAdminAudit({
      adminId: admin.id,
      action: 'update_pricing',
      targetType: 'settings',
      targetId: 'pricing',
      details: pricing as unknown as Record<string, unknown>,
    });
    res.json({ success: true, message: 'Harga dan promo berhasil disimpan.', pricing });
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.startsWith('Tanggal')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Harga dan promo belum dapat disimpan.' });
  }
});

app.get('/api/admin/customer-service', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  res.json({ customerService: await getCustomerServiceSettings() });
});

app.put('/api/admin/customer-service', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin) return;
  const incoming = req.body?.customerService || req.body || {};
  const customerService: CustomerServiceSettings = {
    whatsapp: normalizeWhatsAppNumber(String(incoming.whatsapp || '')),
    label: String(incoming.label || DEFAULT_CUSTOMER_SERVICE.label).slice(0, 80),
    message: String(incoming.message || DEFAULT_CUSTOMER_SERVICE.message).slice(0, 300),
    active: Boolean(incoming.active),
  };
  if (customerService.active && !customerService.whatsapp) {
    res.status(400).json({ error: 'Nomor WhatsApp wajib diisi jika kontak diaktifkan.' });
    return;
  }

  try {
    await writeAppSetting('customer_service', customerService, admin.id);
    await writeAdminAudit({
      adminId: admin.id,
      action: 'update_customer_service',
      targetType: 'settings',
      targetId: 'customer_service',
    });
    res.json({ success: true, message: 'Kontak customer service berhasil disimpan.', customerService });
  } catch {
    res.status(500).json({ error: 'Kontak customer service belum dapat disimpan.' });
  }
});

app.get('/api/admin/activation-codes', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from('activation_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  res.json({ codes: data || [] });
});

app.post('/api/admin/activation-codes', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;

  const planId = String(req.body?.planId || '').toLowerCase();
  const plan = getPlan(planId);
  if (!plan || (planId !== 'trial' && !plan.purchasable)) {
    res.status(400).json({ error: 'Paket kode aktivasi tidak valid.' });
    return;
  }

  const durationDays = planId === 'trial'
    ? TRIAL_DAYS
    : Math.max(1, Math.min(3650, Number(req.body?.durationDays) || 30));
  const quantity = Math.max(1, Math.min(50, Number(req.body?.quantity) || 1));
  const assignedEmail = req.body?.assignedEmail ? String(req.body.assignedEmail).trim().toLowerCase() : null;
  const rawExpiresInDays = Number(req.body?.expiresInDays);
  const expiresInDays = Number.isFinite(rawExpiresInDays)
    ? Math.max(0, Math.min(3650, rawExpiresInDays))
    : 30;
  const expiresAt = expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  try {
    const rows = Array.from({ length: quantity }, () => ({
      code: generateActivationCode(plan.id),
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: durationDays,
      max_uses: 1,
      assigned_email: assignedEmail,
      expires_at: expiresAt,
      status: 'active',
      created_by: admin.id,
    }));
    const { data, error } = await supabaseAdmin
      .from('activation_codes')
      .insert(rows)
      .select('*');
    if (error) throw error;
    await writeAdminAudit({
      adminId: admin.id,
      action: 'create_activation_codes',
      targetType: 'activation_code',
      details: { planId, quantity, durationDays, assignedEmail },
    });
    res.json({ success: true, message: 'Kode aktivasi berhasil dibuat.', codes: data || [] });
  } catch {
    res.status(500).json({ error: 'Kode aktivasi belum dapat dibuat.' });
  }
});

app.patch('/api/admin/activation-codes/:id/revoke', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const codeId = String(req.params.id || '');
  try {
    const { error } = await supabaseAdmin
      .from('activation_codes')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', codeId)
      .eq('status', 'active');
    if (error) throw error;
    await writeAdminAudit({
      adminId: admin.id,
      action: 'revoke_activation_code',
      targetType: 'activation_code',
      targetId: codeId,
    });
    res.json({ success: true, message: 'Kode aktivasi berhasil dicabut.' });
  } catch {
    res.status(500).json({ error: 'Kode aktivasi belum dapat dicabut.' });
  }
});

app.post('/api/admin/subscriptions/:userId/extend', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const targetUserId = String(req.params.userId || '');
  const days = Math.max(1, Math.min(3650, Number(req.body?.days) || 30));

  const { data: license } = await supabaseAdmin
    .from('licenses')
    .select('*')
    .eq('owner_user_id', targetUserId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!license) {
    res.status(404).json({ error: 'Langganan aktif tidak ditemukan.' });
    return;
  }
  if (license.is_legacy_lifetime) {
    res.status(400).json({ error: 'Akun ini memiliki akses lama tanpa batas waktu.' });
    return;
  }

  const base = license.current_period_end && new Date(license.current_period_end).getTime() > Date.now()
    ? new Date(license.current_period_end).getTime()
    : Date.now();
  const periodEnd = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { error } = await supabaseAdmin
      .from('licenses')
      .update({
        status: 'active',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', license.id);
    if (error) throw error;
    await writeAdminAudit({
      adminId: admin.id,
      action: 'extend_subscription',
      targetType: 'subscription',
      targetId: targetUserId,
      details: { days, periodEnd },
    });
    res.json({ success: true, message: `Langganan diperpanjang ${days} hari.`, periodEnd });
  } catch {
    res.status(500).json({ error: 'Langganan belum dapat diperpanjang.' });
  }
});

app.patch('/api/admin/subscriptions/:userId', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const targetUserId = String(req.params.userId || '');
  const { planId, status } = req.body || {};

  const { data: license } = await supabaseAdmin
    .from('licenses')
    .select('*')
    .eq('owner_user_id', targetUserId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!license) {
    res.status(404).json({ error: 'Langganan aktif tidak ditemukan.' });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status === 'revoked' || status === 'expired' || status === 'active') {
    updates.status = status;
  }
  if (planId) {
    const plan = getPlan(planId);
    if (!plan || plan.id === 'trial') {
      res.status(400).json({ error: 'Paket tidak valid.' });
      return;
    }
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    updates.plan_id = plan.id;
    updates.plan_name = plan.name;
    updates.max_brands = plan.maxBrands;
    updates.max_team_members = plan.maxTeamMembers;
    updates.ai_quota_total = plan.aiQuota;
    updates.ai_quota_used = 0;
    updates.is_legacy_lifetime = false;
    updates.billing_cycle = 'monthly';
    updates.current_period_start = periodStart.toISOString();
    updates.current_period_end = periodEnd.toISOString();
    updates.status = 'active';
  }

  try {
    const { error } = await supabaseAdmin.from('licenses').update(updates).eq('id', license.id);
    if (error) throw error;
    await writeAdminAudit({
      adminId: admin.id,
      action: 'update_subscription',
      targetType: 'subscription',
      targetId: targetUserId,
      details: updates,
    });
    res.json({ success: true, message: 'Langganan berhasil diperbarui.' });
  } catch {
    res.status(500).json({ error: 'Langganan belum dapat diperbarui.' });
  }
});

app.get('/api/admin/audit-logs', authenticateUser, async (req: Request, res: Response) => {
  const admin = await requirePlatformOwner(req, res);
  if (!admin || !supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  res.json({ logs: data || [] });
});

app.get('/api/ai/quota', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Layanan belum siap. Silakan coba lagi.' });
    return;
  }

  try {
    const license = await resolveGrantedLicense(user.id, await getActiveLicenseRow(user.id));

    if (!license) {
      res.json({
        remaining: 0,
        total: 0,
        used: 0,
        hasLicense: false,
        planId: null,
        planName: null,
        maxBrands: 1,
        maxTeamMembers: 1,
      });
      return;
    }

    const remaining = Math.max(0, Number(license.ai_quota_total) - Number(license.ai_quota_used));
    res.json({
      remaining,
      total: Number(license.ai_quota_total) || 0,
      used: Number(license.ai_quota_used) || 0,
      hasLicense: true,
      planId: license.plan_id || null,
      planName: license.plan_name || null,
      maxBrands: license.max_brands || 1,
      maxTeamMembers: license.max_team_members || 1,
    });
  } catch (err) {
    res.status(500).json({ error: 'Kuota AI belum dapat diperiksa.' });
  }
});

app.post('/api/ai/metrics-extractor', authenticateUser, aiRateLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { brandId, imageUrl, imageBase64, channel = 'Instagram' } = req.body;
  const targetImage = imageUrl || imageBase64;

  if (!targetImage || !brandId || typeof targetImage !== 'string') {
    res.status(400).json({ error: 'Data yang diperlukan belum lengkap. Pilih brand dan unggah file terlebih dahulu.' });
    return;
  }

  if (!hasGeminiKey) {
    res.status(503).json({ error: 'Layanan AI belum tersedia. Silakan coba lagi nanti.' });
    return;
  }

  let base64Data = targetImage;
  let mimeType = normalizeGeminiMimeType(typeof req.body.mimeType === 'string' ? req.body.mimeType : 'image/jpeg');
  if (targetImage.startsWith('data:')) {
    const match = targetImage.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = normalizeGeminiMimeType(match[1]);
      base64Data = match[2];
    }
  }

  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    res.status(400).json({ error: 'Format file harus berupa gambar atau video.' });
    return;
  }

  const estimatedBytes = Buffer.byteLength(base64Data, 'base64');
  if (estimatedBytes > 3 * 1024 * 1024) {
    res.status(413).json({
      error: 'Ukuran file terlalu besar. Maksimal 3 MB. Kompres file sebelum mengunggah.',
    });
    return;
  }

  const hasAccess = await verifyBrandAiAccess(user.id, brandId);
  if (!hasAccess) {
    res.status(403).json({ error: 'Akses ditolak. Hanya owner, admin, atau editor yang dapat memakai fitur AI pada brand ini.' });
    return;
  }

  const quotaRes = await checkAndDeductQuota(
    user.id,
    brandId,
    'metrics_extractor',
    `Ekstraksi Metrik ${channel}`
  );
  if (!quotaRes.allowed) {
    res.status(403).json({ error: quotaRes.error });
    return;
  }

  try {
    const prompt = `Analisis gambar/screenshot atau rekaman analitik media sosial (${channel}) ini secara presisi dan mendalam.
Platform target: ${channel}.
Instruksi ekstraksi:
1. Ekstrak metrik standar:
   - impressions: total penayangan video / views / tayangan (number)
   - reach: total akun yang dijangkau / viewers unik (number)
   - likes: jumlah suka (number)
   - comments: jumlah komentar (number)
   - shares: jumlah dibagikan (number)
   - saves: jumlah disimpan / favorit / bookmark (number)
   - clicks: jumlah klik tautan / link clicks (number)
2. Ekstrak metrik mendalam video (TikTok / Instagram / Shorts):
   - "watch_time": waktu tonton rata-rata (misal di TikTok 'Waktu tonton rata-rata 14.5 dtk' atau di Instagram 'Average watch time: 0:34 detik'. Format string '0:XX detik' atau null jika bukan video).
   - "drop_off_rate": persentase penonton lewati / drop-off (number 0-100). Jika di TikTok tertera 'Menonton video lengkap 32%', maka drop-off adalah (100 - 32) = 68. Jika tidak tertera, isi null.
   - "reposts": jumlah posting ulang / repost (number 0 jika tidak ada).
   - "traffic_sources": persentase sumber penayangan (0-100).
     * Jika TikTok: "reels" untuk Untuk Anda (FYP), "feed" untuk Mengikuti (Following), "explore" untuk Suara/Pencarian, "profile" untuk Profil pribadi.
     * Jika Instagram: "reels" untuk Tab Reels, "feed" untuk Beranda/Feed, "explore" untuk Jelajahi/Explore, "profile" untuk Profil.
     * Jika platform lain/YouTube: petakan proporsi serupa.
   - "audience_breakdown":
     * "followers": persentase penonton pengikut (0-100).
     * "non_followers": persentase penonton bukan pengikut (0-100).
3. "confidence": tingkat keyakinan pembacaan AI (angka 1-100).
4. "detected_title": judul atau potongan caption/isi video jika tampak pada screenshot.
5. "summary": ringkasan performa 1-2 kalimat dalam bahasa Indonesia.

Kembalikan HANYA JSON murni yang valid tanpa backticks markdown:
{
  "channel": "${channel.toLowerCase()}",
  "detected_title": "judul atau potongan caption jika terdeteksi, atau null",
  "summary": "ringkasan singkat 1-2 kalimat tentang performa konten ini",
  "confidence": 95,
  "impressions": 0,
  "reach": 0,
  "engagement_rate": 0,
  "likes": 0,
  "comments": 0,
  "shares": 0,
  "saves": 0,
  "clicks": 0,
  "watch_time": "0:30 detik",
  "drop_off_rate": 25.5,
  "reposts": 0,
  "traffic_sources": {
    "reels": 0,
    "feed": 0,
    "explore": 0,
    "profile": 0
  },
  "audience_breakdown": {
    "followers": 0,
    "non_followers": 0
  }
}
Pastikan semua nilai numerik adalah angka asli dari gambar/video. Jika informasi tertentu tidak tercantum pada screenshot, isi angka 0 atau null.`;

    const { response, modelUsed } = await runGeminiWithFallback({
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      throw new Error('Layanan AI tidak mengembalikan hasil analisis. Coba gunakan file yang lebih kecil.');
    }

    const parsedMetrics = parseJsonSafely(responseText);
    if (!parsedMetrics || typeof parsedMetrics !== 'object' || Array.isArray(parsedMetrics)) {
      throw new Error('Hasil analisis AI tidak dapat dibaca. Silakan coba lagi.');
    }

    const tokensConsumed = Number((response as any)?.usageMetadata?.totalTokenCount) || 0;
    if (quotaRes.logId) {
      await supabaseAdmin
        ?.from('ai_usage_logs')
        .update({ tokens_consumed: tokensConsumed })
        .eq('id', quotaRes.logId);
    }

    res.json({
      success: true,
      modelUsed,
      data: parsedMetrics,
      metrics: parsedMetrics,
      remainingCredits: quotaRes.remaining,
      totalCredits: quotaRes.total,
      tokensConsumed,
    });
  } catch (err: unknown) {
    console.error('Gemini Metrics Extractor error:', err);
    await refundQuota(user.id, quotaRes.licenseId, quotaRes.logId, 'metrics_extractor');

    const errMessage = err instanceof Error ? err.message : String(err);
    const isOverloaded =
      errMessage.includes('503') ||
      errMessage.includes('high demand') ||
      errMessage.includes('UNAVAILABLE');

    res.status(500).json({
      error: isOverloaded
        ? 'Layanan AI sedang mengalami lonjakan antrian sementara. Kredit AI Anda telah dikembalikan otomatis. Silakan coba klik sekali lagi.'
        : 'Gagal memproses gambar insight. Kredit AI Anda telah dikembalikan secara otomatis.',
    });
  }
});

app.post('/api/ai/strategy-assistant', authenticateUser, aiRateLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { brandId, objective, customNotes } = req.body;

  if (!brandId) {
    res.status(400).json({ error: 'Brand ID wajib diisi.' });
    return;
  }

  if (!hasGeminiKey) {
    res.status(503).json({ error: 'Layanan AI belum tersedia. Silakan coba lagi nanti.' });
    return;
  }

  const hasAccess = await verifyBrandAiAccess(user.id, brandId);
  if (!hasAccess) {
    res.status(403).json({ error: 'Akses ditolak. Hanya owner, admin, atau editor yang dapat memakai fitur AI pada brand ini.' });
    return;
  }

  const quotaRes = await checkAndDeductQuota(
    user.id,
    brandId,
    'strategy_assistant',
    `Strategi AI: ${objective || 'Engagement'}`
  );
  if (!quotaRes.allowed) {
    res.status(403).json({ error: quotaRes.error });
    return;
  }

  try {
    let brandInfo: any = null;
    let recentPosts: any[] = [];
    let recentMetrics: any[] = [];

    if (supabaseAdmin) {
      const { data: bData } = await supabaseAdmin
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .maybeSingle();
      brandInfo = bData;

      const { data: pData } = await supabaseAdmin
        .from('content_posts')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(20);
      recentPosts = pData || [];

      const { data: mData } = await supabaseAdmin
        .from('content_metrics')
        .select('channel, impressions, reach, likes, comments, shares, saves, engagement_rate, recorded_at')
        .eq('brand_id', brandId)
        .order('recorded_at', { ascending: false })
        .limit(30);
      recentMetrics = mData || [];
    }

    let totalReach = 0;
    let totalEng = 0;
    for (const m of recentMetrics) {
      totalReach += m.reach || 0;
      totalEng += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
    }
    const avgER = totalReach > 0 ? ((totalEng / totalReach) * 100).toFixed(2) : '0.00';

    const historicalContext = {
      brand_name: brandInfo?.name || 'Brand Klien',
      industry: brandInfo?.industry || 'Umum',
      description: brandInfo?.description || 'Tidak ada deskripsi',
      social_accounts: brandInfo?.social_accounts || {},
      total_recorded_posts: recentPosts.length,
      sample_recent_posts: recentPosts.slice(0, 10).map((p) => ({
        title: p.title,
        pillar: p.pillar,
        format: p.format,
        channels: p.channels,
        status: p.status,
      })),
      historical_metrics_summary: {
        samples_count: recentMetrics.length,
        average_engagement_rate: `${avgER}%`,
        total_sample_reach: totalReach,
        total_sample_engagements: totalEng,
      },
    };

    const prompt = `Anda adalah Senior Social Media Strategist untuk pasar Indonesia.
Tugas Anda adalah merumuskan rencana strategi konten yang tajam berdasarkan DATA HISTORIS NYATA brand berikut:

DATA HISTORIS BRAND:
${JSON.stringify(historicalContext, null, 2)}

FOKUS / TUJUAN STRATEGIS YANG DIMINTA PENGGUNA:
"${objective || 'Meningkatkan Engagement Rate & Pertumbuhan Akun'}"
Catatan Tambahan Pengguna: "${customNotes || 'Gunakan gaya komunikasi relevan audiens Indonesia'}"

PRINSIP WAJIB:
1. PISAHKAN SECARA TEGAS antara FAKTA HISTORIS DATA (Data-Backed Facts) dan REKOMENDASI STRATEGIS (Actionable AI Recommendations).
2. Jangan membuat klaim bahwa AI menjamin 100% viralitas atau pertumbuhan pasti.
3. Rencana konten harus konkret untuk kreator/tim pemasaran di Indonesia.
4. Kembalikan HANYA JSON murni tanpa markdown dengan format berikut:

{
  "brand_overview": "Analisis singkat posisi brand saat ini berdasarkan data",
  "verified_historical_facts": [
    "Fakta data 1",
    "Fakta data 2"
  ],
  "key_insights": [
    "Wawasan temuan pola 1",
    "Wawasan temuan pola 2"
  ],
  "strategic_recommendations": [
    "Rekomendasi strategis aksi 1",
    "Rekomendasi strategis aksi 2",
    "Rekomendasi strategis aksi 3"
  ],
  "content_action_plan": [
    {
      "hook": "Contoh kalimat judul/hook konten yang memikat",
      "pillar": "Edukatif",
      "format": "carousel",
      "channel": "instagram",
      "rationale": "Alasan mengapa ide ini relevan"
    },
    {
      "hook": "Contoh hook kedua",
      "pillar": "Promosi",
      "format": "reel_short",
      "channel": "tiktok",
      "rationale": "Alasan rekomendasi"
    },
    {
      "hook": "Contoh hook ketiga",
      "pillar": "Interaktif",
      "format": "story",
      "channel": "instagram",
      "rationale": "Alasan rekomendasi"
    }
  ],
  "disclaimer": "Rekomendasi ini disusun berdasarkan analisis statistik data historis brand Anda."
}`;

    const { response, modelUsed } = await runGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    const parsedStrategy = parseJsonSafely(responseText);

    const tokensConsumed = Number((response as any)?.usageMetadata?.totalTokenCount) || 0;
    if (quotaRes.logId) {
      await supabaseAdmin
        ?.from('ai_usage_logs')
        .update({ tokens_consumed: tokensConsumed })
        .eq('id', quotaRes.logId);
    }

    res.json({
      success: true,
      modelUsed,
      strategy: parsedStrategy,
      remainingCredits: quotaRes.remaining,
      totalCredits: quotaRes.total,
      tokensConsumed,
    });
  } catch (err: unknown) {
    console.error('Gemini Strategy Assistant error:', err);
    await refundQuota(user.id, quotaRes.licenseId, quotaRes.logId, 'strategy_assistant');

    const errMessage = err instanceof Error ? err.message : String(err);
    const isOverloaded =
      errMessage.includes('503') ||
      errMessage.includes('high demand') ||
      errMessage.includes('UNAVAILABLE');

    res.status(500).json({
      error: isOverloaded
        ? 'Layanan AI sedang mengalami lonjakan antrian sementara. Kredit AI Anda telah dikembalikan otomatis. Silakan coba klik sekali lagi.'
        : 'Gagal menghasilkan rekomendasi strategi AI. Kredit AI Anda telah dikembalikan secara otomatis.',
    });
  }
});

// API fallback agar request ke endpoint tidak dikenal tidak jatuh ke index.html.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Layanan tidak ditemukan.' });
});

// Error handler terpusat, termasuk payload terlalu besar dan JSON rusak.
app.use((err: any, _req: Request, res: Response, _next: () => void) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Ukuran data terlalu besar. Maksimal 4,5 MB. Kompres gambar atau video sebelum mengunggah.',
    });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Permintaan tidak dapat dibaca. Silakan coba lagi.' });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Terjadi kendala. Silakan coba lagi.' });
});

// Diekspor untuk Vercel Function (api/[...path].ts) dan launcher lokal.
export default app;
export { app };

