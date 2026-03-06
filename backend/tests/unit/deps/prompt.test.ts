import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showManualInstallHelp,
  showInstallStart,
  showCommand,
  showStepSuccess,
  showStepFailure,
  showCheckStatus,
  showCheckStart,
  showAllReady,
  showInstallFailed,
} from '../../../src/deps/prompt.js';

// Mock process.stderr.write
const mockStderrWrite = vi.fn();
const originalStderrWrite = process.stderr.write;

describe('deps/prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.stderr.write = mockStderrWrite as typeof process.stderr.write;
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.stderr.write = originalStderrWrite;
  });

  describe('showManualInstallHelp', () => {
    it('显示手动安装帮助', () => {
      showManualInstallHelp('node', 'https://nodejs.org/');

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('[ERROR]');
      expect(output).toContain('Cannot auto-install');
      expect(output).toContain('https://nodejs.org/');
    });
  });

  describe('showInstallStart', () => {
    it('显示安装开始信息', () => {
      showInstallStart('pnpm');

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('[Installing pnpm');
    });
  });

  describe('showCommand', () => {
    it('显示命令信息', () => {
      showCommand('npm', ['install', '-g', 'pnpm']);

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('> npm install -g pnpm');
    });
  });

  describe('showStepSuccess', () => {
    it('显示成功信息（默认消息）', () => {
      showStepSuccess();

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✓ Done');
    });

    it('显示成功信息（自定义消息）', () => {
      showStepSuccess('pnpm 9.0.0 installed');

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✓ pnpm 9.0.0 installed');
    });
  });

  describe('showStepFailure', () => {
    it('显示失败信息（默认消息）', () => {
      showStepFailure();

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✗ Failed');
    });

    it('显示失败信息（自定义消息）', () => {
      showStepFailure('Network error');

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✗ Network error');
    });
  });

  describe('showCheckStatus', () => {
    it('显示已安装状态', () => {
      showCheckStatus('node', true, '20.0.0');

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✓ Node.js 20.0.0');
    });

    it('显示未安装状态', () => {
      showCheckStatus('pnpm', false);

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✗ pnpm not found');
    });

    it('无版本时显示 installed', () => {
      showCheckStatus('claude', true);

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('✓ Claude CLI installed');
    });
  });

  describe('showCheckStart', () => {
    it('显示检测开始信息', () => {
      showCheckStart();

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('Checking dependencies');
    });
  });

  describe('showAllReady', () => {
    it('显示所有依赖就绪信息', () => {
      showAllReady();

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('All dependencies ready');
    });
  });

  describe('showInstallFailed', () => {
    it('显示安装失败信息', () => {
      showInstallFailed(['node', 'pnpm']);

      const output = mockStderrWrite.mock.calls.map(c => c[0]).join('');
      expect(output).toContain('[ERROR]');
      expect(output).toContain('Missing: node, pnpm');
    });
  });
});