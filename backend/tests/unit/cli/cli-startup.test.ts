import { describe, it, expect, vi } from 'vitest';
import { PortInUseError, startOrFallback } from '../../../src/cli-utils.js';

describe('PortInUseError', () => {
  it('should have correct name, message, and port', () => {
    const err = new PortInUseError(8866);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PortInUseError);
    expect(err.name).toBe('PortInUseError');
    expect(err.port).toBe(8866);
    expect(err.message).toContain('8866');
  });
});

describe('startOrFallback', () => {
  it('should attach when daemon is already running', async () => {
    const isDaemonRunning = vi.fn().mockResolvedValue(true);
    const startServer = vi.fn();
    const attach = vi.fn().mockResolvedValue(undefined);

    const result = await startOrFallback(isDaemonRunning, startServer, attach);

    expect(result).toBe('attached');
    expect(attach).toHaveBeenCalledOnce();
    expect(startServer).not.toHaveBeenCalled();
  });

  it('should start server when no daemon is running', async () => {
    const isDaemonRunning = vi.fn().mockResolvedValue(false);
    const startServer = vi.fn().mockResolvedValue(undefined);
    const attach = vi.fn();

    const result = await startOrFallback(isDaemonRunning, startServer, attach);

    expect(result).toBe('started');
    expect(startServer).toHaveBeenCalledOnce();
    expect(attach).not.toHaveBeenCalled();
  });

  it('should retry daemon check and attach on PortInUseError', async () => {
    const isDaemonRunning = vi.fn()
      .mockResolvedValueOnce(false)   // First check: no daemon
      .mockResolvedValueOnce(true);   // Retry: daemon found
    const startServer = vi.fn().mockRejectedValue(new PortInUseError(8866));
    const attach = vi.fn().mockResolvedValue(undefined);

    const result = await startOrFallback(isDaemonRunning, startServer, attach);

    expect(result).toBe('attached');
    expect(isDaemonRunning).toHaveBeenCalledTimes(2);
    expect(attach).toHaveBeenCalledOnce();
  });

  it('should throw PortInUseError when port in use and no daemon on retry', async () => {
    const isDaemonRunning = vi.fn().mockResolvedValue(false);
    const startServer = vi.fn().mockRejectedValue(new PortInUseError(8866));
    const attach = vi.fn();

    await expect(startOrFallback(isDaemonRunning, startServer, attach))
      .rejects.toThrow(PortInUseError);

    expect(isDaemonRunning).toHaveBeenCalledTimes(2);
    expect(attach).not.toHaveBeenCalled();
  });

  it('should propagate non-PortInUseError errors without retry', async () => {
    const isDaemonRunning = vi.fn().mockResolvedValue(false);
    const startServer = vi.fn().mockRejectedValue(new Error('unknown error'));
    const attach = vi.fn();

    await expect(startOrFallback(isDaemonRunning, startServer, attach))
      .rejects.toThrow('unknown error');

    // Should NOT retry daemon check for non-port errors
    expect(isDaemonRunning).toHaveBeenCalledTimes(1);
  });
});
