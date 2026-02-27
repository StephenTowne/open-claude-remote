import { describe, it, expect, vi } from 'vitest';
import { HookReceiver } from '../../../src/hooks/hook-receiver.js';

describe('HookReceiver', () => {
  it('should process hook payload and emit approval event', () => {
    const receiver = new HookReceiver();
    const handler = vi.fn();
    receiver.on('approval', handler);

    const payload = {
      message: 'Claude wants to run: ls -la',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    };

    const approval = receiver.processHook(payload);

    expect(approval).not.toBeNull();
    expect(approval!.tool).toBe('Bash');
    expect(approval!.description).toBe('Claude wants to run: ls -la');
    expect(approval!.params).toEqual({ command: 'ls -la' });
    expect(approval!.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(handler).toHaveBeenCalledWith(approval);
  });

  it('should handle minimal payload with friendly description', () => {
    const receiver = new HookReceiver();
    const approval = receiver.processHook({});

    expect(approval).not.toBeNull();
    expect(approval!.tool).toBe('unknown_tool');
    expect(approval!.description).toBe('Approval requested (no details provided)');
  });

  it('should use tool_name in description when message is missing', () => {
    const receiver = new HookReceiver();
    const approval = receiver.processHook({ tool_name: 'Write' });

    expect(approval).not.toBeNull();
    expect(approval!.description).toBe('Tool call: Write');
  });

  it('should generate unique IDs for each request', () => {
    const receiver = new HookReceiver();
    const a1 = receiver.processHook({ message: 'test1' });
    const a2 = receiver.processHook({ message: 'test2' });
    expect(a1!.id).not.toBe(a2!.id);
  });
});
