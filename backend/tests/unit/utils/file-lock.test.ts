import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { withFileLock, withFileLockAsync } from '../../../src/utils/file-lock.js';

describe('file-lock', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `file-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('withFileLock (sync)', () => {
    it('should acquire and release lock', () => {
      const lockPath = join(testDir, 'test.lock');
      const result = withFileLock(lockPath, () => {
        // 锁目录在回调内应存在
        expect(existsSync(lockPath)).toBe(true);
        return 42;
      });
      expect(result).toBe(42);
      // 锁释放后目录不存在
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should release lock after callback throws', () => {
      const lockPath = join(testDir, 'throw.lock');
      expect(() => {
        withFileLock(lockPath, () => {
          throw new Error('boom');
        });
      }).toThrow('boom');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should retry and succeed when stale lock is detected', () => {
      const lockPath = join(testDir, 'retry.lock');
      // 手动创建锁目录（模拟另一个进程持有的锁）
      mkdirSync(lockPath);

      // staleMs=1 意味着几乎立即检测为僵尸锁并清理
      const result = withFileLock(lockPath, () => 'got-it', {
        retries: 5,
        retryIntervalMs: 5,
        staleMs: 1,
      });
      expect(result).toBe('got-it');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should throw when retries exceeded', () => {
      const lockPath = join(testDir, 'stuck.lock');
      mkdirSync(lockPath);

      expect(() => {
        withFileLock(lockPath, () => 'never', {
          retries: 3,
          retryIntervalMs: 5,
          staleMs: 60000, // 不会过期
        });
      }).toThrow(/acquire file lock/i);

      // 手动清理
      rmSync(lockPath, { recursive: true, force: true });
    });

    it('should clean up stale lock and acquire', () => {
      const lockPath = join(testDir, 'stale.lock');
      mkdirSync(lockPath);
      // 把 mtime 设置为很久以前（无法直接设置目录 mtime，用 staleMs=0 模拟）
      const result = withFileLock(lockPath, () => 'after-stale', {
        staleMs: 0, // 任何锁都视为过期
      });
      expect(result).toBe('after-stale');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should not leave lock directory after successful execution', () => {
      const lockPath = join(testDir, 'clean.lock');
      withFileLock(lockPath, () => 'ok');
      expect(existsSync(lockPath)).toBe(false);
    });
  });

  describe('withFileLockAsync', () => {
    it('should acquire and release lock', async () => {
      const lockPath = join(testDir, 'async.lock');
      const result = await withFileLockAsync(lockPath, async () => {
        expect(existsSync(lockPath)).toBe(true);
        return 'async-result';
      });
      expect(result).toBe('async-result');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should release lock after async callback throws', async () => {
      const lockPath = join(testDir, 'async-throw.lock');
      await expect(
        withFileLockAsync(lockPath, async () => {
          throw new Error('async-boom');
        }),
      ).rejects.toThrow('async-boom');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should retry and succeed when lock is released by another task', async () => {
      const lockPath = join(testDir, 'async-retry.lock');
      mkdirSync(lockPath);
      // setTimeout 可以在 async 等待期间触发
      setTimeout(() => {
        rmSync(lockPath, { recursive: true, force: true });
      }, 30);

      const result = await withFileLockAsync(lockPath, async () => 'async-got-it', {
        retries: 30,
        retryIntervalMs: 10,
      });
      expect(result).toBe('async-got-it');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should clean up stale lock in async mode', async () => {
      const lockPath = join(testDir, 'async-stale.lock');
      mkdirSync(lockPath);
      const result = await withFileLockAsync(lockPath, async () => 'recovered', {
        staleMs: 0,
      });
      expect(result).toBe('recovered');
      expect(existsSync(lockPath)).toBe(false);
    });
  });

  describe('concurrent file counter', () => {
    it('should maintain consistency with sequential lock acquisitions', () => {
      const lockPath = join(testDir, 'counter.lock');
      const counterFile = join(testDir, 'counter.txt');
      writeFileSync(counterFile, '0');

      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        withFileLock(lockPath, () => {
          const current = parseInt(readFileSync(counterFile, 'utf-8'), 10);
          writeFileSync(counterFile, String(current + 1));
        });
      }

      const final = parseInt(readFileSync(counterFile, 'utf-8'), 10);
      expect(final).toBe(iterations);
      expect(existsSync(lockPath)).toBe(false);
    });
  });

  describe('parent directory does not exist', () => {
    it('should create parent directory when it does not exist (sync)', () => {
      // 模拟 ~/.claude-remote 不存在的场景
      const nonExistentDir = join(tmpdir(), `no-parent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const lockPath = join(nonExistentDir, 'settings.json.lock');

      // 确保目录不存在
      expect(existsSync(nonExistentDir)).toBe(false);

      // 应该自动创建父目录并成功获取锁
      const result = withFileLock(lockPath, () => 'success');
      expect(result).toBe('success');
      expect(existsSync(lockPath)).toBe(false);

      // 清理
      rmSync(nonExistentDir, { recursive: true, force: true });
    });

    it('should create parent directory when it does not exist (async)', async () => {
      const nonExistentDir = join(tmpdir(), `no-parent-async-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const lockPath = join(nonExistentDir, 'settings.json.lock');

      expect(existsSync(nonExistentDir)).toBe(false);

      const result = await withFileLockAsync(lockPath, async () => 'async-success');
      expect(result).toBe('async-success');
      expect(existsSync(lockPath)).toBe(false);

      rmSync(nonExistentDir, { recursive: true, force: true });
    });
  });
});
