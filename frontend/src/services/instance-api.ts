import type { InstanceListItem } from '@claude-remote/shared';
import { authenticate } from './api-client.js';
import { loadToken } from './token-storage.js';

/**
 * 获取实例列表（从当前实例的 API）。
 * 如果收到 401 且有 cachedToken，尝试自动重新认证后重试一次。
 */
export async function fetchInstances(): Promise<InstanceListItem[]> {
  const res = await fetch('/api/instances', {
    credentials: 'include',
  });

  // Auto-reconnect on 401 if we have a cached token
  if (res.status === 401) {
    const cachedToken = loadToken();
    console.log('[fetchInstances] got 401, cachedToken =', cachedToken ? 'exists' : 'null');
    if (cachedToken) {
      try {
        console.log('[fetchInstances] attempting re-authentication...');
        const ok = await authenticate(cachedToken);
        console.log('[fetchInstances] re-auth result:', ok);
        if (ok) {
          // Retry the request after successful re-auth
          const retryRes = await fetch('/api/instances', {
            credentials: 'include',
          });
          if (retryRes.ok) {
            console.log('[fetchInstances] retry succeeded');
            return retryRes.json();
          }
        }
      } catch (err) {
        console.log('[fetchInstances] re-auth error:', err);
      }
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch instances: ${res.status}`);
  }
  return res.json();
}

/**
 * 构建目标实例的 base URL。
 */
export function buildInstanceBaseUrl(host: string, port: number): string {
  const protocol = window.location.protocol;
  return `${protocol}//${host}:${port}`;
}

/**
 * 构建目标实例的 WebSocket URL。
 */
export function buildInstanceWsUrl(host: string, port: number): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}:${port}/ws`;
}

/**
 * 对目标实例执行认证。
 */
export async function authenticateToInstance(host: string, port: number, token: string): Promise<boolean> {
  const baseUrl = buildInstanceBaseUrl(host, port);
  const res = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  return res.ok;
}
