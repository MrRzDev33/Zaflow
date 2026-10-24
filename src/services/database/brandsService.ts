import { supabase, isConfigured } from '../../config/supabase.ts';
import { Brand, BrandMember, BrandMemberRole } from '../../types/database.ts';

export type BrandSocialAccounts = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  facebook?: string;
};

export interface CreateBrandInput {
  name: string;
  industry?: string;
  description?: string;
  color_hex?: string;
  platforms?: string[];
  social_accounts?: BrandSocialAccounts;
}

export interface UpdateBrandInput {
  name?: string;
  industry?: string;
  description?: string;
  color_hex?: string;
  platforms?: string[];
  social_accounts?: BrandSocialAccounts;
}

export const brandsService = {
  /**
   * Mengambil semua brand yang pengguna menjadi anggotanya
   */
  async getUserBrands(): Promise<Brand[]> {
    const list = await brandsService.getUserBrandsWithRoles();
    return list.map((item) => item.brand);
  },

  /**
   * Mengambil brand beserta role pengguna pada masing-masing brand.
   */
  async getUserBrandsWithRoles(): Promise<Array<{ brand: Brand; role: BrandMemberRole }>> {
    if (!isConfigured) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Query brand yang terhubung melalui brand_members
    const { data, error } = await supabase
      .from('brand_members')
      .select(`
        brand_id,
        role,
        brands (*)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Gagal mengambil daftar brand:', error);
      throw error;
    }

    if (!data) return [];

    const result: Array<{ brand: Brand; role: BrandMemberRole }> = [];
    for (const item of data) {
      if (item.brands) {
        result.push({
          brand: item.brands as unknown as Brand,
          role: item.role as BrandMemberRole,
        });
      }
    }
    return result;
  },

  /**
   * Membuat Brand baru dan mendaftarkan pembuat sebagai 'owner'
   * Menggunakan pola 2-step insert untuk memastikan RLS tidak memblokir row sebelum relasi member terpasang
   */
  async createBrand(input: CreateBrandInput): Promise<Brand> {
    if (!isConfigured) {
      throw new Error('Supabase belum terkonfigurasi.');
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error('Pengguna belum login.');

    const trimmedName = input.name.trim();
    if (!trimmedName) throw new Error('Nama brand tidak boleh kosong.');

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || `brand-${Date.now()}`;

    const brandId = crypto.randomUUID();

    // 1. Insert ke tabel brands tanpa .select()
    // Ini memastikan INSERT policy terpenuhi tanpa terhalang SELECT policy sebelum membership terbuat
    const brandPayload: Record<string, unknown> = {
      id: brandId,
      name: trimmedName,
      slug,
      industry: input.industry || 'Lainnya',
      description: input.description?.trim() || null,
      color_hex: input.color_hex || '#2563EB',
      platforms: input.platforms && input.platforms.length > 0 ? input.platforms : ['instagram'],
      social_accounts: input.social_accounts || {},
      created_by: user.id,
    };

    let { error: brandError } = await supabase
      .from('brands')
      .insert(brandPayload);

    // Tetap bisa membuat brand jika migrasi kolom platforms belum dijalankan.
    if (brandError && /platforms/i.test(brandError.message)) {
      delete brandPayload.platforms;
      const retry = await supabase.from('brands').insert(brandPayload);
      brandError = retry.error;
    }

    if (brandError) {
      console.error('Gagal membuat brand di tabel brands:', brandError);
      throw new Error(brandError.message || 'Gagal menyimpan data brand.');
    }

    // 2. Daftarkan pembuat ke brand_members sebagai 'owner'
    const { error: memberError } = await supabase
      .from('brand_members')
      .insert({
        brand_id: brandId,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Gagal mendaftarkan owner brand:', memberError);
      // Pemulihan otomatis: bersihkan brand yang baru dibuat agar tidak meninggalkan record yatim
      try {
        await supabase.from('brands').delete().eq('id', brandId);
      } catch (cleanupErr) {
        console.warn('Gagal menghapus brand yatim pasca error membership:', cleanupErr);
      }
      throw new Error(memberError.message || 'Gagal mengatur hak akses brand.');
    }

    // 3. Ambil data brand lengkap setelah status member aktif
    const { data: brandData, error: fetchError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .maybeSingle();

    if (fetchError || !brandData) {
      return {
        id: brandId,
        name: trimmedName,
        slug,
        industry: input.industry || 'Lainnya',
        description: input.description?.trim() || null,
        color_hex: input.color_hex || '#2563EB',
        platforms: input.platforms && input.platforms.length > 0 ? input.platforms : ['instagram'],
        social_accounts: input.social_accounts || {},
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return brandData as Brand;
  },

  /**
   * Memperbarui informasi brand (hanya owner atau admin)
   */
  async updateBrand(brandId: string, input: UpdateBrandInput): Promise<Brand> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Nama brand tidak boleh kosong.');
      payload.name = name;
      payload.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (input.industry !== undefined) payload.industry = input.industry;
    if (input.description !== undefined) payload.description = input.description.trim() || null;
    if (input.color_hex !== undefined) payload.color_hex = input.color_hex;
    if (input.platforms !== undefined) {
      if (input.platforms.length === 0) {
        throw new Error('Pilih minimal satu platform untuk brand ini.');
      }
      payload.platforms = input.platforms;
    }
    if (input.social_accounts !== undefined) payload.social_accounts = input.social_accounts;

    let { data, error } = await supabase
      .from('brands')
      .update(payload)
      .eq('id', brandId)
      .select()
      .single();

    // Tetap bisa menyimpan pengaturan lain jika migrasi kolom platforms
    // belum dijalankan. Platform akan diturunkan dari akun sosial yang terisi.
    if (error && /platforms/i.test(error.message)) {
      delete payload.platforms;
      const retry = await supabase
        .from('brands')
        .update(payload)
        .eq('id', brandId)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Gagal memperbarui brand:', error);
      throw new Error(error.message || 'Gagal memperbarui brand.');
    }

    return data as Brand;
  },

  /**
   * Menghapus brand (hanya owner)
   */
  async deleteBrand(brandId: string): Promise<void> {
    if (!isConfigured) throw new Error('Supabase belum terkonfigurasi.');

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (error) {
      console.error('Gagal menghapus brand:', error);
      throw new Error(error.message || 'Gagal menghapus brand.');
    }
  },

  /**
   * Mengambil role pengguna aktif di brand tertentu
   */
  async getUserRole(brandId: string): Promise<BrandMemberRole | null> {
    if (!isConfigured || !brandId) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('brand_members')
      .select('role')
      .eq('brand_id', brandId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data.role as BrandMemberRole;
  },

  /**
   * Mengambil anggota tim untuk suatu brand
   */
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
        profiles (
          id,
          full_name,
          avatar_url,
          system_role
        )
      `)
      .eq('brand_id', brandId);

    if (error) throw error;
    return (data || []) as unknown as BrandMember[];
  },
};
