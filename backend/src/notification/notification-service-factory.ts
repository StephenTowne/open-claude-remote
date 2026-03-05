import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { CLAUDE_REMOTE_DIR } from '#shared';
import type { NotificationChannel } from '../hooks/hook-types.js';
import { DingtalkService } from './dingtalk-service.js';
import { WechatWorkService } from './wechat-work-service.js';
import { logger } from '../logger/logger.js';

/**
 * NotificationServiceFactory - 通知服务工厂
 *
 * 采用懒加载 + 缓存策略实现即时生效：
 * - 懒加载：第一次调用 getXxxService() 时创建服务
 * - 缓存：后续调用返回同一实例
 * - 刷新：refresh() 清除缓存，下次调用时重新创建服务（使用新配置）
 *
 * 实现配置即时生效的核心机制：
 * 1. 配置更新 → factory.refresh() 清除缓存
 * 2. 下次发送通知 → getXxxService() 重新读取配置创建新服务
 */
export class NotificationServiceFactory {
  /** 钉钉服务缓存（undefined = 未缓存，null = 未配置，object = 已配置） */
  private dingtalkServiceCache: DingtalkService | null | undefined = undefined;
  /** 微信服务缓存（undefined = 未缓存，null = 未配置，object = 已配置） */
  private wechatWorkServiceCache: WechatWorkService | null | undefined = undefined;

  constructor(private configPath: string) {}

  /**
   * 获取钉钉服务实例
   * - 缓存命中：返回缓存实例
   * - 缓存未命中：读取配置创建服务
   *
   * @returns 钉钉服务实例，未配置或无效返回 null
   */
  getDingtalkService(): DingtalkService | null {
    if (this.dingtalkServiceCache !== undefined) {
      return this.dingtalkServiceCache;
    }
    this.dingtalkServiceCache = this.createDingtalkService();
    return this.dingtalkServiceCache;
  }

  /**
   * 获取微信服务实例
   * - 缓存命中：返回缓存实例
   * - 缓存未命中：读取配置创建服务
   *
   * @returns 微信服务实例，未配置或无效返回 null
   */
  getWechatWorkService(): WechatWorkService | null {
    if (this.wechatWorkServiceCache !== undefined) {
      return this.wechatWorkServiceCache;
    }
    this.wechatWorkServiceCache = this.createWechatWorkService();
    return this.wechatWorkServiceCache;
  }

  /**
   * 刷新服务缓存
   * - 清除指定渠道缓存：下次调用 getXxxService() 时重新创建
   * - 清除所有缓存：channel 未指定时清除全部
   *
   * @param channel 可选，指定刷新的渠道
   */
  refresh(channel?: NotificationChannel): void {
    if (!channel || channel === 'dingtalk') {
      this.dingtalkServiceCache = undefined;
      logger.debug({ channel: 'dingtalk' }, 'Dingtalk service cache cleared');
    }
    if (!channel || channel === 'wechat_work') {
      this.wechatWorkServiceCache = undefined;
      logger.debug({ channel: 'wechat_work' }, 'WeChatWork service cache cleared');
    }
    logger.info({ channel: channel ?? 'all' }, 'Notification service cache refreshed');
  }

  /**
   * 创建钉钉服务实例
   * - 读取配置文件
   * - 验证 webhookUrl
   * - 检查 enabled 状态
   */
  private createDingtalkService(): DingtalkService | null {
    try {
      if (!existsSync(this.configPath)) {
        return null;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as {
        notifications?: {
          dingtalk?: { webhookUrl: string; enabled?: boolean };
        };
      };

      const dingtalkConfig = config.notifications?.dingtalk;
      if (!dingtalkConfig?.webhookUrl) {
        return null;
      }

      // 检查是否禁用
      if (dingtalkConfig.enabled === false) {
        logger.debug('Dingtalk notification is disabled, skipping service creation');
        return null;
      }

      const service = new DingtalkService(dingtalkConfig.webhookUrl);
      logger.info('Dingtalk service created from config');
      return service;
    } catch (err) {
      logger.warn({ err, configPath: this.configPath }, 'Failed to create Dingtalk service');
      return null;
    }
  }

  /**
   * 创建微信服务实例
   * - 读取配置文件
   * - 验证 sendKey
   * - 检查 enabled 状态
   */
  private createWechatWorkService(): WechatWorkService | null {
    try {
      if (!existsSync(this.configPath)) {
        return null;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as {
        notifications?: {
          wechat_work?: { sendKey: string; enabled?: boolean };
        };
      };

      const wechatConfig = config.notifications?.wechat_work;
      if (!wechatConfig?.sendKey) {
        return null;
      }

      // 检查是否禁用
      if (wechatConfig.enabled === false) {
        logger.debug('WeChat Work notification is disabled, skipping service creation');
        return null;
      }

      const service = new WechatWorkService(wechatConfig.sendKey);
      logger.info('WeChat Work service created from config');
      return service;
    } catch (err) {
      logger.warn({ err, configPath: this.configPath }, 'Failed to create WeChat Work service');
      return null;
    }
  }
}

/**
 * 创建 NotificationServiceFactory 实例
 * 使用默认配置文件路径
 */
export function createNotificationServiceFactory(): NotificationServiceFactory {
  const configPath = resolve(homedir(), CLAUDE_REMOTE_DIR, 'config.json');
  return new NotificationServiceFactory(configPath);
}