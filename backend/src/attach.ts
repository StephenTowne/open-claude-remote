/**
 * claude-remote attach 命令实现
 *
 * 用法：
 *   claude-remote attach <name|id>
 *
 * 通过 daemon API 查找实例，然后 WS attach 到对应实例。
 */
import { DEFAULT_PORT } from '#shared';
import { VirtualPtyManager } from './pty/virtual-pty.js';
import { TerminalRelay } from './terminal/terminal-relay.js';
import { listInstances, getSharedToken } from './daemon/daemon-client.js';
import { logger } from './logger/logger.js';

export interface AttachOptions {
  /** 目标实例名称或 ID */
  target: string;
}

/**
 * 执行 attach 命令。
 */
export async function attachInstance(options: AttachOptions): Promise<void> {
  const { target } = options;

  // 获取运行中的实例列表
  let instances: Array<{ instanceId: string; name: string; cwd: string }>;
  try {
    instances = await listInstances();
  } catch (err) {
    console.error('Failed to connect to daemon. Is it running?');
    console.error('  Start it with: claude-remote');
    process.exit(1);
  }

  if (instances.length === 0) {
    console.error('No running instances found');
    process.exit(1);
  }

  // 查找目标实例：按名称或 ID 匹配
  const instance = instances.find(
    inst => inst.name === target || inst.instanceId === target || inst.instanceId.startsWith(target),
  );

  if (!instance) {
    console.error(`Instance not found: ${target}`);
    console.error('Available instances:');
    for (const inst of instances) {
      console.error(`  - ${inst.name} (${inst.instanceId.substring(0, 8)})`);
    }
    process.exit(1);
  }

  console.log(`Connecting to instance: ${instance.name}...`);

  // 获取共享 Token 用于 WS 认证
  const token = getSharedToken();

  // 创建 VirtualPtyManager
  const virtualPty = new VirtualPtyManager();

  // 创建 TerminalRelay
  const relay = new TerminalRelay(virtualPty);

  // 幂等退出保护
  let stopping = false;

  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    virtualPty.destroy();
    relay.stop();
  };

  // 处理 PTY 输出 → stdout
  virtualPty.on('data', (data: string) => {
    process.stdout.write(data);
  });

  // 处理服务端 resize 通知
  virtualPty.on('server_resize', () => {
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    virtualPty.resize(cols, rows);
  });

  // 处理连接关闭
  virtualPty.on('exit', (_exitCode: number) => {
    console.log('\nConnection closed');
    cleanup();
    process.exit(0);
  });

  virtualPty.on('error', (err: Error) => {
    console.error('Connection error:', err.message);
    cleanup();
    process.exit(1);
  });

  // 连接到 daemon 的 WS，指定 instanceId
  const wsUrl = `ws://localhost:${DEFAULT_PORT}/ws/${instance.instanceId}`;

  try {
    await virtualPty.connect(wsUrl, token);
  } catch (err) {
    console.error('Connection failed:', err instanceof Error ? err.message : err);
    cleanup();
    process.exit(1);
  }

  // 同步终端大小
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  virtualPty.resize(cols, rows);

  // 启动 TerminalRelay
  relay.start();

  console.log('Connected. Press Ctrl+C twice to exit.');

  // 等待进程退出
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      console.log('\nDisconnecting...');
      cleanup();
      resolve();
    });

    process.on('SIGTERM', () => {
      cleanup();
      resolve();
    });
  });
}
