import { useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { AuthPage } from './pages/AuthPage.js';
import { ConsolePage } from './pages/ConsolePage.js';
import { getStatus, authenticate } from './services/api-client.js';
import { loadToken, clearToken } from './services/token-storage.js';

/**
 * 从 URL 提取 token 参数并清理 URL
 */
function extractUrlToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    // 清理 URL（安全考虑，避免 token 泄露）
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
  }
  return token;
}

export function App() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isCheckingAuth = useAppStore((s) => s.isCheckingAuth);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setCheckingAuth = useAppStore((s) => s.setCheckingAuth);
  const setCachedToken = useAppStore((s) => s.setCachedToken);

  useEffect(() => {
    // 检查 URL 中是否有 token 参数（扫码连接）
    const urlToken = extractUrlToken();

    if (urlToken) {
      // URL token 优先，直接尝试认证
      authenticate(urlToken)
        .then((ok) => {
          if (ok) {
            setAuthenticated(true);
            setCachedToken(urlToken);
          } else {
            // 认证失败，存储预填充 token 供登录页使用
            sessionStorage.setItem('prefill_token', urlToken);
            setCheckingAuth(false);
          }
        })
        .catch(() => {
          // 认证失败，存储预填充 token 供登录页使用
          sessionStorage.setItem('prefill_token', urlToken);
          setCheckingAuth(false);
        });
      return;
    }

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
        Checking session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <ConsolePage />;
}
