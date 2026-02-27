import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock logger before importing the module under test
vi.mock('../../../src/logger/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { TerminalRelay } from '../../../src/terminal/terminal-relay.js';
import type { PtyManager } from '../../../src/pty/pty-manager.js';

// Minimal PtyManager mock
function makePtyManager() {
  return { write: vi.fn(), resize: vi.fn() } as unknown as PtyManager;
}

// Build a fake process.stdin/stdout pair that we can control
function makeStdinMock(isTTY = true, isRaw = false) {
  const emitter = new EventEmitter() as NodeJS.ReadStream & { isTTY: boolean; isRaw: boolean; setRawMode: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };
  emitter.isTTY = isTTY;
  emitter.isRaw = isRaw;
  emitter.setRawMode = vi.fn();
  emitter.resume = vi.fn();
  emitter.pause = vi.fn();
  return emitter;
}

function makeStdoutMock(columns = 80, rows = 24) {
  const emitter = new EventEmitter() as NodeJS.WriteStream & { columns: number; rows: number };
  emitter.columns = columns;
  emitter.rows = rows;
  return emitter;
}

describe('TerminalRelay', () => {
  let origStdin: typeof process.stdin;
  let origStdout: typeof process.stdout;
  let origKill: typeof process.kill;

  beforeEach(() => {
    origStdin = process.stdin;
    origStdout = process.stdout;
    origKill = process.kill;
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdin', { value: origStdin, writable: true });
    Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    process.kill = origKill;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function stubProcessIO(isTTY = true) {
    const stdin = makeStdinMock(isTTY);
    const stdout = makeStdoutMock();
    Object.defineProperty(process, 'stdin', { value: stdin, writable: true });
    Object.defineProperty(process, 'stdout', { value: stdout, writable: true });
    return { stdin, stdout };
  }

  describe('start()', () => {
    it('sets raw mode and resumes stdin when isTTY', () => {
      const { stdin } = stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);

      relay.start();

      expect(stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(stdin.resume).toHaveBeenCalled();
    });

    it('skips raw mode when stdin is not a TTY', () => {
      const { stdin } = stubProcessIO(false);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);

      relay.start();

      expect(stdin.setRawMode).not.toHaveBeenCalled();
    });
  });

  describe('stdin → PTY forwarding', () => {
    it('forwards regular keystrokes to PTY', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('hello'));

      expect(pty.write).toHaveBeenCalledWith('hello');
    });

    it('forwards single Ctrl+C (\\x03) to PTY without triggering shutdown', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));

      expect(pty.write).toHaveBeenCalledWith('\x03');
      expect(killSpy).not.toHaveBeenCalled();
    });
  });

  describe('double Ctrl+C shutdown', () => {
    it('triggers SIGINT on process when Ctrl+C pressed twice within 500ms', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      vi.advanceTimersByTime(300);
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));

      expect(pty.write).toHaveBeenCalledTimes(2);
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });

    it('does NOT trigger SIGINT when Ctrl+C gap exceeds 500ms', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      vi.advanceTimersByTime(600);
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));

      expect(killSpy).not.toHaveBeenCalled();
    });

    it('resets the timer after a gap, allowing fresh double Ctrl+C', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      // First attempt — too slow, no shutdown
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      vi.advanceTimersByTime(600);
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      expect(killSpy).not.toHaveBeenCalled();

      // Second attempt — fast enough, should shutdown
      vi.advanceTimersByTime(200);
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });
  });

  describe('stop()', () => {
    it('restores raw mode to original state and pauses stdin', () => {
      const { stdin } = stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.stop();

      // setRawMode called with false (restore wasRaw = false)
      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
      expect(stdin.pause).toHaveBeenCalled();
    });

    it('stops forwarding data to PTY after stop()', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.stop();

      (process.stdin as EventEmitter).emit('data', Buffer.from('after-stop'));

      expect(pty.write).not.toHaveBeenCalled();
    });
  });
});
