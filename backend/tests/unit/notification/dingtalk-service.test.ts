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

      expect(mockFetch).toHaveBeenCalledWith(mockWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            title: 'Test Title',
            text: '### Test Title\n\n**工具**: Bash\n\n**消息**: Test message\n\n---\n请及时处理',
          },
        }),
      });
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
  });
});