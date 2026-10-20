import { supabase, isConfigured } from '../../config/supabase.ts';
import { ActivityLog } from '../../types/database.ts';

export const activityService = {
  /**
   * Mengambil riwayat log aktivitas untuk brand aktif
   */
  async getRecentActivities(brandId: string, limit = 50): Promise<ActivityLog[]> {
    if (!isConfigured || !brandId) return [];

    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        id,
        brand_id,
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      const { data: simpleData, error: simpleError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (simpleError) {
        console.warn('Gagal memuat log aktivitas:', simpleError.message);
        return [];
      }
      return (simpleData || []) as ActivityLog[];
    }

    return data as unknown as ActivityLog[];
  },

  /**
   * Mencatat aktivitas baru (dilindungi RLS)
   */
  async logActivity(
    brandId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details: Record<string, unknown> = {}
  ) {
    if (!isConfigured || !brandId) return;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('activity_logs').insert({
      brand_id: brandId,
      user_id: user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details,
    });
  },
};
