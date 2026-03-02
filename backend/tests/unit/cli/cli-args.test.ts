import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/cli-utils.js';

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

  it('should parse --name option', () => {
    const options = parseCliArgs(['node', 'cli.js', '--name', 'my-project']);
    expect(options.name).toBe('my-project');
  });

  it('should parse --name=<value> form', () => {
    const options = parseCliArgs(['node', 'cli.js', '--name=api']);
    expect(options.name).toBe('api');
  });

  it('should combine --name with other options', () => {
    const options = parseCliArgs(['node', 'cli.js', '--port', '8080', '--name', 'backend']);
    expect(options.port).toBe(8080);
    expect(options.name).toBe('backend');
  });

  it('should parse "attach 3001" correctly', () => {
    const options = parseCliArgs(['node', 'cli.js', 'attach', '3001']);
    expect(options.attach).toBe('3001');
  });

  it('should parse "attach myproject" correctly', () => {
    const options = parseCliArgs(['node', 'cli.js', 'attach', 'myproject']);
    expect(options.attach).toBe('myproject');
  });

  it('should throw error when attach has no target argument', () => {
    expect(() => parseCliArgs(['node', 'cli.js', 'attach'])).toThrow('attach 命令需要指定目标实例');
  });

  it('should parse --no-terminal flag', () => {
    const options = parseCliArgs(['node', 'cli.js', '--no-terminal']);
    expect(options.noTerminal).toBe(true);
  });

  it('should combine --no-terminal with other options', () => {
    const options = parseCliArgs(['node', 'cli.js', '--no-terminal', '--port', '3001']);
    expect(options.noTerminal).toBe(true);
    expect(options.port).toBe(3001);
  });
});
