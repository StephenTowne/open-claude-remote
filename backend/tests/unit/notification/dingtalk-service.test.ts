import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DingtalkService } from '../../../src/notification/dingtalk-service.js';

describe('DingtalkService', () => {
  const mockWebhookUrl = 'https://oapi.dingtalk.com/robot/send?access_token=test-token';
  let service: DingtalkService;

  beforeEach(() => {
    service = new DingtalkService(mockWebhookUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification with correct payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0, errmsg: 'ok' }),
      });
      global.fetch = mockFetch;

      await service.sendNotification('Test Title', 'Bash', 'Test message');

      expect(mockFetch).toHaveBeenCalledWith(mockWebhookUrl, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '### Test Title\n\n**Tool**: Bash\n\n**Message**: Test message\n\n---\nPlease respond promptly',
          },
        }),
      }));
    });

    it('should handle API error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 310000, errmsg: 'keywords not in content' }),
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

    it('should skip notification when webhook URL is empty', async () => {
      const emptyService = new DingtalkService('');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await emptyService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid hostname (SSRF protection)', async () => {
      const maliciousService = new DingtalkService('https://evil.com/steal?data=sensitive');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await maliciousService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject malformed URL', async () => {
      const invalidService = new DingtalkService('not-a-valid-url');
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      await invalidService.sendNotification('Title', 'Tool', 'Message');

      expect(mockFetch).not.toHaveBeenCalled();
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