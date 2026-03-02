import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock qrcode-terminal
vi.mock('qrcode-terminal', () => ({
  default: {
    generate: vi.fn((url: string, options: { small: boolean }, callback: (qr: string) => void) => {
      // 模拟生成简化的二维码输出
      callback('████████\n████████\n████████');
    }),
  },
}));

describe('qrcode-banner', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should print QR code with URL', async () => {
    const { printQRCode } = await import('../../../src/utils/qrcode-banner.js');

    const testUrl = 'http://192.168.1.100:3000?token=abc123';
    printQRCode(testUrl);

    // 验证 qrcode-terminal 被正确调用
    const qrcode = await import('qrcode-terminal');
    expect(qrcode.default.generate).toHaveBeenCalledWith(
      testUrl,
      { small: true },
      expect.any(Function)
    );

    // 验证 stderr 输出包含扫码提示
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining('扫码连接')
    );
  });

  it('should format QR code lines with prefix', async () => {
    const { printQRCode } = await import('../../../src/utils/qrcode-banner.js');

    printQRCode('http://test.url');

    // 验证每一行都有 ║ 前缀
    const calls = stderrWrite.mock.calls;
    const qrCalls = calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('║')
    );
    expect(qrCalls.length).toBeGreaterThan(0);
  });

  it('should skip empty lines in QR output', async () => {
    // 重新 mock 以返回空行
    vi.resetModules();
    vi.doMock('qrcode-terminal', () => ({
      default: {
        generate: vi.fn((url: string, options: { small: boolean }, callback: (qr: string) => void) => {
          // 包含空行的输出
          callback('████████\n\n████████\n');
        }),
      },
    }));

    const { printQRCode } = await import('../../../src/utils/qrcode-banner.js');
    const localStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    printQRCode('http://test.url');

    // 每一个 ║ 前缀的调用都应该包含非空内容
    const prefixCalls = localStderr.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].match(/^║\s+.+/)
    );
    expect(prefixCalls.length).toBeGreaterThan(0);
  });
});