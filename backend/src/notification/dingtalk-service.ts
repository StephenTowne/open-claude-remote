import { logger } from '../logger/logger.js';

/** 钉钉 Webhook 允许的域名 */
const ALLOWED_HOSTS = ['oapi.dingtalk.com'];

/** HTTP 请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * 钉钉群机器人 Webhook 通知服务
 * 参考文档: https://open.dingtalk.com/document/robots/custom-robot-access
 */
export class DingtalkService {
  private validatedUrl: string | null = null;

  constructor(private webhookUrl: string) {
    this.validatedUrl = this.validateWebhookUrl(webhookUrl);
  }

  /**
   * 验证 webhook URL 是否为合法的钉钉域名
   * 防止 SSRF 攻击
   */
  private validateWebhookUrl(url: string): string | null {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      // 只允许钉钉官方域名
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        logger.warn({ hostname: parsed.hostname }, 'Invalid dingtalk webhook hostname, rejecting');
        return null;
      }
      return url;
    } catch {
      logger.warn({ url }, 'Invalid webhook URL format, rejecting');
      return null;
    }
  }

  /**
   * 发送钉钉通知
   * 失败时仅记录日志，不抛出异常
   *
   * @param title 消息标题
   * @param tool 工具名称
   * @param message 详细消息
   */
  async sendNotification(title: string, tool: string, message: string): Promise<void> {
    if (!this.validatedUrl) {
      logger.warn('Dingtalk webhook URL is empty or invalid, skipping notification');
      return;
    }

    const payload = {
      msgtype: 'markdown',
      markdown: {
        title,
        text: `### ${title}\n\n**Tool**: ${tool}\n\n**Message**: ${message}\n\n---\nPlease respond promptly`,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.validatedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          { status: response.status, body: text },
          'Dingtalk notification failed with HTTP error'
        );
        return;
      }

      const result = (await response.json()) as { errcode?: number; errmsg?: string };
      if (result.errcode !== 0) {
        logger.error(
          { errcode: result.errcode, errmsg: result.errmsg },
          'Dingtalk notification failed with API error'
        );
        return;
      }

      logger.info({ title, tool }, 'Dingtalk notification sent successfully');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error({ timeout: REQUEST_TIMEOUT_MS }, 'Dingtalk notification timed out');
      } else {
        logger.error({ err, title, tool }, 'Dingtalk notification failed with exception');
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}