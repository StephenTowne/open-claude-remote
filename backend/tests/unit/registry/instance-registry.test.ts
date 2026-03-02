import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { InstanceRegistryManager } from '../../../src/registry/instance-registry.js';
import type { InstanceInfo } from '@claude-remote/shared';

function makeInstance(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    instanceId: `id-${Math.random().toString(36).slice(2)}`,
    name: 'test-project',
    host: '0.0.0.0',
    port: 3000,
    pid: process.pid, // Use current process PID so it passes liveness check
    cwd: '/tmp/test',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('InstanceRegistryManager', () => {
  let testDir: string;
  let registry: InstanceRegistryManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    registry = new InstanceRegistryManager(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('register', () => {
    it('should register a new instance', async () => {
      const info = makeInstance();
      registry.register(info);

      const list = await registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].instanceId).toBe(info.instanceId);
    });

    it('should register multiple instances', async () => {
      registry.register(makeInstance({ port: 3000 }));
      registry.register(makeInstance({ port: 3001 }));

      const list = await registry.list();
      expect(list).toHaveLength(2);
    });

    it('should create registry file if not exists', () => {
      const info = makeInstance();
      registry.register(info);

      const filePath = join(testDir, 'instances.json');
      expect(existsSync(filePath)).toBe(true);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content.version).toBe(1);
      expect(content.instances).toHaveLength(1);
    });

    it('should replace existing instance with same instanceId', async () => {
      const info = makeInstance();
      registry.register(info);
      registry.register({ ...info, port: 3999 });

      const list = await registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].port).toBe(3999);
    });
  });

  describe('unregister', () => {
    it('should remove an instance by id', async () => {
      const info = makeInstance();
      registry.register(info);
      registry.unregister(info.instanceId);

      const list = await registry.list();
      expect(list).toHaveLength(0);
    });

    it('should not throw when removing non-existent instance', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array when no registry file', async () => {
      const list = await registry.list();
      expect(list).toEqual([]);
    });

    it('should clean up zombie processes', async () => {
      // Register with a PID that definitely doesn't exist
      const zombieInfo = makeInstance({ pid: 999999 });
      registry.register(zombieInfo);

      // Also register with our own PID (alive)
      const aliveInfo = makeInstance({ pid: process.pid, port: 3001 });
      registry.register(aliveInfo);

      const list = await registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].instanceId).toBe(aliveInfo.instanceId);
    });

    it('should handle corrupted registry file gracefully', async () => {
      const filePath = join(testDir, 'instances.json');
      const { writeFileSync } = require('node:fs');
      writeFileSync(filePath, 'not valid json!!!');

      const list = await registry.list();
      expect(list).toEqual([]);
    });
  });

  describe('atomic write', () => {
    it('should write atomically via temp file + rename', () => {
      const info = makeInstance();
      registry.register(info);

      // Verify no leftover tmp files
      const files = readdirSync(testDir);
      const tmpFiles = files.filter((f: string) => f.includes('.tmp.'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('file lock', () => {
    it('should not leave lock directory after register', () => {
      registry.register(makeInstance());
      const files = readdirSync(testDir);
      const lockDirs = files.filter(f => f.endsWith('.lock'));
      expect(lockDirs).toHaveLength(0);
    });

    it('should maintain consistency after register + unregister sequence', async () => {
      const a = makeInstance({ port: 3000 });
      const b = makeInstance({ port: 3001 });

      registry.register(a);
      registry.register(b);
      expect(await registry.list()).toHaveLength(2);

      registry.unregister(a.instanceId);
      const remaining = await registry.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].instanceId).toBe(b.instanceId);

      // 锁不残留
      const files = readdirSync(testDir);
      const lockDirs = files.filter(f => f.endsWith('.lock'));
      expect(lockDirs).toHaveLength(0);
    });
  });
});
