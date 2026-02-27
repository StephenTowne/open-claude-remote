import { describe, it, expect, beforeEach } from 'vitest';
import { OutputBuffer } from '../../../src/pty/output-buffer.js';

describe('OutputBuffer', () => {
  let buffer: OutputBuffer;

  beforeEach(() => {
    buffer = new OutputBuffer(100); // small max for testing
  });

  it('should start empty with seq 0', () => {
    expect(buffer.getFullContent()).toBe('');
    expect(buffer.sequenceNumber).toBe(0);
  });

  it('should append data and increment sequence number', () => {
    buffer.append('hello');
    expect(buffer.getFullContent()).toBe('hello');
    expect(buffer.sequenceNumber).toBe(1);

    buffer.append(' world');
    expect(buffer.getFullContent()).toBe('hello world');
    expect(buffer.sequenceNumber).toBe(2);
  });

  it('should handle multi-line data', () => {
    buffer.append('line1\nline2\nline3\n');
    expect(buffer.getFullContent()).toBe('line1\nline2\nline3\n');
  });

  it('should enforce max lines by dropping oldest lines', () => {
    const smallBuffer = new OutputBuffer(3);
    smallBuffer.append('line1\nline2\nline3\nline4\nline5\n');
    const content = smallBuffer.getFullContent();
    // Should only keep last 3 lines (line3, line4, line5 + trailing)
    expect(content).not.toContain('line1');
    expect(content).not.toContain('line2');
    expect(content).toContain('line4');
    expect(content).toContain('line5');
  });

  it('should handle data without trailing newline', () => {
    buffer.append('no newline');
    expect(buffer.getFullContent()).toBe('no newline');
  });

  it('should preserve ANSI escape codes', () => {
    const ansi = '\x1b[31mred text\x1b[0m';
    buffer.append(ansi);
    expect(buffer.getFullContent()).toBe(ansi);
  });

  it('should handle rapid sequential appends', () => {
    for (let i = 0; i < 50; i++) {
      buffer.append(`chunk${i}`);
    }
    expect(buffer.sequenceNumber).toBe(50);
    expect(buffer.getFullContent()).toContain('chunk49');
  });

  it('should handle empty appends', () => {
    buffer.append('');
    expect(buffer.getFullContent()).toBe('');
    expect(buffer.sequenceNumber).toBe(1);
  });

  it('should overflow correctly with many lines', () => {
    const smallBuffer = new OutputBuffer(5);
    for (let i = 0; i < 20; i++) {
      smallBuffer.append(`line${i}\n`);
    }
    const content = smallBuffer.getFullContent();
    expect(content).toContain('line19');
    expect(content).toContain('line18');
    expect(content).not.toContain('line0');
  });
});
