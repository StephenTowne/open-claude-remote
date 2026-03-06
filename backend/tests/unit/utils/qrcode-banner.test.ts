import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock qrcode-terminal
vi.mock('qrcode-terminal', () => ({
  default: {
    generate: vi.fn((url: string, options: { small: boolean }, callback: (qr: string) => void) => {
      // Simulate QR code output (16 lines, 31 chars wide with block characters)
      const mockQR = [
        '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄',
        '█ ▄▄▄▄▄ █  █ ▄▄ █',
        '█ █   █ █▄▀█▄▄▀ █',
        '█ █▄▄▄█ █▄ ▀ ▄▄ █',
        '█ ▄▄▄▄▄ █▄█▄▄█▄▄█',
        '█▄▄▄▄▄▄▄█▄▄▄▄▄▄▄█',
      ].join('\n');
      callback(mockQR);
    }),
  },
}));

describe('qrcode-banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateQRCodeLines', () => {
    it('should return array of QR code lines', async () => {
      const { generateQRCodeLines } = await import('../../../src/utils/qrcode-banner.js');

      const testUrl = 'http://192.168.1.100:3000?token=abc123';
      const lines = generateQRCodeLines(testUrl);

      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should call qrcode-terminal with correct parameters', async () => {
      const { generateQRCodeLines } = await import('../../../src/utils/qrcode-banner.js');
      const qrcode = await import('qrcode-terminal');

      const testUrl = 'http://192.168.1.100:3000?token=abc123';
      generateQRCodeLines(testUrl);

      expect(qrcode.default.generate).toHaveBeenCalledWith(
        testUrl,
        { small: true },
        expect.any(Function)
      );
    });

    it('should filter out empty lines', async () => {
      // Reset modules and re-mock with empty lines
      vi.resetModules();
      vi.doMock('qrcode-terminal', () => ({
        default: {
          generate: vi.fn((url: string, options: { small: boolean }, callback: (qr: string) => void) => {
            // Include empty lines in output
            callback('▄▄▄▄▄\n\n███\n   \n');
          }),
        },
      }));

      const { generateQRCodeLines } = await import('../../../src/utils/qrcode-banner.js');
      const lines = generateQRCodeLines('http://test.url');

      // Empty or whitespace-only lines should be filtered
      expect(lines.every(line => line.trim().length > 0)).toBe(true);
    });

    it('should return lines without border characters', async () => {
      const { generateQRCodeLines } = await import('../../../src/utils/qrcode-banner.js');

      const lines = generateQRCodeLines('http://test.url');

      // Lines should be raw QR content, not prefixed with box characters
      expect(lines.every(line => !line.includes('║'))).toBe(true);
    });
  });
});