import { logger } from '../logger/logger.js';

/**
 * 钉钉群机器人 Webhook 通知服务
 * 参考文档: https://open.dingtalk.com/document/robots/custom-robot-access
 */
export class DingtalkService {
  constructor(private webhookUrl: string) {}

  /**
   * 发送钉钉通知
   * 失败时仅记录日志，不抛出异常
   *
   * @param title 消息标题
   * @param tool 工具名称
   * @param message 详细消息
   */
  async sendNotification(title: string, tool: string, message: string): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('Dingtalk webhook URL is empty, skipping notification');
      return;
    }

    const payload = {
      msgtype: 'markdown',
      markdown: {
        title,
        text: `### ${title}\n\n**工具**: ${tool}\n\n**消息**: ${message}\n\n---\n请及时处理`,
      },
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          { status: response.status, body: text },
          'Dingtalk notification failed with HTTP error'
        );
        return;
      }

      const result = await response.json() as { errcode?: number; errmsg?: string };
      if (result.errcode !== 0) {
        logger.error(
          { errcode: result.errcode, errmsg: result.errmsg },
          'Dingtalk notification failed with API error'
        );
        return;
      }

      logger.info({ title, tool }, 'Dingtalk notification sent successfully');
    } catch (err) {
      logger.error({ err, title, tool }, 'Dingtalk notification failed with exception');
    }
  }
}