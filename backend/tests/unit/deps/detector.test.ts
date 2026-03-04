import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkDependency, checkNodeVersion, checkAllDependencies } from '../../../src/deps/detector.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

describe('deps/detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkDependency', () => {
    it('检测已安装的依赖并返回版本', async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, { stdout: 'v20.10.0\n', stderr: '' });
      }) as typeof execFile);

      const result = await checkDependency('node');

      expect(result.installed).toBe(true);
      expect(result.version).toBe('20.10.0');
    });

    it('检测未安装的依赖', async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void
      ) => {
        callback(new Error('command not found'));
      }) as typeof execFile);

      const result = await checkDependency('pnpm');

      expect(result.installed).toBe(false);
      expect(result.version).toBeUndefined();
    });

    it('处理不带 v 前缀的版本输出', async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, { stdout: '9.0.0\n', stderr: '' });
      }) as typeof execFile);

      const result = await checkDependency('pnpm');

      expect(result.installed).toBe(true);
      expect(result.version).toBe('9.0.0');
    });

    it('处理多行版本输出', async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, { stdout: '1.2.3\nSome additional info\n', stderr: '' });
      }) as typeof execFile);

      const result = await checkDependency('claude');

      expect(result.installed).toBe(true);
      expect(result.version).toBe('1.2.3');
    });

    it('处理版本格式不匹配的情况', async () => {
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string; stderr: string }) => void
      ) => {
        callback(null, { stdout: 'custom-version-build\n', stderr: '' });
      }) as typeof execFile);

      const result = await checkDependency('node');

      expect(result.installed).toBe(true);
      expect(result.version).toBe('custom-version-build');
    });
  });

  describe('checkNodeVersion', () => {
    it('版本满足最低要求时返回 true', () => {
      expect(checkNodeVersion('20.0.0', '20')).toBe(true);
      expect(checkNodeVersion('22.0.0', '20')).toBe(true);
      expect(checkNodeVersion('20.10.0', '20')).toBe(true);
    });

    it('版本不满足最低要求时返回 false', () => {
      expect(checkNodeVersion('18.0.0', '20')).toBe(false);
      expect(checkNodeVersion('19.9.9', '20')).toBe(false);
    });

    it('处理带 v 前缀的版本', () => {
      expect(checkNodeVersion('v20.0.0', '20')).toBe(true);
      expect(checkNodeVersion('v18.0.0', '20')).toBe(false);
    });
  });

  describe('checkAllDependencies', () => {
    it('返回所有依赖的状态', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation(((
        _cmd: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string; stderr: string }) => void
      ) => {
        callCount++;
        const versions = ['v20.0.0', '9.0.0', '0.2.0'];
        callback(null, { stdout: versions[callCount - 1] + '\n', stderr: '' });
      }) as typeof execFile);

      const results = await checkAllDependencies();

      expect(results.node.installed).toBe(true);
      expect(results.pnpm.installed).toBe(true);
      expect(results.claude.installed).toBe(true);
    });
  });
});