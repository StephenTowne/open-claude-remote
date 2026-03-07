import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { CLAUDE_REMOTE_DIR, DEFAULT_PORT } from '#shared';
import { InstanceSession, type InstanceSessionOptions } from './instance-session.js';
import type { CreateInstanceOptions, InstanceInfo } from './types.js';
import { createClaudeSettings, extractSettingsFromArgs, saveClaudeSettings, loadWorkdirConfig, mergeConfigs, loadUserConfig } from '../config.js';
import { logger } from '../logger/logger.js';
import type { PushService } from '../push/push-service.js';
import type { NotificationManager } from '../notification/notification-manager.js';
import type { NotificationServiceFactory } from '../notification/notification-service-factory.js';

/**
 * InstanceManager: 管理所有 InstanceSession 的中央协调器
 * 单进程内通过 Map 管理，无需文件注册表
 */
export class InstanceManager extends EventEmitter {
  private instances = new Map<string, InstanceSession>();

  private pushService: PushService | null = null;
  private notificationManager: NotificationManager | null = null;
  private notificationServiceFactory: NotificationServiceFactory | null = null;
  private displayIp: string = '127.0.0.1';

  /**
   * 注入全局共享的通知服务
   */
  setSharedServices(options: {
    pushService?: PushService;
    notificationManager?: NotificationManager;
    notificationServiceFactory?: NotificationServiceFactory;
    displayIp?: string;
  }): void {
    if (options.pushService) this.pushService = options.pushService;
    if (options.notificationManager) this.notificationManager = options.notificationManager;
    if (options.notificationServiceFactory) this.notificationServiceFactory = options.notificationServiceFactory;
    if (options.displayIp) this.displayIp = options.displayIp;
  }

  /**
   * 创建新实例（进程内创建 PTY，不再 spawn 子进程）
   */
  createInstance(options: CreateInstanceOptions): InstanceSession {
    const instanceId = randomUUID();
    const name = options.name || basename(options.cwd);

    // 加载工作路径配置
    const globalConfig = loadUserConfig();
    const workdirConfig = loadWorkdirConfig(options.cwd);
    const mergedConfig = mergeConfigs(globalConfig, workdirConfig);

    const maxBufferLines = options.maxBufferLines ?? mergedConfig.maxBufferLines ?? 10000;
    const claudeCommand = options.claudeCommand ?? mergedConfig.claudeCommand ?? 'claude';

    // 合并 claudeArgs
    const mergedArgs = mergedConfig.claudeArgs ?? [];
    const inputArgs = options.claudeArgs ?? [];
    const finalClaudeArgs = inputArgs.length === 0 && options.claudeArgs !== undefined
      ? [] // 显式传空数组 = 清空
      : Array.from(new Set([...mergedArgs, ...inputArgs]));

    const sessionOptions: InstanceSessionOptions = {
      instanceId,
      name,
      cwd: options.cwd,
      maxBufferLines,
      headless: options.headless ?? false,
      claudeArgs: finalClaudeArgs,
    };

    const session = new InstanceSession(sessionOptions);

    // 注入共享的通知服务
    if (this.pushService) session.setPushService(this.pushService);
    if (this.notificationManager) session.setNotificationManager(this.notificationManager);
    if (this.notificationServiceFactory) session.setNotificationServiceFactory(this.notificationServiceFactory);

    // 设置实例 URL
    const instanceUrl = `http://${this.displayIp}:${DEFAULT_PORT}`;
    session.setInstanceUrl(instanceUrl);

    // PTY 退出时自动移除
    session.on('exit', () => {
      this.removeInstance(instanceId, 'pty_exit');
    });

    // 生成 Claude settings 并 spawn PTY
    const sharedConfigDir = resolve(homedir(), CLAUDE_REMOTE_DIR);
    const extracted = extractSettingsFromArgs(finalClaudeArgs);
    const finalSettings = createClaudeSettings(instanceId, extracted?.settingsValue);
    const settingsPath = saveClaudeSettings(finalSettings, instanceId, sharedConfigDir);

    let spawnArgs: string[];
    if (extracted) {
      spawnArgs = [...extracted.otherArgs, '--settings', settingsPath];
    } else {
      spawnArgs = [...finalClaudeArgs, '--settings', settingsPath];
    }

    session.ptyManager.spawn({
      command: claudeCommand,
      args: spawnArgs,
      cwd: options.cwd,
    });
    session.setStatus('running');

    // 注册到 Map
    this.instances.set(instanceId, session);

    logger.info({
      instanceId,
      name,
      cwd: options.cwd,
      headless: options.headless,
    }, 'Instance created');

    this.emit('instance_created', this.getInstanceInfo(session));

    return session;
  }

  /**
   * 获取实例
   */
  getInstance(instanceId: string): InstanceSession | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * 列出所有实例信息
   */
  listInstances(): InstanceInfo[] {
    const result: InstanceInfo[] = [];
    for (const session of this.instances.values()) {
      result.push(this.getInstanceInfo(session));
    }
    return result;
  }

  /**
   * 销毁特定实例
   */
  destroyInstance(instanceId: string): boolean {
    const session = this.instances.get(instanceId);
    if (!session) return false;

    session.destroy();
    this.removeInstance(instanceId, 'manual_destroy');
    return true;
  }

  /**
   * 销毁所有实例
   */
  destroyAll(): void {
    for (const [id, session] of this.instances) {
      session.destroy();
      logger.info({ instanceId: id }, 'Instance destroyed during shutdown');
    }
    this.instances.clear();
  }

  /**
   * Ping 所有实例的客户端（由全局心跳定时器调用）
   */
  pingAllClients(): void {
    for (const session of this.instances.values()) {
      session.pingClients();
    }
  }

  /**
   * 向所有实例的所有客户端广播消息
   */
  broadcastAll(message: import('#shared').ServerMessage): void {
    for (const session of this.instances.values()) {
      session.broadcast(message);
    }
  }

  /**
   * 更新所有实例的 IP 地址
   */
  updateDisplayIp(newIp: string): void {
    const oldIp = this.displayIp;
    this.displayIp = newIp;
    const newUrl = `http://${newIp}:${DEFAULT_PORT}`;
    for (const session of this.instances.values()) {
      session.setInstanceUrl(newUrl);
      session.broadcast({
        type: 'ip_changed',
        oldIp,
        newIp,
        newUrl,
      });
    }
  }

  get size(): number {
    return this.instances.size;
  }

  private getInstanceInfo(session: InstanceSession): InstanceInfo {
    return {
      instanceId: session.instanceId,
      name: session.name,
      cwd: session.cwd,
      status: session.status,
      startedAt: session.startedAt,
      headless: session.headless,
      clientCount: session.clientCount,
      claudeArgs: session.claudeArgs.length > 0 ? session.claudeArgs : undefined,
    };
  }

  private removeInstance(instanceId: string, reason: string): void {
    if (this.instances.delete(instanceId)) {
      logger.info({ instanceId, reason }, 'Instance removed');
      this.emit('instance_removed', instanceId, reason);
    }
  }
}
