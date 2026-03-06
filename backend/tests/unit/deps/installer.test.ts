import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installWithProgress, tryFallbackInstall } from '../../../src/deps/installer.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock detector
vi.mock('../../../src/deps/detector.js', () => ({
  checkDependency: vi.fn(),
}));

// Mock prompt
vi.mock('../../../src/deps/prompt.js', () => ({
  showInstallStart: vi.fn(),
  showCommand: vi.fn(),
  showStepSuccess: vi.fn(),
  showStepFailure: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { checkDependency } from '../../../src/deps/detector.js';

const mockSpawn = vi.mocked(spawn);
const mockCheckDependency = vi.mocked(checkDependency);

describe('deps/installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('installWithProgress', () => {
    it('成功安装依赖', async () => {
      // 创建一个 Promise 来控制 spawn 的 close 事件
      let closeCallback: ((code: number) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      // Mock checkDependency - 安装后已安装
      mockCheckDependency.mockResolvedValue({ installed: true, version: '9.0.0' });

      const resultPromise = installWithProgress('pnpm', [
        { command: 'corepack', args: ['enable'], timeout: 10000 },
      ]);

      // 等待 spawn 被调用后触发 close
      await new Promise(resolve => setTimeout(resolve, 10));
      if (closeCallback) {
        closeCallback(0);
      }

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.version).toBe('9.0.0');
    });

    it('安装失败时返回失败结果', async () => {
      let closeCallback: ((code: number) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      mockCheckDependency.mockResolvedValue({ installed: false });

      const resultPromise = installWithProgress('pnpm', [
        { command: 'corepack', args: ['enable'], timeout: 10000 },
      ]);

      await new Promise(resolve => setTimeout(resolve, 10));
      if (closeCallback) {
        closeCallback(1); // 非0退出码
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
    });

    it('命令执行成功但验证失败时提示重启终端', async () => {
      let closeCallback: ((code: number) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      mockCheckDependency.mockResolvedValue({ installed: false }); // 验证失败

      const resultPromise = installWithProgress('pnpm', [
        { command: 'corepack', args: ['enable'], timeout: 10000 },
      ]);

      await new Promise(resolve => setTimeout(resolve, 10));
      if (closeCallback) {
        closeCallback(0); // 命令成功
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('restart your terminal');
    });

    it('spawn 错误时返回失败', async () => {
      let errorCallback: ((err: Error) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number | Error) => void) => {
          if (event === 'error') {
            errorCallback = callback as (err: Error) => void;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      mockCheckDependency.mockResolvedValue({ installed: false });

      const resultPromise = installWithProgress('pnpm', [
        { command: 'nonexistent', args: [], timeout: 10000 },
      ]);

      await new Promise(resolve => setTimeout(resolve, 10));
      if (errorCallback) {
        errorCallback(new Error('Command not found'));
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
    });
  });

  describe('tryFallbackInstall', () => {
    it('pnpm 备用安装成功', async () => {
      let closeCallback: ((code: number) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      mockCheckDependency.mockResolvedValue({ installed: true, version: '9.0.0' });

      const resultPromise = tryFallbackInstall('pnpm');

      await new Promise(resolve => setTimeout(resolve, 10));
      if (closeCallback) {
        closeCallback(0);
      }

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.version).toBe('9.0.0');
    });

    it('非 pnpm 返回无备用方案', async () => {
      const result = await tryFallbackInstall('node');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No fallback available');
    });

    it('pnpm 备用安装失败', async () => {
      let closeCallback: ((code: number) => void) | null = null;
      const mockProc = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback;
          }
        }),
        kill: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProc as unknown as ReturnType<typeof spawn>);

      mockCheckDependency.mockResolvedValue({ installed: false });

      const resultPromise = tryFallbackInstall('pnpm');

      await new Promise(resolve => setTimeout(resolve, 10));
      if (closeCallback) {
        closeCallback(1);
      }

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Fallback install failed');
    });
  });
});