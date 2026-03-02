import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { SpawnResult } from '../../../src/registry/instance-spawner.js';

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
const mockConfig = {
  workspaces: [] as string[] | undefined,
  defaultClaudeArgs: [] as string[],
};
vi.mock('../../../src/config.js', () => ({
  loadUserConfig: () => mockConfig,
}));

// Mock fs - 所有目录都存在
vi.mock('node:fs', () => ({
  existsSync: () => true,
}));

import { createInstanceRoutes } from '../../../src/api/instance-routes.js';
import { AuthModule } from '../../../src/auth/auth-middleware.js';
import type { InstanceInfo } from '@claude-remote/shared';

const TEST_TOKEN = 'test-token-for-instances';

function makeInstance(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    instanceId: 'id-1',
    name: 'test-project',
    host: '0.0.0.0',
    port: 3000,
    pid: process.pid,
    cwd: '/tmp/test',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('instance-routes', () => {
  const currentInstanceId = 'id-current';
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;
  let listFn: ReturnType<typeof vi.fn>;
  let spawner: { spawn: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const authModule = new AuthModule({
      token: TEST_TOKEN,
      sessionTtlMs: 86400000,
      rateLimitPerMinute: 10,
      cookieName: 'session_id_test_instances',
    });

    listFn = vi.fn().mockResolvedValue([]);
    spawner = { spawn: vi.fn() };
    app.use('/api', createInstanceRoutes(authModule, listFn, currentInstanceId, spawner as any));

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    // 重置 mock 状态
    listFn.mockReset().mockResolvedValue([]);
    spawner.spawn.mockReset();
    mockConfig.workspaces = [];
    mockConfig.defaultClaudeArgs = [];
  });

  async function authenticate(): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_TOKEN }),
    });
    const setCookie = res.headers.get('set-cookie');
    return setCookie ?? '';
  }

  it('should require auth for GET /api/instances', async () => {
    const res = await fetch(`${baseUrl}/api/instances`);
    expect(res.status).toBe(401);
  });

  it('should return instance list with isCurrent flag', async () => {
    const instances = [
      makeInstance({ instanceId: 'id-current', port: 3000 }),
      makeInstance({ instanceId: 'id-other', port: 3001 }),
    ];
    listFn.mockResolvedValue(instances);

    const cookie = await authenticate();
    const res = await fetch(`${baseUrl}/api/instances`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);

    const current = body.find((i: any) => i.instanceId === 'id-current');
    const other = body.find((i: any) => i.instanceId === 'id-other');
    expect(current.isCurrent).toBe(true);
    expect(other.isCurrent).toBe(false);
  });

  it('should return empty array when no instances', async () => {
    listFn.mockResolvedValue([]);
    const cookie = await authenticate();

    const res = await fetch(`${baseUrl}/api/instances`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  describe('GET /api/instances/config', () => {
    it('should return merged workspaces from config and running instances', async () => {
      mockConfig.workspaces = ['/workspace/a', '/workspace/b'];
      listFn.mockResolvedValue([
        makeInstance({ cwd: '/workspace/b' }), // 重复
        makeInstance({ cwd: '/workspace/c' }),
      ]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // 应该去重
      expect(body.workspaces.sort()).toEqual(['/workspace/a', '/workspace/b', '/workspace/c'].sort());
    });

    it('should return empty workspaces when no config and no instances', async () => {
      mockConfig.workspaces = undefined;
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workspaces).toEqual([]);
    });
  });

  describe('POST /api/instances/create', () => {
    it('should reject when whitelist is empty', async () => {
      mockConfig.workspaces = undefined;
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/tmp/test' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('not allowed');
    });

    it('should reject directory not in whitelist', async () => {
      mockConfig.workspaces = ['/workspace/a'];
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspace/b' }),
      });

      expect(res.status).toBe(403);
    });

    it('should allow directory from running instance cwd', async () => {
      mockConfig.workspaces = [];
      listFn.mockResolvedValue([
        makeInstance({ cwd: '/tmp/test' }),
      ]);
      spawner.spawn.mockResolvedValue({
        pid: 12345,
        cwd: '/tmp/test',
        name: 'test',
      } as SpawnResult);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/tmp/test' }),
      });

      expect(res.status).toBe(200);
    });

    it('should allow subdirectory of whitelisted path', async () => {
      mockConfig.workspaces = ['/workspace'];
      listFn.mockResolvedValue([]);
      spawner.spawn.mockResolvedValue({
        pid: 12345,
        cwd: '/workspace/subdir',
        name: 'subdir',
      } as SpawnResult);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspace/subdir' }),
      });

      expect(res.status).toBe(200);
    });

    it('should reject path outside whitelisted directory', async () => {
      mockConfig.workspaces = ['/workspace/a'];
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspace/b/subdir' }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject path traversal attempt', async () => {
      mockConfig.workspaces = ['/workspace/a'];
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspace/a/../../etc' }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject prefix-confused path', async () => {
      mockConfig.workspaces = ['/workspace'];
      listFn.mockResolvedValue([]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspacefoo' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
