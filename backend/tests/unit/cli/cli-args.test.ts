import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/cli-utils.js';

describe('parseCliArgs', () => {
  it('should parse --host and --token', () => {
    const options = parseCliArgs(['node', 'cli.js', '--host', '127.0.0.1', '--token', 'abc']);
    expect(options.host).toBe('127.0.0.1');
    expect(options.token).toBe('abc');
    expect(options.help).toBe(false);
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
    const options = parseCliArgs(['node', 'cli.js', '--host', '0.0.0.0', '--name', 'backend']);
    expect(options.host).toBe('0.0.0.0');
    expect(options.name).toBe('backend');
  });

  it('should parse "attach myproject" correctly', () => {
    const options = parseCliArgs(['node', 'cli.js', 'attach', 'myproject']);
    expect(options.attach).toBe('myproject');
  });

  it('should throw error when attach has no target argument', () => {
    expect(() => parseCliArgs(['node', 'cli.js', 'attach'])).toThrow('attach requires a target instance');
  });

  it('should parse --no-terminal flag', () => {
    const options = parseCliArgs(['node', 'cli.js', '--no-terminal']);
    expect(options.noTerminal).toBe(true);
  });

  it('should parse "update" subcommand', () => {
    const options = parseCliArgs(['node', 'cli.js', 'update']);
    expect(options.update).toBe(true);
  });

  it('should not pass "update" to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', 'update']);
    expect(options.claudeArgs).toEqual([]);
  });

  it('should parse "stop" subcommand', () => {
    const options = parseCliArgs(['node', 'cli.js', 'stop']);
    expect(options.stop).toBe(true);
  });

  it('should not pass "stop" to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', 'stop']);
    expect(options.claudeArgs).toEqual([]);
  });

  it('should parse --version flag', () => {
    const options = parseCliArgs(['node', 'cli.js', '--version']);
    expect(options.version).toBe(true);
  });

  it('should not pass --version to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', '--version']);
    expect(options.claudeArgs).toEqual([]);
  });

  it('should still pass -v to claudeArgs (not intercepted)', () => {
    const options = parseCliArgs(['node', 'cli.js', '-v']);
    expect(options.version).toBe(false);
    expect(options.claudeArgs).toEqual(['-v']);
  });

  it('should pass --port to claudeArgs (no longer a server option)', () => {
    const options = parseCliArgs(['node', 'cli.js', '--port', '8080']);
    expect(options.claudeArgs).toContain('--port');
    expect(options.claudeArgs).toContain('8080');
  });

  it('should parse "list" subcommand', () => {
    const options = parseCliArgs(['node', 'cli.js', 'list']);
    expect(options.list).toBe(true);
  });

  it('should not pass "list" to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', 'list']);
    expect(options.claudeArgs).toEqual([]);
  });

  it('should parse "status" subcommand', () => {
    const options = parseCliArgs(['node', 'cli.js', 'status']);
    expect(options.status).toBe(true);
  });

  it('should not pass "status" to claudeArgs', () => {
    const options = parseCliArgs(['node', 'cli.js', 'status']);
    expect(options.claudeArgs).toEqual([]);
  });
});
