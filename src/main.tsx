import { lazy, Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/**
 * Halaman /promo adalah landing page penjualan yang terpisah dari aplikasi.
 * Dimuat lewat dynamic import agar bundle Workspace (yang besar) tidak ikut
 * diunduh pengunjung iklan di HP.
 */
const isPromoPage =
  typeof window !== 'undefined' &&
  window.location.pathname.replace(/\/+$/, '') === '/promo';

async function loadRoot(): Promise<{ default: ComponentType }> {
  if (isPromoPage) {
    const { LandingPage } = await import('./components/landing/LandingPage.tsx');
    return { default: LandingPage };
  }
  const { default: App } = await import('./App.tsx');
  return { default: App };
}

const Root = lazy(loadRoot);

createRoot(document.getElementById('root')!).render(
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm font-semibold text-slate-500">Memuat ZaFlow...</p>
      </div>
    }
  >
    <Root />
  </Suspense>
);
