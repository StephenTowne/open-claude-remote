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

  it('should ignore PreToolUse events', () => {
    const receiver = new HookReceiver();
    const notificationHandler = vi.fn();
    receiver.on('notification', notificationHandler);

    const result = receiver.processHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Q?', options: [{ label: 'A' }] }] },
    });

    expect(result.type).toBe('ignored');
    expect(notificationHandler).not.toHaveBeenCalled();
  });
});
