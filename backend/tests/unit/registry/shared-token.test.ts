import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the logger to keep tests silent
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('shared-token', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `shared-token-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return CLI token if provided', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir, 'cli-token-123');
    expect(result.token).toBe('cli-token-123');
    expect(result.source).toBe('cli');
  });

  it('should read existing token from config.json', async () => {
    const configPath = join(testDir, 'config.json');
    const config = { token: 'config-token-456', shortcuts: [], commands: [] };
    writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('config-token-456');
    expect(result.source).toBe('file');
  });

  it('should generate and persist token to config.json if none exists', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(64); // 32 bytes hex
    expect(result.source).toBe('generated');

    // Verify token was written to config.json
    const configPath = join(testDir, 'config.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.token).toBe(result.token);
  });

  it('should migrate old token file to config.json', async () => {
    // 创建旧的 token 文件
    const oldTokenPath = join(testDir, 'token');
    writeFileSync(oldTokenPath, 'migration-token-789', { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('migration-token-789');
    expect(result.source).toBe('file');

    // 验证 token 已迁移到 config.json
    const configPath = join(testDir, 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.token).toBe('migration-token-789');

    // 验证旧 token 文件已被删除
    expect(existsSync(oldTokenPath)).toBe(false);
  });

  it('should create config.json if not exists when generating token', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);

    const configPath = join(testDir, 'config.json');
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.token).toBe(result.token);
    // shortcuts 和 commands 现在是可选的，生成 token 时不会创建空数组
  });

  it('should preserve existing config fields when adding token', async () => {
    const configPath = join(testDir, 'config.json');
    const existingConfig = {
      shortcuts: [{ label: 'Test', data: 'test data', enabled: true }],
      commands: [{ label: 'Cmd', command: 'echo test', enabled: false }],
    };
    writeFileSync(configPath, JSON.stringify(existingConfig), { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);

    // 验证 token 被添加，且原有字段保留
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.token).toBe(result.token);
    expect(config.shortcuts).toEqual(existingConfig.shortcuts);
    expect(config.commands).toEqual(existingConfig.commands);
  });

  it('should prioritize CLI token over config.json', async () => {
    const configPath = join(testDir, 'config.json');
    const config = { token: 'config-loses', shortcuts: [], commands: [] };
    writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir, 'cli-wins');
    expect(result.token).toBe('cli-wins');
    expect(result.source).toBe('cli');
  });

  it('should create directory with 0o700 if not exists', async () => {
    const nestedDir = join(testDir, 'nested', '.claude-remote');
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    getOrCreateSharedToken(nestedDir);
    expect(existsSync(nestedDir)).toBe(true);
    const stat = statSync(nestedDir);
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('should set config.json file permissions to 0o600', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    getOrCreateSharedToken(testDir);
    const configPath = join(testDir, 'config.json');
    const stat = statSync(configPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('should skip empty token in config.json and generate new one', async () => {
    const configPath = join(testDir, 'config.json');
    const config = { token: '  \n', shortcuts: [], commands: [] };
    writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.source).toBe('generated');
    expect(result.token.length).toBe(64);
  });

  it('should return same token on consecutive calls (second from file)', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const first = getOrCreateSharedToken(testDir);
    expect(first.source).toBe('generated');

    const second = getOrCreateSharedToken(testDir);
    expect(second.token).toBe(first.token);
    expect(second.source).toBe('file');
  });

  it('should not leave lock directory after operation', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    getOrCreateSharedToken(testDir);

    // 检查没有残留的 .lock 目录
    const files = readdirSync(testDir);
    const lockDirs = files.filter(f => f.endsWith('.lock'));
    expect(lockDirs).toHaveLength(0);
  });

  it('should prioritize config.json token over old token file', async () => {
    // 创建 config.json 带有 token
    const configPath = join(testDir, 'config.json');
    const config = { token: 'config-token-priority', shortcuts: [], commands: [] };
    writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });

    // 创建旧的 token 文件
    const oldTokenPath = join(testDir, 'token');
    writeFileSync(oldTokenPath, 'old-token-ignored', { mode: 0o600 });

    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('config-token-priority');
    expect(result.source).toBe('file');

    // 旧文件应保留（因为没被读取迁移）
    expect(existsSync(oldTokenPath)).toBe(true);
  });
});