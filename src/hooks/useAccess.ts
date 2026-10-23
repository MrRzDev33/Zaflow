import { useCallback, useEffect, useState } from 'react';
import { accessService, type AccessStatus } from '../services/access/accessService.ts';

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
      setError(err?.message || 'Status akun belum dapat dimuat.');
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

  return {
    status,
    loading,
    error,
    refresh,
    setStatus,
  };
}
