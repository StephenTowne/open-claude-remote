import { describe, it, expect, vi } from 'vitest';
import { HookReceiver } from '../../../src/hooks/hook-receiver.js';

describe('HookReceiver', () => {
  it('should extract tool name from real Claude Code notification payload', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('notification', handler);

    const payload = {
      session_id: 'd4fc2964-efd9-4aeb-8d10-17555e83eef2',
      hook_event_name: 'Notification',
      message: 'Claude needs your permission to use Read',
      notification_type: 'permission_prompt',
    };

    const result = receiver.processHook(payload);

    expect(result.type).toBe('notification');
    expect(result.notification!.tool).toBe('Read');
    expect(result.notification!.message).toBe('Claude needs your permission to use Read');
    expect(handler).toHaveBeenCalledWith(result.notification);
  });

  it('should extract tool name for Bash tool', () => {
    const receiver = new HookReceiver();
    const result = receiver.processHook({
      message: 'Claude needs your permission to use Bash',
      notification_type: 'permission_prompt',
    });

    expect(result.type).toBe('notification');
    expect(result.notification!.tool).toBe('Bash');
  });

  it('should extract tool name for Write tool', () => {
    const receiver = new HookReceiver();
    const result = receiver.processHook({
      message: 'Claude needs your permission to use Write',
      notification_type: 'permission_prompt',
    });

    expect(result.type).toBe('notification');
    expect(result.notification!.tool).toBe('Write');
  });

  it('should fallback to legacy tool_name field if present', () => {
    const receiver = new HookReceiver();
    const payload = {
      message: 'Claude wants to run: ls -la',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    };

    const result = receiver.processHook(payload);

    expect(result.type).toBe('notification');
    expect(result.notification!.tool).toBe('Bash');
    expect(result.notification!.message).toBe('Claude wants to run: ls -la');
  });

  it('should handle minimal payload with friendly message', () => {
    const receiver = new HookReceiver();
    const result = receiver.processHook({});

    expect(result.type).toBe('notification');
    expect(result.notification!.tool).toBe('unknown_tool');
    expect(result.notification!.message).toBe('Approval requested (no details provided)');
  });

  it('should emit notification event', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('notification', handler);

    receiver.processHook({ message: 'test' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should ignore non-permission notification_type payload', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('notification', handler);

    const result = receiver.processHook({
      message: 'Claude has completed the task',
      notification_type: 'task_complete',
    });

    expect(result.type).toBe('ignored');
    expect(result.notification).toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  // ---- PreToolUse + AskUserQuestion tests ----

  it('should emit ask_question event for PreToolUse AskUserQuestion payload', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('ask_question', handler);

    const payload = {
      hook_event_name: 'PreToolUse',
      session_id: 'session-123',
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          {
            question: 'Which library?',
            header: 'Library',
            options: [
              { label: 'React', description: 'UI library' },
              { label: 'Vue', description: 'Progressive framework' },
            ],
            multiSelect: false,
          },
        ],
      },
    };

    const result = receiver.processHook(payload);

    expect(result.type).toBe('ask_question');
    expect(result.notification).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      sessionId: 'session-123',
      questions: payload.tool_input.questions,
    });
  });

  it('should ignore PreToolUse for non-AskUserQuestion tools', () => {
    const receiver = new HookReceiver();
    const askHandler = vi.fn();
    const notificationHandler = vi.fn();
    receiver.on('ask_question', askHandler);
    receiver.on('notification', notificationHandler);

    const result = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });

    expect(result.type).toBe('ignored');
    expect(askHandler).not.toHaveBeenCalled();
    expect(notificationHandler).not.toHaveBeenCalled();
  });

  it('should not affect Notification permission_prompt flow when PreToolUse is used', () => {
    const receiver = new HookReceiver();
    const askHandler = vi.fn();
    const notificationHandler = vi.fn();
    receiver.on('ask_question', askHandler);
    receiver.on('notification', notificationHandler);

    // First: PreToolUse AskUserQuestion
    const askResult = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Q?', options: [{ label: 'A' }] }] },
    });
    expect(askResult.type).toBe('ask_question');
    expect(askHandler).toHaveBeenCalledOnce();

    // Then: Notification permission_prompt
    const notifResult = receiver.processHook({
      hook_event_name: 'Notification',
      message: 'Claude needs your permission to use Bash',
      notification_type: 'permission_prompt',
    });
    expect(notifResult.type).toBe('notification');
    expect(notificationHandler).toHaveBeenCalledOnce();
  });

  it('should ignore malformed AskUserQuestion payload when questions is not an array', () => {
    const receiver = new HookReceiver();
    const askHandler = vi.fn();
    receiver.on('ask_question', askHandler);

    const result = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: 'invalid' },
    });

    expect(result.type).toBe('ignored');
    expect(askHandler).not.toHaveBeenCalled();
  });

  it('should ignore malformed AskUserQuestion payload when question options are invalid', () => {
    const receiver = new HookReceiver();
    const askHandler = vi.fn();
    receiver.on('ask_question', askHandler);

    const result = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          {
            question: 'Q?',
            options: [{ description: 'missing label' }],
          },
        ],
      },
    });

    expect(result.type).toBe('ignored');
    expect(askHandler).not.toHaveBeenCalled();
  });

  it('should ignore malformed AskUserQuestion payload when question text is blank', () => {
    const receiver = new HookReceiver();
    const askHandler = vi.fn();
    receiver.on('ask_question', askHandler);

    const result = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          {
            question: '   ',
            options: [{ label: 'A' }],
          },
        ],
      },
    });

    expect(result.type).toBe('ignored');
    expect(askHandler).not.toHaveBeenCalled();
  });
});
