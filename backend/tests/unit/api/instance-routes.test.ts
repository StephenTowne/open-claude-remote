import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';

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
  claudeArgs: [] as string[],
};
vi.mock('../../../src/config.js', () => ({
  loadUserConfig: () => mockConfig,
  getSettingsDirs: () => [],
  scanSettingsFiles: () => [],
}));

// Mock fs - 所有目录都存在
vi.mock('node:fs', () => ({
  existsSync: () => true,
}));

import { createInstanceRoutes } from '../../../src/api/instance-routes.js';
import { createAuthRoutes } from '../../../src/api/auth-routes.js';
import { AuthModule } from '../../../src/auth/auth-middleware.js';

const TEST_TOKEN = 'test-token-for-instances';

function createMockInstanceManager() {
  return {
    listInstances: vi.fn().mockReturnValue([]),
    createInstance: vi.fn().mockImplementation((opts: any) => ({
      instanceId: 'new-instance-id',
      name: opts.name || 'test',
      cwd: opts.cwd,
    })),
    destroyInstance: vi.fn().mockReturnValue(true),
    getInstance: vi.fn(),
    size: 0,
  };
}

describe('instance-routes', () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;
  let mockManager: ReturnType<typeof createMockInstanceManager>;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const authModule = new AuthModule({
      token: TEST_TOKEN,
      sessionTtlMs: 86400000,
      rateLimitPerMinute: 10,
      cookieName: 'session_id_test_instances',
    });

    mockManager = createMockInstanceManager();
    app.use('/api', createAuthRoutes(authModule));
    app.use('/api', createInstanceRoutes(authModule, mockManager as any));

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
    mockManager.listInstances.mockReset().mockReturnValue([]);
    mockManager.createInstance.mockReset().mockImplementation((opts: any) => ({
      instanceId: 'new-instance-id',
      name: opts.name || 'test',
      cwd: opts.cwd,
    }));
    mockManager.destroyInstance.mockReset().mockReturnValue(true);
    mockConfig.workspaces = [];
    mockConfig.claudeArgs = [];
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

  it('should return instance list', async () => {
    mockManager.listInstances.mockReturnValue([
      { instanceId: 'id-1', name: 'project-a', cwd: '/tmp/a', status: 'running', startedAt: new Date().toISOString(), headless: false, clientCount: 0 },
      { instanceId: 'id-2', name: 'project-b', cwd: '/tmp/b', status: 'idle', startedAt: new Date().toISOString(), headless: true, clientCount: 1 },
    ]);

    const cookie = await authenticate();
    const res = await fetch(`${baseUrl}/api/instances`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].instanceId).toBe('id-1');
    expect(body[1].instanceId).toBe('id-2');
  });

  it('should return empty array when no instances', async () => {
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
      mockManager.listInstances.mockReturnValue([
        { instanceId: 'id-1', name: 'b', cwd: '/workspace/b', status: 'running', startedAt: '', headless: false, clientCount: 0 },
        { instanceId: 'id-2', name: 'c', cwd: '/workspace/c', status: 'running', startedAt: '', headless: false, clientCount: 0 },
      ]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.workspaces.sort()).toEqual(['/workspace/a', '/workspace/b', '/workspace/c'].sort());
    });

    it('should return empty workspaces when no config and no instances', async () => {
      mockConfig.workspaces = undefined;

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
      mockManager.listInstances.mockReturnValue([
        { instanceId: 'id-1', name: 'test', cwd: '/tmp/test', status: 'running', startedAt: '', headless: false, clientCount: 0 },
      ]);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/tmp/test' }),
      });

      expect(res.status).toBe(200);
      expect(mockManager.createInstance).toHaveBeenCalled();
    });

    it('should default headless to true when not specified (web-spawned)', async () => {
      mockConfig.workspaces = ['/tmp/test'];

      const cookie = await authenticate();
      await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/tmp/test' }),
      });

      expect(mockManager.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true }),
      );
    });

    it('should pass headless: false when explicitly set (CLI-spawned)', async () => {
      mockConfig.workspaces = ['/tmp/test'];

      const cookie = await authenticate();
      await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/tmp/test', headless: false }),
      });

      expect(mockManager.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false }),
      );
    });

    it('should allow subdirectory of whitelisted path', async () => {
      mockConfig.workspaces = ['/workspace'];

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

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/workspace/a/../../etc' }),
      });

      expect(res.status).toBe(403);
    });

    it('should bypass workspace validation when headless: false (CLI launch)', async () => {
      // CLI 启动不受 workspace 限制
      mockConfig.workspaces = [];

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/any/directory', headless: false }),
      });

      expect(res.status).toBe(200);
      expect(mockManager.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: '/any/directory', headless: false }),
      );
    });

    it('should apply workspace validation when headless: true (Web launch)', async () => {
      // Web 启动需要 workspace 验证
      mockConfig.workspaces = [];

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/create`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/any/directory', headless: true }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('not allowed');
    });
  });

  describe('DELETE /api/instances/:instanceId', () => {
    it('should destroy an existing instance', async () => {
      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/some-id`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      expect(mockManager.destroyInstance).toHaveBeenCalledWith('some-id');
    });

    it('should return 404 for non-existent instance', async () => {
      mockManager.destroyInstance.mockReturnValue(false);

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/instances/non-existent`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(404);
    });
  });
});
