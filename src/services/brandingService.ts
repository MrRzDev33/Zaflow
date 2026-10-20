/**
 * Service untuk mengelola branding aplikasi ZaFlow (nama & logo)
 * Mendukung penyimpanan lokal, sinkronisasi antar-tab/komponen secara real-time,
 * serta upload file gambar langsung (Base64) maupun input URL gambar eksternal.
 */

export interface AppBranding {
  appName: string;
  logoUrl: string | null; // URL gambar atau Data URL Base64
  updatedAt: string;
}

const STORAGE_KEY = 'zaflow_app_branding_v1';
const EVENT_NAME = 'zaflow:branding-changed';

export const DEFAULT_BRANDING: AppBranding = {
  appName: 'ZaFlow',
  logoUrl: null, // null berarti memakai SVG logo bawaan ZaFlow
  updatedAt: new Date().toISOString(),
};

export const brandingService = {
  getBranding(): AppBranding {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_BRANDING;
      const parsed = JSON.parse(raw);
      return {
        appName: parsed.appName || 'ZaFlow',
        logoUrl: parsed.logoUrl || null,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    } catch {
      return DEFAULT_BRANDING;
    }
  },

  setBranding(updates: Partial<AppBranding>): AppBranding {
    const current = this.getBranding();
    const updated: AppBranding = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Gagal menyimpan branding ke localStorage:', err);
    }

    // Broadcast ke tab dan komponen lain
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
    }

    return updated;
  },

  setLogoUrl(url: string | null): AppBranding {
    return this.setBranding({ logoUrl: url ? url.trim() : null });
  },

  resetLogo(): AppBranding {
    return this.setBranding({ logoUrl: null, appName: 'ZaFlow' });
  },

  /**
   * Mengonversi file gambar ke Base64 Data URL untuk disimpan langsung
   */
  async uploadLogoFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Berkas harus berupa file gambar (PNG, JPG, SVG, WebP).'));
        return;
      }

      // Batasi ukuran maksimal 3MB agar muat di localStorage dengan aman
      if (file.size > 3 * 1024 * 1024) {
        reject(new Error('Ukuran gambar maksimal 3 MB. Harap gunakan gambar yang lebih kecil atau gunakan opsi URL.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.setLogoUrl(dataUrl);
        resolve(dataUrl);
      };
      reader.onerror = () => {
        reject(new Error('Gagal membaca berkas gambar.'));
      };
      reader.readAsDataURL(file);
    });
  },

  subscribe(callback: (branding: AppBranding) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<AppBranding>;
      callback(custom.detail || this.getBranding());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        callback(this.getBranding());
      }
    };

    window.addEventListener(EVENT_NAME, handleCustom);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  },
};
