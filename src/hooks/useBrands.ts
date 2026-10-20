import { useState, useEffect, useCallback, useMemo } from 'react';
import { Brand, BrandMemberRole } from '../types/database.ts';
import { brandsService, CreateBrandInput } from '../services/database/brandsService.ts';

const ACTIVE_BRAND_KEY = 'zaflow_active_brand_id';
const LEGACY_BRAND_KEY = 'narasosial_active_brand_id';

export function useBrands(userId: string | undefined) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rolesByBrand, setRolesByBrand] = useState<Record<string, BrandMemberRole>>({});
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_BRAND_KEY) || localStorage.getItem(LEGACY_BRAND_KEY);
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    if (!userId) {
      setBrands([]);
      setRolesByBrand({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const listWithRoles = await brandsService.getUserBrandsWithRoles();
      const list = listWithRoles.map((item) => item.brand);
      setBrands(list);
      setRolesByBrand(
        listWithRoles.reduce<Record<string, BrandMemberRole>>((acc, item) => {
          acc[item.brand.id] = item.role;
          return acc;
        }, {})
      );

      // Pastikan ada brand aktif yang valid
      if (list.length > 0) {
        const savedId = localStorage.getItem(ACTIVE_BRAND_KEY);
        const exists = list.some((b) => b.id === savedId);
        if (exists && savedId) {
          setActiveBrandIdState(savedId);
        } else {
          setActiveBrandIdState(list[0].id);
          localStorage.setItem(ACTIVE_BRAND_KEY, list[0].id);
        }
      } else {
        setRolesByBrand({});
        setActiveBrandIdState(null);
        localStorage.removeItem(ACTIVE_BRAND_KEY);
      }
    } catch (err: unknown) {
      console.error('Gagal memuat brands:', err);
      const msg = err instanceof Error ? err.message : (err as any)?.message || 'Gagal memuat brand';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const setActiveBrandId = useCallback((id: string) => {
    setActiveBrandIdState(id);
    localStorage.setItem(ACTIVE_BRAND_KEY, id);
  }, []);

  const activeBrand = useMemo(() => {
    if (!activeBrandId) return brands[0] || null;
    return brands.find((b) => b.id === activeBrandId) || brands[0] || null;
  }, [brands, activeBrandId]);

  const activeRole = useMemo<BrandMemberRole | null>(() => {
    if (!activeBrand) return null;
    return rolesByBrand[activeBrand.id] || null;
  }, [activeBrand, rolesByBrand]);

  const createBrand = useCallback(async (input: CreateBrandInput) => {
    try {
      setError(null);
      const created = await brandsService.createBrand(input);
      await fetchBrands();
      setActiveBrandId(created.id);
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || 'Gagal membuat brand baru';
      setError(msg);
      throw new Error(msg);
    }
  }, [fetchBrands, setActiveBrandId]);

  return {
    brands,
    activeBrand,
    activeBrandId,
    activeRole,
    rolesByBrand,
    setActiveBrandId,
    createBrand,
    loading,
    error,
    refreshBrands: fetchBrands,
  };
}
