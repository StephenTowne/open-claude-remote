/**
 * Daemon 子进程入口点
 *
 * 由 daemon-launcher.ts 通过 fork() 启动。
 * 以 daemonMode 运行 startServer（不创建 firstSession，不接管 stdin/stdout）。
 * 启动成功后通过 IPC 通知父进程，然后断开 IPC。
 */

import { installDaemonGuard } from './daemon-guard.js';
installDaemonGuard();

// Daemon 不需要 CLI 模式的 logger 配置
delete process.env.CLI_MODE;
// 标记为无终端模式
process.env.NO_TERMINAL = 'true';

void (async () => {
  try {
    // 从环境变量读取 CLI overrides
    const overridesJson = process.env.DAEMON_OVERRIDES;
    const overrides = overridesJson ? JSON.parse(overridesJson) : {};

    // 强制 daemon 模式
    overrides.daemonMode = true;

    const { startServer } = await import('../index.js');
    await startServer(overrides);

    // 服务启动成功，通知父进程
    if (process.send) {
      process.send({ type: 'ready', pid: process.pid });
      // 断开 IPC 通道，让父进程可以独立退出
      process.disconnect();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.send) {
      process.send({ type: 'error', message });
    }
    process.exit(1);
  }
})();
