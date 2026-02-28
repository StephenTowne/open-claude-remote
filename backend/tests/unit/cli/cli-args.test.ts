import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/cli.js';

describe('parseCliArgs', () => {
  it('should parse valid --port and --host and --token', () => {
    const options = parseCliArgs(['node', 'cli.js', '--port', '8080', '--host', '127.0.0.1', '--token', 'abc']);
    expect(options.port).toBe(8080);
    expect(options.host).toBe('127.0.0.1');
    expect(options.token).toBe('abc');
    expect(options.help).toBe(false);
  });

  it('should throw error when --port is missing value', () => {
    expect(() => parseCliArgs(['node', 'cli.js', '--port'])).toThrow('--port requires a numeric value');
  });

  it('should throw error when --port value is not a valid integer', () => {
    expect(() => parseCliArgs(['node', 'cli.js', '--port', 'abc'])).toThrow('--port requires a numeric value');
  });

  it('should parse --port=<value> form', () => {
    const options = parseCliArgs(['node', 'cli.js', '--port=8081']);
    expect(options.port).toBe(8081);
  });

  it('should throw error when --port is out of range', () => {
    expect(() => parseCliArgs(['node', 'cli.js', '--port', '70000'])).toThrow('--port must be between 1 and 65535');
  });

  it('should pass unknown args to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', 'chat', '--model', 'claude-sonnet-4-6']);
    expect(options.claudeArgs).toEqual(['chat', '--model', 'claude-sonnet-4-6']);
  });
});
