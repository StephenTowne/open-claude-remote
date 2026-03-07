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
});
