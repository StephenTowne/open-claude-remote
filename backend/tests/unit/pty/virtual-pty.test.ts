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