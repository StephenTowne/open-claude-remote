import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WechatWorkService } from '../../../src/notification/wechat-work-service.js';

describe('WechatWorkService', () => {
  const mockApiUrl = 'https://sctptesttoken123456.push.ft07.com/send/abc123.send';
  let service: WechatWorkService;

  beforeEach(() => {
    service = new WechatWorkService(mockApiUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification with correct payload to push.ft07.com', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0, message: 'success', data: {} }),
      });
      global.fetch = mockFetch;

      await service.sendNotification('Test Title', 'Bash', 'Test message');

      expect(mockFetch).toHaveBeenCalledWith(
        mockApiUrl,
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

  describe('Validation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should skip notification when API URL is empty', async () => {
      const emptyService = new WechatWorkService('');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await emptyService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid URL format (not https)', async () => {
      const invalidService = new WechatWorkService('http://test.push.ft07.com/send/key.send');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid URL format (wrong domain)', async () => {
      const invalidService = new WechatWorkService('https://evil.com/send/key.send');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid URL format (missing .send suffix)', async () => {
      const invalidService = new WechatWorkService('https://test.push.ft07.com/send/key');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject URL with SSRF attack attempts', async () => {
      // 各种 SSRF 攻击尝试
      const maliciousUrls = [
        'https://evil.com@push.ft07.com/send/key.send',     // @ 用户信息注入
        'https://push.ft07.com.evil.com/send/key.send',     // 域名欺骗
        'https://push.ft07.com/../../../etc/passwd',        // 路径穿越
        'https://push.ft07.com:8080/send/key.send',         // 端口注入（子域名格式不对）
        'https://test.push.ft07.com/send/key.send?redirect=evil', // 查询参数注入
      ];

      for (const url of maliciousUrls) {
        const service = new WechatWorkService(url);
        const mockFetch = vi.fn();
        global.fetch = mockFetch;

        await service.sendNotification('Title', 'Tool', 'Message');

        expect(mockFetch).not.toHaveBeenCalled();
      }
    });

    it('should accept valid URL with different uid patterns', async () => {
      const validUrls = [
        'https://abc123.push.ft07.com/send/testkey.send',
        'https://user-id-123.push.ft07.com/send/SCT123.send',
        'https://a.push.ft07.com/send/b.send',
      ];

      for (const url of validUrls) {
        const service = new WechatWorkService(url);
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ code: 0, message: 'success', data: {} }),
        });
        global.fetch = mockFetch;

        await service.sendNotification('Title', 'Tool', 'Message');

        expect(mockFetch).toHaveBeenCalledWith(
          url,
          expect.objectContaining({ method: 'POST' })
        );
      }
    });
  });

  describe('Message format', () => {
    it('should format message with markdown structure', async () => {
      const service = new WechatWorkService(mockApiUrl);
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
      const service = new WechatWorkService(mockApiUrl);
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