import { WECHAT_WORK_API_URL_PATTERN } from '#shared';
import { logger } from '../logger/logger.js';

/** Server酱³ 允许的域名 */
const ALLOWED_HOST = 'push.ft07.com';

/** HTTP 请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * 企业微信通知服务（Server酱³ 实现）
 * API URL 格式: https://<uid>.push.ft07.com/send/<sendkey>.send
 */
export class WechatWorkService {
  private validatedApiUrl: string | null = null;

  constructor(private apiUrl: string) {
    if (this.validateApiUrl(apiUrl)) {
      this.validatedApiUrl = apiUrl;
    }
  }

  /**
   * 验证 API URL 是否合法
   * - 必须匹配 Server酱³ URL 格式
   * - 域名必须为 push.ft07.com
   */
  private validateApiUrl(apiUrl: string): boolean {
    if (!apiUrl) {
      return false;
    }

    // 严格正则验证
    if (!WECHAT_WORK_API_URL_PATTERN.test(apiUrl)) {
      logger.warn({ apiUrl: apiUrl.substring(0, 40) + '...' }, 'Invalid Server酱 API URL format, rejecting');
      return false;
    }

    // 二次验证域名（SSRF 防护）
    try {
      const parsedUrl = new URL(apiUrl);
      const hostname = parsedUrl.hostname;
      // 必须以 push.ft07.com 结尾（支持子域名）
      if (!hostname.endsWith('.' + ALLOWED_HOST) && hostname !== ALLOWED_HOST) {
        logger.warn({ hostname }, 'Invalid hostname, must be push.ft07.com subdomain');
        return false;
      }
      return true;
    } catch {
      logger.warn({ apiUrl }, 'Failed to parse API URL');
      return false;
    }
  }

  /**
   * 发送微信通知
   * 失败时仅记录日志，不抛出异常
   *
   * @param title 消息标题
   * @param tool 工具名称
   * @param message 详细消息
   */
  async sendNotification(title: string, tool: string, message: string): Promise<void> {
    if (!this.validatedApiUrl) {
      logger.warn('WeChat API URL is empty or invalid, skipping notification');
      return;
    }

    // 构造 Markdown 消息（与钉钉格式一致）
    const desp = `### ${title}\n\n**Tool**: ${tool}\n\n**Message**: ${message}\n\n---\nPlease respond promptly`;

    const payload = {
      title,
      desp,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.validatedApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          { status: response.status, body: text },
          'WeChat notification failed with HTTP error'
        );
        return;
      }

      const result = (await response.json()) as { code?: number; message?: string; data?: { error?: string } };
      // Server酱返回格式：{ code: 0, message: "...", data: { ... } }
      // code 为 0 表示成功，其他值表示失败
      if (result.code !== 0) {
        logger.error(
          { code: result.code, message: result.message, error: result.data?.error },
          'WeChat notification failed with API error'
        );
        return;
      }

      logger.info({ title, tool }, 'WeChat notification sent successfully');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error({ timeout: REQUEST_TIMEOUT_MS }, 'WeChat notification timed out');
      } else {
        logger.error({ err, title, tool }, 'WeChat notification failed with exception');
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}