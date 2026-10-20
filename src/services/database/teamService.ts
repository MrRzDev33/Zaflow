import { supabase, isConfigured } from '../../config/supabase.ts';
import { BrandMember } from '../../types/database.ts';

export interface BrandInvitation {
  id: string;
  brand_id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
}

export const teamService = {
  async getBrandMembers(brandId: string): Promise<BrandMember[]> {
    if (!isConfigured || !brandId) return [];

    const { data, error } = await supabase
      .from('brand_members')
      .select(`
        id,
        brand_id,
        user_id,
        role,
        created_at,
        profile:profiles (
          id,
          full_name,
          avatar_url,
          system_role
        )
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Gagal memuat anggota brand:', error.message);
      return [];
    }

    return (data || []) as unknown as BrandMember[];
  },

  async inviteMember(
    brandId: string,
    email: string,
    role: 'admin' | 'editor' | 'viewer'
  ): Promise<{ success: boolean; message: string; token?: string; inviteUrl?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Harap masuk terlebih dahulu.');

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brand_id: brandId, email, role }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal mengirim undangan.');
        return json;
      }
    } catch {
      // Fallback ke Supabase client
    }

    // Fallback client-side Supabase
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: inviteErr } = await supabase.from('brand_invitations').insert({
      brand_id: brandId,
      email,
      role: role || 'editor',
      token,
      status: 'pending',
      expires_at: expiresAt,
      invited_by: session.user.id,
    });

    if (inviteErr) {
      throw new Error(inviteErr.message || 'Gagal menyimpan undangan.');
    }

    const inviteUrl = `${window.location.origin}/?invite_token=${token}`;
    return {
      success: true,
      message: `Undangan untuk ${email} berhasil dibuat!`,
      token,
      inviteUrl,
    };
  },

  async getPendingInvitations(brandId: string): Promise<BrandInvitation[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !brandId) return [];

    try {
      const res = await fetch(`/api/team/invitations?brand_id=${brandId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback ke Supabase client
    }

    const { data, error } = await supabase
      .from('brand_invitations')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as BrandInvitation[];
  },

  async cancelInvitation(brandId: string, inviteId: string): Promise<{ success: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Harap masuk terlebih dahulu.');

    try {
      const res = await fetch(`/api/team/invitations/${inviteId}?brand_id=${brandId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal membatalkan undangan.');
        return json;
      }
    } catch {
      // Fallback ke Supabase client
    }

    const { error } = await supabase
      .from('brand_invitations')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('brand_id', brandId);

    if (error) throw new Error(error.message || 'Gagal membatalkan undangan.');
    return { success: true };
  },

  async getInvitationPreview(token: string): Promise<{
    id?: string;
    brand_id?: string;
    brand_name?: string;
    role?: string;
    email?: string;
    email_masked?: string;
    status?: string;
    is_expired?: boolean;
  } | null> {
    if (!token) return null;
    try {
      const res = await fetch(`/api/team/invitations/preview?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Endpoint backend mungkin tidak aktif di static hosting
    }

    // Fallback baca langsung dari Supabase jika client diinisialisasi
    try {
      const { data, error } = await supabase
        .from('brand_invitations')
        .select('id, brand_id, email, role, status, expires_at, brands:brand_id (id, name)')
        .eq('token', token)
        .maybeSingle();

      if (error || !data) return null;
      const isExpired = new Date(data.expires_at) < new Date();
      return {
        id: data.id,
        brand_id: data.brand_id,
        brand_name: (data.brands as any)?.name || 'Brand',
        role: data.role,
        email: data.email,
        status: isExpired && data.status === 'pending' ? 'expired' : data.status,
        is_expired: isExpired,
      };
    } catch {
      return null;
    }
  },

  async acceptInvitation(token: string): Promise<{ success: boolean; message: string; brand_id: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Harap masuk terlebih dahulu.');

    // 1. Coba panggil server endpoint
    try {
      const res = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Gagal menerima undangan.');
        }
        return json;
      }
    } catch (apiErr: any) {
      if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('404')) {
        throw apiErr;
      }
    }

    // 2. Fallback: Eksekusi langsung ke Supabase (misal saat running di static host seperti Vercel tanpa backend server)
    const { data: invite, error: fetchErr } = await supabase
      .from('brand_invitations')
      .select('id, brand_id, email, role, status, expires_at, brands:brand_id (id, name)')
      .eq('token', token)
      .maybeSingle();

    if (fetchErr || !invite) {
      throw new Error('Undangan tidak ditemukan atau token tidak valid.');
    }

    if (invite.status !== 'pending') {
      throw new Error(`Undangan ini sudah berstatus '${invite.status}'.`);
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabase.from('brand_invitations').update({ status: 'expired' }).eq('id', invite.id);
      throw new Error('Masa berlaku undangan ini telah kedaluwarsa.');
    }

    // Insert ke brand_members
    const { error: memberErr } = await supabase
      .from('brand_members')
      .upsert({
        brand_id: invite.brand_id,
        user_id: session.user.id,
        role: invite.role,
      }, { onConflict: 'brand_id,user_id' });

    if (memberErr) {
      throw new Error(memberErr.message || 'Gagal menambahkan Anda ke dalam tim brand.');
    }

    // Perbarui status undangan jadi accepted
    await supabase
      .from('brand_invitations')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    const brandName = (invite.brands as any)?.name || 'Brand';
    return {
      success: true,
      message: `Selamat! Anda berhasil bergabung ke dalam tim '${brandName}' sebagai ${invite.role}.`,
      brand_id: invite.brand_id,
    };
  },

  async updateMemberRole(brandId: string, userId: string, newRole: 'owner' | 'admin' | 'editor' | 'viewer'): Promise<{ success: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Harap masuk terlebih dahulu.');

    const res = await fetch(`/api/team/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ brand_id: brandId, role: newRole }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengubah role anggota.');
    return json;
  },

  async removeMember(brandId: string, userId: string): Promise<{ success: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Harap masuk terlebih dahulu.');

    const res = await fetch(`/api/team/members/${userId}?brand_id=${brandId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menghapus anggota.');
    return json;
  },
};
