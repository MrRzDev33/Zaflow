import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { getPlan, TRIAL_PLAN } from '../config/plans.ts';

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
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di server.');
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
    res.status(503).json({ error: 'Layanan autentikasi database tidak tersedia atau belum dikonfigurasi di server.' });
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Sesi kedaluwarsa atau token tidak valid.' });
      return;
    }
    (req as any).user = user;
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
      error: 'Layanan database lisensi belum dikonfigurasi di server.',
    };
  }

  // Jalur utama: RPC atomik dari migrasi 20261020_01.
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('consume_ai_credit', {
    p_user_id: userId,
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
  const { data: license } = await supabaseAdmin
    .from('licenses')
    .select('*')
    .eq('owner_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  let targetLicense = license;

  if (!targetLicense) {
    const trialKey = `TRIAL-${userId.slice(0, 8).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { data: createdLic } = await supabaseAdmin
      .from('licenses')
      .insert({
        license_key: trialKey,
        plan_id: TRIAL_PLAN.id,
        plan_name: TRIAL_PLAN.name,
        max_brands: TRIAL_PLAN.maxBrands,
        max_team_members: TRIAL_PLAN.maxTeamMembers,
        ai_quota_total: TRIAL_PLAN.aiQuota,
        ai_quota_used: 0,
        status: 'active',
        owner_user_id: userId,
        activated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (createdLic) {
      targetLicense = createdLic;
    } else {
      const { data: retryLicense } = await supabaseAdmin
        .from('licenses')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      targetLicense = retryLicense;
    }
  }

  if (!targetLicense) {
    return {
      allowed: false,
      remaining: 0,
      total: 0,
      used: 0,
      error: 'Lisensi akun tidak ditemukan. Silakan hubungi admin.',
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
    .eq('status', 'active')
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
        .update({ ai_quota_used: Math.max(0, updatedLicense.ai_quota_used), updated_at: new Date().toISOString() })
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

// Webhook generik (opsional, untuk provider selain Midtrans).
app.post('/api/webhook/payment', async (req: Request, res: Response) => {
  const webhookSecret = (process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    res.status(503).json({ success: false, error: 'Payment webhook secret belum dikonfigurasi di server.' });
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
    res.status(503).json({ success: false, error: 'Database belum dikonfigurasi.' });
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
    res.status(503).json({ success: false, error: 'MIDTRANS_SERVER_KEY belum dikonfigurasi.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ success: false, error: 'Database belum dikonfigurasi.' });
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
      .select('id, user_id, status, amount, license_key, plan_id')
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

    if (tx.status === 'success' && isSuccess) {
      res.json({ success: true, message: 'Notifikasi sudah diproses sebelumnya.' });
      return;
    }

    if (isSuccess && tx.status !== 'success') {
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
      const { error: activationError } = await supabaseAdmin.rpc('activate_license_from_payment', {
        p_user_id: tx.user_id,
        p_license_key: licenseKey,
        p_plan_id: plan.id,
        p_plan_name: plan.name,
        p_max_brands: plan.maxBrands,
        p_max_team_members: plan.maxTeamMembers,
        p_ai_quota: plan.aiQuota,
      });

      if (activationError) {
        // Fallback database lama: aktifkan lisensi yang sudah ada atau buat baru.
        const { data: existingLicense } = await supabaseAdmin
          .from('licenses')
          .select('id, license_key')
          .eq('owner_user_id', tx.user_id)
          .eq('status', 'active')
          .maybeSingle();

        if (existingLicense) {
          const { error } = await supabaseAdmin
            .from('licenses')
            .update({
              plan_id: plan.id,
              plan_name: plan.name,
              max_brands: plan.maxBrands,
              max_team_members: plan.maxTeamMembers,
              ai_quota_total: plan.aiQuota,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLicense.id);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin.from('licenses').insert({
            license_key: licenseKey,
            plan_id: plan.id,
            plan_name: plan.name,
            max_brands: plan.maxBrands,
            max_team_members: plan.maxTeamMembers,
            ai_quota_total: plan.aiQuota,
            ai_quota_used: 0,
            status: 'active',
            owner_user_id: tx.user_id,
            activated_at: new Date().toISOString(),
          });
          if (error) throw error;
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'success',
          license_key: licenseKey,
          paid_at: new Date().toISOString(),
          payment_provider: 'midtrans',
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
      message: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.',
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
      res.status(404).json({ success: false, message: 'Kunci lisensi tidak ditemukan di database.' });
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
    res.status(500).json({ success: false, message: 'Kesalahan internal server saat aktivasi lisensi.' });
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    action: 'invited_member',
    entity_type: 'brand_invitation',
    details: { email: normalizedEmail, role: requestedRole },
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    email: invite.email,
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    res.status(400).json({ error: `Undangan ini sudah berstatus '${invite.status}'.` });
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
    res.status(403).json({
      error: `Undangan ini ditujukan untuk ${invite.email}. Masuk dengan akun email tersebut untuk menerima undangan.`,
    });
    return;
  }

  // 4. Masukkan ke tabel brand_members
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
    action: 'joined_team',
    entity_type: 'brand_member',
    details: { role: invite.role, email: invite.email },
  });

  const brandName = (invite.brands as any)?.name || 'Brand';
  res.json({
    success: true,
    message: `Selamat! Anda berhasil bergabung ke dalam tim '${brandName}' sebagai ${invite.role}.`,
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    action: 'updated_member_role',
    entity_type: 'brand_member',
    entity_id: targetUserId,
    details: { previous_role: targetMember.role, new_role: role },
  });

  res.json({ success: true, message: `Role anggota berhasil diperbarui menjadi ${role}.` });
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
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
    action: isSelf ? 'left_brand' : 'removed_member',
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

  if (!plan || !plan.purchasable) {
    res.status(400).json({ error: 'Paket tidak valid atau tidak dapat dibeli.' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
    return;
  }

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
    amount: plan.price,
    plan_id: plan.id,
    payment_provider: 'midtrans',
    raw_payload: {
      plan_id: plan.id,
      plan_name: plan.name,
      sandbox_checkout: false,
    },
  });

  if (txInsertError) {
    console.error('Gagal membuat transaksi:', txInsertError);
    res.status(500).json({
      error: 'Gagal membuat transaksi. Pastikan migrasi database terbaru sudah dijalankan.',
    });
    return;
  }

  // Mode sandbox lokal: hanya aktif jika ALLOW_SANDBOX_CHECKOUT=true dan
  // Midtrans tidak dalam mode production.
  if (!hasMidtrans) {
    if (!allowSandboxCheckout || midtransIsProduction) {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_id', orderId);
      res.status(503).json({
        error: 'Pembayaran Midtrans belum dikonfigurasi. Hubungi admin atau aktifkan MIDTRANS_SERVER_KEY.',
      });
      return;
    }

    const { data: activatedLicense, error: activationError } = await supabaseAdmin.rpc(
      'activate_license_from_payment',
      {
        p_user_id: user.id,
        p_license_key: licenseKey,
        p_plan_id: plan.id,
        p_plan_name: plan.name,
        p_max_brands: plan.maxBrands,
        p_max_team_members: plan.maxTeamMembers,
        p_ai_quota: plan.aiQuota,
      }
    );

    if (activationError) {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_id', orderId);
      res.status(503).json({
        error: 'Migrasi RPC aktivasi lisensi belum tersedia. Jalankan migrasi 20261020_01 terlebih dahulu.',
      });
      return;
    }

    await supabaseAdmin
      .from('transactions')
      .update({
        status: 'success',
        paid_at: new Date().toISOString(),
        raw_payload: { sandbox_checkout: true, plan_id: plan.id, plan_name: plan.name },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    res.json({
      success: true,
      sandbox: true,
      orderId,
      licenseKey,
      plan,
      license: Array.isArray(activatedLicense) ? activatedLicense[0] : activatedLicense,
      message: `Mode sandbox: lisensi ${plan.name} diaktifkan tanpa pembayaran.`,
    });
    return;
  }

  try {
    const snap = await createMidtransSnapTransaction({
      orderId,
      amount: plan.price,
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
          snap_token: snap.token,
          redirect_url: snap.redirect_url,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    res.json({
      success: true,
      orderId,
      plan,
      token: snap.token,
      redirectUrl: snap.redirect_url,
    });
  } catch (err: unknown) {
    console.error('Gagal membuat transaksi Midtrans:', err);
    const message = err instanceof Error ? err.message : 'Gagal membuat transaksi Midtrans.';
    await supabaseAdmin
      .from('transactions')
      .update({
        status: 'failed',
        raw_payload: { plan_id: plan.id, error: message },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', orderId);

    res.status(502).json({ error: `Gagal membuat transaksi Midtrans: ${message}` });
  }
});

// Status pembayaran untuk polling UI setelah kembali dari halaman Midtrans.
app.get('/api/payments/midtrans/status/:orderId', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orderId = String(req.params.orderId || '');
  if (!orderId) {
    res.status(400).json({ error: 'orderId wajib diisi.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
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
  const user = (req as any).user;
  if (!supabaseAdmin) {
    res.status(403).json({ error: 'Supabase tidak dikonfigurasi.' });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.system_role === 'super_admin';
  if (!isSuperAdmin) {
    res.status(403).json({ error: 'Akses ditolak. Anda bukan platform administrator.' });
    return;
  }

  const [usersRes, brandsRes, licensesRes, txRes, logsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('brands').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('licenses').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('ai_usage_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  res.json({
    users: usersRes.data || [],
    brands: brandsRes.data || [],
    licenses: licensesRes.data || [],
    transactions: txRes.data || [],
    aiLogs: logsRes.data || [],
  });
});

app.get('/api/ai/quota', authenticateUser, async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Database belum dikonfigurasi di server.' });
    return;
  }

  try {
    const { data: license } = await supabaseAdmin
      .from('licenses')
      .select('id, ai_quota_total, ai_quota_used')
      .eq('owner_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!license) {
      res.json({
        remaining: TRIAL_PLAN.aiQuota,
        total: TRIAL_PLAN.aiQuota,
        used: 0,
        hasLicense: false,
        planId: TRIAL_PLAN.id,
        planName: TRIAL_PLAN.name,
        maxBrands: TRIAL_PLAN.maxBrands,
        maxTeamMembers: TRIAL_PLAN.maxTeamMembers,
      });
      return;
    }

    const { data: licenseDetails } = await supabaseAdmin
      .from('licenses')
      .select('plan_id, plan_name, max_brands, max_team_members')
      .eq('id', (license as any).id)
      .maybeSingle();

    const remaining = Math.max(0, license.ai_quota_total - license.ai_quota_used);
    res.json({
      remaining,
      total: license.ai_quota_total,
      used: license.ai_quota_used,
      hasLicense: true,
      planId: licenseDetails?.plan_id || null,
      planName: licenseDetails?.plan_name || null,
      maxBrands: licenseDetails?.max_brands || 1,
      maxTeamMembers: licenseDetails?.max_team_members || 1,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memeriksa kuota AI.' });
  }
});

app.post('/api/ai/metrics-extractor', authenticateUser, aiRateLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { brandId, imageUrl, imageBase64, channel = 'Instagram' } = req.body;
  const targetImage = imageUrl || imageBase64;

  if (!targetImage || !brandId || typeof targetImage !== 'string') {
    res.status(400).json({ error: 'Parameter tidak lengkap (brandId dan file gambar/video wajib diisi).' });
    return;
  }

  if (!hasGeminiKey) {
    res.status(503).json({ error: 'Layanan AI belum dikonfigurasi. Hubungi admin untuk mengatur GEMINI_API_KEY.' });
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
      error: 'Ukuran file terlalu besar. Maksimal 3 MB (agar base64 tetap di bawah batas 4.5 MB Vercel Functions).',
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
      throw new Error('Gemini tidak mengembalikan teks analisis. Coba gunakan file yang lebih kecil atau model lain.');
    }

    const parsedMetrics = parseJsonSafely(responseText);
    if (!parsedMetrics || typeof parsedMetrics !== 'object' || Array.isArray(parsedMetrics)) {
      throw new Error('Respons Gemini bukan JSON metrik yang valid.');
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
        ? 'Layanan AI Gemini sedang mengalami lonjakan antrian sementara. Kredit AI Anda telah dikembalikan otomatis. Silakan coba klik sekali lagi.'
        : 'Gagal memproses gambar insight dengan AI Gemini. Kredit AI Anda telah dikembalikan secara otomatis.',
      details: errMessage,
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
    res.status(503).json({ error: 'Layanan AI belum dikonfigurasi. Hubungi admin untuk mengatur GEMINI_API_KEY.' });
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
        ? 'Layanan AI Gemini sedang mengalami lonjakan antrian sementara. Kredit AI Anda telah dikembalikan otomatis. Silakan coba klik sekali lagi.'
        : 'Gagal menghasilkan rekomendasi strategi AI. Kredit AI Anda telah dikembalikan secara otomatis.',
      details: errMessage,
    });
  }
});

// API fallback agar request ke endpoint tidak dikenal tidak jatuh ke index.html.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

// Error handler terpusat, termasuk payload terlalu besar dan JSON rusak.
app.use((err: any, _req: Request, res: Response, _next: () => void) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Payload terlalu besar. Maksimal 4.5 MB (batas Vercel Functions). Kompres gambar/video sebelum mengunggah.',
    });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Body JSON tidak valid.' });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Kesalahan internal server.' });
});

// Diekspor untuk Vercel Function (api/[...path].ts) dan launcher lokal.
export default app;
export { app };

