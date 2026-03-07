import { DEFAULT_PORT } from '#shared';
import type { InstanceInfo } from '#shared';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { getOrCreateSharedToken } from '../registry/shared-token.js';

const DAEMON_BASE_URL = `http://localhost:${DEFAULT_PORT}`;

/** Cookie 缓存，避免重复认证 */
let cachedCookie: string | null = null;
let cookieExpiry: number = 0;
const COOKIE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Daemon 状态信息
 */
export interface DaemonStatus {
  status: 'ok';
  version: string;
  pid: number;
  port: number;
  startedAt: string | null;
  uptime: number | null;
  instanceCount: number;
}

/**
 * 检查 daemon 是否正在运行
 */
export async function isDaemonRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 获取 daemon 状态信息
 */
export async function getDaemonStatus(): Promise<DaemonStatus> {
  const res = await fetch(`${DAEMON_BASE_URL}/api/health`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) {
    throw new Error(`Failed to get daemon status: ${res.status}`);
  }
  return res.json();
}

/**
 * 向 daemon 发送停止请求（localhost only，无需认证）
 */
export async function stopDaemon(): Promise<void> {
  const running = await isDaemonRunning();
  if (!running) {
    process.stderr.write('No running daemon found.\n');
    process.exit(1);
  }

  try {
    const res = await fetch(`${DAEMON_BASE_URL}/api/shutdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      process.stderr.write('Daemon stopped.\n');
      // 清除缓存的 cookie
      cachedCookie = null;
    } else {
      process.stderr.write(`Failed to stop daemon: ${res.status}\n`);
      process.exit(1);
    }
  } catch {
    // Connection refused or reset means daemon is already stopping
    process.stderr.write('Daemon stopped.\n');
    cachedCookie = null;
  }
}

/**
 * 获取认证 cookie（带缓存）
 */
async function getAuthCookie(): Promise<string> {
  // 检查缓存是否有效
  if (cachedCookie && Date.now() < cookieExpiry) {
    return cachedCookie;
  }

  const sharedConfigDir = resolve(homedir(), '.claude-remote');
  const { token } = getOrCreateSharedToken(sharedConfigDir);

  const res = await fetch(`${DAEMON_BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status}`);
  }

  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received');
  }

  const cookie = setCookie.split(';')[0];
  cachedCookie = cookie;
  cookieExpiry = Date.now() + COOKIE_TTL_MS;

  return cookie;
}

/**
 * 获取 daemon 的共享 token
 */
export function getSharedToken(): string {
  const sharedConfigDir = resolve(homedir(), '.claude-remote');
  const { token } = getOrCreateSharedToken(sharedConfigDir);
  return token;
}

/**
 * 通过 daemon API 创建新实例
 */
export async function createInstance(options: {
  cwd: string;
  name?: string;
  claudeArgs?: string[];
  headless?: boolean;
}): Promise<{ instanceId: string; name: string }> {
  const cookie = await getAuthCookie();

  const res = await fetch(`${DAEMON_BASE_URL}/api/instances/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({
      cwd: options.cwd,
      name: options.name,
      claudeArgs: options.claudeArgs,
      headless: options.headless,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create instance: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    instanceId: data.instance.instanceId,
    name: data.instance.name,
  };
}

/**
 * 获取运行中的实例列表
 */
export async function listInstances(): Promise<InstanceInfo[]> {
  const cookie = await getAuthCookie();

  const res = await fetch(`${DAEMON_BASE_URL}/api/instances`, {
    headers: { 'Cookie': cookie },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Failed to list instances: ${res.status}`);
  }

  return res.json();
}
