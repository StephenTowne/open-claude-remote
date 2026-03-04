import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock detector module
vi.mock('../../../src/deps/detector.js', () => ({
  checkDependency: vi.fn(),
  checkNodeVersion: vi.fn(),
  checkAllDependencies: vi.fn(),
}));

// Mock installer module
vi.mock('../../../src/deps/installer.js', () => ({
  installWithProgress: vi.fn(),
  tryFallbackInstall: vi.fn(),
}));

// Mock prompt module
vi.mock('../../../src/deps/prompt.js', () => ({
  promptInstall: vi.fn(),
  showAllReady: vi.fn(),
  showCheckStart: vi.fn(),
  showCheckStatus: vi.fn(),
  showManualInstallHelp: vi.fn(),
}));

// Mock platform module
vi.mock('../../../src/deps/platform.js', () => ({
  detectPackageManager: vi.fn(),
  getNodeInstallCommands: vi.fn(),
  getPlatformHelp: vi.fn(),
}));

import { checkAllDependencies, checkNodeVersion } from '../../../src/deps/detector.js';
import { ensureDependencies } from '../../../src/deps/index.js';
import {
  showCheckStart,
  showCheckStatus,
  showAllReady,
} from '../../../src/deps/prompt.js';

const mockCheckAllDependencies = vi.mocked(checkAllDependencies);
const mockCheckNodeVersion = vi.mocked(checkNodeVersion);
const mockShowCheckStart = vi.mocked(showCheckStart);
const mockShowCheckStatus = vi.mocked(showCheckStatus);
const mockShowAllReady = vi.mocked(showAllReady);

// Mock process.stderr.write
const mockStderrWrite = vi.fn();
const originalStderrWrite = process.stderr.write;

describe('deps/index - ensureDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.stderr.write = mockStderrWrite as typeof process.stderr.write;
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.stderr.write = originalStderrWrite;
  });

  describe('silent mode', () => {
    it('所有依赖已安装时不打印任何日志', async () => {
      // 模拟所有依赖都已安装且版本符合
      mockCheckAllDependencies.mockResolvedValue({
        node: { installed: true, version: '20.10.0' },
        pnpm: { installed: true, version: '10.0.0' },
        claude: { installed: true, version: '2.1.0' },
      });
      mockCheckNodeVersion.mockReturnValue(true);

      const result = await ensureDependencies();

      // 验证结果
      expect(result.allInstalled).toBe(true);
      expect(result.installed).toEqual([]);
      expect(result.failed).toEqual([]);

      // 验证静默模式：不打印任何日志
      expect(mockShowCheckStart).not.toHaveBeenCalled();
      expect(mockShowCheckStatus).not.toHaveBeenCalled();
      expect(mockShowAllReady).not.toHaveBeenCalled();
    });

    it('Node.js 版本不满足时打印日志', async () => {
      mockCheckAllDependencies.mockResolvedValue({
        node: { installed: true, version: '18.0.0' },
        pnpm: { installed: true, version: '10.0.0' },
        claude: { installed: true, version: '2.1.0' },
      });
      // checkAllDependenciesSilently 按顺序检查 node, pnpm, claude
      // Node.js 版本不满足（第一次调用），pnpm 版本满足（第二次调用）
      mockCheckNodeVersion
        .mockReturnValueOnce(false) // node 版本检查失败
        .mockReturnValueOnce(true); // pnpm 版本检查通过

      const result = await ensureDependencies();

      expect(result.allInstalled).toBe(false);
      expect(result.failed).toContain('node');

      // 应该显示检测日志
      expect(mockShowCheckStart).toHaveBeenCalled();
    });

    it('有缺失依赖时显示检测日志和已安装状态', async () => {
      mockCheckAllDependencies.mockResolvedValue({
        node: { installed: true, version: '20.10.0' },
        pnpm: { installed: false }, // pnpm 缺失
        claude: { installed: true, version: '2.1.0' },
      });
      mockCheckNodeVersion.mockReturnValue(true);

      // 模拟安装取消
      const { promptInstall } = await import('../../../src/deps/prompt.js');
      vi.mocked(promptInstall).mockResolvedValue(false);

      const result = await ensureDependencies();

      expect(result.allInstalled).toBe(false);
      expect(result.failed).toContain('pnpm');

      // 应该显示检测开始和已安装依赖的状态
      expect(mockShowCheckStart).toHaveBeenCalled();
      // Node.js 和 Claude 已安装，应该显示其状态
      expect(mockShowCheckStatus).toHaveBeenCalledWith('node', true, '20.10.0');
      expect(mockShowCheckStatus).toHaveBeenCalledWith('claude', true, '2.1.0');
      // pnpm 缺失，应该显示未安装状态
      expect(mockShowCheckStatus).toHaveBeenCalledWith('pnpm', false);
    });
  });
});