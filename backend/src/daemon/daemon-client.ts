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
  const result = await stopDaemonInternal();

  if (!result.stopped) {
    process.stderr.write(`${result.message}\n`);
    process.exit(1);
  }

  process.stderr.write('Daemon stopped.\n');
}

/**
 * 内部停止函数，不退出进程
 */
async function stopDaemonInternal(): Promise<{ stopped: boolean; message: string }> {
  const running = await isDaemonRunning();
  if (!running) {
    return { stopped: false, message: 'No running daemon found.' };
  }

  try {
    const res = await fetch(`${DAEMON_BASE_URL}/api/shutdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
      signal: AbortSignal.timeout(5000),
    });

    // 清除缓存的 cookie
    cachedCookie = null;

    if (res.ok) {
      return { stopped: true, message: 'Daemon stopped.' };
    } else {
      return { stopped: false, message: `Failed to stop daemon: ${res.status}` };
    }
  } catch {
    // Connection refused or reset means daemon is already stopping
    cachedCookie = null;
    return { stopped: true, message: 'Daemon stopped.' };
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

/**
 * 三版本建议类型
 */
export type VersionAdvice =
  | 'up_to_date'         // 全部最新
  | 'restart_daemon'     // 需重启 daemon
  | 'update_available'   // npm 有新版
  | 'update_and_restart'; // 需更新 + 重启

/**
 * 三版本聚合信息
 */
export interface FullVersionInfo {
  daemonVersion: string | null;  // null = daemon 未运行
  cliVersion: string;
  latestVersion: string | null;  // null = 查询失败/跳过
  needsRestart: boolean;
  updateAvailable: boolean;
  advice: VersionAdvice;
}

/**
 * 获取三版本聚合信息（daemon / CLI / npm latest）
 */
export async function getFullVersionInfo(opts?: {
  skipNpmCheck?: boolean;
  npmCheckTimeout?: number;
}): Promise<FullVersionInfo> {
  const { getCurrentVersion, fetchLatestVersion, isNewerVersion } = await import('../update.js');
  const timeout = opts?.npmCheckTimeout ?? 5000;

  // 1. CLI 版本（进程级缓存）
  const cliVersion = getCurrentVersion();

  // 2. Daemon 版本
  let daemonVersion: string | null = null;
  try {
    const status = await getDaemonStatus();
    daemonVersion = status.version;
  } catch {
    // daemon 未运行
  }

  // 3. npm 最新版（可选）
  let latestVersion: string | null = null;
  if (!opts?.skipNpmCheck) {
    try {
      latestVersion = await Promise.race([
        fetchLatestVersion(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('npm check timeout')), timeout)
        ),
      ]);
    } catch {
      // 网络失败或超时，静默忽略
    }
  }

  // 4. 推导状态
  // needsRestart: CLI 版本比 daemon 新（即 daemon 过时），而非简单不等
  const needsRestart = daemonVersion !== null && isNewerVersion(cliVersion, daemonVersion);
  const updateAvailable = latestVersion !== null && isNewerVersion(latestVersion, cliVersion);

  let advice: VersionAdvice;
  if (needsRestart && updateAvailable) {
    advice = 'update_and_restart';
  } else if (needsRestart) {
    advice = 'restart_daemon';
  } else if (updateAvailable) {
    advice = 'update_available';
  } else {
    advice = 'up_to_date';
  }

  return { daemonVersion, cliVersion, latestVersion, needsRestart, updateAvailable, advice };
}

/**
 * 版本检查结果
 */
export interface VersionCheckResult {
  running: boolean;
  daemonVersion: string | null;
  cliVersion: string;
  needsRestart: boolean;
}

/**
 * 检查 daemon 是否需要重启
 * @returns 版本检查结果
 */
export async function checkDaemonVersion(): Promise<VersionCheckResult> {
  const { getCurrentVersion } = await import('../update.js');
  const cliVersion = getCurrentVersion();

  try {
    const status = await getDaemonStatus();
    return {
      running: true,
      daemonVersion: status.version,
      cliVersion,
      needsRestart: status.version !== cliVersion,
    };
  } catch {
    return {
      running: false,
      daemonVersion: null,
      cliVersion,
      needsRestart: false,
    };
  }
}

/**
 * 智能重启 daemon
 * - 无实例时自动重启
 * - 有实例时返回 false，由调用方提示用户
 */
export async function smartRestartDaemon(): Promise<{
  restarted: boolean;
  reason: 'auto' | 'has_instances' | 'not_running' | 'stop_failed';
}> {
  // 1. 检查 daemon 是否运行
  const running = await isDaemonRunning();
  if (!running) {
    return { restarted: false, reason: 'not_running' };
  }

  // 2. 检查是否有运行中的实例
  const instances = await listInstances().catch(() => []);

  if (instances.length > 0) {
    return { restarted: false, reason: 'has_instances' };
  }

  // 3. 无实例，可以安全重启
  const stopResult = await stopDaemonInternal();
  if (!stopResult.stopped) {
    return { restarted: false, reason: 'stop_failed' };
  }

  // 等待进程完全退出
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. 重新启动
  const { launchDaemon } = await import('./daemon-launcher.js');
  await launchDaemon();

  return { restarted: true, reason: 'auto' };
}
