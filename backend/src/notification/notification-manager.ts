import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { CLAUDE_REMOTE_DIR } from '#shared';
import type { NotificationChannel } from '../hooks/hook-types.js';
import { logger } from '../logger/logger.js';

/**
 * NotificationManager - 管理通知渠道的启用状态
 *
 * 采用 TTL 缓存策略实现即时生效：
 * - 缓存有效（< 10秒）：直接返回缓存值
 * - 缓存过期：重新读取配置文件
 * - 主动刷新：PATCH API 成功后调用 refresh() 立即更新缓存
 */
export class NotificationManager {
  private cache = new Map<NotificationChannel, { enabled: boolean; timestamp: number }>();
  private readonly TTL_MS = 10_000; // 10秒容错窗口

  constructor(private configPath: string) {}

  /**
   * 检查渠道是否启用
   * - 缓存有效：直接返回
   * - 缓存过期：重新读取配置
   *
   * @param channel 渠道类型
   * @returns 是否启用（未配置默认返回 true）
   */
  isEnabled(channel: NotificationChannel): boolean {
    const now = Date.now();
    const cached = this.cache.get(channel);

    if (cached && now - cached.timestamp < this.TTL_MS) {
      return cached.enabled;
    }

    const enabled = this.readEnabledFromConfig(channel);
    this.cache.set(channel, { enabled, timestamp: now });
    return enabled;
  }

  /**
   * 主动刷新缓存（PATCH API 成功后调用）
   * 确保当前实例立即感知配置变更
   *
   * @param channel 渠道类型
   */
  refresh(channel: NotificationChannel): void {
    const enabled = this.readEnabledFromConfig(channel);
    this.cache.set(channel, { enabled, timestamp: Date.now() });
    logger.info({ channel, enabled }, 'Notification channel cache refreshed');
  }

  /**
   * 从配置文件读取 enabled 状态
   * - 未配置：返回 true（默认启用）
   * - 已配置但未设置 enabled：返回 true
   * - 已配置且 enabled=false：返回 false
   */
  private readEnabledFromConfig(channel: NotificationChannel): boolean {
    try {
      if (!existsSync(this.configPath)) {
        return true; // 未配置文件，默认启用
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as {
        dingtalk?: { webhookUrl: string; enabled?: boolean };
        notifications?: {
          dingtalk?: { webhookUrl: string; enabled?: boolean };
          wechat_work?: { sendKey: string; enabled?: boolean };
        };
      };

      if (channel === 'dingtalk') {
        // 优先使用新版 notifications 结构，回退到旧版
        const dingtalkConfig = config.notifications?.dingtalk ?? config.dingtalk;
        if (!dingtalkConfig?.webhookUrl) {
          return true; // 未配置，默认启用（不会被调用）
        }
        return dingtalkConfig.enabled ?? true;
      }

      if (channel === 'wechat_work') {
        const wechatConfig = config.notifications?.wechat_work;
        if (!wechatConfig?.sendKey) {
          return true; // 未配置，默认启用（不会被调用）
        }
        return wechatConfig.enabled ?? true;
      }

      return true;
    } catch (err) {
      logger.warn({ err, channel, configPath: this.configPath }, 'Failed to read notification enabled status, defaulting to true');
      return true;
    }
  }
}

/**
 * 创建 NotificationManager 实例
 * 使用默认配置文件路径
 */
export function createNotificationManager(): NotificationManager {
  const configPath = resolve(homedir(), CLAUDE_REMOTE_DIR, 'settings.json');
  return new NotificationManager(configPath);
}