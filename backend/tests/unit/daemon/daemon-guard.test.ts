import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock fs.appendFileSync / mkdirSync before importing module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('daemon-guard', () => {
  // Store original listeners to restore after each test
  let originalUncaughtListeners: NodeJS.UncaughtExceptionListener[];
  let originalRejectionListeners: NodeJS.UnhandledRejectionListener[];
  let originalExitListeners: NodeJS.ExitListener[];
  let originalSighupListeners: NodeJS.SignalsListener[];

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(fs.appendFileSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();

    // Save original listeners
    originalUncaughtListeners = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
    originalRejectionListeners = process.listeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
    originalExitListeners = process.listeners('exit') as NodeJS.ExitListener[];
    originalSighupListeners = process.listeners('SIGHUP') as NodeJS.SignalsListener[];
  });

  afterEach(() => {
    // Remove any listeners added by our tests
    const currentUncaught = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
    for (const listener of currentUncaught) {
      if (!originalUncaughtListeners.includes(listener)) {
        process.removeListener('uncaughtException', listener);
      }
    }

    const currentRejection = process.listeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
    for (const listener of currentRejection) {
      if (!originalRejectionListeners.includes(listener)) {
        process.removeListener('unhandledRejection', listener);
      }
    }

    const currentExit = process.listeners('exit') as NodeJS.ExitListener[];
    for (const listener of currentExit) {
      if (!originalExitListeners.includes(listener)) {
        process.removeListener('exit', listener);
      }
    }

    const currentSighup = process.listeners('SIGHUP') as NodeJS.SignalsListener[];
    for (const listener of currentSighup) {
      if (!originalSighupListeners.includes(listener)) {
        process.removeListener('SIGHUP', listener);
      }
    }

    vi.restoreAllMocks();
  });

  describe('installDaemonGuard', () => {
    it('should register uncaughtException, unhandledRejection, exit, and SIGHUP handlers', async () => {
      const uncaughtBefore = process.listenerCount('uncaughtException');
      const rejectionBefore = process.listenerCount('unhandledRejection');
      const exitBefore = process.listenerCount('exit');
      const sighupBefore = process.listenerCount('SIGHUP');

      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      expect(process.listenerCount('uncaughtException')).toBe(uncaughtBefore + 1);
      expect(process.listenerCount('unhandledRejection')).toBe(rejectionBefore + 1);
      expect(process.listenerCount('exit')).toBe(exitBefore + 1);
      expect(process.listenerCount('SIGHUP')).toBe(sighupBefore + 1);
    });

    it('should not register handlers twice on repeated calls', async () => {
      const uncaughtBefore = process.listenerCount('uncaughtException');

      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();
      installDaemonGuard();

      expect(process.listenerCount('uncaughtException')).toBe(uncaughtBefore + 1);
    });
  });

  describe('uncaughtException handler', () => {
    it('should write crash log entry with error details', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      // Get the handler we just added (it's the last one)
      const handlers = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
      const handler = handlers[handlers.length - 1];

      const testError = new Error('test uncaught');
      handler(testError, 'uncaughtException');

      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(fs.appendFileSync).mock.calls[0];
      const filePath = callArgs[0] as string;
      const content = callArgs[1] as string;

      expect(filePath).toContain('crash.log');
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('uncaughtException');
      expect(entry.error.message).toBe('test uncaught');
      expect(entry.error.stack).toBeDefined();
      expect(entry.pid).toBe(process.pid);
      expect(entry.uptime).toBeTypeOf('number');
      expect(entry.timestamp).toBeDefined();

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('unhandledRejection handler', () => {
    it('should write crash log entry with rejection reason', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const handlers = process.listeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
      const handler = handlers[handlers.length - 1];

      const testError = new Error('test rejection');
      handler(testError, Promise.resolve());

      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const content = vi.mocked(fs.appendFileSync).mock.calls[0][1] as string;
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('unhandledRejection');
      expect(entry.error.message).toBe('test rejection');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should handle non-Error rejection reason', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const handlers = process.listeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
      const handler = handlers[handlers.length - 1];

      handler('string rejection reason', Promise.resolve());

      const content = vi.mocked(fs.appendFileSync).mock.calls[0][1] as string;
      const entry = JSON.parse(content.trim());
      expect(entry.error.message).toBe('string rejection reason');

      mockExit.mockRestore();
    });
  });

  describe('fatalHandled prevents duplicate writes', () => {
    it('should only write crash log once for multiple fatal events', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const handlers = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
      const handler = handlers[handlers.length - 1];

      // Call twice
      handler(new Error('first'), 'uncaughtException');
      handler(new Error('second'), 'uncaughtException');

      // Only the first write should happen
      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      mockExit.mockRestore();
    });
  });

  describe('markGracefulShutdown', () => {
    it('should prevent exit handler from writing crash log on non-zero exit', async () => {
      const { installDaemonGuard, markGracefulShutdown } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      // Mark graceful shutdown
      markGracefulShutdown();

      // Trigger exit with non-zero code
      const exitHandlers = process.listeners('exit') as NodeJS.ExitListener[];
      const exitHandler = exitHandlers[exitHandlers.length - 1];
      exitHandler(1);

      // Should NOT write crash log because shutdown was graceful
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });
  });

  describe('exit handler', () => {
    it('should write crash log on non-zero exit when not graceful', async () => {
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const exitHandlers = process.listeners('exit') as NodeJS.ExitListener[];
      const exitHandler = exitHandlers[exitHandlers.length - 1];

      exitHandler(1);

      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const content = vi.mocked(fs.appendFileSync).mock.calls[0][1] as string;
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('unexpectedExit');
      expect(entry.exitCode).toBe(1);
    });

    it('should not write crash log on zero exit code', async () => {
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const exitHandlers = process.listeners('exit') as NodeJS.ExitListener[];
      const exitHandler = exitHandlers[exitHandlers.length - 1];

      exitHandler(0);

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should not write if fatal handler already wrote', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      // Trigger uncaughtException first
      const uncaughtHandlers = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
      const uncaughtHandler = uncaughtHandlers[uncaughtHandlers.length - 1];
      uncaughtHandler(new Error('crash'), 'uncaughtException');

      // Then trigger exit
      const exitHandlers = process.listeners('exit') as NodeJS.ExitListener[];
      const exitHandler = exitHandlers[exitHandlers.length - 1];
      exitHandler(1);

      // Should only have one write (from uncaughtException)
      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      mockExit.mockRestore();
    });
  });

  describe('SIGHUP handler', () => {
    it('should write crash log on SIGHUP', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const sighupHandlers = process.listeners('SIGHUP') as NodeJS.SignalsListener[];
      const handler = sighupHandlers[sighupHandlers.length - 1];

      handler('SIGHUP');

      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const content = vi.mocked(fs.appendFileSync).mock.calls[0][1] as string;
      const entry = JSON.parse(content.trim());
      expect(entry.event).toBe('SIGHUP');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('crash log format', () => {
    it('should produce valid JSON Lines with all required fields', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const handlers = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
      const handler = handlers[handlers.length - 1];

      handler(new Error('format test'), 'uncaughtException');

      const content = vi.mocked(fs.appendFileSync).mock.calls[0][1] as string;
      // Should end with newline (JSON Lines format)
      expect(content.endsWith('\n')).toBe(true);

      const entry = JSON.parse(content.trim());
      // Required fields
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('event');
      expect(entry).toHaveProperty('error');
      expect(entry).toHaveProperty('pid');
      expect(entry).toHaveProperty('uptime');

      // Timestamp should be ISO format
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);

      mockExit.mockRestore();
    });

    it('should write to crash.log in the log directory', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const { installDaemonGuard } = await import('../../../src/daemon/daemon-guard.js');
      installDaemonGuard();

      const handlers = process.listeners('uncaughtException') as NodeJS.UncaughtExceptionListener[];
      const handler = handlers[handlers.length - 1];

      handler(new Error('path test'), 'uncaughtException');

      const filePath = vi.mocked(fs.appendFileSync).mock.calls[0][0] as string;
      const expectedDir = process.env.LOG_DIR ?? path.resolve(os.homedir(), '.claude-remote', 'logs');
      expect(filePath).toBe(path.resolve(expectedDir, 'crash.log'));

      mockExit.mockRestore();
    });
  });
});
