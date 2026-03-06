import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import { EventEmitter, Readable } from 'node:stream';

// Mock logger 避免测试中产生日志文件
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock node:https
vi.mock('node:https', () => ({
  get: vi.fn(),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  realpathSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe('update module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectPackageManager', () => {
    it('should return "pnpm" when binary path contains /pnpm/', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.realpathSync).mockReturnValue('/home/user/.local/share/pnpm/global/5/node_modules/.bin/claude-remote');

      const { detectPackageManager } = await import('../../../src/update.js');
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('should return "pnpm" when binary path contains /pnpm-global/', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.realpathSync).mockReturnValue('/opt/pnpm-global/node_modules/.bin/claude-remote');

      const { detectPackageManager } = await import('../../../src/update.js');
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('should return "npm" for standard npm global path', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.realpathSync).mockReturnValue('/usr/local/lib/node_modules/@caoruhua/open-claude-remote/dist/backend/src/cli.js');

      const { detectPackageManager } = await import('../../../src/update.js');
      expect(detectPackageManager()).toBe('npm');
    });

    it('should return "npm" when realpathSync throws', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.realpathSync).mockImplementation(() => { throw new Error('ENOENT'); });

      const { detectPackageManager } = await import('../../../src/update.js');
      expect(detectPackageManager()).toBe('npm');
    });
  });

  describe('isNewerVersion', () => {
    it('should return true when major version is higher', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true);
    });

    it('should return true when minor version is higher', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('1.2.0', '1.1.0')).toBe(true);
    });

    it('should return true when patch version is higher', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('1.0.2', '1.0.1')).toBe(true);
    });

    it('should return false when versions are equal', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    });

    it('should return false when current is newer', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
    });

    it('should return false when current major is higher', async () => {
      const { isNewerVersion } = await import('../../../src/update.js');
      expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return version from package.json', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@caoruhua/open-claude-remote', version: '0.1.4' })
      );

      const { getCurrentVersion } = await import('../../../src/update.js');
      expect(getCurrentVersion()).toBe('0.1.4');
    });

    it('should throw when package.json is not found', async () => {
      const fs = await import('node:fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { getCurrentVersion } = await import('../../../src/update.js');
      expect(() => getCurrentVersion()).toThrow();
    });
  });

  describe('fetchLatestVersion', () => {
    it('should return version from npm registry', async () => {
      const https = await import('node:https');
      const mockResponse = new Readable({
        read() {
          this.push(JSON.stringify({ version: '1.0.0' }));
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      const { fetchLatestVersion } = await import('../../../src/update.js');
      const version = await fetchLatestVersion();
      expect(version).toBe('1.0.0');
    });

    it('should reject on non-200 status', async () => {
      const https = await import('node:https');
      const mockResponse = new Readable({
        read() { this.push(null); },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 404 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      const { fetchLatestVersion } = await import('../../../src/update.js');
      await expect(fetchLatestVersion()).rejects.toThrow('npm registry returned status 404');
    });

    it('should reject on invalid JSON', async () => {
      const https = await import('node:https');
      const mockResponse = new Readable({
        read() {
          this.push('not-json');
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      const { fetchLatestVersion } = await import('../../../src/update.js');
      await expect(fetchLatestVersion()).rejects.toThrow();
    });

    it('should reject on network error', async () => {
      const https = await import('node:https');

      vi.mocked(https.get).mockImplementation((_url: unknown, _cb: unknown) => {
        const req = {
          on: vi.fn().mockImplementation((event: string, handler: (err: Error) => void) => {
            if (event === 'error') {
              // 延迟触发错误以模拟异步行为
              setTimeout(() => handler(new Error('ECONNREFUSED')), 0);
            }
            return req;
          }),
          setTimeout: vi.fn(),
        };
        return req as unknown as ReturnType<typeof https.get>;
      });

      const { fetchLatestVersion } = await import('../../../src/update.js');
      await expect(fetchLatestVersion()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('updatePackage', () => {
    let mockExit: ReturnType<typeof vi.spyOn>;
    let mockStdoutWrite: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockStdoutWrite.mockRestore();
    });

    it('should exit(0) when already up to date', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');

      // getCurrentVersion mock
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@caoruhua/open-claude-remote', version: '1.0.0' })
      );

      // fetchLatestVersion mock
      const mockResponse = new Readable({
        read() {
          this.push(JSON.stringify({ version: '1.0.0' }));
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      const { updatePackage } = await import('../../../src/update.js');
      await updatePackage();

      expect(mockExit).toHaveBeenCalledWith(0);
      // 确认输出了 "up to date" 信息
      const output = mockStdoutWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('up to date');
    });

    it('should spawn npm install when using npm and new version available', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');
      const cp = await import('node:child_process');

      // getCurrentVersion
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@caoruhua/open-claude-remote', version: '0.1.0' })
      );

      // detectPackageManager → npm
      vi.mocked(fs.realpathSync).mockReturnValue('/usr/local/lib/node_modules/.bin/claude-remote');

      // fetchLatestVersion
      const mockResponse = new Readable({
        read() {
          this.push(JSON.stringify({ version: '1.0.0' }));
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      // spawn mock — 模拟成功退出
      const mockChild = new EventEmitter() as ChildProcess;
      vi.mocked(cp.spawn).mockReturnValue(mockChild);

      const { updatePackage } = await import('../../../src/update.js');
      const promise = updatePackage();

      // 延迟触发 close 事件
      setTimeout(() => mockChild.emit('close', 0), 10);
      await promise;

      expect(cp.spawn).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', '@caoruhua/open-claude-remote@latest'],
        expect.objectContaining({ stdio: 'inherit' })
      );
      const output = mockStdoutWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('Successfully updated');
    });

    it('should spawn pnpm add when using pnpm', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');
      const cp = await import('node:child_process');

      // getCurrentVersion
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@caoruhua/open-claude-remote', version: '0.1.0' })
      );

      // detectPackageManager → pnpm
      vi.mocked(fs.realpathSync).mockReturnValue('/home/user/.local/share/pnpm/global/5/node_modules/.bin/claude-remote');

      // fetchLatestVersion
      const mockResponse = new Readable({
        read() {
          this.push(JSON.stringify({ version: '1.0.0' }));
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      // spawn mock — 模拟成功退出
      const mockChild = new EventEmitter() as ChildProcess;
      vi.mocked(cp.spawn).mockReturnValue(mockChild);

      const { updatePackage } = await import('../../../src/update.js');
      const promise = updatePackage();

      setTimeout(() => mockChild.emit('close', 0), 10);
      await promise;

      expect(cp.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['add', '-g', '@caoruhua/open-claude-remote@latest'],
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    it('should show manual command and exit(1) when spawn fails', async () => {
      const fs = await import('node:fs');
      const https = await import('node:https');
      const cp = await import('node:child_process');

      // getCurrentVersion
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@caoruhua/open-claude-remote', version: '0.1.0' })
      );

      // detectPackageManager → npm
      vi.mocked(fs.realpathSync).mockReturnValue('/usr/local/lib/node_modules/.bin/claude-remote');

      // fetchLatestVersion
      const mockResponse = new Readable({
        read() {
          this.push(JSON.stringify({ version: '1.0.0' }));
          this.push(null);
        },
      }) as IncomingMessage;
      Object.assign(mockResponse, { statusCode: 200 });

      vi.mocked(https.get).mockImplementation((_url: unknown, cb: unknown) => {
        (cb as (res: IncomingMessage) => void)(mockResponse);
        return { on: vi.fn().mockReturnThis(), setTimeout: vi.fn() } as unknown as ReturnType<typeof https.get>;
      });

      // spawn mock — 模拟非零退出码
      const mockChild = new EventEmitter() as ChildProcess;
      vi.mocked(cp.spawn).mockReturnValue(mockChild);

      const { updatePackage } = await import('../../../src/update.js');
      const promise = updatePackage();

      setTimeout(() => mockChild.emit('close', 1), 10);
      await promise;

      expect(mockExit).toHaveBeenCalledWith(1);
      const output = mockStdoutWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('npm install -g');
    });
  });
});
