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
});
