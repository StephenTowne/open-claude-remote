import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Use vi.hoisted with pure Node APIs (not vitest imports)
const testConfigDir = vi.hoisted(() => {
  const os = require('node:os');
  const path = require('node:path');
  return path.join(os.tmpdir(), `config-routes-test-${Date.now()}-${process.pid}`);
});

// Mock homedir to use temp directory
vi.mock('node:os', () => ({
  homedir: () => testConfigDir,
}));

import { createConfigRoutes } from '../../../src/api/config-routes.js';
import { AuthModule } from '../../../src/auth/auth-middleware.js';

const TEST_TOKEN = 'test-token-for-config-routes';

describe('config-routes', () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    mkdirSync(testConfigDir, { recursive: true });

    const app = express();
    app.use(express.json());

    const authModule = new AuthModule({
      token: TEST_TOKEN,
      sessionTtlMs: 86400000,
      rateLimitPerMinute: 10,
      cookieName: 'session_id_test_config',
    });

    app.use('/api', createConfigRoutes(authModule));

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
    rmSync(testConfigDir, { recursive: true, force: true });
  });

  async function authenticate(): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TEST_TOKEN }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error(`Auth failed: no cookie. Status: ${res.status}`);
    }
    // 只返回 name=value 部分
    return setCookie.split(';')[0];
  }

  it('should require auth for GET /api/config', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(401);
  });

  it('should return null when config file does not exist', async () => {
    const cookie = await authenticate();
    const res = await fetch(`${baseUrl}/api/config`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeNull();
    expect(body.configPath).toContain('config.json');
  });

  it('should return config without token field', async () => {
    // 创建带有 token 的配置文件
    const configPath = join(testConfigDir, '.claude-remote', 'config.json');
    mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        token: 'secret-token-should-not-be-exposed',
        shortcuts: [{ label: 'Test', data: 'test data', enabled: true }],
        commands: [{ label: 'Cmd', command: 'echo test', enabled: false }],
      }),
      'utf-8'
    );

    const cookie = await authenticate();
    const res = await fetch(`${baseUrl}/api/config`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
    expect(body.config.token).toBeUndefined();
    expect(body.config.shortcuts).toHaveLength(1);
    expect(body.config.commands).toHaveLength(1);
  });

  it('should return config as-is when no token field', async () => {
    // 创建不带 token 的配置文件
    const configPath = join(testConfigDir, '.claude-remote', 'config.json');
    mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        shortcuts: [{ label: 'Shortcut1', data: 'data1', enabled: true }],
        commands: [],
      }),
      'utf-8'
    );

    const cookie = await authenticate();
    const res = await fetch(`${baseUrl}/api/config`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.shortcuts).toHaveLength(1);
    expect(body.config.commands).toHaveLength(0);
  });
});