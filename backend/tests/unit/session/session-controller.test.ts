import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    ptyManager = createMockPtyManager();
    wsServer = createMockWsServer();
    hookReceiver = createMockHookReceiver();
    ({ SessionController } = await import('../../../src/session/session-controller.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
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

  describe('pty output passthrough (no filtering)', () => {
    it('should pass alt-screen sequences through to WebSocket unmodified', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      // PTY output containing complete alt-screen enter → content → exit
      const altScreenData = '\x1b[?1049h\x1b[2J\x1b[HTui content\x1b[?1049l';
      ptyManager.emit('data', altScreenData);

      vi.advanceTimersByTime(16);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: altScreenData,
        }),
      );
    });

    it('should not duplicate ANSI sequences split across chunk boundaries', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      // Simulate chunk boundary splitting a cursor movement sequence
      ptyManager.emit('data', 'Hello\x1b[5A');
      ptyManager.emit('data', ' World');

      vi.advanceTimersByTime(16);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: 'Hello\x1b[5A World',
        }),
      );
    });

    it('should include alt-screen data in history_sync on reconnect', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const dataWithAlt = 'Before\x1b[?1049hAlt content\x1b[?1049lAfter';
      ptyManager.emit('data', dataWithAlt);
      vi.advanceTimersByTime(16);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerConnect(mockWs);

      expect(wsServer.sendTo).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          type: 'history_sync',
          data: expect.stringContaining('\x1b[?1049h'),
        }),
      );
    });
  });

  describe('pty output batching', () => {
    it('should batch multiple PTY chunks and flush once by timer', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      ptyManager.emit('data', 'A');
      ptyManager.emit('data', 'B');

      expect(wsServer.broadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'terminal_output' }),
      );

      vi.advanceTimersByTime(16);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: 'AB',
        }),
      );
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
    });

    it('should flush immediately when max chunk bytes threshold is reached', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const large = 'x'.repeat(40 * 1024);
      ptyManager.emit('data', large);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: large,
        }),
      );
    });

    it('should flush via high watermark when a single large chunk exceeds 256KB', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      // 260KB single chunk exceeds WS_HIGH_WATERMARK_BYTES (256KB)
      // This path increments wsBackpressureEvents
      const huge = 'x'.repeat(260 * 1024);
      ptyManager.emit('data', huge);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: huge,
        }),
      );
    });

    it('should force flush pending data on process exit event', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      ptyManager.emit('data', 'tail-data');
      expect(wsServer.broadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'terminal_output' }),
      );

      ptyManager.emit('exit', 0);

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal_output',
          data: 'tail-data',
        }),
      );
      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_ended',
          exitCode: 0,
        }),
      );
    });
  });
});
