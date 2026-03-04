import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';
import {
  type HookPayload,
  type PermissionRequestPayload,
  type NotificationPayload,
  type PreToolUsePayload,
  type SessionEndPayload,
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
const ALL_CHANNELS: NotificationChannel[] = ['websocket', 'push', 'dingtalk'];
// 仅 WebSocket 通知
const WEBSOCKET_ONLY: NotificationChannel[] = ['websocket'];

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
      case 'PermissionRequest':
        return this.handlePermissionRequest(payload as PermissionRequestPayload);

      case 'Notification':
        return this.handleNotification(payload as NotificationPayload);

      case 'PreToolUse':
        return this.handlePreToolUse(payload as PreToolUsePayload);

      case 'SessionEnd':
        return this.handleSessionEnd(payload as SessionEndPayload);

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
   * 处理权限审批请求
   */
  private handlePermissionRequest(payload: PermissionRequestPayload): HookResult {
    const toolName = payload.tool_name || 'unknown';
    const toolInput = payload.tool_input;

    let message = `Claude requests to use tool: ${toolName}`;
    const detail = this.formatToolInput(toolInput);

    // 根据工具类型生成更具体的消息
    if (toolName === 'Bash' && toolInput?.command) {
      message = `Claude requests to execute command: ${toolInput.command}`;
    } else if (toolName === 'Write' && toolInput?.file_path) {
      message = `Claude requests to write file: ${toolInput.file_path}`;
    } else if (toolName === 'Edit' && toolInput?.file_path) {
      message = `Claude requests to edit file: ${toolInput.file_path}`;
    }

    const notification: HookNotification = {
      eventType: HookEventType.PERMISSION_REQUEST,
      channels: ALL_CHANNELS,
      tool: toolName,
      title: `Approval Required: ${toolName}`,
      message,
      detail,
    };

    logger.info({ tool: toolName, eventType: 'PermissionRequest' }, 'Permission request notification created');
    this.emit('notification', notification);
    return { type: 'notification', notification };
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
   * 处理 PreToolUse 事件（仅处理 AskUserQuestion）
   */
  private handlePreToolUse(payload: PreToolUsePayload): HookResult {
    // 仅处理 AskUserQuestion 工具
    if (payload.tool_name !== 'AskUserQuestion') {
      logger.debug(
        { toolName: payload.tool_name },
        'PreToolUse event ignored (not AskUserQuestion)'
      );
      return { type: 'ignored' };
    }

    // 提取问题内容
    const questions = payload.tool_input?.questions as
      | Array<{ question: string }>
      | undefined;
    const questionText = questions
      ?.map(q => q.question)
      .join('; ') || 'Waiting for your response';

    const notification: HookNotification = {
      eventType: HookEventType.NOTIFICATION,
      channels: ALL_CHANNELS,
      tool: 'AskUserQuestion',
      title: 'Waiting for Your Response',
      message: questionText,
    };

    logger.info(
      { questionCount: questions?.length || 0 },
      'AskUserQuestion notification created'
    );
    this.emit('notification', notification);
    return { type: 'notification', notification };
  }

  /**
   * 处理会话结束事件
   */
  private handleSessionEnd(payload: SessionEndPayload): HookResult {
    const { reason } = payload;

    const notification: HookNotification = {
      eventType: HookEventType.SESSION_ENDED,
      channels: WEBSOCKET_ONLY,
      tool: 'session',
      title: 'Session Ended',
      message: this.formatSessionEndReason(reason),
    };

    logger.info({ reason }, 'Session end notification created');
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

  /**
   * 格式化工具输入参数为可读字符串
   */
  private formatToolInput(toolInput?: Record<string, unknown>): string | undefined {
    if (!toolInput || Object.keys(toolInput).length === 0) {
      return undefined;
    }

    const parts: string[] = [];
    for (const [key, value] of Object.entries(toolInput)) {
      if (key === 'command' && typeof value === 'string') {
        parts.push(`Command: ${value}`);
      } else if (key === 'file_path' && typeof value === 'string') {
        parts.push(`File: ${value}`);
      } else if (key === 'pattern' && typeof value === 'string') {
        parts.push(`Pattern: ${value}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  /**
   * 格式化会话结束原因
   */
  private formatSessionEndReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      clear: 'Session cleared (/clear)',
      logout: 'User logged out',
      prompt_input_exit: 'User exited during input prompt',
      bypass_permissions_disabled: 'Bypass permissions mode disabled',
      other: 'Session ended',
    };

    return reasonMap[reason] || `Session ended: ${reason}`;
  }
}