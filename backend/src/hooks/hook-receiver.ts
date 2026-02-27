import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ApprovalRequest } from '@claude-remote/shared';
import { logger } from '../logger/logger.js';

/**
 * Raw hook payload from Claude Code Notification hook.
 * The notification hook sends JSON with a "message" field.
 */
export interface HookPayload {
  type?: string;
  message?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

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

    // Claude Code notification hooks send a message describing what needs approval
    const toolName = payload.tool_name ?? 'unknown_tool';
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
}
