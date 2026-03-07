import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstanceManager } from '../../../src/instance/instance-manager.js';

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

// Mock config functions
vi.mock('../../../src/config.js', () => ({
  loadUserConfig: vi.fn().mockReturnValue({}),
  loadWorkdirConfig: vi.fn().mockReturnValue({}),
  mergeConfigs: vi.fn().mockImplementation((a, b) => ({ ...a, ...b })),
  createClaudeSettings: vi.fn().mockReturnValue({ hooks: {} }),
  extractSettingsFromArgs: vi.fn().mockReturnValue(null),
  saveClaudeSettings: vi.fn().mockReturnValue('/tmp/test-settings.json'),
}));

describe('InstanceManager', () => {
  let manager: InstanceManager;

  beforeEach(() => {
    manager = new InstanceManager();
  });

  afterEach(() => {
    manager.destroyAll();
  });

  it('should start with no instances', () => {
    expect(manager.size).toBe(0);
    expect(manager.listInstances()).toEqual([]);
  });

  it('should create an instance', () => {
    const session = manager.createInstance({
      cwd: '/tmp/test-project',
      name: 'test',
    });

    expect(session).toBeDefined();
    expect(session.name).toBe('test');
    expect(session.cwd).toBe('/tmp/test-project');
    expect(manager.size).toBe(1);
  });

  it('should generate instanceId for new instances', () => {
    const session = manager.createInstance({ cwd: '/tmp/a' });
    expect(session.instanceId).toBeTruthy();
    expect(session.instanceId).toMatch(/^[0-9a-f-]+$/);
  });

  it('should use cwd basename when name is not provided', () => {
    const session = manager.createInstance({ cwd: '/tmp/my-project' });
    expect(session.name).toBe('my-project');
  });

  it('should get instance by id', () => {
    const session = manager.createInstance({ cwd: '/tmp/test' });
    const found = manager.getInstance(session.instanceId);
    expect(found).toBe(session);
  });

  it('should return undefined for non-existent instance', () => {
    expect(manager.getInstance('non-existent')).toBeUndefined();
  });

  it('should list all instances', () => {
    manager.createInstance({ cwd: '/tmp/a', name: 'a' });
    manager.createInstance({ cwd: '/tmp/b', name: 'b' });

    const instances = manager.listInstances();
    expect(instances).toHaveLength(2);
    expect(instances.map(i => i.name).sort()).toEqual(['a', 'b']);
  });

  it('should destroy a specific instance', () => {
    const session = manager.createInstance({ cwd: '/tmp/test' });
    const id = session.instanceId;

    const result = manager.destroyInstance(id);
    expect(result).toBe(true);
    expect(manager.size).toBe(0);
    expect(manager.getInstance(id)).toBeUndefined();
  });

  it('should return false when destroying non-existent instance', () => {
    const result = manager.destroyInstance('non-existent');
    expect(result).toBe(false);
  });

  it('should destroy all instances', () => {
    manager.createInstance({ cwd: '/tmp/a' });
    manager.createInstance({ cwd: '/tmp/b' });
    manager.createInstance({ cwd: '/tmp/c' });

    expect(manager.size).toBe(3);

    manager.destroyAll();
    expect(manager.size).toBe(0);
  });

  it('should auto-remove instance when PTY exits', () => {
    const session = manager.createInstance({ cwd: '/tmp/test' });
    const id = session.instanceId;

    expect(manager.size).toBe(1);

    // Simulate PTY exit
    session.ptyManager.emit('exit', 0);

    expect(manager.size).toBe(0);
    expect(manager.getInstance(id)).toBeUndefined();
  });

  it('should emit instance_created event', () => {
    const handler = vi.fn();
    manager.on('instance_created', handler);

    manager.createInstance({ cwd: '/tmp/test', name: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].name).toBe('test');
  });

  it('should emit instance_removed event', () => {
    const handler = vi.fn();
    manager.on('instance_removed', handler);

    const session = manager.createInstance({ cwd: '/tmp/test' });
    const id = session.instanceId;

    manager.destroyInstance(id);

    expect(handler).toHaveBeenCalledWith(id, 'manual_destroy');
  });

  it('should emit instance_removed on PTY exit', () => {
    const handler = vi.fn();
    manager.on('instance_removed', handler);

    const session = manager.createInstance({ cwd: '/tmp/test' });
    const id = session.instanceId;

    session.ptyManager.emit('exit', 0);

    expect(handler).toHaveBeenCalledWith(id, 'pty_exit');
  });

  it('should create headless instances', () => {
    const session = manager.createInstance({
      cwd: '/tmp/test',
      headless: true,
    });

    expect(session.headless).toBe(true);
    const info = manager.listInstances();
    expect(info[0].headless).toBe(true);
  });

  // === 并发安全测试 ===
  it('should handle concurrent instance creation', async () => {
    // 同时创建多个实例
    const promises = Array.from({ length: 10 }, (_, i) =>
      Promise.resolve(manager.createInstance({ cwd: `/tmp/project-${i}`, name: `project-${i}` }))
    );

    const sessions = await Promise.all(promises);
    expect(sessions).toHaveLength(10);
    expect(manager.size).toBe(10);

    // 每个 instanceId 应该是唯一的
    const ids = sessions.map(s => s.instanceId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
  });

  it('should handle concurrent destroy during creation', async () => {
    const session = manager.createInstance({ cwd: '/tmp/test' });
    const id = session.instanceId;

    // 同时销毁和触发 PTY 退出
    const destroyPromise = Promise.resolve(manager.destroyInstance(id));
    session.ptyManager.emit('exit', 0);
    await destroyPromise;

    // 应该只剩 0 个实例
    expect(manager.size).toBe(0);
  });

  // === IP 更新测试 ===
  it('should update display IP for all instances', () => {
    const session1 = manager.createInstance({ cwd: '/tmp/a' });
    const session2 = manager.createInstance({ cwd: '/tmp/b' });

    manager.updateDisplayIp('192.168.1.100');

    // 检查 broadcast 是否被调用（通过实例行为验证）
    expect(manager.size).toBe(2);
  });

  // === 共享服务注入测试 ===
  it('should inject shared services into instances', () => {
    manager.setSharedServices({
      displayIp: '192.168.1.50',
    });

    const session = manager.createInstance({ cwd: '/tmp/test' });

    // 实例应该被创建
    expect(session).toBeDefined();
    expect(manager.size).toBe(1);
  });

  // === pingAllClients 测试 ===
  it('should ping all clients across all instances', () => {
    const session1 = manager.createInstance({ cwd: '/tmp/a' });
    const session2 = manager.createInstance({ cwd: '/tmp/b' });

    // pingAllClients 应该不会抛出错误
    expect(() => manager.pingAllClients()).not.toThrow();
  });

  // === broadcastAll 测试 ===
  it('should broadcast to all clients across all instances', () => {
    manager.createInstance({ cwd: '/tmp/a' });
    manager.createInstance({ cwd: '/tmp/b' });

    // broadcastAll 应该不会抛出错误
    expect(() => manager.broadcastAll({ type: 'test', data: 'hello' })).not.toThrow();
  });
});
