import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock daemon-client 内部的 fetch (getDaemonStatus 使用)
// Mock update 模块
vi.mock('../../../src/update.js', () => ({
  getCurrentVersion: vi.fn(),
  fetchLatestVersion: vi.fn(),
  isNewerVersion: vi.fn(),
}));

// Mock getDaemonStatus — 通过 mock 同模块中的其他导出
// 由于 getFullVersionInfo 在 daemon-client.ts 中直接调用同文件的 getDaemonStatus，
// 我们需要 mock 全局 fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('getFullVersionInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 重置 fetch mock
    mockFetch.mockReset();
  });

  it('should return up_to_date when all versions match', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    vi.mocked(update.fetchLatestVersion).mockResolvedValue('0.2.5');
    vi.mocked(update.isNewerVersion).mockReturnValue(false);

    // Mock getDaemonStatus via fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.daemonVersion).toBe('0.2.5');
    expect(info.cliVersion).toBe('0.2.5');
    expect(info.latestVersion).toBe('0.2.5');
    expect(info.needsRestart).toBe(false);
    expect(info.updateAvailable).toBe(false);
    expect(info.advice).toBe('up_to_date');
  });

  it('should return restart_daemon when daemon version differs from CLI', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.6');
    vi.mocked(update.fetchLatestVersion).mockResolvedValue('0.2.6');
    // isNewerVersion(cli=0.2.6, daemon=0.2.5) → true; isNewerVersion(latest=0.2.6, cli=0.2.6) → false
    vi.mocked(update.isNewerVersion).mockImplementation((a, b) => a === '0.2.6' && b === '0.2.5');

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.daemonVersion).toBe('0.2.5');
    expect(info.cliVersion).toBe('0.2.6');
    expect(info.needsRestart).toBe(true);
    expect(info.updateAvailable).toBe(false);
    expect(info.advice).toBe('restart_daemon');
  });

  it('should return update_available when npm has newer version', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    vi.mocked(update.fetchLatestVersion).mockResolvedValue('0.3.0');
    // isNewerVersion(cli=0.2.5, daemon=0.2.5) → false; isNewerVersion(latest=0.3.0, cli=0.2.5) → true
    vi.mocked(update.isNewerVersion).mockImplementation((a, b) => a === '0.3.0' && b === '0.2.5');

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.daemonVersion).toBe('0.2.5');
    expect(info.cliVersion).toBe('0.2.5');
    expect(info.latestVersion).toBe('0.3.0');
    expect(info.needsRestart).toBe(false);
    expect(info.updateAvailable).toBe(true);
    expect(info.advice).toBe('update_available');
  });

  it('should return update_and_restart when both outdated', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.6');
    vi.mocked(update.fetchLatestVersion).mockResolvedValue('0.3.0');
    // isNewerVersion(latest, cli) → true
    vi.mocked(update.isNewerVersion).mockReturnValue(true);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.daemonVersion).toBe('0.2.5');
    expect(info.cliVersion).toBe('0.2.6');
    expect(info.latestVersion).toBe('0.3.0');
    expect(info.needsRestart).toBe(true);
    expect(info.updateAvailable).toBe(true);
    expect(info.advice).toBe('update_and_restart');
  });

  it('should handle npm check failure gracefully', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    vi.mocked(update.fetchLatestVersion).mockRejectedValue(new Error('network error'));
    vi.mocked(update.isNewerVersion).mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.latestVersion).toBeNull();
    expect(info.updateAvailable).toBe(false);
    expect(info.needsRestart).toBe(false);
    expect(info.advice).toBe('up_to_date');
  });

  it('should skip npm check when skipNpmCheck is true', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    vi.mocked(update.isNewerVersion).mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo({ skipNpmCheck: true });

    expect(update.fetchLatestVersion).not.toHaveBeenCalled();
    expect(info.latestVersion).toBeNull();
    expect(info.advice).toBe('up_to_date');
  });

  it('should handle daemon not running', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    vi.mocked(update.fetchLatestVersion).mockResolvedValue('0.2.5');
    vi.mocked(update.isNewerVersion).mockReturnValue(false);

    // getDaemonStatus throws when daemon is not running
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    const info = await getFullVersionInfo();

    expect(info.daemonVersion).toBeNull();
    expect(info.cliVersion).toBe('0.2.5');
    expect(info.needsRestart).toBe(false);
    expect(info.updateAvailable).toBe(false);
    expect(info.advice).toBe('up_to_date');
  });

  it('should timeout npm check and return null latestVersion', async () => {
    const update = await import('../../../src/update.js');
    vi.mocked(update.getCurrentVersion).mockReturnValue('0.2.5');
    // fetchLatestVersion 永不 resolve（模拟超时）
    vi.mocked(update.fetchLatestVersion).mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );
    vi.mocked(update.isNewerVersion).mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok',
        version: '0.2.5',
        pid: 12345,
        port: 8866,
        startedAt: null,
        uptime: null,
        instanceCount: 0,
      }),
    });

    const { getFullVersionInfo } = await import('../../../src/daemon/daemon-client.js');
    // 使用很短的超时来快速测试
    const info = await getFullVersionInfo({ npmCheckTimeout: 50 });

    expect(info.latestVersion).toBeNull();
    expect(info.updateAvailable).toBe(false);
  });
});
