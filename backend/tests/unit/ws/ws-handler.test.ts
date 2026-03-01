import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWsMessage, type WsHandlerCallbacks } from '../../../src/ws/ws-handler.js';

// Minimal WebSocket mock
function createMockWs() {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
  } as any;
}

describe('WS Handler', () => {
  let callbacks: WsHandlerCallbacks;

  beforeEach(() => {
    callbacks = {
      onUserInput: vi.fn(),
      onResize: vi.fn(),
    };
  });

  it('should route user_input messages', () => {
    const ws = createMockWs();
    handleWsMessage(ws, JSON.stringify({ type: 'user_input', data: 'hello' }), callbacks);
    expect(callbacks.onUserInput).toHaveBeenCalledWith('hello');
  });

  it('should route resize messages', () => {
    const ws = createMockWs();
    handleWsMessage(ws, JSON.stringify({ type: 'resize', cols: 120, rows: 40 }), callbacks);
    expect(callbacks.onResize).toHaveBeenCalledWith(120, 40);
  });

  it('should reply to heartbeat messages', () => {
    const ws = createMockWs();
    handleWsMessage(ws, JSON.stringify({ type: 'heartbeat', timestamp: 123 }), callbacks);
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('heartbeat');
    expect(typeof sent.timestamp).toBe('number');
  });

  it('should handle invalid JSON gracefully', () => {
    const ws = createMockWs();
    // Should not throw
    handleWsMessage(ws, 'not json', callbacks);
    expect(callbacks.onUserInput).not.toHaveBeenCalled();
  });

  it('should ignore unknown message types', () => {
    const ws = createMockWs();
    handleWsMessage(ws, JSON.stringify({ type: 'unknown_type' }), callbacks);
    expect(callbacks.onUserInput).not.toHaveBeenCalled();
  });

  it('should validate user_input has string data', () => {
    const ws = createMockWs();
    handleWsMessage(ws, JSON.stringify({ type: 'user_input', data: 123 }), callbacks);
    expect(callbacks.onUserInput).not.toHaveBeenCalled();
  });

  // ---- permission_decision tests ----

  it('should route valid permission_decision with allow', () => {
    const ws = createMockWs();
    const onPermissionDecision = vi.fn();
    const cb = { ...callbacks, onPermissionDecision };

    handleWsMessage(ws, JSON.stringify({
      type: 'permission_decision',
      requestId: 'req-1',
      behavior: 'allow',
    }), cb);

    expect(onPermissionDecision).toHaveBeenCalledWith('req-1', {
      behavior: 'allow',
      updatedPermissions: undefined,
    });
  });

  it('should route valid permission_decision with deny', () => {
    const ws = createMockWs();
    const onPermissionDecision = vi.fn();
    const cb = { ...callbacks, onPermissionDecision };

    handleWsMessage(ws, JSON.stringify({
      type: 'permission_decision',
      requestId: 'req-2',
      behavior: 'deny',
    }), cb);

    expect(onPermissionDecision).toHaveBeenCalledWith('req-2', {
      behavior: 'deny',
      updatedPermissions: undefined,
    });
  });

  it('should reject permission_decision with invalid behavior value', () => {
    const ws = createMockWs();
    const onPermissionDecision = vi.fn();
    const cb = { ...callbacks, onPermissionDecision };

    handleWsMessage(ws, JSON.stringify({
      type: 'permission_decision',
      requestId: 'req-3',
      behavior: 'approve_everything',
    }), cb);

    expect(onPermissionDecision).not.toHaveBeenCalled();
  });

  it('should reject permission_decision with missing requestId', () => {
    const ws = createMockWs();
    const onPermissionDecision = vi.fn();
    const cb = { ...callbacks, onPermissionDecision };

    handleWsMessage(ws, JSON.stringify({
      type: 'permission_decision',
      behavior: 'allow',
    }), cb);

    expect(onPermissionDecision).not.toHaveBeenCalled();
  });

  it('should pass updatedPermissions when provided', () => {
    const ws = createMockWs();
    const onPermissionDecision = vi.fn();
    const cb = { ...callbacks, onPermissionDecision };

    const suggestions = [{ type: 'allow', tool: 'Bash' }];
    handleWsMessage(ws, JSON.stringify({
      type: 'permission_decision',
      requestId: 'req-4',
      behavior: 'allow',
      updatedPermissions: suggestions,
    }), cb);

    expect(onPermissionDecision).toHaveBeenCalledWith('req-4', {
      behavior: 'allow',
      updatedPermissions: suggestions,
    });
  });
});
