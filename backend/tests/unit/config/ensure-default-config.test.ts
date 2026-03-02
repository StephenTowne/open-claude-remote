import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureDefaultUserConfig, DEFAULT_SHORTCUTS, DEFAULT_COMMANDS } from '../../../src/config.js';

describe('ensureDefaultUserConfig', () => {
  const testDir = resolve(tmpdir(), `claude-remote-ensure-config-test-${Date.now()}`);
  const configPath = resolve(testDir, 'config.json');

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create config file with default shortcuts and commands when file does not exist', async () => {
    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(true);
    expect(result.commandsWritten).toBe(true);
    expect(existsSync(configPath)).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });

  it('should fill shortcuts and commands when config is empty object', async () => {
    writeFileSync(configPath, '{}', 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(true);
    expect(result.commandsWritten).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });

  it('should write defaults when shortcuts is empty array', async () => {
    writeFileSync(configPath, JSON.stringify({ shortcuts: [] }), 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('should write defaults when commands is empty array', async () => {
    writeFileSync(configPath, JSON.stringify({ commands: [] }), 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.commandsWritten).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });

  it('should NOT overwrite existing shortcuts', async () => {
    const customShortcuts = [{ label: 'Custom', data: 'custom', enabled: true }];
    writeFileSync(configPath, JSON.stringify({ shortcuts: customShortcuts }), 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(false);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(customShortcuts);
  });

  it('should NOT overwrite existing commands', async () => {
    const customCommands = [{ label: 'Custom', command: '/custom', enabled: true }];
    writeFileSync(configPath, JSON.stringify({ commands: customCommands }), 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.commandsWritten).toBe(false);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.commands).toEqual(customCommands);
  });

  it('should preserve other config fields when adding defaults', async () => {
    const existingConfig = {
      token: 'my-token',
      port: 4000,
      workspaces: ['/path/to/project'],
      claudeArgs: ['--test'],
    };
    writeFileSync(configPath, JSON.stringify(existingConfig), 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(true);
    expect(result.commandsWritten).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.token).toBe('my-token');
    expect(saved.port).toBe(4000);
    expect(saved.workspaces).toEqual(['/path/to/project']);
    expect(saved.claudeArgs).toEqual(['--test']);
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });

  it('should handle invalid JSON by overwriting with defaults', async () => {
    writeFileSync(configPath, 'not valid json', 'utf-8');

    const result = await ensureDefaultUserConfig(testDir);

    expect(result.shortcutsWritten).toBe(true);
    expect(result.commandsWritten).toBe(true);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });

  it('should handle concurrent calls with file lock', async () => {
    // 启动多个并发的 ensureDefaultUserConfig 调用
    const results = await Promise.all([
      ensureDefaultUserConfig(testDir),
      ensureDefaultUserConfig(testDir),
      ensureDefaultUserConfig(testDir),
    ]);

    // 所有调用都应该成功完成
    expect(results).toHaveLength(3);

    // 文件应该只写入一次默认值（后续调用检测到已有值）
    // 注意：由于 TOCTOU，可能多个调用同时检测到空数组
    // 但最终文件内容应该是正确的
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(saved.commands).toEqual(DEFAULT_COMMANDS);
  });
});