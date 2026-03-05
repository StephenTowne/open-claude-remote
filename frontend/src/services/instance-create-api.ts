import { authenticate } from './api-client.js';
import { loadToken } from './token-storage.js';
import type { SettingsFile } from '../types/index.js';

export interface InstanceConfigResponse {
  workspaces: string[];
  claudeArgs: string[];
  settingsFiles: SettingsFile[];
  settingsDirs: string[];
}

export interface CreateInstanceRequest {
  cwd: string;
  name?: string;
  claudeArgs?: string[];
}

export interface CreateInstanceResponse {
  success: boolean;
  instance: {
    pid: number;
    cwd: string;
    name: string;
  };
}

/**
 * 自动重认证的 fetch helper
 * 如果收到 401 且有 cachedToken，尝试重新认证后重试
 */
async function fetchWithAutoReauth(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);

  if (res.status === 401) {
    const cachedToken = loadToken();
    if (cachedToken) {
      try {
        const ok = await authenticate(cachedToken);
        if (ok) {
          return fetch(url, init);
        }
      } catch {
        // Fall through to return original 401 response
      }
    }
  }

  return res;
}

/**
 * 获取实例创建配置（工作目录列表和默认参数）
 */
export async function getInstanceConfig(): Promise<InstanceConfigResponse> {
  const res = await fetchWithAutoReauth('/api/instances/config', {
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Failed to get instance config: ${res.status}`);
  }
  return res.json();
}

/**
 * 创建新实例
 */
export async function createInstance(request: CreateInstanceRequest): Promise<CreateInstanceResponse> {
  const res = await fetchWithAutoReauth('/api/instances/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Failed to create instance: ${res.status}`);
  }
  return res.json();
}