import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const authModule = new AuthModule({
      token: TEST_TOKEN,
      sessionTtlMs: 86400000,
      rateLimitPerMinute: 10,
      cookieName: 'session_id_test_instances',
    });

    listFn = vi.fn().mockReturnValue([]);
    app.use('/api', createInstanceRoutes(authModule, listFn, currentInstanceId));

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
    listFn.mockReturnValue(instances);

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
    listFn.mockReturnValue([]);
    const cookie = await authenticate();

    const res = await fetch(`${baseUrl}/api/instances`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
