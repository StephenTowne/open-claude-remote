import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ---- Minimal mocks ----

function createMockPtyManager() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    cols: 80,
    rows: 24,
    resize: vi.fn(),
    write: vi.fn(),
    spawn: vi.fn(),
    kill: vi.fn(),
  });
}

function createMockWsServer() {
  const emitter = new EventEmitter();
  const messageHandlers: Array<(ws: unknown, data: string) => void> = [];
  const connectHandlers: Array<(ws: unknown) => void> = [];
  return Object.assign(emitter, {
    clientCount: 0,
    broadcast: vi.fn(),
    sendTo: vi.fn(),
    onMessage: vi.fn((handler) => { messageHandlers.push(handler); }),
    onConnect: vi.fn((handler) => { connectHandlers.push(handler); }),
    _triggerMessage: (ws: unknown, data: string) => messageHandlers.forEach(h => h(ws, data)),
    _triggerConnect: (ws: unknown) => connectHandlers.forEach(h => h(ws)),
  });
}

function createMockHookReceiver() {
  const emitter = new EventEmitter();
  return emitter;
}

// ---- Lazy import after vi.mock setup ----
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/ws/ws-handler.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/ws/ws-handler.js')>();
  return original;
});

describe('SessionController', () => {
  let ptyManager: ReturnType<typeof createMockPtyManager>;
  let wsServer: ReturnType<typeof createMockWsServer>;
  let hookReceiver: ReturnType<typeof createMockHookReceiver>;
  let SessionController: typeof import('../../../src/session/session-controller.js').SessionController;

  beforeEach(async () => {
    vi.clearAllMocks();
    ptyManager = createMockPtyManager();
    wsServer = createMockWsServer();
    hookReceiver = createMockHookReceiver();
    ({ SessionController } = await import('../../../src/session/session-controller.js'));
  });

  describe('onResize', () => {
    it('should call ptyManager.resize when resize message is received', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerMessage(mockWs, JSON.stringify({ type: 'resize', cols: 50, rows: 20 }));

      expect(ptyManager.resize).toHaveBeenCalledWith(50, 20);
    });

    it('should apply correct cols and rows from resize message', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerMessage(mockWs, JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));

      expect(ptyManager.resize).toHaveBeenCalledWith(120, 40);
    });
  });

  describe('onConnect / history_sync', () => {
    it('should send history_sync with ptyManager cols and rows on connect', () => {
      ptyManager.cols = 80;
      ptyManager.rows = 24;

      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerConnect(mockWs);

      expect(wsServer.sendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'history_sync',
          cols: 80,
          rows: 24,
        }),
      );
    });
  });
});
