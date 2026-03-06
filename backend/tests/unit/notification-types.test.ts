import { describe, it, expect } from 'vitest';
import {
  getNotificationStatus,
  validateDingtalkConfig,
  validateWechatWorkConfig,
  buildWechatWorkApiUrl,
  DINGTALK_WEBHOOK_PATTERN,
  SENDKEY_PATTERN,
  type DingtalkConfig,
  type NotificationConfigs,
} from '#shared';

describe('notification-types', () => {
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

    it('should return configured true when wechat_work has sendKey', () => {
      const configs: NotificationConfigs = {
        wechat_work: { sendKey: 'SCT123456abcdef' },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work).toEqual({ configured: true, enabled: undefined });
    });

    it('should return configured false when wechat_work sendKey is empty', () => {
      const configs: NotificationConfigs = {
        wechat_work: { sendKey: '' },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work?.configured).toBe(false);
    });

    it('should return both dingtalk and wechat_work status', () => {
      const configs: NotificationConfigs = {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
        wechat_work: { sendKey: 'SCT123456' },
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
          sendKey: 'SCT123456',
          enabled: true,
        },
      };

      const result = getNotificationStatus(configs);

      expect(result.wechat_work).toEqual({ configured: true, enabled: true });
    });

    it('should return enabled false when wechat_work is explicitly disabled', () => {
      const configs: NotificationConfigs = {
        wechat_work: {
          sendKey: 'SCT123456',
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
    it('should return true for valid SendKey', () => {
      expect(validateWechatWorkConfig({ sendKey: 'SCT123456abcdef' })).toBe(true);
    });

    it('should return true for valid SendKey with long suffix', () => {
      expect(validateWechatWorkConfig({ sendKey: 'SCT44554TYXsr5mdP3gwWdD4ed6dKJ5cd' })).toBe(true);
    });

    it('should return false for invalid SendKey (not starting with SCT)', () => {
      expect(validateWechatWorkConfig({ sendKey: 'AB123456' })).toBe(false);
    });

    it('should return false for invalid SendKey (empty)', () => {
      expect(validateWechatWorkConfig({ sendKey: '' })).toBe(false);
    });

    it('should return false for invalid SendKey (lowercase)', () => {
      expect(validateWechatWorkConfig({ sendKey: 'sct123456' })).toBe(false);
    });

    it('should return false when config is undefined', () => {
      expect(validateWechatWorkConfig(undefined)).toBe(false);
    });
  });

  describe('buildWechatWorkApiUrl', () => {
    it('should build correct API URL from SendKey', () => {
      const url = buildWechatWorkApiUrl('SCT123456abcdef');
      expect(url).toBe('https://sctapi.ftqq.com/SCT123456abcdef.send');
    });

    it('should build correct API URL for long SendKey', () => {
      const url = buildWechatWorkApiUrl('SCT44554TYXsr5mdP3gwWdD4ed6dKJ5cd');
      expect(url).toBe('https://sctapi.ftqq.com/SCT44554TYXsr5mdP3gwWdD4ed6dKJ5cd.send');
    });
  });

  describe('SENDKEY_PATTERN', () => {
    it('should match valid SendKeys', () => {
      const validKeys = [
        'SCT123456abcdef',
        'SCT44554TYXsr5mdP3gwWdD4ed6dKJ5cd',
        'SCT1234567890',
      ];
      validKeys.forEach(key => {
        expect(SENDKEY_PATTERN.test(key)).toBe(true);
      });
    });

    it('should not match invalid SendKeys', () => {
      const invalidKeys = [
        'sct123456abcdef',     // lowercase prefix
        'AB123456abcdef',      // wrong prefix
        '123SCT456abcdef',     // prefix not at start
        'SCT',                 // only prefix, no suffix
        'SCTshort',            // too short (< 10 chars after SCT)
        'SCT_12345678',        // contains underscore
        'SCT-12345678',        // contains hyphen
        'SCT 12345678',        // contains space
        '',                    // empty
      ];
      invalidKeys.forEach(key => {
        expect(SENDKEY_PATTERN.test(key)).toBe(false);
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