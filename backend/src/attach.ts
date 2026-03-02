/**
 * claude-remote attach 命令实现
 *
 * 用法：
 *   claude-remote attach <port|name>
 *
 * 连接到指定的实例，接管其终端输入输出。
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { CLAUDE_REMOTE_DIR, REGISTRY_FILENAME } from '@claude-remote/shared';
import type { InstanceInfo } from '@claude-remote/shared';
import { existsSync, readFileSync } from 'node:fs';
import { VirtualPtyManager } from './pty/virtual-pty.js';
import { TerminalRelay } from './terminal/terminal-relay.js';
import { getOrCreateSharedToken } from './registry/shared-token.js';
import { logger } from './logger/logger.js';

export interface AttachOptions {
  /** 目标实例端口或名称 */
  target: string;
}

/**
 * 从注册表获取实例列表。
 */
function loadInstances(baseDir: string): InstanceInfo[] {
  const registryPath = resolve(baseDir, REGISTRY_FILENAME);
  if (!existsSync(registryPath)) {
    return [];
  }
  try {
    const content = readFileSync(registryPath, 'utf-8');
    const data = JSON.parse(content);
    return data.instances ?? [];
  } catch {
    return [];
  }
}

/**
 * 查找目标实例。
 */
function findInstance(target: string, instances: InstanceInfo[]): InstanceInfo | null {
  // 先按端口查找
  const port = parseInt(target, 10);
  if (!isNaN(port)) {
    const byPort = instances.find(inst => inst.port === port);
    if (byPort) return byPort;
  }

  // 再按名称查找
  const byName = instances.find(inst => inst.name === target);
  return byName ?? null;
}

/**
 * 检查进程是否存活
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 执行 attach 命令。
 */
export async function attachInstance(options: AttachOptions): Promise<void> {
  const { target } = options;

  // 获取配置目录
  const sharedConfigDir = resolve(homedir(), CLAUDE_REMOTE_DIR);

  // 加载实例列表
  const instances = loadInstances(sharedConfigDir);

  // 过滤存活实例
  const aliveInstances = instances.filter(inst => isProcessAlive(inst.pid));

  if (aliveInstances.length === 0) {
    console.error('没有发现存活实例');
    process.exit(1);
  }

  // 查找目标实例
  const instance = findInstance(target, aliveInstances);

  if (!instance) {
    console.error(`未找到实例: ${target}`);
    console.error('可用实例:');
    for (const inst of aliveInstances) {
      console.error(`  - ${inst.name} (端口 ${inst.port})`);
    }
    process.exit(1);
  }

  console.log(`正在连接实例: ${instance.name} (端口 ${instance.port})...`);

  // 获取共享 Token
  const { token } = getOrCreateSharedToken(sharedConfigDir);

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

  // 处理连接关闭
  virtualPty.on('exit', (_exitCode: number) => {
    console.log('\n连接已关闭');
    cleanup();
    process.exit(0);
  });

  virtualPty.on('error', (err: Error) => {
    console.error('连接错误:', err.message);
    cleanup();
    process.exit(1);
  });

  // 连接到实例 - 使用 instance.host（回退为 localhost）
  // 注意：instance.host 为 '0.0.0.0' 时表示监听所有接口，客户端应使用 localhost 连接
  const host = instance.host && instance.host !== '0.0.0.0' ? instance.host : 'localhost';
  const wsUrl = `ws://${host}:${instance.port}/ws`;

  try {
    await virtualPty.connect(wsUrl, token);
  } catch (err) {
    console.error('连接失败:', err instanceof Error ? err.message : err);
    cleanup();
    process.exit(1);
  }

  // 同步终端大小
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  virtualPty.resize(cols, rows);

  // 启动 TerminalRelay
  relay.start();

  console.log('已连接。按 Ctrl+C 两次退出。');

  // 等待进程退出
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      console.log('\n正在断开连接...');
      cleanup();
      resolve();
    });

    process.on('SIGTERM', () => {
      cleanup();
      resolve();
    });
  });
}