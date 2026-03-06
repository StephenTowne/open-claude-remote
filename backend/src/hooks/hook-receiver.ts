import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';
import {
  type HookPayload,
  type NotificationPayload,
  type StopPayload,
  type HookNotification,
  type TaskCompletedData,
  type NotificationChannel,
  HookEventType,
  type NotificationType,
} from './hook-types.js';

/**
 * Structured result from processHook.
 */
export interface HookResult {
  type: 'notification' | 'action' | 'ignored';
  notification?: HookNotification;
  action?: {
    type: 'task_completed';
    data: TaskCompletedData;
  };
}

// 需要发送所有渠道通知的事件类型
const ALL_CHANNELS: NotificationChannel[] = ['websocket', 'push', 'dingtalk', 'wechat_work'];

// 需要处理的 Notification 类型
const INTERACTIVE_NOTIFICATION_TYPES: NotificationType[] = [
  'permission_prompt',
  'idle_prompt',
  'elicitation_dialog',
];

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'notification' events for user attention events.
 * Emits 'task_completed' events when Claude finishes responding.
 */
export class HookReceiver extends EventEmitter {
  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): HookResult {
    logger.info(
      { eventName: payload.hook_event_name },
      'Hook received'
    );

    switch (payload.hook_event_name) {
      case 'Notification':
        return this.handleNotification(payload as NotificationPayload);

      case 'Stop':
        return this.handleStop(payload as StopPayload);

      default:
        logger.debug(
          { eventName: payload.hook_event_name },
          'Hook event type not handled'
        );
        return { type: 'ignored' };
    }
  }

  /**
   * 处理通知事件
   */
  private handleNotification(payload: NotificationPayload): HookResult {
    const { notification_type, message, title } = payload;

    // 仅处理需要用户交互的通知类型
    if (!INTERACTIVE_NOTIFICATION_TYPES.includes(notification_type)) {
      logger.debug(
        { notificationType: notification_type },
        'Non-interactive notification ignored'
      );
      return { type: 'ignored' };
    }

    // 从消息中提取工具名
    const toolName = this.extractToolFromMessage(message) || 'claude';

    // 根据通知类型生成标题
    let notificationTitle: string;
    switch (notification_type) {
      case 'permission_prompt':
        notificationTitle = title || 'Approval Required';
        break;
      case 'idle_prompt':
        notificationTitle = title || 'Claude Waiting for Input';
        break;
      case 'elicitation_dialog':
        notificationTitle = title || 'Waiting for Your Response';
        break;
      default:
        notificationTitle = title || 'Claude Notification';
    }

    const notification: HookNotification = {
      eventType: HookEventType.NOTIFICATION,
      channels: ALL_CHANNELS,
      tool: toolName,
      title: notificationTitle,
      message,
    };

    logger.info(
      { tool: toolName, notificationType: notification_type },
      'Notification event processed'
    );
    this.emit('notification', notification);
    return { type: 'notification', notification };
  }

  /**
   * 处理任务完成事件
   * 不发送通知，而是触发 task_completed 事件以便 SessionController 更新状态
   */
  private handleStop(payload: StopPayload): HookResult {
    const data: TaskCompletedData = {
      lastMessage: payload.last_assistant_message,
    };

    logger.info('Stop event received, emitting task_completed');
    this.emit('task_completed', data);
    return { type: 'ignored' };
  }

  /**
   * 从消息中提取工具名
   * Pattern: "Claude needs your permission to use <ToolName>"
   */
  private extractToolFromMessage(message?: string): string | null {
    if (!message) return null;
    const match = PERMISSION_TOOL_RE.exec(message);
    return match ? match[1] : null;
  }
}