import { EventEmitter } from 'node:events';
import type { Question } from '@claude-remote/shared';
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

interface AskQuestionEventPayload {
  sessionId?: string;
  questions: Question[];
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
  type: 'notification' | 'ask_question' | 'ignored';
  notification?: HookNotification;
}

// Pattern: "Claude needs your permission to use <ToolName>"
const PERMISSION_TOOL_RE = /permission to use (\S+)$/;

/**
 * Receives and parses Hook HTTP POST from Claude Code.
 * Emits 'notification' events for permission prompts,
 * and 'ask_question' events for AskUserQuestion tool calls.
 */
export class HookReceiver extends EventEmitter {
  /**
   * Process an incoming hook payload.
   */
  processHook(payload: HookPayload): HookResult {
    logger.info({ payload }, 'Hook received');

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
