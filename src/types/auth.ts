import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';
import { Profile } from './database.ts';

export interface AuthState {
  user: SupabaseUser | null;
  profile: Profile | null;
  session: SupabaseSession | null;
  loading: boolean;
  error: string | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  fullName: string;
}
