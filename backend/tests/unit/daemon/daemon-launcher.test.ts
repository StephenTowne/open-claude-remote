import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process.fork
const mockFork = vi.fn();
vi.mock('node:child_process', () => ({
  fork: (...args: unknown[]) => mockFork(...args),
}));

describe('launchDaemon', () => {
  let mockChild: EventEmitter & { unref: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockChild = Object.assign(new EventEmitter(), {
      unref: vi.fn(),
      kill: vi.fn(),
    });
    mockFork.mockReturnValue(mockChild);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should resolve with pid on ready message', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon({ host: '0.0.0.0' });

    // Simulate daemon sending ready IPC message
    mockChild.emit('message', { type: 'ready', pid: 12345 });

    const result = await promise;
    expect(result.pid).toBe(12345);
    expect(mockChild.unref).toHaveBeenCalledOnce();
  });

  it('should reject on error message from daemon', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon();

    mockChild.emit('message', { type: 'error', message: 'port in use' });

    await expect(promise).rejects.toThrow('Daemon startup failed: port in use');
  });

  it('should reject on fork error', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon();

    mockChild.emit('error', new Error('spawn ENOENT'));

    await expect(promise).rejects.toThrow('Failed to fork daemon: spawn ENOENT');
  });

  it('should reject on unexpected exit', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon();

    mockChild.emit('exit', 1);

    await expect(promise).rejects.toThrow('Daemon exited unexpectedly with code 1');
  });

  it('should reject on timeout', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon();

    // Advance timer past timeout
    vi.advanceTimersByTime(16_000);

    await expect(promise).rejects.toThrow('Daemon failed to start within 15s');
    expect(mockChild.kill).toHaveBeenCalledOnce();
  });

  it('should pass overrides via DAEMON_OVERRIDES env', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const overrides = { host: '192.168.1.1', token: 'test-token' };
    const promise = launchDaemon(overrides);

    // Verify fork was called with correct env
    const forkCall = mockFork.mock.calls[0];
    const forkOptions = forkCall[2] as { env: Record<string, string> };
    const passedOverrides = JSON.parse(forkOptions.env.DAEMON_OVERRIDES);
    expect(passedOverrides).toEqual(overrides);

    // Resolve to avoid unhandled promise rejection
    mockChild.emit('message', { type: 'ready', pid: 1 });
    await promise;
  });

  it('should fork with detached mode and IPC', async () => {
    const { launchDaemon } = await import('../../../src/daemon/daemon-launcher.js');

    const promise = launchDaemon();

    const forkCall = mockFork.mock.calls[0];
    const forkOptions = forkCall[2] as { detached: boolean; stdio: string[] };
    expect(forkOptions.detached).toBe(true);
    expect(forkOptions.stdio).toContain('ipc');

    mockChild.emit('message', { type: 'ready', pid: 1 });
    await promise;
  });
});
