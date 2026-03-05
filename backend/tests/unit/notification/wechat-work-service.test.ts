import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WechatWorkService } from '../../../src/notification/wechat-work-service.js';

describe('WechatWorkService', () => {
  describe('Standard sendkey (SCT)', () => {
    const mockSendkey = 'SCTtesttoken123456';
    let service: WechatWorkService;

    beforeEach(() => {
      service = new WechatWorkService(mockSendkey);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('sendNotification', () => {
      it('should send notification with correct payload to sctapi.ftqq.com', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ code: 0, message: 'success', data: {} }),
        });
        global.fetch = mockFetch;

        await service.sendNotification('Test Title', 'Bash', 'Test message');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://sctapi.ftqq.com/SCTtesttoken123456.send',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
        );

        // 验证请求体格式（URL encoded, space becomes +）
        const callArgs = mockFetch.mock.calls[0];
        const body = callArgs[1].body as string;
        expect(body).toContain('title=Test+Title');
        expect(body).toContain('desp='); // desp 字段存在
      });

      it('should handle API error response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ code: 40001, message: 'invalid sendkey', data: {} }),
        });
        global.fetch = mockFetch;

        // 不应抛出异常
        await expect(service.sendNotification('Title', 'Tool', 'Message')).resolves.toBeUndefined();
      });

      it('should handle HTTP error response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        });
        global.fetch = mockFetch;

        // 不应抛出异常
        await expect(service.sendNotification('Title', 'Tool', 'Message')).resolves.toBeUndefined();
      });

      it('should handle network error gracefully', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        global.fetch = mockFetch;

        // 不应抛出异常
        await expect(service.sendNotification('Title', 'Tool', 'Message')).resolves.toBeUndefined();
      });

      it('should handle request timeout', async () => {
        const mockFetch = vi.fn().mockImplementation(() =>
          new Promise((_, reject) => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          })
        );
        global.fetch = mockFetch;

        // 不应抛出异常
        await expect(service.sendNotification('Title', 'Tool', 'Message')).resolves.toBeUndefined();
      });
    });
  });

  describe('Turbo sendkey (sctp)', () => {
    const mockSendkey = 'sctptesttoken123456';
    let service: WechatWorkService;

    beforeEach(() => {
      service = new WechatWorkService(mockSendkey);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should send notification to push.ft07.com', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0, message: 'success', data: {} }),
      });
      global.fetch = mockFetch;

      await service.sendNotification('Test Title', 'Bash', 'Test message');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sctptesttoken123456.push.ft07.com/send',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });
  });

  describe('Validation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should skip notification when sendkey is empty', async () => {
      const emptyService = new WechatWorkService('');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await emptyService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid sendkey format', async () => {
      const invalidService = new WechatWorkService('invalid-format');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject sendkey with wrong prefix', async () => {
      const invalidService = new WechatWorkService('XXXtesttoken123456');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject sendkey with special characters (SSRF protection)', async () => {
      // sctp + @ 可能构造出 userinfo@host 形式的 URL，绕过域名白名单
      const maliciousKeys = [
        'sctp@evil.com',       // @ 分隔 userinfo 和 host
        'sctp.evil.com',       // 点号可能影响子域名解析
        'SCT../../../etc',     // 路径穿越尝试
        'sctp:8080',           // 端口注入
      ];

      for (const key of maliciousKeys) {
        const service = new WechatWorkService(key);
        const mockFetch = vi.fn();
        global.fetch = mockFetch;

        await service.sendNotification('Title', 'Tool', 'Message');

        expect(mockFetch).not.toHaveBeenCalled();
      }
    });
  });

  describe('Message format', () => {
    it('should format message with markdown structure', async () => {
      const mockSendkey = 'SCTtesttoken123456';
      const service = new WechatWorkService(mockSendkey);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0, message: 'success', data: {} }),
      });
      global.fetch = mockFetch;

      await service.sendNotification('Test Title', 'Bash', 'Test message');

      const callArgs = mockFetch.mock.calls[0];
      // URLSearchParams encodes space as +, # as %23, : as %3A
      const body = callArgs[1].body as string;
      // 检查 URL 编码后的内容
      expect(body).toContain('%23%23%23+Test+Title'); // ### Test Title (### = %23%23%23, space = +)
      expect(body).toContain('**Tool**%3A+Bash'); // **Tool**: Bash (: = %3A, space = +)
      expect(body).toContain('**Message**%3A+Test+message');
      expect(body).toContain('---');
      expect(body).toContain('Please+respond+promptly');
    });

    it('should include instance URL in message', async () => {
      const mockSendkey = 'SCTtesttoken123456';
      const service = new WechatWorkService(mockSendkey);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0, message: 'success', data: {} }),
      });
      global.fetch = mockFetch;

      await service.sendNotification('Test Title', 'Bash', 'Test message\n\nInstance: http://192.168.1.1:3000');

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as string;
      // URL 编码后 :// 变成 %3A%2F%2F
      expect(body).toContain('Instance%3A+http'); // Instance: http
    });
  });
});