import { describe, it, expect } from 'vitest';
import {
  migrateNotificationConfig,
  mergeNotificationConfigs,
  getNotificationStatus,
  validateDingtalkConfig,
  validateWechatWorkConfig,
  DINGTALK_WEBHOOK_PATTERN,
  WECHAT_WORK_API_URL_PATTERN,
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

    it('should preserve wechat_work config from new notifications structure', () => {
      const newConfig: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://new.webhook.url' },
        wechat_work: { apiUrl: 'https://test.push.ft07.com/send/abc.send' },
      };

      const result = mergeNotificationConfigs(newConfig, undefined);

      expect(result.dingtalk?.webhookUrl).toBe('https://new.webhook.url');
      expect(result.wechat_work?.apiUrl).toBe('https://test.push.ft07.com/send/abc.send');
    });

    it('should preserve wechat_work config even when dingtalk falls back to old config', () => {
      const newConfig: NotificationConfigs = {
        wechat_work: { apiUrl: 'https://test.push.ft07.com/send/xyz.send' },
      };
      const oldDingtalk: DingtalkConfig = { webhookUrl: 'https://old.webhook.url' };

      const result = mergeNotificationConfigs(newConfig, oldDingtalk);

      expect(result.dingtalk?.webhookUrl).toBe('https://old.webhook.url');
      expect(result.wechat_work?.apiUrl).toBe('https://test.push.ft07.com/send/xyz.send');
    });
  });

  describe('getNotificationStatus', () => {
    it('should return configured true when dingtalk has webhookUrl', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
      };

      const result = getNotificationStatus(configs);

      expect(result).toEqual({
        dingtalk: { configured: true, enabled: undefined },
      });
    });

    it('should return configured false when webhookUrl is empty', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: '' },
      };

      const result = getNotificationStatus(configs);

      expect(result.dingtalk?.configured).toBe(false);
    });

    it('should return configured true when wechat_work has apiUrl', () => {
      const configs: NotificationConfigs = {
        wechat_work: { apiUrl: 'https://test.push.ft07.com/send/abc.send' },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work).toEqual({ configured: true, enabled: undefined });
    });

    it('should return configured false when wechat_work apiUrl is empty', () => {
      const configs: NotificationConfigs = {
        wechat_work: { apiUrl: '' },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work?.configured).toBe(false);
    });

    it('should return both dingtalk and wechat_work status', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
        wechat_work: { apiUrl: 'https://test.push.ft07.com/send/abc.send' },
      };

      const result = getNotificationStatus(configs);

      expect(result.dingtalk).toEqual({ configured: true, enabled: undefined });
      expect(result.wechat_work).toEqual({ configured: true, enabled: undefined });
    });

    it('should return empty object when configs is undefined', () => {
      const result = getNotificationStatus(undefined);

      expect(result).toEqual({});
    });

    it('should return enabled true when dingtalk is explicitly enabled', () => {
      const configs: NotificationConfigs = {
        dingtalk: {
          webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123',
          enabled: true,
        },
      };

      const result = getNotificationStatus(configs);

      expect(result.dingtalk).toEqual({ configured: true, enabled: true });
    });

    it('should return enabled false when dingtalk is explicitly disabled', () => {
      const configs: NotificationConfigs = {
        dingtalk: {
          webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123',
          enabled: false,
        },
      };

      const result = getNotificationStatus(configs);

      expect(result.dingtalk).toEqual({ configured: true, enabled: false });
    });

    it('should return enabled true when wechat_work is explicitly enabled', () => {
      const configs: NotificationConfigs = {
        wechat_work: {
          apiUrl: 'https://test.push.ft07.com/send/abc.send',
          enabled: true,
        },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work).toEqual({ configured: true, enabled: true });
    });

    it('should return enabled false when wechat_work is explicitly disabled', () => {
      const configs: NotificationConfigs = {
        wechat_work: {
          apiUrl: 'https://test.push.ft07.com/send/abc.send',
          enabled: false,
        },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work).toEqual({ configured: true, enabled: false });
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

  describe('validateWechatWorkConfig', () => {
    it('should return true for valid API URL', () => {
      expect(validateWechatWorkConfig({ apiUrl: 'https://test.push.ft07.com/send/abc123.send' })).toBe(true);
    });

    it('should return true for valid API URL with different uid', () => {
      expect(validateWechatWorkConfig({ apiUrl: 'https://user-id-123.push.ft07.com/send/SCTkey.send' })).toBe(true);
    });

    it('should return false for invalid URL format (wrong domain)', () => {
      expect(validateWechatWorkConfig({ apiUrl: 'https://evil.com/send/key.send' })).toBe(false);
    });

    it('should return false for invalid URL format (not https)', () => {
      expect(validateWechatWorkConfig({ apiUrl: 'http://test.push.ft07.com/send/key.send' })).toBe(false);
    });

    it('should return false for invalid URL format (missing .send)', () => {
      expect(validateWechatWorkConfig({ apiUrl: 'https://test.push.ft07.com/send/key' })).toBe(false);
    });

    it('should return false for empty apiUrl', () => {
      expect(validateWechatWorkConfig({ apiUrl: '' })).toBe(false);
    });

    it('should return false when config is undefined', () => {
      expect(validateWechatWorkConfig(undefined)).toBe(false);
    });
  });

  describe('WECHAT_WORK_API_URL_PATTERN', () => {
    it('should match valid API URLs', () => {
      const validUrls = [
        'https://test.push.ft07.com/send/abc123.send',
        'https://user-id-123.push.ft07.com/send/SCTkey.send',
        'https://a.push.ft07.com/send/b.send',
      ];
      validUrls.forEach(url => {
        expect(WECHAT_WORK_API_URL_PATTERN.test(url)).toBe(true);
      });
    });

    it('should not match invalid URLs', () => {
      const invalidUrls = [
        'http://test.push.ft07.com/send/key.send',      // not https
        'https://evil.com/send/key.send',               // wrong domain
        'https://push.ft07.com/send/key.send',          // missing uid subdomain
        'https://test.push.ft07.com/send/key',          // missing .send suffix
        'https://test.push.ft07.com/key.send',          // missing /send path
        'https://test.ft07.com/send/key.send',          // wrong subdomain
        'not-a-url',                                     // not a URL
        '',                                              // empty
      ];
      invalidUrls.forEach(url => {
        expect(WECHAT_WORK_API_URL_PATTERN.test(url)).toBe(false);
      });
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