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

    it('triggers SIGINT on kitty-encoded Ctrl+C (\\x1b[99;5u) pressed twice within 500ms', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      const kittyCtrlC = '\x1b[99;5u';
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlC));
      vi.advanceTimersByTime(300);
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlC));

      expect(pty.write).toHaveBeenCalledTimes(2);
      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });

    it('triggers SIGINT when mixing classic \\x03 and kitty-encoded Ctrl+C', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('\x03'));
      vi.advanceTimersByTime(200);
      (process.stdin as EventEmitter).emit('data', Buffer.from('\x1b[99;5u'));

      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });

    it('triggers SIGINT on kitty Ctrl+C with event type (\\x1b[99;5:1u)', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      const kittyCtrlCPress = '\x1b[99;5:1u';
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlCPress));
      vi.advanceTimersByTime(300);
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlCPress));

      expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    });

    it('does NOT trigger SIGINT for kitty-encoded Ctrl+C with gap exceeding 500ms', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const killSpy = vi.fn();
      process.kill = killSpy as unknown as typeof process.kill;

      const relay = new TerminalRelay(pty);
      relay.start();

      const kittyCtrlC = '\x1b[99;5u';
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlC));
      vi.advanceTimersByTime(600);
      (process.stdin as EventEmitter).emit('data', Buffer.from(kittyCtrlC));

      expect(killSpy).not.toHaveBeenCalled();
    });
  });

  describe('pauseResize / resumeResize', () => {
    it('should not forward PC resize to PTY when paused', () => {
      const { stdout } = stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.pauseResize();

      // 触发 PC 终端 resize 事件
      stdout.columns = 120;
      stdout.rows = 40;
      (process.stdout as EventEmitter).emit('resize');

      expect(pty.resize).not.toHaveBeenCalled();
    });

    it('should forward PC resize to PTY after resumeResize', () => {
      const { stdout } = stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.pauseResize();
      relay.resumeResize();

      // resume 后 resize 应该正常转发
      stdout.columns = 120;
      stdout.rows = 40;
      (process.stdout as EventEmitter).emit('resize');

      expect(pty.resize).toHaveBeenCalledWith(120, 40);
    });

    it('should immediately sync PC terminal size to PTY on resumeResize', () => {
      const { stdout } = stubProcessIO(true);
      stdout.columns = 150;
      stdout.rows = 45;
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.pauseResize();

      relay.resumeResize();

      // 应立即用当前 PC 终端尺寸 resize PTY
      expect(pty.resize).toHaveBeenCalledWith(150, 45);
    });

    it('should not affect stdin forwarding when paused', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      relay.start();
      relay.pauseResize();

      (process.stdin as EventEmitter).emit('data', Buffer.from('hello'));

      expect(pty.write).toHaveBeenCalledWith('hello');
    });
  });

  describe('event emission', () => {
    it('emits local_input when stdin data arrives', () => {
      stubProcessIO(true);
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      const handler = vi.fn();
      relay.on('local_input', handler);
      relay.start();

      (process.stdin as EventEmitter).emit('data', Buffer.from('hello'));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits local_resize when PC terminal resizes', () => {
      const { stdout } = stubProcessIO(true);
      stdout.columns = 120;
      stdout.rows = 40;
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      const handler = vi.fn();
      relay.on('local_resize', handler);
      relay.start();

      (process.stdout as EventEmitter).emit('resize');

      expect(handler).toHaveBeenCalledWith(120, 40);
    });

    it('emits local_resize even when resize is paused', () => {
      const { stdout } = stubProcessIO(true);
      stdout.columns = 100;
      stdout.rows = 30;
      const pty = makePtyManager();
      const relay = new TerminalRelay(pty);
      const handler = vi.fn();
      relay.on('local_resize', handler);
      relay.start();
      relay.pauseResize();

      (process.stdout as EventEmitter).emit('resize');

      // 事件仍然发射（用于记录 size），但 PTY 不 resize
      expect(handler).toHaveBeenCalledWith(100, 30);
      expect(pty.resize).not.toHaveBeenCalled();
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
