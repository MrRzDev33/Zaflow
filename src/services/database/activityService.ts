import { supabase, isConfigured } from '../../config/supabase.ts';
import { ActivityLog } from '../../types/database.ts';

interface ActivityPageOptions {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
}

interface ActivityPageResult {
  items: ActivityLog[];
  total: number;
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%,()]/g, ' ').trim();
}

export const activityService = {
  /**
   * Mengambil riwayat log aktivitas dengan pagination server-side.
   */
  async getActivities(brandId: string, options: ActivityPageOptions): Promise<ActivityPageResult> {
    if (!isConfigured || !brandId) return { items: [], total: 0 };

    const page = Math.max(1, options.page);
    const pageSize = Math.max(1, options.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = sanitizeSearch(options.search || '');

    const applyFilters = (query: any) => {
      let next = query.eq('brand_id', brandId);
      if (options.action && options.action !== 'all') {
        next = next.eq('action', options.action);
      }
      if (search) {
        next = next.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
      }
      return next;
    };

    const { data, error, count } = await applyFilters(
      supabase
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
        `, { count: 'exact' })
    )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error || !data) {
      const fallback = await applyFilters(
        supabase
          .from('activity_logs')
          .select('*', { count: 'exact' })
      )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fallback.error) {
        console.warn('Gagal memuat log aktivitas:', fallback.error.message);
        return { items: [], total: 0 };
      }
      return {
        items: (fallback.data || []) as ActivityLog[],
        total: fallback.count || 0,
      };
    }

    return {
      items: data as unknown as ActivityLog[],
      total: count || 0,
    };
  },

  /**
   * Daftar nama tindakan untuk pilihan filter.
   */
  async getActionOptions(brandId: string): Promise<string[]> {
    if (!isConfigured || !brandId) return [];
    const { data, error } = await supabase
      .from('activity_logs')
      .select('action')
      .eq('brand_id', brandId)
      .order('action', { ascending: true })
      .limit(1000);

    if (error || !data) return [];
    return Array.from(new Set(data.map((row: { action: string }) => row.action).filter(Boolean)));
  },

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
