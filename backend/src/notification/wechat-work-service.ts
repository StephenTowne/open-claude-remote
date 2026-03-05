import { WECHAT_WORK_SENDKEY_PATTERN } from '#shared';
import { logger } from '../logger/logger.js';

/** Server酱允许的域名 */
const ALLOWED_HOSTS = ['sctapi.ftqq.com', 'push.ft07.com'];

/** HTTP 请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * 企业微信通知服务（Server酱实现）
 * 参考文档: https://sct.ftqq.com/
 */
export class WechatWorkService {
  private validatedSendkey: string | null = null;
  private apiUrl: string | null = null;

  constructor(private sendkey: string) {
    const result = this.validateSendkey(sendkey);
    this.validatedSendkey = result.validated;
    this.apiUrl = result.apiUrl;
  }

  /**
   * 验证 sendkey 并构建 API URL
   * - SCT 开头 → https://sctapi.ftqq.com/{sendkey}.send
   * - sctp 开头 → https://{sendkey}.push.ft07.com/send
   */
  private validateSendkey(sendkey: string): { validated: string | null; apiUrl: string | null } {
    if (!sendkey) {
      return { validated: null, apiUrl: null };
    }

    // 严格正则验证：仅允许字母数字，防止特殊字符构造恶意 URL
    if (!WECHAT_WORK_SENDKEY_PATTERN.test(sendkey)) {
      logger.warn({ sendkey: sendkey.substring(0, 8) + '...' }, 'Invalid sendkey format, rejecting');
      return { validated: null, apiUrl: null };
    }

    // 标准 sendkey (SCT...)
    if (sendkey.startsWith('SCT')) {
      return {
        validated: sendkey,
        apiUrl: `https://sctapi.ftqq.com/${sendkey}.send`,
      };
    }

    // Turbo sendkey (sctp...)
    return {
      validated: sendkey,
      apiUrl: `https://${sendkey}.push.ft07.com/send`,
    };
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
    if (!this.validatedSendkey || !this.apiUrl) {
      logger.warn('WeChat sendkey is empty or invalid, skipping notification');
      return;
    }

    // SSRF 防护：验证 URL 域名
    try {
      const parsedUrl = new URL(this.apiUrl);
      const hostname = parsedUrl.hostname;
      // 检查是否以允许的域名结尾（支持子域名）
      const isAllowed = ALLOWED_HOSTS.some(allowed =>
        hostname === allowed || hostname.endsWith('.' + allowed)
      );
      if (!isAllowed) {
        logger.warn({ hostname }, 'Invalid WeChat API hostname, rejecting for SSRF protection');
        return;
      }
    } catch {
      logger.warn({ apiUrl: this.apiUrl }, 'Invalid WeChat API URL format, rejecting');
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
      const response = await fetch(this.apiUrl, {
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