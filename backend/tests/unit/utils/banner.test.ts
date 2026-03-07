import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printBanner } from '../../../src/utils/banner.js';

// Mock qrcode-banner to return deterministic lines
vi.mock('../../../src/utils/qrcode-banner.js', () => ({
  generateQRCodeLines: vi.fn(() => ['██  ██', '  ████', '██  ██']),
}));

// Mock update to return deterministic version
vi.mock('../../../src/update.js', () => ({
  getCurrentVersion: vi.fn(() => '1.2.3'),
}));

describe('printBanner', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrWrite.mockRestore();
  });

  it('should print banner with all fields', () => {
    printBanner({
      url: 'http://192.168.1.1:8866',
      token: 'abc123',
      instanceName: 'my-project',
      logDir: '/home/user/.claude-remote/logs',
      pid: 12345,
    });

    // Combine all stderr output
    const output = stderrWrite.mock.calls.map(call => String(call[0])).join('');

    // Should contain version
    expect(output).toContain('Claude Code Remote v1.2.3');

    // Should contain instance info
    expect(output).toContain('Instance:  my-project');
    expect(output).toContain('URL:       http://192.168.1.1:8866');
    expect(output).toContain('PID:       12345');
    expect(output).toContain('Logs:      /home/user/.claude-remote/logs');

    // Should contain commands
    expect(output).toContain('claude-remote attach my-project');
    expect(output).toContain('claude-remote list');
    expect(output).toContain('claude-remote stop');

    // Should contain token
    expect(output).toContain('Token: abc123');

    // Should contain QR label
    expect(output).toContain('Scan QR to connect');

    // Should contain border characters
    expect(output).toContain('╔');
    expect(output).toContain('╚');
  });

  it('should output to stderr, not stdout', () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    printBanner({
      url: 'http://localhost:8866',
      token: 'token',
      instanceName: 'test',
      logDir: '/tmp/logs',
      pid: 1,
    });

    expect(stderrWrite).toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();
    stdoutWrite.mockRestore();
  });
});
