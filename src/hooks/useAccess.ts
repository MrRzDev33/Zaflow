import { useCallback, useEffect, useState } from 'react';
import { accessService, type AccessStatus } from '../services/access/accessService.ts';
import { ApiError } from '../services/http/apiClient.ts';

export function useAccess(userId: string | undefined) {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return null;
    }

    try {
      setError(null);
      const next = await accessService.getStatus();
      setStatus(next);
      return next;
    } catch (err: any) {
      // Jangan pertahankan akses lama jika sesi/akun sudah tidak berlaku.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setStatus(null);
      }
      if (err instanceof ApiError && err.status === 401) {
        setError('Sesi tidak berlaku atau akun sedang tidak aktif. Silakan masuk kembali atau hubungi customer service.');
      } else {
        setError(err?.message || 'Status akun belum dapat dimuat.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [userId, refresh]);

  // Periksa ulang status akun secara berkala dan saat tab kembali aktif,
  // agar akun yang dinonaktifkan tidak terus memakai akses lama.
  useEffect(() => {
    if (!userId) return;

    const interval = window.setInterval(() => {
      refresh();
    }, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, [userId, refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    setStatus,
  };
}
