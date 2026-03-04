import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';

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

// Mock file-lock to avoid filesystem locking in unit tests
vi.mock('../../../src/utils/file-lock.js', () => ({
  withFileLock: (_lockPath: string, fn: () => unknown) => fn(),
  withFileLockAsync: (_lockPath: string, fn: () => Promise<unknown>) => fn(),
}));

import { createConfigRoutes } from '../../../src/api/config-routes.js';
import { AuthModule } from '../../../src/auth/auth-middleware.js';

const TEST_TOKEN = 'test-token-for-config-routes';

describe('config-routes', () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;
  let configPath: string;

  beforeAll(async () => {
    mkdirSync(testConfigDir, { recursive: true });
    configPath = join(testConfigDir, '.claude-remote', 'config.json');

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

  beforeEach(() => {
    // 清理配置目录
    const configDir = join(testConfigDir, '.claude-remote');
    if (existsSync(configDir)) {
      rmSync(configDir, { recursive: true, force: true });
    }
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

  // PUT 端点测试
  it('should require auth for PUT /api/config', async () => {
    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcuts: [], commands: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('should reject invalid config structure', async () => {
    const cookie = await authenticate();

    // shortcuts 不是数组
    let res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ shortcuts: 'invalid', commands: [] }),
    });
    expect(res.status).toBe(400);

    // shortcut 缺少必要字段
    res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ shortcuts: [{ label: 'test' }], commands: [] }),
    });
    expect(res.status).toBe(400);

    // port 不是数字
    res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ port: 'invalid' }),
    });
    expect(res.status).toBe(400);

    // autoSend 不是布尔值
    res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        shortcuts: [],
        commands: [{ label: 'Test', command: '/test', enabled: true, autoSend: 'invalid' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should accept commands with valid autoSend field', async () => {
    const cookie = await authenticate();

    // autoSend: true
    let res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        shortcuts: [],
        commands: [{ label: 'Test', command: '/test', enabled: true, autoSend: true }],
      }),
    });
    expect(res.status).toBe(200);

    // autoSend: false
    res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        shortcuts: [],
        commands: [{ label: 'Test', command: '/test', enabled: true, autoSend: false }],
      }),
    });
    expect(res.status).toBe(200);

    // autoSend 缺失（向后兼容）
    res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        shortcuts: [],
        commands: [{ label: 'Test', command: '/test', enabled: true }],
      }),
    });
    expect(res.status).toBe(200);
  });

  it('should save valid config', async () => {
    const cookie = await authenticate();

    const newConfig = {
      shortcuts: [
        { label: 'Esc', data: '\x1b', enabled: true },
        { label: 'Enter', data: '\r', enabled: false, desc: 'Enter key' },
      ],
      commands: [
        { label: '/help', command: '/help', enabled: true },
      ],
    };

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(newConfig),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // 验证文件已写入
    expect(existsSync(configPath)).toBe(true);
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toHaveLength(2);
    expect(saved.commands).toHaveLength(1);
  });

  it('should preserve existing token when updating config', async () => {
    // 创建带 token 的现有配置
    mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        token: 'existing-secret-token',
        shortcuts: [],
        commands: [],
      }),
      'utf-8'
    );

    const cookie = await authenticate();
    const newConfig = {
      shortcuts: [{ label: 'Test', data: 'x', enabled: true }],
      commands: [],
    };

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(newConfig),
    });

    expect(res.status).toBe(200);

    // 验证 token 被保留
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.token).toBe('existing-secret-token');
    expect(saved.shortcuts).toHaveLength(1);
  });

  it('should create config directory if not exists', async () => {
    const cookie = await authenticate();

    // 配置目录不存在
    expect(existsSync(join(testConfigDir, '.claude-remote'))).toBe(false);

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ shortcuts: [], commands: [] }),
    });

    expect(res.status).toBe(200);
    expect(existsSync(configPath)).toBe(true);
  });

  it('should preserve non-modified config fields when updating (merge, not replace)', async () => {
    // 这是 bug 的核心测试：前端只发送 shortcuts/commands，不应覆盖其他字段
    mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        token: 'secret-token',
        port: 4000,
        host: '192.168.1.100',
        instanceName: 'my-instance',
        claudeCommand: '/usr/local/bin/claude',
        claudeArgs: ['--verbose'],
        shortcuts: [],
        commands: [],
      }),
      'utf-8'
    );

    const cookie = await authenticate();
    // 前端只发送 shortcuts 和 commands（这在 SettingsModal 中是实际行为）
    const partialConfig = {
      shortcuts: [{ label: 'New', data: 'x', enabled: true }],
      commands: [{ label: 'Cmd', command: 'test', enabled: true }],
    };

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(partialConfig),
    });

    expect(res.status).toBe(200);

    // 验证所有字段都被保留（合并而非替换）
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.token).toBe('secret-token');       // 保留
    expect(saved.port).toBe(4000);                   // 保留（不应被覆盖）
    expect(saved.host).toBe('192.168.1.100');        // 保留（不应被覆盖）
    expect(saved.instanceName).toBe('my-instance');  // 保留（不应被覆盖）
    expect(saved.claudeCommand).toBe('/usr/local/bin/claude'); // 保留
    expect(saved.claudeArgs).toEqual(['--verbose']); // 保留
    expect(saved.shortcuts).toHaveLength(1);         // 更新
    expect(saved.commands).toHaveLength(1);          // 更新
  });

  describe('auto-fill default shortcuts and commands', () => {
    it('should fill default shortcuts in response when config exists but missing shortcuts', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          port: 4000,
          commands: [{ label: 'Test', command: 'test', enabled: true }],
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.shortcuts).toBeDefined();
      expect(body.config.shortcuts.length).toBeGreaterThan(0);
      // 验证默认 shortcuts 被填充到响应中
      expect(body.config.shortcuts[0]).toHaveProperty('label');
      expect(body.config.shortcuts[0]).toHaveProperty('data');
      expect(body.config.shortcuts[0]).toHaveProperty('enabled');

      // 验证文件不会被修改（懒填充，不持久化）
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.shortcuts).toBeUndefined();
    });

    it('should fill default commands in response when config exists but missing commands', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          port: 4000,
          shortcuts: [{ label: 'Test', data: 'test', enabled: true }],
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.commands).toBeDefined();
      expect(body.config.commands.length).toBeGreaterThan(0);
      // 验证默认 commands 被填充到响应中
      expect(body.config.commands[0]).toHaveProperty('label');
      expect(body.config.commands[0]).toHaveProperty('command');
      expect(body.config.commands[0]).toHaveProperty('enabled');

      // 验证文件不会被修改（懒填充，不持久化）
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.commands).toBeUndefined();
    });

    it('should fill both shortcuts and commands in response when both are missing', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          port: 4000,
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.shortcuts).toBeDefined();
      expect(body.config.commands).toBeDefined();
      expect(body.config.shortcuts.length).toBeGreaterThan(0);
      expect(body.config.commands.length).toBeGreaterThan(0);

      // 验证其他字段保留
      expect(body.config.port).toBe(4000);
    });

    it('should NOT fill when shortcuts and commands already exist', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          shortcuts: [{ label: 'Custom', data: 'custom', enabled: true }],
          commands: [{ label: 'CustomCmd', command: 'custom', enabled: true }],
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // 应保留用户自定义的配置
      expect(body.config.shortcuts).toHaveLength(1);
      expect(body.config.shortcuts[0].label).toBe('Custom');
      expect(body.config.commands).toHaveLength(1);
      expect(body.config.commands[0].label).toBe('CustomCmd');
    });
  });

  describe('notification config (multi-channel)', () => {
    it('should return notification status in new format', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          shortcuts: [],
          commands: [],
          notifications: {
            dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123' },
          },
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // 验证新版 notifications 结构
      expect(body.config.notifications).toBeDefined();
      expect(body.config.notifications.dingtalk).toEqual({ configured: true });
      // 验证旧版 dingtalk 字段仍然存在（向后兼容）
      expect(body.config.dingtalk).toEqual({ configured: true });
      // 验证不暴露实际 webhook URL
      expect(body.config.notifications.dingtalk.webhookUrl).toBeUndefined();
      expect(body.config.dingtalk.webhookUrl).toBeUndefined();
    });

    it('should migrate old dingtalk config to notifications (read fallback)', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          shortcuts: [],
          commands: [],
          dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=old123' },
        }),
        'utf-8'
      );

      const cookie = await authenticate();
      const res = await fetch(`${baseUrl}/api/config`, {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // 验证旧版 dingtalk 配置被正确识别
      expect(body.config.notifications.dingtalk).toEqual({ configured: true });
      expect(body.config.dingtalk).toEqual({ configured: true });
    });

    it('should save notifications config with dual-write (new and old fields)', async () => {
      const cookie = await authenticate();

      const res = await fetch(`${baseUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          shortcuts: [],
          commands: [],
          notifications: {
            dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=new123' },
          },
        }),
      });

      expect(res.status).toBe(200);

      // 验证双写：同时写入 notifications 和 dingtalk
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.notifications?.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=new123');
      expect(saved.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=new123');
    });

    it('should support old dingtalk format in PUT (backward compatibility)', async () => {
      const cookie = await authenticate();

      const res = await fetch(`${baseUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          shortcuts: [],
          commands: [],
          dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=old456' },
        }),
      });

      expect(res.status).toBe(200);

      // 验证双写：旧格式也会被写入新版 notifications
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=old456');
      expect(saved.notifications?.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=old456');
    });

    it('new notifications should take precedence over old dingtalk', async () => {
      // 先创建带有旧版 dingtalk 配置的文件
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          shortcuts: [],
          commands: [],
          dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=old789' },
        }),
        'utf-8'
      );

      const cookie = await authenticate();

      // 使用新版 notifications 更新
      const res = await fetch(`${baseUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          notifications: {
            dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=new789' },
          },
        }),
      });

      expect(res.status).toBe(200);

      // 验证新版配置覆盖了旧版
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.notifications?.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=new789');
      expect(saved.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=new789');
    });

    it('should reject invalid notifications structure', async () => {
      const cookie = await authenticate();

      // webhookUrl 不是字符串
      const res = await fetch(`${baseUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          shortcuts: [],
          commands: [],
          notifications: {
            dingtalk: { webhookUrl: 12345 },
          },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return empty notification status when no config exists', async () => {
      mkdirSync(join(testConfigDir, '.claude-remote'), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          shortcuts: [],
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
      // 没有通知配置时，notifications 应为空对象或未定义
      expect(body.config.notifications?.dingtalk?.configured).not.toBe(true);
    });
  });
});