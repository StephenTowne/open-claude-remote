import type { InstanceListItem } from '@claude-remote/shared';

/**
 * 获取实例列表（从当前实例的 API）。
 */
export async function fetchInstances(): Promise<InstanceListItem[]> {
  const res = await fetch('/api/instances', {
    credentials: 'include',
  });
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
