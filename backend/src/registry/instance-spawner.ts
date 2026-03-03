import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger/logger.js';

export interface SpawnOptions {
  /** 工作目录 */
  cwd: string;
  /** 实例名称 */
  name?: string;
  /** Claude 额外参数 */
  claudeArgs?: string[];
  /** 是否为 headless 模式（无终端） */
  headless?: boolean;
  /** 指定端口（可选，默认自动分配） */
  port?: number;
}

export interface SpawnResult {
  /** 进程 PID */
  pid: number;
  /** 工作目录 */
  cwd: string;
  /** 实例名称 */
  name: string;
}

/**
 * 实例创建服务。
 * 通过 spawn 子进程启动新的 claude-remote 实例。
 */
export class InstanceSpawner {
  private readonly entryScript: string;

  constructor() {
    // 获取当前模块所在目录
    const currentDir = dirname(fileURLToPath(import.meta.url));

    // 入口脚本路径：优先检查 dist/（生产模式），回退到 src/../dist（开发模式）
    // 开发模式下 tsx 直接运行 src/，import.meta.url 指向 src/registry/
    // 生产模式下 node 运行 dist/，import.meta.url 指向 dist/registry/
    const distEntryScript = resolve(currentDir, '../cli.js');
    const devEntryScript = resolve(currentDir, '../../dist/cli.js');

    if (existsSync(distEntryScript)) {
      this.entryScript = distEntryScript;
    } else if (existsSync(devEntryScript)) {
      this.entryScript = devEntryScript;
    } else {
      throw new Error(`Entry script not found. Tried: ${distEntryScript}, ${devEntryScript}`);
    }
  }

  /**
   * 创建新实例。
   */
  async spawn(options: SpawnOptions): Promise<SpawnResult> {
    const {
      cwd,
      name,
      claudeArgs = [],
      headless = true,
      port,
    } = options;

    logger.info({
      cwd,
      name,
      headless,
      port,
    }, 'InstanceSpawner: spawning new instance');

    // 构建子进程参数
    const args: string[] = [];

    // 禁用 CLI 模式输出，改用环境变量控制
    // headless 模式下传递 --no-terminal 标志
    if (headless) {
      args.push('--no-terminal');
    }

    if (name) {
      args.push('--name', name);
    }

    if (port) {
      args.push('--port', String(port));
    }

    // 添加 Claude 参数分隔符
    if (claudeArgs.length > 0) {
      args.push('--', ...claudeArgs);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [this.entryScript, ...args], {
        cwd,
        detached: true,  // 与父进程解绑，允许父进程退出后继续运行
        stdio: 'ignore', // headless 模式忽略 stdio
        // 继承父进程的环境变量，并添加自定义变量
        env: {
          ...process.env,
          // 设置 headless 标志供 index.ts 使用
          NO_TERMINAL: headless ? 'true' : 'false',
        },
      });

      const childPid = child.pid;

      child.on('error', (err) => {
        logger.error({ err, cwd, name }, 'InstanceSpawner: failed to spawn');
        reject(err);
      });

      // 子进程启动后立即 unref，让父进程可以独立退出
      child.unref();

      // 给子进程一点启动时间，然后检查是否存活
      setTimeout(() => {
        try {
          process.kill(childPid!, 0); // 检查进程是否存在
          logger.info({
            pid: childPid,
            cwd,
            name,
          }, 'InstanceSpawner: instance spawned successfully');

          resolve({
            pid: childPid!,
            cwd,
            name: name ?? cwd.split('/').pop() ?? 'unknown',
          });
        } catch {
          reject(new Error('Spawned process exited immediately'));
        }
      }, 500);
    });
  }
}