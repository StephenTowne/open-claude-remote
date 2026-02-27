import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { logger } from '../logger/logger.js';

export interface PtyManagerOptions {
  command: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface PtyManagerEvents {
  data: (data: string) => void;
  exit: (exitCode: number, signal?: number) => void;
  error: (err: Error) => void;
}

/**
 * Manages a PTY process (Claude Code CLI).
 * Emits: 'data', 'exit', 'error'
 */
export class PtyManager extends EventEmitter {
  private process: pty.IPty | null = null;
  private _exited: boolean = false;

  get exited(): boolean {
    return this._exited;
  }

  /**
   * Spawn the PTY process.
   */
  spawn(options: PtyManagerOptions): void {
    if (this.process) {
      throw new Error('PTY process already running');
    }

    const cols = options.cols ?? process.stdout.columns ?? 80;
    const rows = options.rows ?? process.stdout.rows ?? 24;

    logger.info({ command: options.command, args: options.args, cwd: options.cwd, cols, rows }, 'Spawning PTY process');

    try {
      this.process = pty.spawn(options.command, options.args ?? [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: options.cwd ?? process.cwd(),
        env: { ...process.env, ...options.env } as Record<string, string>,
      });

      this.process.onData((data: string) => {
        this.emit('data', data);
      });

      this.process.onExit(({ exitCode, signal }) => {
        this._exited = true;
        logger.info({ exitCode, signal }, 'PTY process exited');
        this.emit('exit', exitCode, signal);
        this.process = null;
      });

      logger.info({ pid: this.process.pid }, 'PTY process spawned');
    } catch (err) {
      logger.error({ err }, 'Failed to spawn PTY process');
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Write data to the PTY stdin.
   */
  write(data: string): void {
    if (!this.process) {
      logger.warn('Attempted to write to PTY but no process is running');
      return;
    }
    this.process.write(data);
  }

  /**
   * Resize the PTY.
   */
  resize(cols: number, rows: number): void {
    if (!this.process) return;
    try {
      this.process.resize(cols, rows);
      logger.debug({ cols, rows }, 'PTY resized');
    } catch (err) {
      logger.error({ err }, 'Failed to resize PTY');
    }
  }

  /**
   * Kill the PTY process.
   */
  destroy(): void {
    if (!this.process) return;
    try {
      this.process.kill();
      logger.info('PTY process killed');
    } catch (err) {
      logger.error({ err }, 'Failed to kill PTY process');
    }
    this.process = null;
  }
}
