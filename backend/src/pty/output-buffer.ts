/**
 * Ring buffer for PTY output. Stores raw ANSI strings, enforces max line count.
 * Provides monotonically increasing sequence numbers for reconnection sync.
 */
export class OutputBuffer {
  private lines: string[] = [];
  private partial: string = ''; // incomplete line (no trailing \n yet)
  private seq: number = 0;
  private readonly maxLines: number;

  constructor(maxLines: number = 10000) {
    this.maxLines = maxLines;
  }

  get sequenceNumber(): number {
    return this.seq;
  }

  /**
   * Append raw PTY output data. May contain multiple lines or partial lines.
   */
  append(data: string): void {
    this.seq++;

    // Combine with any pending partial line
    const combined = this.partial + data;
    const parts = combined.split('\n');

    // Last element is either empty (data ended with \n) or a partial line
    this.partial = parts.pop() ?? '';

    // All other elements are complete lines
    for (const line of parts) {
      this.lines.push(line);
    }

    // Trim when exceeding max by 10%, to amortize allocation cost
    const trimThreshold = Math.floor(this.maxLines * 1.1);
    if (this.lines.length > trimThreshold) {
      this.lines = this.lines.slice(this.lines.length - this.maxLines);
    }
  }

  /**
   * Get full buffered content as a single string (for history_sync).
   */
  getFullContent(): string {
    const joined = this.lines.join('\n');
    if (this.lines.length === 0) {
      return this.partial;
    }
    if (this.partial) {
      return joined + '\n' + this.partial;
    }
    // Lines were split from \n, so the original data had \n between/after them
    return joined + '\n';
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.lines = [];
    this.partial = '';
  }
}
