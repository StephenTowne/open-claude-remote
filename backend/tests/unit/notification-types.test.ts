import { describe, it, expect } from 'vitest';
import {
  migrateNotificationConfig,
  mergeNotificationConfigs,
  getNotificationStatus,
  validateDingtalkConfig,
  DINGTALK_WEBHOOK_PATTERN,
  type DingtalkConfig,
  type NotificationConfigs,
} from '#shared';

describe('notification-types', () => {
  describe('migrateNotificationConfig', () => {
    it('should migrate old dingtalk config to new notifications structure', () => {
      const oldConfig = {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
      };

      const result = migrateNotificationConfig(oldConfig);

      expect(result).toEqual({
        notifications: {
          dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
        },
      });
    });

    it('should return empty object when no dingtalk config exists', () => {
      const result = migrateNotificationConfig({});

      expect(result).toEqual({});
    });
  });

  describe('mergeNotificationConfigs', () => {
    it('should prefer new notifications structure over old dingtalk config', () => {
      const newConfig: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://new.webhook.url' },
      };
      const oldConfig: DingtalkConfig = { webhookUrl: 'https://old.webhook.url' };

      const result = mergeNotificationConfigs(newConfig, oldConfig);

      expect(result.dingtalk?.webhookUrl).toBe('https://new.webhook.url');
    });

    it('should fall back to old dingtalk config when new config is empty', () => {
      const oldConfig: DingtalkConfig = { webhookUrl: 'https://old.webhook.url' };

      const result = mergeNotificationConfigs(undefined, oldConfig);

      expect(result.dingtalk?.webhookUrl).toBe('https://old.webhook.url');
    });

    it('should return empty object when neither config exists', () => {
      const result = mergeNotificationConfigs(undefined, undefined);

      expect(result).toEqual({});
    });
  });

  describe('getNotificationStatus', () => {
    it('should return configured true when dingtalk has webhookUrl', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
      };

      const result = getNotificationStatus(configs);

      expect(result).toEqual({
        dingtalk: { configured: true },
      });
    });

    it('should return configured false when webhookUrl is empty', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: '' },
      };

      const result = getNotificationStatus(configs);

      expect(result.dingtalk?.configured).toBe(false);
    });

    it('should return empty object when configs is undefined', () => {
      const result = getNotificationStatus(undefined);

      expect(result).toEqual({});
    });
  });

  describe('validateDingtalkConfig', () => {
    it('should return true for valid webhook URL', () => {
      const config: DingtalkConfig = {
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123',
      };

      expect(validateDingtalkConfig(config)).toBe(true);
    });

    it('should return false for invalid webhook URL', () => {
      const config: DingtalkConfig = {
        webhookUrl: 'https://example.com/webhook',
      };

      expect(validateDingtalkConfig(config)).toBe(false);
    });

    it('should return false when config is undefined', () => {
      expect(validateDingtalkConfig(undefined)).toBe(false);
    });
  });

  describe('DINGTALK_WEBHOOK_PATTERN', () => {
    it('should match valid DingTalk webhook URLs', () => {
      const validUrls = [
        'https://oapi.dingtalk.com/robot/send?access_token=abc123',
        'https://oapi.dingtalk.com/robot/send?access_token=xyz789&other=param',
      ];

      validUrls.forEach(url => {
        expect(DINGTALK_WEBHOOK_PATTERN.test(url)).toBe(true);
      });
    });

    it('should not match invalid URLs', () => {
      const invalidUrls = [
        'http://oapi.dingtalk.com/robot/send?access_token=abc123',
        'https://example.com/robot/send?access_token=abc123',
        'https://oapi.dingtalk.com/webhook/send?access_token=abc123',
        'not-a-url',
        '',
      ];

      invalidUrls.forEach(url => {
        expect(DINGTALK_WEBHOOK_PATTERN.test(url)).toBe(false);
      });
    });
  });
});
