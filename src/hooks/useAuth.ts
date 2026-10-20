import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '../services/auth/authService.ts';
import { isConfigured } from '../config/supabase.ts';
import { Profile } from '../types/database.ts';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState<boolean>(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const p = await authService.getProfile(userId);
      setProfile(p);
    } catch (err: unknown) {
      console.warn('Gagal mengambil profil:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Ambil sesi awal
    authService.getSession().then((initialSession) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      if (!mounted) return;
      setError(err instanceof Error ? err.message : 'Gagal memuat sesi pengguna');
      setLoading(false);
    });

    // Pasang listener
    const { data: { subscription } } = authService.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      const s = newSession as Session | null;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal keluar');
    }
  }, []);

  const completePasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return {
    user,
    profile,
    session,
    loading,
    error,
    passwordRecovery,
    completePasswordRecovery,
    signOut,
    isConfigured,
  };
}
