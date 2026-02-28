import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';

/**
 * Raw hook payload from Claude Code Notification hook.
 * Real payloads include: session_id, hook_event_name, message, notification_type, cwd, transcript_path.
 * The tool name is embedded in the message field: "Claude needs your permission to use <ToolName>"
 */
export interface HookPayload {
  message?: string;
  notification_type?: string;
  hook_event_name?: string;
  session_id?: string;
  // Legacy fields (may exist in older Claude Code versions)
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Simplified notification info emitted from hook processing.
 */
export interface HookNotification {
  tool: string;
  message: string;
}

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'notification' events when a hook arrives.
 */
export class HookReceiver extends EventEmitter {
  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): HookNotification | null {
    logger.info({ payload }, 'Hook received');

    if (payload.notification_type && payload.notification_type !== 'permission_prompt') {
      logger.debug({ notificationType: payload.notification_type }, 'Non-permission hook ignored');
      return null;
    }

    // Extract tool name: prefer explicit tool_name, then parse from message
    const toolName = payload.tool_name
      ?? this.extractToolFromMessage(payload.message)
      ?? 'unknown_tool';

    const message = payload.message
      ?? (payload.tool_name ? `Tool call: ${payload.tool_name}` : 'Approval requested (no details provided)');

    const notification: HookNotification = {
      tool: String(toolName),
      message: String(message),
    };

    logger.info({ tool: notification.tool }, 'Hook notification created');
    this.emit('notification', notification);
    return notification;
  }

  private extractToolFromMessage(message?: string): string | null {
    if (!message) return null;
    const match = PERMISSION_TOOL_RE.exec(message);
    return match ? match[1] : null;
  }
}
