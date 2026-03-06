import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRY_FILENAME } from '#shared';
import type { InstanceInfo, InstanceRegistry } from '#shared';
import { logger } from '../logger/logger.js';
import { withFileLock, withFileLockAsync } from '../utils/file-lock.js';

/**
 * 检查进程是否存活。
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
 * 实例注册表管理器。
 * 操作 ~/.claude-remote/instances.json 实现多实例发现。
 * 所有公共方法通过 mkdir-based 文件锁保护 read-modify-write 操作。
 */
export class InstanceRegistryManager {
  private readonly registryPath: string;
  private readonly lockPath: string;
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.registryPath = join(baseDir, REGISTRY_FILENAME);
    this.lockPath = this.registryPath + '.lock';
  }

  /**
   * 注册实例信息（如已存在同 ID 则替换）。
   */
  register(info: InstanceInfo): void {
    withFileLock(this.lockPath, () => {
      const data = this.readRegistry();
      data.instances = data.instances.filter(i => i.instanceId !== info.instanceId);
      data.instances.push(info);
      this.writeRegistry(data);
      logger.info({ instanceId: info.instanceId, name: info.name, port: info.port }, 'Instance registered');
    });
  }

  /**
   * 注销实例。
   */
  unregister(instanceId: string): void {
    withFileLock(this.lockPath, () => {
      const data = this.readRegistry();
      const before = data.instances.length;
      data.instances = data.instances.filter(i => i.instanceId !== instanceId);
      if (data.instances.length < before) {
        this.writeRegistry(data);
        logger.info({ instanceId }, 'Instance unregistered');
      }
    });
  }

  /**
   * 列出所有存活实例，自动清理僵尸进程。
   * 使用异步文件锁，避免在 API 请求路径上阻塞事件循环。
   */
  async list(): Promise<InstanceInfo[]> {
    return withFileLockAsync(this.lockPath, async () => {
      const data = this.readRegistry();
      const alive = data.instances.filter(i => isProcessAlive(i.pid));

      if (alive.length < data.instances.length) {
        const removed = data.instances.length - alive.length;
        logger.info({ removed }, 'Cleaned up zombie instances');
        data.instances = alive;
        this.writeRegistry(data);
      }

      return alive;
    });
  }

  /**
   * 更新实例的 host 字段（用于 IP 变化时更新）。
   */
  updateHost(instanceId: string, newHost: string): void {
    withFileLock(this.lockPath, () => {
      const data = this.readRegistry();
      const instance = data.instances.find(i => i.instanceId === instanceId);
      if (instance && instance.host !== newHost) {
        instance.host = newHost;
        this.writeRegistry(data);
        logger.info({ instanceId, newHost }, 'Instance host updated');
      }
    });
  }

  private readRegistry(): InstanceRegistry {
    if (!existsSync(this.registryPath)) {
      return { version: 1, instances: [] };
    }

    try {
      const content = readFileSync(this.registryPath, 'utf-8');
      const data = JSON.parse(content) as InstanceRegistry;
      if (!data.instances || !Array.isArray(data.instances)) {
        return { version: 1, instances: [] };
      }
      return data;
    } catch (err) {
      logger.warn({ err, path: this.registryPath }, 'Failed to read registry, starting fresh');
      return { version: 1, instances: [] };
    }
  }

  private writeRegistry(data: InstanceRegistry): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
    }

    const tmpPath = `${this.registryPath}.tmp.${process.pid}`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmpPath, this.registryPath);
  }
}
