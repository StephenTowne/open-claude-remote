import { PtyManager } from '../pty/pty-manager.js';
import { logger } from '../logger/logger.js';

/**
 * Relays PC terminal stdin/stdout to/from the PTY process.
 * Sets stdin to raw mode so all keystrokes pass through directly.
 */
export class TerminalRelay {
  private stdinHandler: ((data: Buffer) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private wasRaw: boolean = false;

  constructor(private ptyManager: PtyManager) {}

  /**
   * Start relaying stdin → PTY and listen for terminal resize.
   */
  start(): void {
    if (!process.stdin.isTTY) {
      logger.warn('stdin is not a TTY, terminal relay will not set raw mode');
      return;
    }

    // Save and set raw mode
    this.wasRaw = process.stdin.isRaw ?? false;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // stdin → PTY
    this.stdinHandler = (data: Buffer) => {
      this.ptyManager.write(data.toString());
    };
    process.stdin.on('data', this.stdinHandler);

    // Terminal resize → PTY resize
    this.resizeHandler = () => {
      const cols = process.stdout.columns;
      const rows = process.stdout.rows;
      if (cols && rows) {
        this.ptyManager.resize(cols, rows);
      }
    };
    process.stdout.on('resize', this.resizeHandler);

    logger.info('Terminal relay started (raw mode)');
  }

  /**
   * Stop relaying and restore terminal state.
   */
  stop(): void {
    if (this.stdinHandler) {
      process.stdin.removeListener('data', this.stdinHandler);
      this.stdinHandler = null;
    }
    if (this.resizeHandler) {
      process.stdout.removeListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(this.wasRaw);
      process.stdin.pause();
    }

    logger.info('Terminal relay stopped');
  }
}
