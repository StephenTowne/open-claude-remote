import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';

// Store mock instances for access in tests
const mockWsInstances: Array<EventEmitter & { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = [];

// Mock WebSocket before importing VirtualPtyManager
vi.mock('ws', () => ({
  WebSocket: class MockWebSocket extends EventEmitter {
    send = vi.fn();
    close = vi.fn();

    constructor() {
      super();
      mockWsInstances.push(this);
    }
  },
}));

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { VirtualPtyManager } from '../../../src/pty/virtual-pty.js';

type MockWsType = EventEmitter & { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

function getLastMockWs(): MockWsType | undefined {
  return mockWsInstances[mockWsInstances.length - 1];
}

describe('VirtualPtyManager', () => {
  let virtualPty: VirtualPtyManager;

  beforeEach(() => {
    virtualPty = new VirtualPtyManager();
    mockWsInstances.length = 0;
  });

  afterEach(() => {
    virtualPty.destroy();
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should resolve on WS open', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();

      // Trigger open event
      ws?.emit('open');

      await expect(connectPromise).resolves.toBeUndefined();
      expect(virtualPty.connected).toBe(true);
    });

    it('should reject on WS error before open', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();

      // Trigger error event before open
      const testError = new Error('Connection refused');
      ws?.emit('error', testError);

      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(virtualPty.connected).toBe(false);
    });

    it('should have correct initial state', () => {
      expect(virtualPty.cols).toBe(80);
      expect(virtualPty.rows).toBe(24);
      expect(virtualPty.connected).toBe(false);
    });
  });

  describe('error handling (P0 verification)', () => {
    it('should emit "error" when WS errors after connection established', async () => {
      const errorHandler = vi.fn();
      virtualPty.on('error', errorHandler);

      // Connect first
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      // Now error after connection
      const testError = new Error('Connection lost');
      ws?.emit('error', testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
      expect(virtualPty.connected).toBe(false);
    });

    it('should reject when WS errors before connection (not emit)', async () => {
      const errorHandler = vi.fn();
      virtualPty.on('error', errorHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();

      // Error before open
      const testError = new Error('Connection refused');
      ws?.emit('error', testError);

      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('write', () => {
    it('should send user_input JSON when connected', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      virtualPty.write('hello');

      expect(ws?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'user_input', data: 'hello' })
      );
    });

    it('should skip when not connected', () => {
      // Don't connect, just write
      virtualPty.write('hello');
      // No WebSocket should have been created
      expect(mockWsInstances.length).toBe(0);
    });
  });

  describe('resize', () => {
    it('should send resize JSON and update cols/rows', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      virtualPty.resize(120, 40);

      expect(virtualPty.cols).toBe(120);
      expect(virtualPty.rows).toBe(40);
      expect(ws?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'resize', cols: 120, rows: 40 })
      );
    });
  });

  describe('message handling', () => {
    it('should emit "data" on terminal_output', async () => {
      const dataHandler = vi.fn();
      virtualPty.on('data', dataHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'terminal_output',
        data: 'test output',
      })));

      expect(dataHandler).toHaveBeenCalledWith('test output');
    });

    it('should emit "data" on history_sync', async () => {
      const dataHandler = vi.fn();
      virtualPty.on('data', dataHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'history_sync',
        data: 'history data',
      })));

      expect(dataHandler).toHaveBeenCalledWith('history data');
    });

    it('should ignore status_update', async () => {
      const dataHandler = vi.fn();
      virtualPty.on('data', dataHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'status_update',
        status: 'running',
      })));

      expect(dataHandler).not.toHaveBeenCalled();
    });

    it('should emit "exit" on session_ended message', async () => {
      const exitHandler = vi.fn();
      virtualPty.on('exit', exitHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'session_ended',
        exitCode: 0,
        reason: 'Process exited normally',
      })));

      expect(exitHandler).toHaveBeenCalledWith(0);
    });

    it('should emit "exit" with non-zero code on session_ended', async () => {
      const exitHandler = vi.fn();
      virtualPty.on('exit', exitHandler);

      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'session_ended',
        exitCode: 1,
        reason: 'Process exited with code 1',
      })));

      expect(exitHandler).toHaveBeenCalledWith(1);
    });

    it('should update local size on history_sync when server size differs (slave mode)', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      // Set local size first (simulating PC terminal size)
      virtualPty.resize(100, 30);
      expect(ws?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'resize', cols: 100, rows: 30 })
      );

      // Clear mock for next assertion
      (ws?.send as ReturnType<typeof vi.fn>).mockClear();

      // Listen for resize event to notify local terminal
      const resizeHandler = vi.fn();
      virtualPty.on('resize', resizeHandler);

      // Server sends history_sync with different size (from webapp master)
      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'history_sync',
        data: 'history data',
        cols: 80,
        rows: 24,
      })));

      // As slave, should update local size to match server (webapp master), not send resize
      expect(ws?.send).not.toHaveBeenCalled();
      expect(virtualPty.cols).toBe(80);
      expect(virtualPty.rows).toBe(24);
      // Should emit resize event to notify local terminal
      expect(resizeHandler).toHaveBeenCalledWith(80, 24);
    });

    it('should NOT sync local size on history_sync when server size matches', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      // Set local size first
      virtualPty.resize(100, 30);
      (ws?.send as ReturnType<typeof vi.fn>).mockClear();

      // Listen for resize event
      const resizeHandler = vi.fn();
      virtualPty.on('resize', resizeHandler);

      // Server sends history_sync with matching size
      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'history_sync',
        data: 'history data',
        cols: 100,
        rows: 30,
      })));

      // Should NOT have sent resize again, and no resize event
      expect(ws?.send).not.toHaveBeenCalled();
      expect(resizeHandler).not.toHaveBeenCalled();
    });

    it('should sync local size on terminal_resize (slave mode)', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      // Set local size first
      virtualPty.resize(100, 30);
      (ws?.send as ReturnType<typeof vi.fn>).mockClear();

      // Listen for resize event to notify local terminal
      const resizeHandler = vi.fn();
      virtualPty.on('resize', resizeHandler);

      // Server sends terminal_resize with different size (from webapp master)
      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'terminal_resize',
        cols: 80,
        rows: 24,
      })));

      // As slave, should update local size to match server (webapp master)
      expect(ws?.send).not.toHaveBeenCalled();
      expect(virtualPty.cols).toBe(80);
      expect(virtualPty.rows).toBe(24);
      // Should emit resize event to notify local terminal
      expect(resizeHandler).toHaveBeenCalledWith(80, 24);
    });

    it('should NOT emit resize event when terminal_resize size matches', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      // Set local size first
      virtualPty.resize(100, 30);
      (ws?.send as ReturnType<typeof vi.fn>).mockClear();

      // Listen for resize event
      const resizeHandler = vi.fn();
      virtualPty.on('resize', resizeHandler);

      // Server sends terminal_resize with matching size
      ws?.emit('message', Buffer.from(JSON.stringify({
        type: 'terminal_resize',
        cols: 100,
        rows: 30,
      })));

      // Should NOT emit resize event when size matches
      expect(resizeHandler).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should close WS and set connected=false', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      expect(virtualPty.connected).toBe(true);

      virtualPty.destroy();

      expect(ws?.close).toHaveBeenCalled();
      expect(virtualPty.connected).toBe(false);
    });

    it('should be idempotent', async () => {
      const connectPromise = virtualPty.connect('ws://localhost:3000', 'test-token');
      const ws = getLastMockWs();
      ws?.emit('open');
      await connectPromise;

      virtualPty.destroy();
      virtualPty.destroy(); // Second call should not throw

      expect(virtualPty.connected).toBe(false);
      expect(ws?.close).toHaveBeenCalledTimes(1);
    });
  });
});