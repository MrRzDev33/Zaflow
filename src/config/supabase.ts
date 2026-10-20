import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured, getStoredSupabaseConfig } from './env.ts';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

export const isConfigured = isSupabaseConfigured();
const stored = getStoredSupabaseConfig();

export const supabase: SupabaseClient = createClient(
  isConfigured ? (env.supabaseUrl || stored.url) : fallbackUrl,
  isConfigured ? (env.supabaseAnonKey || stored.anonKey) : fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

