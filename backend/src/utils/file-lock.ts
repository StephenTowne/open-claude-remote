import { mkdirSync, rmdirSync, statSync } from 'node:fs';

export interface FileLockOptions {
  /** 最大重试次数 (默认 50) */
  retries?: number;
  /** 重试间隔 ms (默认 50) */
  retryIntervalMs?: number;
  /** 超过此 ms 视为僵尸锁，强制删除 (默认 10000) */
  staleMs?: number;
}

const DEFAULTS: Required<FileLockOptions> = {
  retries: 50,
  retryIntervalMs: 50,
  staleMs: 10_000,
};

/** tryMkdir 返回值：'acquired' 获取成功，'retry' 需重试，'wait' 需等待后重试 */
type TryResult = 'acquired' | 'retry' | 'wait';

/**
 * 尝试一次 mkdir 获取锁。
 * mkdirSync 在 POSIX 上是原子操作：成功即持有锁，EEXIST 则需重试。
 * 返回三种结果：获取成功 / 僵尸锁已清理可立即重试 / 需等待后重试。
 */
function tryOnce(lockPath: string, staleMs: number): TryResult {
  try {
    mkdirSync(lockPath);
    return 'acquired';
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }

  // 检查是否为僵尸锁
  try {
    const stat = statSync(lockPath);
    if (Date.now() - stat.mtimeMs > staleMs) {
      try { rmdirSync(lockPath); } catch { /* 另一个进程可能已清理 */ }
      return 'retry';
    }
  } catch {
    // stat 失败说明锁已被释放，直接重试
    return 'retry';
  }

  return 'wait';
}

/**
 * 释放锁（删除目录）。
 */
function releaseLock(lockPath: string): void {
  try {
    rmdirSync(lockPath);
  } catch {
    // 锁目录可能已被清理（比如被判定为僵尸锁），忽略
  }
}

/**
 * 同步阻塞等待指定毫秒数。
 * 使用 Atomics.wait 实现，依赖 Node.js 的 SharedArrayBuffer 支持。
 */
function blockWait(ms: number): void {
  const buf = new SharedArrayBuffer(4);
  const arr = new Int32Array(buf);
  Atomics.wait(arr, 0, 0, ms);
}

/**
 * 同步文件锁。在 fn 执行期间持有 lockPath 目录锁。
 * fn 无论正常返回还是抛异常，锁都会被释放。
 *
 * 注意：锁竞争时使用 Atomics.wait 阻塞事件循环。
 * 仅适合启动/关闭阶段使用，请求路径上应使用 withFileLockAsync。
 */
export function withFileLock<T>(lockPath: string, fn: () => T, options?: FileLockOptions): T {
  const opts = { ...DEFAULTS, ...options };
  let acquired = false;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const result = tryOnce(lockPath, opts.staleMs);
    if (result === 'acquired') { acquired = true; break; }
    if (result === 'retry') continue;
    // result === 'wait'
    if (attempt >= opts.retries) {
      throw new Error(`Failed to acquire file lock: ${lockPath} after ${opts.retries} retries`);
    }
    blockWait(opts.retryIntervalMs);
  }
  if (!acquired) {
    throw new Error(`Failed to acquire file lock: ${lockPath} after ${opts.retries} retries`);
  }
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * 异步文件锁。在 fn 执行期间持有 lockPath 目录锁。
 * fn 无论 resolve 还是 reject，锁都会被释放。
 * 使用非阻塞 setTimeout 重试，不阻塞事件循环。
 */
export async function withFileLockAsync<T>(
  lockPath: string,
  fn: () => Promise<T>,
  options?: FileLockOptions,
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let acquired = false;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const result = tryOnce(lockPath, opts.staleMs);
    if (result === 'acquired') { acquired = true; break; }
    if (result === 'retry') continue;
    // result === 'wait'
    if (attempt >= opts.retries) {
      throw new Error(`Failed to acquire file lock: ${lockPath} after ${opts.retries} retries`);
    }
    await new Promise<void>(resolve => setTimeout(resolve, opts.retryIntervalMs));
  }
  if (!acquired) {
    throw new Error(`Failed to acquire file lock: ${lockPath} after ${opts.retries} retries`);
  }
  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}
