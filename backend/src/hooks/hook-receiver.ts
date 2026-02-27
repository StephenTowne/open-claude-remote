import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ApprovalRequest } from '@claude-remote/shared';
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

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'approval' events when a permission_prompt notification arrives.
 */
export class HookReceiver extends EventEmitter {
  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): ApprovalRequest | null {
    logger.info({ payload }, 'Hook received');

    // Extract tool name: prefer explicit tool_name, then parse from message
    const toolName = payload.tool_name
      ?? this.extractToolFromMessage(payload.message)
      ?? 'unknown_tool';

    const description = payload.message
      ?? (payload.tool_name ? `Tool call: ${payload.tool_name}` : 'Approval requested (no details provided)');

    const approval: ApprovalRequest = {
      id: randomUUID(),
      tool: String(toolName),
      description: String(description),
      params: payload.tool_input,
    };

    logger.info({ approvalId: approval.id, tool: approval.tool }, 'Approval request created from hook');
    this.emit('approval', approval);
    return approval;
  }

  private extractToolFromMessage(message?: string): string | null {
    if (!message) return null;
    const match = PERMISSION_TOOL_RE.exec(message);
    return match ? match[1] : null;
  }
}
