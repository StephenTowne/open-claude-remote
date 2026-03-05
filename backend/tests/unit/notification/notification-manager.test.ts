import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { NotificationManager, createNotificationManager } from '../../../src/notification/notification-manager.js';

describe('NotificationManager', () => {
  let tempDir: string;
  let configPath: string;
  let manager: NotificationManager;

  beforeEach(() => {
    // 创建临时目录
    tempDir = resolve(tmpdir(), `notification-manager-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configPath = resolve(tempDir, 'config.json');
    manager = new NotificationManager(configPath);
  });

  afterEach(() => {
    // 清理临时目录
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('isEnabled', () => {
    it('should return true when config file does not exist', () => {
      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(true);
    });

    it('should return true when dingtalk is not configured', () => {
      writeFileSync(configPath, JSON.stringify({}));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(true);
    });

    it('should return true when dingtalk is configured without enabled field', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc' },
        },
      }));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(true);
    });

    it('should return true when dingtalk is explicitly enabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: true,
          },
        },
      }));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(true);
    });

    it('should return false when dingtalk is explicitly disabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: false,
          },
        },
      }));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(false);
    });

    it('should support legacy dingtalk config (top-level)', () => {
      writeFileSync(configPath, JSON.stringify({
        dingtalk: {
          webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
          enabled: false,
        },
      }));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(false);
    });

    it('should prefer new notifications.dingtalk over legacy dingtalk', () => {
      writeFileSync(configPath, JSON.stringify({
        dingtalk: {
          webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=old',
          enabled: true,
        },
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=new',
            enabled: false,
          },
        },
      }));

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(false);
    });

    it('should return true when wechat_work is not configured', () => {
      writeFileSync(configPath, JSON.stringify({}));

      const result = manager.isEnabled('wechat_work');
      expect(result).toBe(true);
    });

    it('should return true when wechat_work is configured without enabled field', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: { sendKey: 'SCT123456abcdef' },
        },
      }));

      const result = manager.isEnabled('wechat_work');
      expect(result).toBe(true);
    });

    it('should return false when wechat_work is explicitly disabled', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
            enabled: false,
          },
        },
      }));

      const result = manager.isEnabled('wechat_work');
      expect(result).toBe(false);
    });

    it('should use cached value within TTL', () => {
      const realDateNow = Date.now;
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: false,
          },
        },
      }));

      // 第一次调用，读取配置并缓存
      expect(manager.isEnabled('dingtalk')).toBe(false);

      // 修改配置文件
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: true,
          },
        },
      }));

      // 在 TTL 内，应该返回缓存值
      currentTime += 5000; // 5 秒后
      expect(manager.isEnabled('dingtalk')).toBe(false);

      vi.restoreAllMocks();
    });

    it('should re-read config after TTL expires', () => {
      const realDateNow = Date.now;
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: false,
          },
        },
      }));

      // 第一次调用，读取配置并缓存
      expect(manager.isEnabled('dingtalk')).toBe(false);

      // 修改配置文件
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: true,
          },
        },
      }));

      // TTL 过期后，应该重新读取
      currentTime += 11000; // 11 秒后
      expect(manager.isEnabled('dingtalk')).toBe(true);

      vi.restoreAllMocks();
    });

    it('should return true when config file is invalid JSON', () => {
      writeFileSync(configPath, 'not a valid json');

      const result = manager.isEnabled('dingtalk');
      expect(result).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should immediately update cache with new value', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: false,
          },
        },
      }));

      // 第一次调用，读取配置并缓存
      expect(manager.isEnabled('dingtalk')).toBe(false);

      // 修改配置文件
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          dingtalk: {
            webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc',
            enabled: true,
          },
        },
      }));

      // 主动刷新缓存
      manager.refresh('dingtalk');

      // 应该立即返回新值
      expect(manager.isEnabled('dingtalk')).toBe(true);
    });

    it('should refresh wechat_work channel', () => {
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
            enabled: false,
          },
        },
      }));

      expect(manager.isEnabled('wechat_work')).toBe(false);

      // 修改配置文件
      writeFileSync(configPath, JSON.stringify({
        notifications: {
          wechat_work: {
            sendKey: 'SCT123456abcdef',
            enabled: true,
          },
        },
      }));

      manager.refresh('wechat_work');
      expect(manager.isEnabled('wechat_work')).toBe(true);
    });
  });
});