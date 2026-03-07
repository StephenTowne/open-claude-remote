import type { InstanceListItem } from '#shared';
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
 * 构建实例的 WebSocket URL（同源，按 instanceId 路由）。
 */
export function buildInstanceWsUrl(instanceId: string): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}/ws/${instanceId}`;
}
