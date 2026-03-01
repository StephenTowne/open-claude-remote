import { EventEmitter } from 'node:events';
import type { Question, PermissionSuggestion, PermissionDecision } from '@claude-remote/shared';
import { logger } from '../logger/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * Raw hook payload from Claude Code hooks (Notification / PreToolUse / PermissionRequest).
 */
export interface HookPayload {
  message?: string;
  notification_type?: string;
  hook_event_name?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  permission_suggestions?: PermissionSuggestion[];
  [key: string]: unknown;
}

interface AskQuestionEventPayload {
  sessionId?: string;
  questions: Question[];
}

/**
 * Permission request event emitted from hook processing.
 */
export interface PermissionRequestEvent {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  permissionSuggestions?: PermissionSuggestion[];
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
  type: 'notification' | 'ask_question' | 'permission_request' | 'ignored';
  notification?: HookNotification;
  permissionRequest?: PermissionRequestEvent;
}

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

const PERMISSION_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'notification' events for permission prompts,
 * 'ask_question' events for AskUserQuestion tool calls,
 * and 'permission_request' events for PermissionRequest hooks.
 */
export class HookReceiver extends EventEmitter {
  private pendingRequests = new Map<string, {
    resolve: (decision: PermissionDecision | null) => void;
    timeout: NodeJS.Timeout;
  }>();

  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): HookResult {
    logger.info({ payload }, 'Hook received');

    // PermissionRequest: handle permission request with async decision
    if (payload.hook_event_name === 'PermissionRequest') {
      const event: PermissionRequestEvent = {
        requestId: randomUUID(),
        toolName: String(payload.tool_name ?? 'unknown'),
        toolInput: (payload.tool_input as Record<string, unknown>) ?? {},
        permissionSuggestions: payload.permission_suggestions,
      };

      logger.info({
        requestId: event.requestId,
        toolName: event.toolName,
        hasSuggestions: !!event.permissionSuggestions,
      }, 'PermissionRequest hook received');
      this.emit('permission_request', event);
      return { type: 'permission_request', permissionRequest: event };
    }

    // PreToolUse: intercept AskUserQuestion to get structured question data
    if (payload.hook_event_name === 'PreToolUse') {
      if (payload.tool_name === 'AskUserQuestion') {
        const askPayload = this.parseAskQuestionPayload(payload);
        if (!askPayload) {
          logger.warn({ sessionId: payload.session_id }, 'Invalid AskUserQuestion payload ignored');
          return { type: 'ignored' };
        }

        logger.info({
          sessionId: askPayload.sessionId,
          questionCount: askPayload.questions.length,
        }, 'AskUserQuestion hook received');
        this.emit('ask_question', askPayload);
        return { type: 'ask_question' };
      }
      logger.debug({ toolName: payload.tool_name }, 'PreToolUse for non-AskUserQuestion tool ignored');
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

  /**
   * Wait for user decision on a permission request.
   * Returns null on timeout.
   */
  async waitForDecision(requestId: string, timeoutMs: number = PERMISSION_REQUEST_TIMEOUT_MS): Promise<PermissionDecision | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        logger.warn({ requestId }, 'Permission request timed out');
        resolve(null);
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: (decision) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          resolve(decision);
        },
        timeout,
      });
    });
  }

  /**
   * Submit a decision for a pending permission request.
   * Called from WebSocket handler when user responds.
   */
  submitDecision(requestId: string, decision: PermissionDecision): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      logger.info({ requestId, behavior: decision.behavior }, 'Permission decision submitted');
      pending.resolve(decision);
    } else {
      logger.warn({ requestId }, 'No pending permission request found for decision');
    }
  }

  private extractToolFromMessage(message?: string): string | null {
    if (!message) return null;
    const match = PERMISSION_TOOL_RE.exec(message);
    return match ? match[1] : null;
  }

  private parseAskQuestionPayload(payload: HookPayload): AskQuestionEventPayload | null {
    const rawQuestions = payload.tool_input?.questions;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return null;
    }

    for (const rawQuestion of rawQuestions) {
      if (!rawQuestion || typeof rawQuestion !== 'object') {
        return null;
      }

      const questionRecord = rawQuestion as Record<string, unknown>;
      if (typeof questionRecord.question !== 'string' || questionRecord.question.trim().length === 0) {
        return null;
      }

      if (!Array.isArray(questionRecord.options) || questionRecord.options.length === 0) {
        return null;
      }

      for (const rawOption of questionRecord.options) {
        if (!rawOption || typeof rawOption !== 'object') {
          return null;
        }
        const optionRecord = rawOption as Record<string, unknown>;
        if (typeof optionRecord.label !== 'string' || optionRecord.label.trim().length === 0) {
          return null;
        }
      }
    }

    const questions = rawQuestions as Question[];
    return {
      sessionId: typeof payload.session_id === 'string' && payload.session_id.length > 0
        ? payload.session_id
        : undefined,
      questions,
    };
  }
}
