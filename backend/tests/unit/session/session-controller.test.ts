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
  const messageHandlers: Array<(ws: unknown, data: string, clientType: 'attach' | 'webapp') => void> = [];
  const connectHandlers: Array<(ws: unknown, clientType: 'attach' | 'webapp') => void> = [];
  const disconnectHandlers: Array<(clientCounts: { attach: number; webapp: number }) => void> = [];
  let _clientCounts = { attach: 0, webapp: 0 };
  return Object.assign(emitter, {
    clientCount: 0,
    broadcast: vi.fn(),
    sendTo: vi.fn(),
    getClientCounts: vi.fn(() => ({ ..._clientCounts })),
    setClientCounts: (counts: { attach: number; webapp: number }) => { _clientCounts = counts; },
    onMessage: vi.fn((handler) => { messageHandlers.push(handler); }),
    onConnect: vi.fn((handler) => { connectHandlers.push(handler); }),
    onDisconnect: vi.fn((handler: (clientCounts: { attach: number; webapp: number }) => void) => { disconnectHandlers.push(handler); }),
    _triggerMessage: (ws: unknown, data: string, clientType: 'attach' | 'webapp' = 'webapp') => messageHandlers.forEach(h => h(ws, data, clientType)),
    _triggerConnect: (ws: unknown, clientType: 'attach' | 'webapp' = 'webapp') => connectHandlers.forEach(h => h(ws, clientType)),
    _triggerDisconnect: (clientCounts: { attach: number; webapp: number } = { attach: 0, webapp: 0 }) => disconnectHandlers.forEach(h => h(clientCounts)),
  });
}

function createMockHookReceiver() {
  const emitter = new EventEmitter();
  return emitter;
}

function createMockTerminalRelay() {
  return {
    pauseResize: vi.fn(),
    resumeResize: vi.fn(),
  };
}

function createMockPushService() {
  return {
    notifyAll: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDingtalkService() {
  return {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationServiceFactory(dingtalkService?: ReturnType<typeof createMockDingtalkService>, wechatWorkService?: ReturnType<typeof createMockDingtalkService>) {
  return {
    getDingtalkService: vi.fn(() => dingtalkService ?? null),
    getWechatWorkService: vi.fn(() => wechatWorkService ?? null),
    refresh: vi.fn(),
  };
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

    it('should apply webapp resize when attach client is connected', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      // attach 客户端在线
      wsServer.getClientCounts.mockReturnValue({ attach: 1, webapp: 1 });

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerMessage(mockWs, JSON.stringify({ type: 'resize', cols: 80, rows: 24 }), 'webapp');

      expect(ptyManager.resize).toHaveBeenCalledWith(80, 24);
    });

    it('should apply webapp resize when no attach client is connected', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      // 无 attach 客户端
      wsServer.getClientCounts.mockReturnValue({ attach: 0, webapp: 1 });

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerMessage(mockWs, JSON.stringify({ type: 'resize', cols: 80, rows: 24 }), 'webapp');

      expect(ptyManager.resize).toHaveBeenCalledWith(80, 24);
    });

    it('should ignore attach resize when webapp client is connected', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      wsServer.getClientCounts.mockReturnValue({ attach: 1, webapp: 2 });

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerMessage(mockWs, JSON.stringify({ type: 'resize', cols: 120, rows: 40 }), 'attach');

      expect(ptyManager.resize).not.toHaveBeenCalled();
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

  describe('dynamic master switch (pauseResize / resumeResize)', () => {
    it('should call pauseResize when first WebApp client connects', () => {
      const relay = createMockTerminalRelay();
      wsServer.setClientCounts({ attach: 0, webapp: 1 });
      wsServer.getClientCounts.mockReturnValueOnce({ attach: 0, webapp: 1 }); // 连接时的计数
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerConnect(mockWs, 'webapp');

      expect(relay.pauseResize).toHaveBeenCalledOnce();
    });

    it('should call pauseResize when attach client connects', () => {
      const relay = createMockTerminalRelay();
      // attach 客户端连接时， getClientCounts 返回 attach: 1
      wsServer.getClientCounts.mockReturnValueOnce({ attach: 1, webapp: 0 });
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerConnect(mockWs, 'attach');

      expect(relay.pauseResize).toHaveBeenCalledOnce();
    });

    it('should NOT call pauseResize when second WebApp client connects', () => {
      const relay = createMockTerminalRelay();
      // 第二个 WebApp 连接时，已有 1 个 webapp
      wsServer.getClientCounts.mockReturnValueOnce({ attach: 0, webapp: 2 });
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      const mockWs = { readyState: 1, send: vi.fn() };
      wsServer._triggerConnect(mockWs, 'webapp');

      expect(relay.pauseResize).not.toHaveBeenCalled();
    });

    it('should call resumeResize when all clients disconnect', () => {
      const relay = createMockTerminalRelay();
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      wsServer._triggerDisconnect({ attach: 0, webapp: 0 });

      expect(relay.resumeResize).toHaveBeenCalledOnce();
    });

    it('should NOT call resumeResize when WebApp clients remain after attach disconnects', () => {
      const relay = createMockTerminalRelay();
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      wsServer._triggerDisconnect({ attach: 0, webapp: 1 });

      expect(relay.resumeResize).not.toHaveBeenCalled();
    });

    it('should NOT call resumeResize when attach client remains', () => {
      const relay = createMockTerminalRelay();
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000, relay as any);

      wsServer._triggerDisconnect({ attach: 1, webapp: 0 });

      expect(relay.resumeResize).not.toHaveBeenCalled();
    });

    it('should broadcast PTY size when all WebApps disconnect and attach remains', () => {
      ptyManager.cols = 100;
      ptyManager.rows = 30;
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      wsServer._triggerDisconnect({ attach: 1, webapp: 0 });

      expect(wsServer.broadcast).toHaveBeenCalledWith({
        type: 'terminal_resize',
        cols: 100,
        rows: 30,
      });
    });

    it('should NOT broadcast PTY size when attach disconnects and WebApp remains', () => {
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      wsServer._triggerDisconnect({ attach: 0, webapp: 1 });

      expect(wsServer.broadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'terminal_resize' }),
      );
    });

    it('should not throw when relay is not provided (backward compatibility)', () => {
      wsServer.getClientCounts.mockReturnValueOnce({ attach: 0, webapp: 1 });
      new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      const mockWs = { readyState: 1, send: vi.fn() };
      expect(() => wsServer._triggerConnect(mockWs, 'webapp')).not.toThrow();
      expect(() => wsServer._triggerDisconnect({ attach: 0, webapp: 0 })).not.toThrow();
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

  describe('instanceUrl in notifications', () => {
    it('should include instance URL in WebSocket notification when set', async () => {
      const controller = new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);
      controller.setInstanceUrl('http://192.168.1.100:3000');

      // 触发 notification 事件
      hookReceiver.emit('notification', {
        eventType: 'notification',
        tool: 'Bash',
        title: 'Approval Required: Bash',
        message: 'Claude requests to execute command: ls -la',
        channels: ['websocket'],
      });

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_update',
          detail: expect.stringContaining('Instance: http://192.168.1.100:3000'),
        }),
      );
    });

    it('should include instance URL in push notification when set', async () => {
      const controller = new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);
      const pushService = createMockPushService();
      controller.setPushService(pushService as any);
      controller.setInstanceUrl('http://192.168.1.100:3000');

      hookReceiver.emit('notification', {
        eventType: 'notification',
        tool: 'Bash',
        title: 'Approval Required: Bash',
        message: 'Claude requests to execute command: ls -la',
        channels: ['push'],
      });

      expect(pushService.notifyAll).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Instance: http://192.168.1.100:3000'),
        }),
      );
    });

    it('should include instance URL in dingtalk notification when set', async () => {
      const controller = new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);
      const dingtalkService = createMockDingtalkService();
      const factory = createMockNotificationServiceFactory(dingtalkService);
      controller.setNotificationServiceFactory(factory as any);
      controller.setInstanceUrl('http://192.168.1.100:3000');

      hookReceiver.emit('notification', {
        eventType: 'notification',
        tool: 'Bash',
        title: 'Approval Required: Bash',
        message: 'Claude requests to execute command: ls -la',
        channels: ['dingtalk'],
      });

      expect(dingtalkService.sendNotification).toHaveBeenCalledWith(
        'Approval Required: Bash',
        'Bash',
        expect.stringContaining('Instance: http://192.168.1.100:3000'),
      );
    });

    it('should NOT include instance URL when not set', async () => {
      const controller = new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);

      hookReceiver.emit('notification', {
        eventType: 'notification',
        tool: 'Bash',
        title: 'Approval Required: Bash',
        message: 'Claude requests to execute command: ls -la',
        channels: ['websocket'],
      });

      expect(wsServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_update',
          detail: 'Claude requests to execute command: ls -la',
        }),
      );
    });

    it('should append URL after detail in dingtalk notification', async () => {
      const controller = new SessionController(ptyManager as any, wsServer as any, hookReceiver as any, 1000);
      const dingtalkService = createMockDingtalkService();
      const factory = createMockNotificationServiceFactory(dingtalkService);
      controller.setNotificationServiceFactory(factory as any);
      controller.setInstanceUrl('http://192.168.1.100:3000');

      hookReceiver.emit('notification', {
        eventType: 'notification',
        tool: 'Bash',
        title: 'Approval Required: Bash',
        message: 'Claude requests to execute command',
        detail: 'Command: ls -la',
        channels: ['dingtalk'],
      });

      const call = dingtalkService.sendNotification.mock.calls[0];
      expect(call[2]).toBe('Claude requests to execute command\nCommand: ls -la\n\nInstance: http://192.168.1.100:3000');
    });
  });
});
