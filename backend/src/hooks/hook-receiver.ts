import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';

/**
 * Raw hook payload from Claude Code hooks (Notification / PreToolUse).
 */
export interface HookPayload {
  message?: string;
  notification_type?: string;
  hook_event_name?: string;
  session_id?: string;
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

/**
 * Structured result from processHook.
 */
export interface HookResult {
  type: 'notification' | 'ignored';
  notification?: HookNotification;
}

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'notification' events for permission prompts.
 */
export class HookReceiver extends EventEmitter {
  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): HookResult {
    logger.info({ payload }, 'Hook received');

    // PreToolUse: ignore all PreToolUse events
    if (payload.hook_event_name === 'PreToolUse') {
      logger.debug({ toolName: payload.tool_name }, 'PreToolUse event ignored');
      return { type: 'ignored' };
    }

    // Notification: only handle permission_prompt
    if (payload.notification_type && payload.notification_type !== 'permission_prompt') {
      logger.debug({ notificationType: payload.notification_type }, 'Non-permission hook ignored');
      return { type: 'ignored' };
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
    return { type: 'notification', notification };
  }

  private extractToolFromMessage(message?: string): string | null {
    if (!message) return null;
    const match = PERMISSION_TOOL_RE.exec(message);
    return match ? match[1] : null;
  }
}
