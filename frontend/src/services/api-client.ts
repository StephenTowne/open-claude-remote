import type { UserConfig, SafeUserConfig } from '../config/commands.js';

const API_BASE = '/api';

export async function authenticate(token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (res.status === 429) {
    throw new Error('Too many attempts. Try again later.');
  }

  return res.ok;
}

export async function getStatus(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/status`, {
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  return res.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getUserConfig(): Promise<{ config: SafeUserConfig | null; configPath: string }> {
  const res = await fetch(`${API_BASE}/config`, {
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Config fetch failed: ${res.status}`);
  }

  return res.json();
}

export async function updateUserConfig(config: UserConfig): Promise<boolean> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  return res.ok;
}

/**
 * 更新通知渠道启用状态
 * @param channel 渠道类型 (dingtalk | wechat_work)
 * @param enabled 是否启用
 */
export async function updateNotificationChannelEnabled(
  channel: 'dingtalk' | 'wechat_work',
  enabled: boolean
): Promise<{ success: boolean; channel: string; enabled: boolean }> {
  const res = await fetch(`${API_BASE}/config/notifications/${channel}/enabled`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ enabled }),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to update channel status: ${res.status}`);
  }

  return res.json();
}
