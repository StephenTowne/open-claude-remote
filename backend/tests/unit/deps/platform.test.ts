import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectPlatform,
  detectArch,
  detectPackageManager,
  getNodeInstallCommands,
  getPlatformHelp,
} from '../../../src/deps/platform.js';

// Mock node:os
vi.mock('node:os', () => ({
  platform: vi.fn(),
  arch: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { platform, arch } from 'node:os';
import { execSync } from 'node:child_process';

const mockPlatform = vi.mocked(platform);
const mockArch = vi.mocked(arch);
const mockExecSync = vi.mocked(execSync);

describe('deps/platform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('detectPlatform', () => {
    it('返回当前平台', () => {
      mockPlatform.mockReturnValue('darwin');

      expect(detectPlatform()).toBe('darwin');
    });

    it('支持不同平台', () => {
      mockPlatform.mockReturnValue('linux');
      expect(detectPlatform()).toBe('linux');

      mockPlatform.mockReturnValue('win32');
      expect(detectPlatform()).toBe('win32');
    });
  });

  describe('detectArch', () => {
    it('返回 CPU 架构', () => {
      mockArch.mockReturnValue('arm64');

      expect(detectArch()).toBe('arm64');
    });
  });

  describe('detectPackageManager', () => {
    describe('macOS (darwin)', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('darwin');
      });

      it('检测到 Homebrew', () => {
        mockExecSync.mockImplementation(() => Buffer.from('/opt/homebrew/bin/brew'));

        expect(detectPackageManager()).toBe('brew');
      });

      it('未检测到包管理器', () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('not found');
        });

        expect(detectPackageManager()).toBe('none');
      });
    });

    describe('Linux', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('linux');
      });

      it('优先检测 apt-get', () => {
        mockExecSync.mockImplementation(() => Buffer.from('/usr/bin/apt-get'));

        expect(detectPackageManager()).toBe('apt');
      });

      it('检测 dnf 作为备选', () => {
        mockExecSync
          .mockImplementationOnce(() => {
            throw new Error('not found');
          })
          .mockImplementationOnce(() => Buffer.from('/usr/bin/dnf'));

        expect(detectPackageManager()).toBe('dnf');
      });

      it('未检测到包管理器', () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('not found');
        });

        expect(detectPackageManager()).toBe('none');
      });
    });

    describe('Windows (win32)', () => {
      beforeEach(() => {
        mockPlatform.mockReturnValue('win32');
      });

      it('检测到 winget', () => {
        mockExecSync.mockImplementation(() => Buffer.from('C:\\Windows\\winget.exe'));

        expect(detectPackageManager()).toBe('winget');
      });

      it('检测到 Chocolatey 作为备选', () => {
        mockExecSync
          .mockImplementationOnce(() => {
            throw new Error('not found');
          })
          .mockImplementationOnce(() => Buffer.from('C:\\ProgramData\\chocolatey\\bin\\choco.exe'));

        expect(detectPackageManager()).toBe('choco');
      });

      it('未检测到包管理器', () => {
        mockExecSync.mockImplementation(() => {
          throw new Error('not found');
        });

        expect(detectPackageManager()).toBe('none');
      });
    });
  });

  describe('getNodeInstallCommands', () => {
    it('返回 brew 安装命令', () => {
      const commands = getNodeInstallCommands('brew');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('brew');
      expect(commands[0].args).toContain('node');
    });

    it('返回 apt 安装命令（需要 sudo）', () => {
      const commands = getNodeInstallCommands('apt');

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some(c => c.command === 'sudo')).toBe(true);
      // 检查使用 apt-get 而不是 apt
      expect(commands.some(c => c.args.includes('apt-get'))).toBe(true);
    });

    it('返回 dnf 安装命令', () => {
      const commands = getNodeInstallCommands('dnf');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('sudo');
    });

    it('返回 winget 安装命令', () => {
      const commands = getNodeInstallCommands('winget');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('winget');
    });

    it('返回 choco 安装命令', () => {
      const commands = getNodeInstallCommands('choco');

      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('choco');
    });

    it('无包管理器时返回空数组', () => {
      const commands = getNodeInstallCommands('none');

      expect(commands).toHaveLength(0);
    });
  });

  describe('getPlatformHelp', () => {
    it('有包管理器时返回空字符串', () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockImplementation(() => Buffer.from('/opt/homebrew/bin/brew'));

      expect(getPlatformHelp()).toBe('');
    });

    it('macOS 无 brew 时返回安装提示', () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const help = getPlatformHelp();
      expect(help).toContain('Homebrew');
    });

    it('Linux 无包管理器时返回 NodeSource 提示', () => {
      mockPlatform.mockReturnValue('linux');
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const help = getPlatformHelp();
      expect(help).toContain('NodeSource');
    });

    it('Windows 无包管理器时返回 nodejs.org 提示', () => {
      mockPlatform.mockReturnValue('win32');
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const help = getPlatformHelp();
      expect(help).toContain('nodejs.org');
    });
  });
});