import { useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { AuthPage } from './pages/AuthPage.js';
import { ConsolePage } from './pages/ConsolePage.js';
import { getStatus } from './services/api-client.js';
import { loadToken, clearToken } from './services/token-storage.js';

export function App() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isCheckingAuth = useAppStore((s) => s.isCheckingAuth);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setCheckingAuth = useAppStore((s) => s.setCheckingAuth);
  const setCachedToken = useAppStore((s) => s.setCachedToken);

  useEffect(() => {
    // Check if existing session cookie is still valid
    getStatus()
      .then(() => {
        // Session is valid, mark as authenticated
        setAuthenticated(true);
        // Restore cachedToken from sessionStorage for cross-instance auth
        const storedToken = loadToken();
        if (storedToken) {
          setCachedToken(storedToken);
        }
      })
      .catch(() => {
        // Session invalid or expired, show login page
        setCheckingAuth(false);
        // Clear stale token from sessionStorage
        clearToken();
        setCachedToken(null);
      });
  }, [setAuthenticated, setCheckingAuth, setCachedToken]);

  // Show loading while checking auth status
  if (isCheckingAuth) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <ConsolePage />;
}
