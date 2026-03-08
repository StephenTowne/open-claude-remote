/**
 * Daemon 进程级错误守卫
 *
 * 捕获 uncaughtException / unhandledRejection / 异常退出，
 * 同步写入 crash.log（JSON Lines），用于诊断 daemon 静默崩溃。
 *
 * 必须在所有业务代码加载之前调用 installDaemonGuard()。
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const logDir = process.env.LOG_DIR ?? resolve(homedir(), '.claude-remote', 'logs');
const crashLogPath = resolve(logDir, 'crash.log');

let installed = false;
let gracefulShutdown = false;
let fatalHandled = false;

/**
 * 标记正在进行优雅关闭，防止 exit handler 误报为异常退出
 */
export function markGracefulShutdown(): void {
  gracefulShutdown = true;
}

function writeCrashEntry(entry: Record<string, unknown>): void {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // ignore — 目录可能已存在或无写权限
  }
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
    ...entry,
  }) + '\n';
  appendFileSync(crashLogPath, line);
}

function serializeError(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, name: err.name };
  }
  return { message: String(err) };
}

/**
 * 安装进程级错误守卫。幂等 — 重复调用不会重复注册。
 */
export function installDaemonGuard(): void {
  if (installed) return;
  installed = true;

  process.on('uncaughtException', (err: Error) => {
    if (fatalHandled) return;
    fatalHandled = true;
    writeCrashEntry({ event: 'uncaughtException', error: serializeError(err) });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    if (fatalHandled) return;
    fatalHandled = true;
    writeCrashEntry({ event: 'unhandledRejection', error: serializeError(reason) });
    process.exit(1);
  });

  process.on('exit', (code: number) => {
    if (gracefulShutdown || fatalHandled || code === 0) return;
    writeCrashEntry({ event: 'unexpectedExit', exitCode: code });
  });

  process.on('SIGHUP', () => {
    if (fatalHandled) return;
    fatalHandled = true;
    writeCrashEntry({ event: 'SIGHUP' });
    process.exit(1);
  });
}
