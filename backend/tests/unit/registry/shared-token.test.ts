import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
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
    // Clear env
    delete process.env.AUTH_TOKEN;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.AUTH_TOKEN;
  });

  it('should return AUTH_TOKEN env var if set', async () => {
    process.env.AUTH_TOKEN = 'env-token-123';
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('env-token-123');
    expect(result.source).toBe('env');
  });

  it('should read existing token file', async () => {
    const tokenPath = join(testDir, 'token');
    writeFileSync(tokenPath, 'file-token-456', { mode: 0o600 });
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('file-token-456');
    expect(result.source).toBe('file');
  });

  it('should trim whitespace from token file', async () => {
    const tokenPath = join(testDir, 'token');
    writeFileSync(tokenPath, '  file-token-789  \n', { mode: 0o600 });
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('file-token-789');
    expect(result.source).toBe('file');
  });

  it('should generate and persist token if none exists', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(64); // 32 bytes hex
    expect(result.source).toBe('generated');

    // Verify token file was written
    const tokenPath = join(testDir, 'token');
    expect(existsSync(tokenPath)).toBe(true);
    expect(readFileSync(tokenPath, 'utf-8')).toBe(result.token);
  });

  it('should create directory with 0o700 if not exists', async () => {
    const nestedDir = join(testDir, 'nested', '.claude-remote');
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    getOrCreateSharedToken(nestedDir);
    expect(existsSync(nestedDir)).toBe(true);
    const stat = statSync(nestedDir);
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('should set token file permissions to 0o600', async () => {
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    getOrCreateSharedToken(testDir);
    const tokenPath = join(testDir, 'token');
    const stat = statSync(tokenPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('should prioritize AUTH_TOKEN env over file', async () => {
    process.env.AUTH_TOKEN = 'env-wins';
    const tokenPath = join(testDir, 'token');
    writeFileSync(tokenPath, 'file-loses', { mode: 0o600 });
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.token).toBe('env-wins');
    expect(result.source).toBe('env');
  });

  it('should skip empty token file and generate new one', async () => {
    const tokenPath = join(testDir, 'token');
    writeFileSync(tokenPath, '  \n', { mode: 0o600 });
    const { getOrCreateSharedToken } = await import('../../../src/registry/shared-token.js');
    const result = getOrCreateSharedToken(testDir);
    expect(result.source).toBe('generated');
    expect(result.token.length).toBe(64);
  });
});
