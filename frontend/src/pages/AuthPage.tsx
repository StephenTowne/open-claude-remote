import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';

export function AuthPage() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const { login, error, loading } = useAuth();

  // 从 sessionStorage 读取预填充 token（来自扫码连接）
  useEffect(() => {
    const prefillToken = sessionStorage.getItem('prefill_token');
    if (prefillToken) {
      setToken(prefillToken);
      sessionStorage.removeItem('prefill_token');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      login(token.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && token.trim()) {
      login(token.trim());
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-primary)',
    }}>
      <form onSubmit={handleSubmit} autoComplete="off" style={{
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Claude Code Remote
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Enter the token shown on your PC terminal
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste token here…"
            aria-label="Authentication token"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            style={{
              width: '100%',
              height: 48,
              padding: '0 48px 0 16px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              fontSize: 16,
              lineHeight: '48px',
              boxSizing: 'border-box',
              ['WebkitTextSecurity' as string]: showToken ? 'none' : 'disc',
            }}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            aria-label={showToken ? 'Hide token' : 'Show token'}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showToken ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <div style={{
            color: 'var(--status-error)',
            fontSize: 14,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !token.trim()}
          style={{
            height: 48,
            borderRadius: 8,
            background: token.trim() ? 'var(--status-running)' : 'var(--bg-tertiary)',
            color: token.trim() ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: 16,
            transition: 'background 0.15s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Authenticating…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
