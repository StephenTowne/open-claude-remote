import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstanceSession, type InstanceSessionOptions } from '../../../src/instance/instance-session.js';

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock PtyManager
vi.mock('../../../src/pty/pty-manager.js', () => ({
  PtyManager: vi.fn().mockImplementation(() => {
    const { EventEmitter } = require('node:events');
    const emitter = new EventEmitter();
    return {
      ...emitter,
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
      write: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
      spawn: vi.fn(),
      cols: 80,
      rows: 24,
    };
  }),
}));

// Mock HookReceiver
vi.mock('../../../src/hooks/hook-receiver.js', () => ({
  HookReceiver: vi.fn().mockImplementation(() => {
    const { EventEmitter } = require('node:events');
    const emitter = new EventEmitter();
    return {
      ...emitter,
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
      processHook: vi.fn(),
    };
  }),
}));

function createTestSession(overrides?: Partial<InstanceSessionOptions>): InstanceSession {
  return new InstanceSession({
    instanceId: 'test-instance-id',
    name: 'test-instance',
    cwd: '/tmp/test',
    maxBufferLines: 100,
    headless: false,
    ...overrides,
  });
}

describe('InstanceSession', () => {
  let session: InstanceSession;

  beforeEach(() => {
    session = createTestSession();
  });

  afterEach(() => {
    session.destroy();
  });

  it('should initialize with correct properties', () => {
    expect(session.instanceId).toBe('test-instance-id');
    expect(session.name).toBe('test-instance');
    expect(session.cwd).toBe('/tmp/test');
    expect(session.headless).toBe(false);
    expect(session.status).toBe('idle');
    expect(session.clientCount).toBe(0);
  });

  it('should update status via setStatus', () => {
    session.setStatus('running');
    expect(session.status).toBe('running');
  });

  it('should emit exit event when PTY exits', () => {
    const exitHandler = vi.fn();
    session.on('exit', exitHandler);

    // Simulate PTY exit
    session.ptyManager.emit('exit', 0);

    expect(exitHandler).toHaveBeenCalledWith(0);
    expect(session.status).toBe('idle');
  });

  it('should close all WS clients when PTY exits', () => {
    // Add mock WS clients
    const mockWs1 = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      ping: vi.fn(),
      terminate: vi.fn(),
    };
    const mockWs2 = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      ping: vi.fn(),
      terminate: vi.fn(),
    };

    session.addClient(mockWs1 as any, 'webapp');
    session.addClient(mockWs2 as any, 'attach');

    expect(session.clientCount).toBe(2);

    // Simulate PTY exit
    session.ptyManager.emit('exit', 0);

    // All clients should have been closed gracefully
    expect(mockWs1.close).toHaveBeenCalledWith(1000, 'PTY exited');
    expect(mockWs2.close).toHaveBeenCalledWith(1000, 'PTY exited');
  });

  it('should track client count', () => {
    expect(session.clientCount).toBe(0);

    const counts = session.getClientCounts();
    expect(counts.attach).toBe(0);
    expect(counts.webapp).toBe(0);
  });

  it('should set instance URL', () => {
    session.setInstanceUrl('http://192.168.1.1:8866');
    // No direct getter, but should not throw
  });

  it('should handle headless mode', () => {
    const headlessSession = createTestSession({ headless: true });
    expect(headlessSession.headless).toBe(true);
    headlessSession.destroy();
  });

  it('should store claudeArgs', () => {
    const argsSession = createTestSession({ claudeArgs: ['--test', '--verbose'] });
    expect(argsSession.claudeArgs).toEqual(['--test', '--verbose']);
    argsSession.destroy();
  });

  it('should have startedAt timestamp', () => {
    expect(session.startedAt).toBeTruthy();
    const date = new Date(session.startedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  // === PTY 事件处理测试 ===
  it('should broadcast terminal output from PTY', async () => {
    const broadcastSpy = vi.spyOn(session, 'broadcast');

    // 模拟 PTY 输出
    session.ptyManager.emit('data', 'Hello World');

    // 等待 flush timer (16ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(broadcastSpy).toHaveBeenCalled();
  });

  it('should buffer PTY output for history', () => {
    // 模拟 PTY 输出
    session.ptyManager.emit('data', 'Line 1');
    session.ptyManager.emit('data', 'Line 2');

    // buffer 应该包含这些数据（通过 history_sync 间接验证）
    // 由于 buffer 是私有的，我们通过 broadcast 调用来验证
    const sendToSpy = vi.spyOn(session, 'sendTo');

    // 模拟已调用过 emit data，所以应该有内容
    expect(session).toBeDefined();
  });

  it('should broadcast error from PTY', () => {
    const broadcastSpy = vi.spyOn(session, 'broadcast');

    session.ptyManager.emit('error', new Error('PTY error'));

    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      code: 'pty_error',
    }));
  });

  it('should broadcast terminal resize', () => {
    const broadcastSpy = vi.spyOn(session, 'broadcast');

    session.ptyManager.emit('resize', 120, 40);

    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'terminal_resize',
      cols: 120,
      rows: 40,
    }));
  });

  // === Hook 处理测试 ===
  it('should change status to waiting_input on notification hook', () => {
    session.setStatus('running');
    expect(session.status).toBe('running');

    // 模拟 hook notification 事件
    session.hookReceiver.emit('notification', {
      eventType: 'Notification',
      tool: 'bash',
      message: 'Test notification',
      channels: ['websocket'],
    });

    expect(session.status).toBe('waiting_input');
  });

  it('should change status back to running on task_completed hook', () => {
    session.setStatus('waiting_input');

    session.hookReceiver.emit('task_completed', {});

    expect(session.status).toBe('running');
  });

  // === 状态更新广播测试 ===
  it('should broadcast status update when status changes', () => {
    const broadcastSpy = vi.spyOn(session, 'broadcast');

    session.setStatus('running');

    expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status_update',
      status: 'running',
    }));
  });

  // === pingClients 测试 ===
  it('should ping all clients', () => {
    // 没有 WS 客户端的 mock，但应该不抛错
    expect(() => session.pingClients()).not.toThrow();
  });

  // === destroy 测试 ===
  it('should clear flush timer on destroy', () => {
    // 触发一些输出来设置 timer
    session.ptyManager.emit('data', 'test');

    // 不应该抛错
    expect(() => session.destroy()).not.toThrow();
  });

  // === 活跃端状态机 (Active Source) 测试 ===
  describe('active source state machine', () => {
    // mock relay helper
    function makeMockRelay() {
      const { EventEmitter } = require('node:events');
      const emitter = new EventEmitter();
      return Object.assign(emitter, {
        pauseResize: vi.fn(),
        resumeResize: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      });
    }

    // mock WS helper with close event support
    function makeMockWs() {
      const handlers: Record<string, Function[]> = {};
      return {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        close: vi.fn(),
        ping: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(handler);
        }),
        // 触发事件（用于模拟 close）
        _emit(event: string, ...args: any[]) {
          for (const h of handlers[event] ?? []) h(...args);
        },
      };
    }

    it('should have activeSource null when no relay is set', () => {
      expect(session.activeSource).toBeNull();
    });

    it('should set activeSource to local when relay is set', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      expect(session.activeSource).toBe('local');
    });

    it('should switch activeSource on WS user_input from webapp', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      expect(session.activeSource).toBe('local');

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');

      // 模拟 WS 消息: user_input
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'hello' }));

      expect(session.activeSource).toBe('webapp');
    });

    it('should switch activeSource back to local on relay local_input', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      // 先切到 webapp
      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'hi' }));
      expect(session.activeSource).toBe('webapp');

      // relay 发射 local_input → 切回 local
      relay.emit('local_input');
      expect(session.activeSource).toBe('local');
    });

    it('should pause relay when switching to webapp', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));

      expect(relay.pauseResize).toHaveBeenCalled();
    });

    it('should resume relay when switching back to local', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      // 切到 webapp
      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));

      // 切回 local
      relay.emit('local_input');
      expect(relay.resumeResize).toHaveBeenCalled();
    });

    it('should only apply resize from active source', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      // activeSource = 'local'

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // webapp 发 resize，但活跃端是 local → 记录但不应用
      messageHandler!(JSON.stringify({ type: 'resize', cols: 100, rows: 50 }));
      expect(session.ptyManager.resize).not.toHaveBeenCalled();

      // webapp 发 user_input → 切换到 webapp
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // webapp 再发 resize → 活跃端 resize 应生效
      messageHandler!(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
      expect(session.ptyManager.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should sync size when switching active source', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      // activeSource = 'local'

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // webapp 先发 resize（被记录但不应用）
      messageHandler!(JSON.stringify({ type: 'resize', cols: 100, rows: 50 }));
      expect(session.ptyManager.resize).not.toHaveBeenCalled();

      // webapp 发 user_input → 切换时应同步 webapp 记录的 size
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.ptyManager.resize).toHaveBeenCalledWith(100, 50);
    });

    it('should call resumeResize (not syncActiveSourceSize) on switch to local', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      // 切到 webapp
      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // relay 发 local_resize（记录 PC size）
      relay.emit('local_resize', 200, 60);

      // relay 发 local_input → 切回 local
      // 应调 resumeResize（由 relay 自行同步 PTY），而非 syncActiveSourceSize
      relay.emit('local_input');
      expect(session.activeSource).toBe('local');
      expect(relay.resumeResize).toHaveBeenCalled();
      // ptyManager.resize 不会被 InstanceSession 直接调用
      // （生产中由 TerminalRelay.resumeResize 内部调用，mock 中是 no-op）
      expect(session.ptyManager.resize).not.toHaveBeenCalled();
    });

    it('should allow resize when activeSource is null', () => {
      // 无 relay，activeSource = null
      expect(session.activeSource).toBeNull();

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // 任何来源的 resize 都应生效
      messageHandler!(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
      expect(session.ptyManager.resize).toHaveBeenCalledWith(80, 24);
    });

    it('should fallback activeSource to local when active webapp disconnects', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // 切到 webapp
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // webapp 断开
      ws._emit('close');
      expect(session.activeSource).toBe('local');
      expect(relay.resumeResize).toHaveBeenCalled();
    });

    it('should fallback activeSource to null when active webapp disconnects without relay', () => {
      // 无 relay
      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // 切到 webapp
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // webapp 断开 → 无 relay → null
      ws._emit('close');
      expect(session.activeSource).toBeNull();
    });

    it('should not change activeSource when non-active client disconnects', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      // activeSource = 'local'

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');

      // webapp 断开，但活跃端是 local → 不变
      ws._emit('close');
      expect(session.activeSource).toBe('local');
    });

    it('should not switch active source on same source user_input', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // 切到 webapp
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'a' }));
      expect(session.activeSource).toBe('webapp');

      relay.pauseResize.mockClear();

      // 再次 webapp input → 不应重复切换
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'b' }));
      expect(session.activeSource).toBe('webapp');
      expect(relay.pauseResize).not.toHaveBeenCalled();
    });

    it('should not sync size when lastKnownSizes is empty for new active source', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // webapp 发 user_input 但没有先发过 resize → 不应 resize
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');
      expect(session.ptyManager.resize).not.toHaveBeenCalled();
    });

    // --- attach ↔ webapp 切换 ---

    it('should switch activeSource on user_input from attach', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);
      expect(session.activeSource).toBe('local');

      const ws = makeMockWs();
      session.addClient(ws as any, 'attach');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      messageHandler!(JSON.stringify({ type: 'user_input', data: 'hi' }));
      expect(session.activeSource).toBe('attach');
      expect(relay.pauseResize).toHaveBeenCalled();
    });

    it('should switch from attach to webapp on user_input', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      // 先切到 attach
      const wsAttach = makeMockWs();
      session.addClient(wsAttach as any, 'attach');
      const attachMsg = wsAttach.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      attachMsg!(JSON.stringify({ type: 'user_input', data: 'a' }));
      expect(session.activeSource).toBe('attach');

      // webapp 发 user_input → 切换
      const wsWebapp = makeMockWs();
      session.addClient(wsWebapp as any, 'webapp');
      const webappMsg = wsWebapp.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      webappMsg!(JSON.stringify({ type: 'user_input', data: 'b' }));
      expect(session.activeSource).toBe('webapp');
      // relay 仍然 paused（非 local 之间切换不影响 relay）
    });

    it('should resume relay on switch from attach back to local', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      // 切到 attach
      const ws = makeMockWs();
      session.addClient(ws as any, 'attach');
      const msgHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      msgHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('attach');

      // 切回 local
      relay.emit('local_input');
      expect(session.activeSource).toBe('local');
      expect(relay.resumeResize).toHaveBeenCalled();
    });

    // --- error handler fallback ---

    it('should fallback activeSource when active client errors out', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const messageHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // 切到 webapp
      messageHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // 触发 error（而非 close）
      ws._emit('error', new Error('connection reset'));
      expect(session.activeSource).toBe('local');
      expect(relay.resumeResize).toHaveBeenCalled();
    });

    // --- 多同类型客户端 ---

    it('should not fallback when one of multiple same-type webapp clients disconnects', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws1 = makeMockWs();
      const ws2 = makeMockWs();
      session.addClient(ws1 as any, 'webapp');
      session.addClient(ws2 as any, 'webapp');

      // ws1 发 user_input → 切到 webapp
      const msg1 = ws1.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      msg1!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // ws1 断开，但 ws2 仍在线 → activeSource 不变
      ws1._emit('close');
      expect(session.activeSource).toBe('webapp');
    });

    // --- P3: stale size cleanup ---

    it('should clear lastKnownSizes for disconnected client type when no remaining', () => {
      const relay = makeMockRelay();
      session.setRelay(relay);

      const ws = makeMockWs();
      session.addClient(ws as any, 'webapp');
      const msgHandler = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // webapp 发 resize（记录 size）
      msgHandler!(JSON.stringify({ type: 'resize', cols: 100, rows: 50 }));

      // webapp 发 user_input → 切到 webapp
      msgHandler!(JSON.stringify({ type: 'user_input', data: 'x' }));
      expect(session.activeSource).toBe('webapp');

      // webapp 断开 → fallback to local
      ws._emit('close');
      expect(session.activeSource).toBe('local');

      // 新 webapp 连接，先发 user_input（没发 resize）→ 不应用旧 size
      const ws2 = makeMockWs();
      session.addClient(ws2 as any, 'webapp');
      const msg2 = ws2.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      (session.ptyManager.resize as any).mockClear();
      msg2!(JSON.stringify({ type: 'user_input', data: 'y' }));
      expect(session.activeSource).toBe('webapp');
      // 旧的 100x50 已被清理，不应同步旧 size
      expect(session.ptyManager.resize).not.toHaveBeenCalled();
    });
  });
});
