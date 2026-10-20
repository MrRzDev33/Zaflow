import { supabase, isConfigured } from '../../config/supabase.ts';
import { SignInCredentials, SignUpCredentials } from '../../types/auth.ts';
import { Profile } from '../../types/database.ts';

export const authService = {
  /**
   * Mendaftar pengguna baru
   */
  async signUp({ email, password, fullName }: SignUpCredentials) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi. Harap isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Masuk dengan email & kata sandi
   */
  async signIn({ email, password }: SignInCredentials) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi. Harap isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Mengirim email tautan reset kata sandi.
   */
  async resetPassword(email: string) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi.');
    }
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  /**
   * Memperbarui kata sandi setelah pengguna membuka tautan recovery.
   */
  async updatePassword(password: string) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi.');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  /**
   * Keluar dari sesi
   */
  async signOut() {
    if (!isConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Mendapatkan sesi pengguna saat ini
   */
  async getSession() {
    if (!isConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Mengambil data profil dari tabel public.profiles
   */
  async getProfile(userId: string): Promise<Profile | null> {
    if (!isConfigured) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Gagal memuat profil pengguna:', error.message);
      return null;
    }
    return data as Profile | null;
  },

  /**
   * Listener perubahan status autentikasi
   */
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    if (!isConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },
};
