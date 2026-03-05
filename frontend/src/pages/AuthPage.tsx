import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';

export function AuthPage() {
  const [token, setToken] = useState('');
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

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste token here…"
          aria-label="Authentication token"
          autoComplete="off"
          style={{
            height: 48,
            padding: '0 16px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 16,
          }}
        />

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
