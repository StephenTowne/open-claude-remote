import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { NotificationServiceFactory, createNotificationServiceFactory } from '../../../src/notification/notification-service-factory.js';

describe('NotificationServiceFactory', () => {
  let tempDir: string;
  let configPath: string;
  let factory: NotificationServiceFactory;

  beforeEach(() => {
    // 创建临时目录
    tempDir = resolve(tmpdir(), `notification-service-factory-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configPath = resolve(tempDir, 'config.json');
    factory = new NotificationServiceFactory(configPath);
  });

  afterEach(() => {
    // 清理临时目录
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getDingtalkService', () => {
    it('should return null when config file does not exist', () => {
      const result = factory.getDingtalkService();
      expect(result).toBeNull();
    });

    it('should return null when dingtalk is not configured', () => {
      writeFileSync(configPath, JSON.stringify({}));

      const result = factory.getDingtalkService();
      expect(result).toBeNull();
    });

    it('should return null when dingtalk webhookUrl is empty', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: { webhookUrl: '' },
        },
      }));

      const result = factory.getDingtalkService();
      expect(result).toBeNull();
    });

    it('should return null when dingtalk is disabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: false,
          },
        },
      }));

      const result = factory.getDingtalkService();
      expect(result).toBeNull();
    });

    it('should return service when dingtalk is configured and enabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          },
        },
      }));

      const result = factory.getDingtalkService();
      expect(result).not.toBeNull();
    });

    it('should return null when legacy dingtalk config exists without notifications (migration expected at startup)', () => {
      // loadUserConfig() 在启动时已将旧版 dingtalk 迁移到 notifications.dingtalk
      // 工厂不再负责兼容旧版字段
      writeFileSync(configPath, JSON.stringify({
        dingtalk: {
          webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=legacy',
        },
      }));

      const result = factory.getDingtalkService();
      expect(result).toBeNull();
    });


    it('should cache service instance (same instance on multiple calls)', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          },
        },
      }));

      const result1 = factory.getDingtalkService();
      const result2 = factory.getDingtalkService();

      expect(result1).toBe(result2); // 同一个实例
    });
  });

  describe('getWechatWorkService', () => {
    it('should return null when config file does not exist', () => {
      const result = factory.getWechatWorkService();
      expect(result).toBeNull();
    });

    it('should return null when wechat_work is not configured', () => {
      writeFileSync(configPath, JSON.stringify({}));

      const result = factory.getWechatWorkService();
      expect(result).toBeNull();
    });

    it('should return null when sendKey is empty', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: { sendKey: '' },
        },
      }));

      const result = factory.getWechatWorkService();
      expect(result).toBeNull();
    });

    it('should return null when wechat_work is disabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
            enabled: false,
          },
        },
      }));

      const result = factory.getWechatWorkService();
      expect(result).toBeNull();
    });

    it('should return service even when sendKey format is invalid (service handles validation internally)', () => {
      // WechatWorkService 内部验证 sendKey 格式，无效时 validatedApiUrl 为 null
      // 工厂不负责验证，由服务层处理
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'invalid-key-format',
          },
        },
      }));

      const result = factory.getWechatWorkService();
      // 服务实例会被创建，但内部的 validatedApiUrl 为 null
      // 发送通知时会跳过（见 WechatWorkService.sendNotification）
      expect(result).not.toBeNull();
    });

    it('should return service when wechat_work is configured with valid sendKey', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const result = factory.getWechatWorkService();
      expect(result).not.toBeNull();
    });

    it('should cache service instance (same instance on multiple calls)', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const result1 = factory.getWechatWorkService();
      const result2 = factory.getWechatWorkService();

      expect(result1).toBe(result2); // 同一个实例
    });
  });

  describe('refresh', () => {
    it('should clear dingtalk cache and create new instance', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          },
        },
      }));

      const result1 = factory.getDingtalkService();
      expect(result1).not.toBeNull();

      // 刷新缓存
      factory.refresh('dingtalk');

      // 修改配置
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xyz',
          },
        },
      }));

      const result2 = factory.getDingtalkService();
      expect(result2).not.toBeNull();
      expect(result2).not.toBe(result1); // 新实例
    });

    it('should clear wechat_work cache and create new instance', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const result1 = factory.getWechatWorkService();
      expect(result1).not.toBeNull();

      // 刷新缓存
      factory.refresh('wechat_work');

      // 修改配置
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCTxyz789new',
          },
        },
      }));

      const result2 = factory.getWechatWorkService();
      expect(result2).not.toBeNull();
      expect(result2).not.toBe(result1); // 新实例
    });

    it('should clear all caches when channel not specified', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          },
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const dingtalk1 = factory.getDingtalkService();
      const wechat1 = factory.getWechatWorkService();

      // 刷新所有缓存
      factory.refresh();

      // 写入新配置
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xyz',
          },
          wechat_work: {
            sendKey: 'SCTxyz789new',
          },
        },
      }));

      const dingtalk2 = factory.getDingtalkService();
      const wechat2 = factory.getWechatWorkService();

      expect(dingtalk2).not.toBe(dingtalk1);
      expect(wechat2).not.toBe(wechat1);
    });

    it('should only clear specified channel cache', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          },
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const dingtalk1 = factory.getDingtalkService();
      const wechat1 = factory.getWechatWorkService();

      // 只刷新钉钉缓存
      factory.refresh('dingtalk');

      // 钉钉应该失效
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xyz',
          },
          wechat_work: {
            sendKey: 'SCT123456abcdef',
          },
        },
      }));

      const dingtalk2 = factory.getDingtalkService();
      const wechat2 = factory.getWechatWorkService();

      expect(dingtalk2).not.toBe(dingtalk1); // 钉钉是新实例
      expect(wechat2).toBe(wechat1); // 微信还是原来实例
    });

    it('should handle refresh on null service gracefully', () => {
      writeFileSync(configPath, JSON.stringify({}));

      // 未配置，返回 null
      expect(factory.getDingtalkService()).toBeNull();

      // 刷新不应报错
      factory.refresh('dingtalk');

      expect(factory.getDingtalkService()).toBeNull();
    });
  });

  describe('config read errors', () => {
    it('should return null when config file is invalid JSON', () => {
      writeFileSync(configPath, 'not a valid json');

      const dingtalk = factory.getDingtalkService();
      const wechat = factory.getWechatWorkService();

      expect(dingtalk).toBeNull();
      expect(wechat).toBeNull();
    });
  });
});