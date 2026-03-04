import { describe, it, expect, vi } from 'vitest';
import { HookReceiver } from '../../../src/hooks/hook-receiver.js';
import { HookEventType } from '../../../src/hooks/hook-types.js';

describe('HookReceiver', () => {
  // ==============================
  // Notification 事件测试
  // ==============================
  describe('Notification event', () => {
    it('should extract tool name from real Claude Code notification payload', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const payload = {
        session_id: 'd4fc2964-efd9-4aeb-8d10-17555e83eef2',
        hook_event_name: 'Notification' as const,
        message: 'Claude needs your permission to use Read',
        notification_type: 'permission_prompt' as const,
      };

      const result = receiver.processHook(payload);

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('Read');
      expect(result.notification!.message).toBe('Claude needs your permission to use Read');
      expect(result.notification!.eventType).toBe(HookEventType.NOTIFICATION);
      expect(result.notification!.channels).toContain('websocket');
      expect(result.notification!.channels).toContain('push');
      expect(result.notification!.channels).toContain('dingtalk');
      expect(handler).toHaveBeenCalledWith(result.notification);
    });

    it('should extract tool name for Bash tool from permission_prompt', () => {
      const receiver = new HookReceiver();
      const result = receiver.processHook({
        hook_event_name: 'Notification',
        message: 'Claude needs your permission to use Bash',
        notification_type: 'permission_prompt',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('Bash');
    });

    it('should extract tool name for Write tool from permission_prompt', () => {
      const receiver = new HookReceiver();
      const result = receiver.processHook({
        hook_event_name: 'Notification',
        message: 'Claude needs your permission to use Write',
        notification_type: 'permission_prompt',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('Write');
    });

    it('should handle idle_prompt notification type', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'Notification',
        message: 'Claude is waiting for input',
        notification_type: 'idle_prompt',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.title).toBe('Claude Waiting for Input');
      expect(handler).toHaveBeenCalled();
    });

    it('should handle elicitation_dialog notification type', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'Notification',
        message: 'Please answer the question',
        notification_type: 'elicitation_dialog',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.title).toBe('Waiting for Your Response');
      expect(handler).toHaveBeenCalled();
    });

    it('should ignore non-interactive notification types', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'Notification',
        message: 'Claude has completed the task',
        notification_type: 'auth_success',
      });

      expect(result.type).toBe('ignored');
      expect(result.notification).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==============================
  // PermissionRequest 事件测试
  // ==============================
  describe('PermissionRequest event', () => {
    it('should handle PermissionRequest with tool details', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { command: 'npm test', description: 'Run tests' },
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('Bash');
      expect(result.notification!.eventType).toBe(HookEventType.PERMISSION_REQUEST);
      expect(result.notification!.message).toContain('npm test');
      expect(result.notification!.channels).toEqual(['websocket', 'push', 'dingtalk']);
      expect(handler).toHaveBeenCalled();
    });

    it('should generate appropriate message for Write tool', () => {
      const receiver = new HookReceiver();

      const result = receiver.processHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/file.ts', content: 'test' },
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.message).toContain('/path/to/file.ts');
    });

    it('should generate appropriate message for Edit tool', () => {
      const receiver = new HookReceiver();

      const result = receiver.processHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Edit',
        tool_input: { file_path: '/path/to/file.ts' },
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.message).toContain('edit file');
    });

    it('should handle unknown tool gracefully', () => {
      const receiver = new HookReceiver();

      const result = receiver.processHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'SomeUnknownTool',
        tool_input: { foo: 'bar' },
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('SomeUnknownTool');
    });
  });

  // ==============================
  // PreToolUse 事件测试
  // ==============================
  describe('PreToolUse event', () => {
    it('should handle AskUserQuestion tool', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'PreToolUse',
        tool_name: 'AskUserQuestion',
        tool_input: {
          questions: [
            { question: 'Which approach do you prefer?', options: [{ label: 'A' }] },
            { question: 'Continue?', options: [{ label: 'Yes' }] },
          ],
        },
        tool_use_id: 'tool_123',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.tool).toBe('AskUserQuestion');
      expect(result.notification!.message).toContain('Which approach do you prefer?');
      expect(result.notification!.message).toContain('Continue?');
      expect(result.notification!.channels).toEqual(['websocket', 'push', 'dingtalk']);
      expect(handler).toHaveBeenCalled();
    });

    it('should ignore other PreToolUse tools', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        tool_use_id: 'tool_123',
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==============================
  // SessionEnd 事件测试
  // ==============================
  describe('SessionEnd event', () => {
    it('should handle SessionEnd with known reason', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'SessionEnd',
        reason: 'logout',
      });

      expect(result.type).toBe('notification');
      expect(result.notification!.eventType).toBe(HookEventType.SESSION_ENDED);
      expect(result.notification!.tool).toBe('session');
      expect(result.notification!.message).toContain('logged out');
      // SessionEnd 只发送 WebSocket 通知
      expect(result.notification!.channels).toEqual(['websocket']);
      expect(handler).toHaveBeenCalled();
    });

    it('should format clear reason', () => {
      const receiver = new HookReceiver();

      const result = receiver.processHook({
        hook_event_name: 'SessionEnd',
        reason: 'clear',
      });

      expect(result.notification!.message).toContain('/clear');
    });

    it('should format unknown reason', () => {
      const receiver = new HookReceiver();

      const result = receiver.processHook({
        hook_event_name: 'SessionEnd',
        reason: 'unknown_reason',
      });

      expect(result.notification!.message).toContain('unknown_reason');
    });
  });

  // ==============================
  // Stop 事件测试
  // ==============================
  describe('Stop event', () => {
    it('should emit task_completed event on Stop', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('task_completed', handler);

      const result = receiver.processHook({
        hook_event_name: 'Stop',
        stop_hook_active: false,
        last_assistant_message: 'Task completed!',
      });

      // Stop 不发送 notification，而是触发 task_completed
      expect(result.type).toBe('ignored');
      expect(result.notification).toBeUndefined();
      expect(handler).toHaveBeenCalledWith({
        lastMessage: 'Task completed!',
      });
    });

    it('should not emit notification on Stop', () => {
      const receiver = new HookReceiver();
      const notificationHandler = vi.fn();
      receiver.on('notification', notificationHandler);

      receiver.processHook({
        hook_event_name: 'Stop',
        stop_hook_active: false,
      });

      expect(notificationHandler).not.toHaveBeenCalled();
    });
  });

  // ==============================
  // 未处理的事件类型测试
  // ==============================
  describe('Unhandled events', () => {
    it('should ignore SessionStart', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'SessionStart',
        source: 'startup',
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore UserPromptSubmit', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Hello',
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore PostToolUse', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/test' },
        tool_response: { content: 'file content' },
        tool_use_id: 'tool_123',
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore PostToolUseFailure', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'Bash',
        tool_input: { command: 'false' },
        error: 'Command failed',
        is_interrupt: false,
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore unknown hook_event_name', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        hook_event_name: 'UnknownEvent' as any,
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==============================
  // Payload 缺失字段测试
  // ==============================
  describe('Missing fields handling', () => {
    it('should ignore payload without hook_event_name', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({
        message: 'test',
      });

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle empty payload', () => {
      const receiver = new HookReceiver();
      const handler = vi.fn();
      receiver.on('notification', handler);

      const result = receiver.processHook({});

      expect(result.type).toBe('ignored');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});