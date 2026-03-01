import { useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { AuthPage } from './pages/AuthPage.js';
import { ConsolePage } from './pages/ConsolePage.js';
import { getStatus, authenticate } from './services/api-client.js';
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
      .catch(async () => {
        // Session invalid or expired (e.g., backend restarted)
        // Try to re-authenticate with cached token if available
        const cachedToken = loadToken();
        if (cachedToken) {
          try {
            const ok = await authenticate(cachedToken);
            if (ok) {
              setAuthenticated(true);
              setCachedToken(cachedToken);
              return;
            }
          } catch {
            // Re-authentication failed, fall through to login
          }
        }
        // No cached token or re-authentication failed, show login page
        setCheckingAuth(false);
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
