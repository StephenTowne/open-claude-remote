import { useState, useCallback } from 'react';
import { authenticate } from '../services/api-client.js';
import { useAppStore } from '../stores/app-store.js';

export function useAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setCachedToken = useAppStore((s) => s.setCachedToken);

  const login = useCallback(async (token: string) => {
    setError(null);
    setLoading(true);
    try {
      const ok = await authenticate(token);
      if (ok) {
        setAuthenticated(true);
        setCachedToken(token);
      } else {
        setError('Invalid token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }, [setAuthenticated, setCachedToken]);

  return { login, error, loading };
}
