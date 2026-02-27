import { describe, it, expect, vi } from 'vitest';
import { HookReceiver } from '../../../src/hooks/hook-receiver.js';

describe('HookReceiver', () => {
  it('should extract tool name from real Claude Code notification payload', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('approval', handler);

    // Real payload from Claude Code Notification hook
    const payload = {
      session_id: 'd4fc2964-efd9-4aeb-8d10-17555e83eef2',
      hook_event_name: 'Notification',
      message: 'Claude needs your permission to use Read',
      notification_type: 'permission_prompt',
    };

    const approval = receiver.processHook(payload);

    expect(approval).not.toBeNull();
    expect(approval!.tool).toBe('Read');
    expect(approval!.description).toBe('Claude needs your permission to use Read');
    expect(approval!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(handler).toHaveBeenCalledWith(approval);
  });

  it('should extract tool name for Bash tool', () => {
    const receiver = new HookReceiver();
    const approval = receiver.processHook({
      message: 'Claude needs your permission to use Bash',
      notification_type: 'permission_prompt',
    });

    expect(approval!.tool).toBe('Bash');
  });

  it('should extract tool name for Write tool', () => {
    const receiver = new HookReceiver();
    const approval = receiver.processHook({
      message: 'Claude needs your permission to use Write',
      notification_type: 'permission_prompt',
    });

    expect(approval!.tool).toBe('Write');
  });

  it('should fallback to legacy tool_name field if present', () => {
    const receiver = new HookReceiver();
    const payload = {
      message: 'Claude wants to run: ls -la',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    };

    const approval = receiver.processHook(payload);

    expect(approval!.tool).toBe('Bash');
    expect(approval!.description).toBe('Claude wants to run: ls -la');
    expect(approval!.params).toEqual({ command: 'ls -la' });
  });

  it('should handle minimal payload with friendly description', () => {
    const receiver = new HookReceiver();
    const approval = receiver.processHook({});

    expect(approval).not.toBeNull();
    expect(approval!.tool).toBe('unknown_tool');
    expect(approval!.description).toBe('Approval requested (no details provided)');
  });

  it('should generate unique IDs for each request', () => {
    const receiver = new HookReceiver();
    const a1 = receiver.processHook({ message: 'test1' });
    const a2 = receiver.processHook({ message: 'test2' });
    expect(a1!.id).not.toBe(a2!.id);
  });
});
