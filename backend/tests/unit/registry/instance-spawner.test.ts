import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
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
import { InstanceSpawner } from '../../../src/registry/instance-spawner.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('InstanceSpawner', () => {
  let originalKill: typeof process.kill;
  let spawner: InstanceSpawner;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    originalKill = process.kill;
    spawner = new InstanceSpawner();
  });

  afterEach(() => {
    process.kill = originalKill;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should throw if entry script not found', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(() => new InstanceSpawner()).toThrow('Entry script not found');
    });
  });

  describe('spawn', () => {
    it('should pass --no-terminal in headless mode', async () => {
      const mockChild = {
        pid: 12345,
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
      process.kill = vi.fn(() => true) as typeof process.kill;

      vi.useFakeTimers();
      const spawnPromise = spawner.spawn({
        cwd: '/test/project',
        headless: true,
      });

      await vi.runAllTimersAsync();
      const result = await spawnPromise;
      vi.useRealTimers();

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--no-terminal']),
        expect.objectContaining({
          cwd: '/test/project',
          detached: true,
        })
      );
      expect(result.pid).toBe(12345);
    });

    it('should pass --name and --port when provided', async () => {
      const mockChild = {
        pid: 12345,
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
      process.kill = vi.fn(() => true) as typeof process.kill;

      vi.useFakeTimers();
      const spawnPromise = spawner.spawn({
        cwd: '/test/project',
        name: 'my-project',
        port: 3001,
        headless: true,
      });

      await vi.runAllTimersAsync();
      await spawnPromise;
      vi.useRealTimers();

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--name', 'my-project', '--port', '3001']),
        expect.any(Object)
      );
    });

    it('should pass -- separator for claude args', async () => {
      const mockChild = {
        pid: 12345,
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
      process.kill = vi.fn(() => true) as typeof process.kill;

      vi.useFakeTimers();
      const spawnPromise = spawner.spawn({
        cwd: '/test/project',
        claudeArgs: ['chat', '--model', 'claude-sonnet'],
        headless: true,
      });

      await vi.runAllTimersAsync();
      await spawnPromise;
      vi.useRealTimers();

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--', 'chat', '--model', 'claude-sonnet']),
        expect.any(Object)
      );
    });

    it('should reject when child emits error', async () => {
      const mockChild = {
        pid: 12345,
        on: vi.fn((event: string, cb: (err: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => cb(new Error('Spawn failed')), 0);
          }
        }),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const spawnPromise = spawner.spawn({
        cwd: '/test/project',
        headless: true,
      });

      await expect(spawnPromise).rejects.toThrow('Spawn failed');
    });

    it('should resolve with pid/cwd/name on success', async () => {
      const mockChild = {
        pid: 54321,
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
      process.kill = vi.fn(() => true) as typeof process.kill;

      vi.useFakeTimers();
      const spawnPromise = spawner.spawn({
        cwd: '/test/my-project',
        name: 'test-instance',
        headless: true,
      });

      await vi.runAllTimersAsync();
      const result = await spawnPromise;
      vi.useRealTimers();

      expect(result).toEqual({
        pid: 54321,
        cwd: '/test/my-project',
        name: 'test-instance',
      });
    });

    it('should derive name from cwd if not provided', async () => {
      const mockChild = {
        pid: 12345,
        on: vi.fn(),
        unref: vi.fn(),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);
      process.kill = vi.fn(() => true) as typeof process.kill;

      vi.useFakeTimers();
      const spawnPromise = spawner.spawn({
        cwd: '/test/my-project',
        headless: true,
      });

      await vi.runAllTimersAsync();
      const result = await spawnPromise;
      vi.useRealTimers();

      expect(result.name).toBe('my-project');
    });
  });
});