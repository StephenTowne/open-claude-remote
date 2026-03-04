import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InstanceInfo } from '#shared';

vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { stopInstances } from '../../../src/registry/stop-instances.js';

interface RegistryLike {
  list: () => InstanceInfo[];
  unregister: (instanceId: string) => void;
}

function makeInstance(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    instanceId: `instance-${Math.random().toString(36).slice(2)}`,
    name: 'test-instance',
    host: '127.0.0.1',
    port: 3000,
    pid: 1234,
    cwd: '/tmp',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('stopInstances', () => {
  let unregisterSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unregisterSpy = vi.fn();
  });

  it('无实例时幂等成功', async () => {
    const registry: RegistryLike = {
      list: () => [],
      unregister: unregisterSpy,
    };

    const signalSender = vi.fn();
    const summary = await stopInstances(registry as never, { signalSender });

    expect(summary).toEqual({
      total: 0,
      stopped: 0,
      failed: 0,
      failures: [],
    });
    expect(signalSender).not.toHaveBeenCalled();
    expect(unregisterSpy).not.toHaveBeenCalled();
  });

  it('多实例时逐实例停止', async () => {
    const a = makeInstance({ instanceId: 'a', pid: 1001, port: 3001, name: 'a' });
    const b = makeInstance({ instanceId: 'b', pid: 1002, port: 3002, name: 'b' });

    const registry: RegistryLike = {
      list: () => [a, b],
      unregister: unregisterSpy,
    };

    const alive = new Set<number>([a.pid, b.pid]);
    const signalSender = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
      if (signal === 0) {
        if (!alive.has(pid)) {
          const err = new Error('not found') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
        return;
      }
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        alive.delete(pid);
      }
    });

    const summary = await stopInstances(registry as never, {
      signalSender,
      processVerifier: async () => true,
      sleep: async () => {},
      gracePeriodMs: 20,
      pollIntervalMs: 5,
    });

    expect(summary.total).toBe(2);
    expect(summary.stopped).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.failures).toEqual([]);

    expect(signalSender).toHaveBeenCalledWith(1001, 'SIGTERM');
    expect(signalSender).toHaveBeenCalledWith(1002, 'SIGTERM');
    expect(unregisterSpy).toHaveBeenCalledTimes(2);
    expect(unregisterSpy).toHaveBeenCalledWith('a');
    expect(unregisterSpy).toHaveBeenCalledWith('b');
  });

  it('单实例超时后触发兜底终止', async () => {
    const a = makeInstance({ instanceId: 'a', pid: 2001, port: 3001, name: 'stuck' });
    const registry: RegistryLike = {
      list: () => [a],
      unregister: unregisterSpy,
    };

    let termCount = 0;
    let killed = false;

    const signalSender = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
      if (pid !== a.pid) return;

      if (signal === 'SIGTERM') {
        termCount += 1;
        return;
      }

      if (signal === 'SIGKILL') {
        killed = true;
        return;
      }

      if (signal === 0) {
        // Before SIGKILL, always appears alive; after kill, dead
        if (killed) {
          const err = new Error('not found') as NodeJS.ErrnoException;
          err.code = 'ESRCH';
          throw err;
        }
      }
    });

    const summary = await stopInstances(registry as never, {
      signalSender,
      processVerifier: async () => true,
      sleep: async () => {},
      gracePeriodMs: 10,
      pollIntervalMs: 2,
    });

    expect(termCount).toBe(1);
    expect(signalSender).toHaveBeenCalledWith(2001, 'SIGKILL');
    expect(summary.failed).toBe(0);
    expect(summary.stopped).toBe(1);
    expect(unregisterSpy).toHaveBeenCalledWith('a');
  });

  it('部分失败时返回失败列表与失败语义', async () => {
    const ok = makeInstance({ instanceId: 'ok', pid: 3001, port: 3001, name: 'ok' });
    const fail = makeInstance({ instanceId: 'fail', pid: 3002, port: 3002, name: 'fail' });

    const registry: RegistryLike = {
      list: () => [ok, fail],
      unregister: unregisterSpy,
    };

    const alive = new Set<number>([ok.pid, fail.pid]);

    const signalSender = vi.fn((pid: number, signal: NodeJS.Signals | 0) => {
      if (pid === ok.pid) {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          alive.delete(pid);
          return;
        }
        if (signal === 0) {
          if (!alive.has(pid)) {
            const err = new Error('not found') as NodeJS.ErrnoException;
            err.code = 'ESRCH';
            throw err;
          }
          return;
        }
      }

      if (pid === fail.pid) {
        if (signal === 'SIGTERM') {
          const err = new Error('operation not permitted') as NodeJS.ErrnoException;
          err.code = 'EPERM';
          throw err;
        }
        if (signal === 0) {
          return;
        }
      }
    });

    const summary = await stopInstances(registry as never, {
      signalSender,
      processVerifier: async () => true,
      sleep: async () => {},
      gracePeriodMs: 10,
      pollIntervalMs: 2,
    });

    expect(summary.total).toBe(2);
    expect(summary.stopped).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toMatchObject({
      instanceId: 'fail',
      pid: 3002,
      port: 3002,
      name: 'fail',
    });

    // 仅成功实例会被注销
    expect(unregisterSpy).toHaveBeenCalledTimes(1);
    expect(unregisterSpy).toHaveBeenCalledWith('ok');
  });

  it('进程校验失败时不发送终止信号并返回失败', async () => {
    const suspicious = makeInstance({ instanceId: 'suspicious', pid: 4001, port: 4001, name: 'suspicious' });

    const registry: RegistryLike = {
      list: () => [suspicious],
      unregister: unregisterSpy,
    };

    const signalSender = vi.fn();
    const processVerifier = vi.fn(async () => false);

    const summary = await stopInstances(registry as never, {
      signalSender,
      processVerifier,
      sleep: async () => {},
      gracePeriodMs: 10,
      pollIntervalMs: 2,
    });

    expect(processVerifier).toHaveBeenCalledWith(suspicious);
    expect(signalSender).not.toHaveBeenCalledWith(4001, 'SIGTERM');
    expect(summary.total).toBe(1);
    expect(summary.stopped).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.failures[0]).toMatchObject({
      instanceId: 'suspicious',
      pid: 4001,
      reason: 'Process verification failed: pid/port mismatch',
    });
    expect(unregisterSpy).not.toHaveBeenCalled();
  });
});
