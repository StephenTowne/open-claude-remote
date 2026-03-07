/**
 * Daemon 启动器
 *
 * 使用 fork() 启动 daemon-entry.ts 作为独立子进程。
 * 等待 IPC "ready" 消息确认启动成功，然后 unref 子进程让 CLI 可以独立退出。
 */
import { fork } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliOverrides } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** daemon 启动超时（毫秒） */
const DAEMON_READY_TIMEOUT_MS = 15_000;

export interface DaemonLaunchResult {
  pid: number;
}

/**
 * Fork 一个 daemon 子进程并等待其就绪
 *
 * @param overrides CLI 覆盖参数（传给 daemon 的 startServer）
 * @returns daemon 进程的 PID
 * @throws 启动超时或 daemon 报错
 */
export async function launchDaemon(overrides: Omit<CliOverrides, 'daemonMode'> = {}): Promise<DaemonLaunchResult> {
  const entryPath = resolve(__dirname, 'daemon-entry.js');

  // 判断是否运行在 tsx/ts-node 下（开发模式），使用 .ts 后缀
  const isDevMode = process.execArgv.some(
    arg => arg.includes('tsx') || arg.includes('ts-node') || arg.includes('loader')
  );
  const actualEntry = isDevMode
    ? resolve(__dirname, 'daemon-entry.ts')
    : entryPath;

  const child = fork(actualEntry, [], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: {
      ...process.env,
      DAEMON_OVERRIDES: JSON.stringify(overrides),
      CLI_MODE: undefined, // daemon 不是 CLI 模式
    },
  });

  return new Promise<DaemonLaunchResult>((promiseResolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Daemon failed to start within ${DAEMON_READY_TIMEOUT_MS / 1000}s`));
    }, DAEMON_READY_TIMEOUT_MS);

    child.on('message', (msg: any) => {
      clearTimeout(timeout);
      if (msg.type === 'ready') {
        // Daemon 启动成功，解除引用让 CLI 可以退出
        child.unref();
        promiseResolve({ pid: msg.pid });
      } else if (msg.type === 'error') {
        reject(new Error(`Daemon startup failed: ${msg.message}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to fork daemon: ${err.message}`));
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Daemon exited unexpectedly with code ${code}`));
    });
  });
}
