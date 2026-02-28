import { useState, useCallback } from 'react';
import { authenticate } from '../services/api-client.js';
import { useAppStore } from '../stores/app-store.js';
import { saveToken, clearToken } from '../services/token-storage.js';

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
        saveToken(token);
      } else {
        setError('Invalid token');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }, [setAuthenticated, setCachedToken]);

  const logout = useCallback(() => {
    setAuthenticated(false);
    setCachedToken(null);
    clearToken();
  }, [setAuthenticated, setCachedToken]);

  return { login, logout, error, loading };
}
