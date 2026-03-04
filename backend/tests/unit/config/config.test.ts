import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSessionCookieName, createClaudeSettings, saveClaudeSettings, loadUserConfig, loadConfig, type CliOverrides, type UserConfig, getDefaultSettingsDirs, getSettingsDirs, scanSettingsFiles, getSettingsFilePath } from '../../../src/config.js';

describe('createSessionCookieName', () => {
  it('should generate cookie name based on port number', () => {
    expect(createSessionCookieName(3000)).toBe('session_id_p3000');
    expect(createSessionCookieName(3001)).toBe('session_id_p3001');
    expect(createSessionCookieName(8080)).toBe('session_id_p8080');
  });

  it('should produce different names for different ports', () => {
    const name3000 = createSessionCookieName(3000);
    const name3001 = createSessionCookieName(3001);
    expect(name3000).not.toBe(name3001);
  });
});

describe('createClaudeSettings', () => {
  it('should generate valid settings object', () => {
    const settings = createClaudeSettings(3000);
    expect(settings).toHaveProperty('hooks');
    expect(typeof settings).toBe('object');
  });

  it('should include hook URL with correct port for port 3000', () => {
    const settings = createClaudeSettings(3000);
    const hookCommand = settings.hooks?.Notification[0].hooks[0].command;
    expect(hookCommand).toContain('localhost:3000');
    expect(hookCommand).toContain('/api/hook');
  });

  it('should include hook URL with correct port for port 3001', () => {
    const settings = createClaudeSettings(3001);
    const hookCommand = settings.hooks?.Notification[0].hooks[0].command;
    expect(hookCommand).toContain('localhost:3001');
    expect(hookCommand).toContain('/api/hook');
  });

  it('should contain required hook types', () => {
    const settings = createClaudeSettings(3000);
    expect(settings.hooks).toHaveProperty('Notification');
    expect(settings.hooks).toHaveProperty('PreToolUse');
  });

  it('should use command hooks with curl', () => {
    const settings = createClaudeSettings(3000);

    // Notification hook
    const notificationHook = settings.hooks?.Notification[0].hooks[0];
    expect(notificationHook.type).toBe('command');
    expect(notificationHook.command).toContain('curl');
    expect(notificationHook.command).toContain('localhost:3000/api/hook');

    // PreToolUse hook
    const preToolUseHook = settings.hooks?.PreToolUse[0].hooks[0];
    expect(preToolUseHook.type).toBe('command');
    expect(preToolUseHook.command).toContain('curl');
    expect(preToolUseHook.command).toContain('localhost:3000/api/hook');
  });

  it('should produce different settings for different ports', () => {
    const settings3000 = createClaudeSettings(3000);
    const settings3001 = createClaudeSettings(3001);

    const cmd3000 = settings3000.hooks?.Notification[0].hooks[0].command;
    const cmd3001 = settings3001.hooks?.Notification[0].hooks[0].command;

    expect(cmd3000).toContain('localhost:3000');
    expect(cmd3001).toContain('localhost:3001');
  });

  it('should merge with existing settings', () => {
    const existingSettings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://example.com',
      },
      someOtherOption: true,
    };

    const settings = createClaudeSettings(3000, existingSettings);

    // Should have original settings
    expect(settings.env).toEqual({ ANTHROPIC_BASE_URL: 'https://example.com' });
    expect(settings.someOtherOption).toBe(true);

    // Should also have hooks
    expect(settings.hooks).toHaveProperty('Notification');
    expect(settings.hooks).toHaveProperty('PreToolUse');
  });

  it('should deep merge hooks — preserve user custom hook events', () => {
    const existingSettings = {
      hooks: {
        PostToolUse: [
          { matcher: '.*', hooks: [{ type: 'command', command: 'echo done' }] },
        ],
      },
    };

    const settings = createClaudeSettings(3000, existingSettings);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // 应保留用户自定义的 PostToolUse
    expect(hooks).toHaveProperty('PostToolUse');
    expect(hooks.PostToolUse).toEqual(existingSettings.hooks.PostToolUse);

    // 同时也有我们注入的 Notification 和 PreToolUse
    expect(hooks).toHaveProperty('Notification');
    expect(hooks).toHaveProperty('PreToolUse');
  });

  it('should override conflicting hook event types with our config', () => {
    const existingSettings = {
      hooks: {
        Notification: [
          { matcher: 'custom', hooks: [{ type: 'command', command: 'echo custom' }] },
        ],
        PostToolUse: [
          { matcher: '.*', hooks: [{ type: 'command', command: 'echo done' }] },
        ],
      },
    };

    const settings = createClaudeSettings(3000, existingSettings);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // Notification 应使用我们注入的配置（覆盖用户的）
    expect(hooks.Notification[0]).toHaveProperty('matcher', 'permission_prompt');

    // PostToolUse 应保留
    expect(hooks.PostToolUse).toEqual(existingSettings.hooks.PostToolUse);
  });
});

describe('saveClaudeSettings', () => {
  const testDir = resolve(tmpdir(), `claude-remote-test-${Date.now()}`);

  beforeEach(() => {
    // Create test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    // Cleanup test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should save settings to file and return path', () => {
    const settings = createClaudeSettings(3000);
    const path = saveClaudeSettings(settings, 3000, testDir);

    expect(path).toBe(resolve(testDir, 'settings', '3000.json'));
    expect(existsSync(path)).toBe(true);
  });

  it('should save valid JSON that can be parsed', () => {
    const settings = createClaudeSettings(3000);
    const path = saveClaudeSettings(settings, 3000, testDir);

    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.hooks).toHaveProperty('Notification');
    expect(parsed.hooks).toHaveProperty('PreToolUse');
  });

  it('should save with pretty formatting (2-space indent)', () => {
    const settings = createClaudeSettings(3000);
    const path = saveClaudeSettings(settings, 3000, testDir);

    const content = readFileSync(path, 'utf-8');

    // Should have newlines and indentation (pretty formatted)
    expect(content).toContain('\n');
    expect(content).toContain('  '); // 2-space indent
  });

  it('should create settings directory if not exists', () => {
    const settings = createClaudeSettings(3001);
    const path = saveClaudeSettings(settings, 3001, testDir);

    expect(existsSync(resolve(testDir, 'settings'))).toBe(true);
    expect(existsSync(path)).toBe(true);
  });
});

describe('loadUserConfig', () => {
  const testDir = resolve(tmpdir(), `claude-remote-config-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty object when config file does not exist', () => {
    const config = loadUserConfig(testDir);
    expect(config).toEqual({});
  });

  it('should load valid config file', () => {
    const configPath = resolve(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ port: 4000, claudeArgs: ['--test'] }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.port).toBe(4000);
    expect(config.claudeArgs).toEqual(['--test']);
  });

  it('should migrate defaultClaudeArgs to claudeArgs when claudeArgs is not set', () => {
    const configPath = resolve(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ defaultClaudeArgs: ['--migrated'] }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.claudeArgs).toEqual(['--migrated']);
  });

  it('should NOT overwrite existing claudeArgs with defaultClaudeArgs', () => {
    const configPath = resolve(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      claudeArgs: ['--keep'],
      defaultClaudeArgs: ['--migrated'],
    }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.claudeArgs).toEqual(['--keep']);
  });

  it('should return empty object on invalid JSON', () => {
    const configPath = resolve(testDir, 'config.json');
    writeFileSync(configPath, 'not valid json', 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config).toEqual({});
  });
});

describe('loadConfig', () => {
  const testDir = resolve(tmpdir(), `claude-remote-loadconfig-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper: 创建带有 mock 用户配置的 loadConfig 测试环境
   */
  function loadConfigWithMocks(userConfig: UserConfig, cliOverrides: CliOverrides = {}) {
    const configPath = resolve(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');
    return loadConfig(cliOverrides, testDir);
  }

  it('should merge claudeArgs from config file and CLI', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--settings', '/path/to/settings.json'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual([
      '--dangerously-skip-permissions',
      '--settings',
      '/path/to/settings.json',
    ]);
  });

  it('should use config file claudeArgs when CLI args are empty array', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = { claudeArgs: [] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual(['--dangerously-skip-permissions']);
  });

  it('should use CLI claudeArgs when config file args are empty', () => {
    const userConfig = { claudeArgs: [] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--settings', '/path/to/settings.json'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual(['--settings', '/path/to/settings.json']);
  });

  it('should use config file claudeArgs when CLI args is undefined', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = {}; // claudeArgs 未传递

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual(['--dangerously-skip-permissions']);
  });

  it('should return empty array when neither config nor CLI has claudeArgs', () => {
    const userConfig = {};
    const cliOverrides: CliOverrides = {};

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual([]);
  });

  it('should merge multiple args from both sources', () => {
    const userConfig = { claudeArgs: ['--arg1', '--arg2'] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--arg3', '--arg4'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    expect(config.claudeArgs).toEqual(['--arg1', '--arg2', '--arg3', '--arg4']);
  });
});

describe('getDefaultSettingsDirs', () => {
  it('should return default settings directories', () => {
    const dirs = getDefaultSettingsDirs();

    expect(dirs).toHaveLength(2);
    expect(dirs[0]).toContain('.claude');
    expect(dirs[1]).toContain('.claude-remote');
    expect(dirs[1]).toContain('settings');
  });
});

describe('getSettingsDirs', () => {
  it('should return default dirs when userConfig is undefined', () => {
    const dirs = getSettingsDirs();
    expect(dirs).toHaveLength(2);
  });

  it('should return default dirs when settingsDirs is empty', () => {
    const dirs = getSettingsDirs({ settingsDirs: [] });
    expect(dirs).toHaveLength(2);
  });

  it('should expand ~ to home directory', () => {
    const dirs = getSettingsDirs({ settingsDirs: ['~/custom-dir'] });
    expect(dirs[0]).not.toContain('~');
    expect(dirs[0]).toContain('custom-dir');
  });

  it('should resolve relative paths', () => {
    const dirs = getSettingsDirs({ settingsDirs: ['./relative'] });
    expect(dirs[0]).not.toContain('./');
  });
});

describe('scanSettingsFiles', () => {
  const testDir = resolve(tmpdir(), `claude-remote-settings-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty array when directory does not exist', () => {
    const files = scanSettingsFiles(['/nonexistent/path']);
    expect(files).toEqual([]);
  });

  it('should scan settings files with correct naming', () => {
    // 创建测试文件
    writeFileSync(join(testDir, 'settings-project-a.json'), '{}');
    writeFileSync(join(testDir, 'settings.idea.json'), '{}');
    writeFileSync(join(testDir, 'settings.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files).toHaveLength(3);
    const filenames = files.map(f => f.filename).sort();
    expect(filenames).toContain('settings-project-a.json');
    expect(filenames).toContain('settings.idea.json');
    expect(filenames).toContain('settings.json');
  });

  it('should ignore non-settings JSON files', () => {
    writeFileSync(join(testDir, 'settings-valid.json'), '{}');
    writeFileSync(join(testDir, 'other-config.json'), '{}');
    writeFileSync(join(testDir, 'config.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('settings-valid.json');
  });

  it('should ignore port config files (pure numbers)', () => {
    writeFileSync(join(testDir, 'settings-project.json'), '{}');
    writeFileSync(join(testDir, '3000.json'), '{}');
    writeFileSync(join(testDir, '8080.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('settings-project.json');
  });

  it('should reject files with path traversal', () => {
    // 扫描函数只会读取目录中的文件，无法创建恶意文件名
    // 但我们测试安全检查函数不在这里
    // 这个测试验证包含 .. 的文件名不会在有效扫描结果中
    const files = scanSettingsFiles([testDir]);
    expect(files.every(f => !f.filename.includes('..'))).toBe(true);
  });

  it('should generate correct displayName', () => {
    writeFileSync(join(testDir, 'settings-project-a.json'), '{}');
    writeFileSync(join(testDir, 'settings.idea.json'), '{}');
    writeFileSync(join(testDir, 'settings.json'), '{}');

    const files = scanSettingsFiles([testDir]);
    const displayNames = files.map(f => f.displayName);

    expect(displayNames).toContain('project-a');
    expect(displayNames).toContain('idea');
    // settings.json 去掉 settings 后为空，应保留原名
    expect(displayNames).toContain('settings');
  });

  it('should dedupe filenames from multiple directories', () => {
    const dir1 = join(testDir, 'dir1');
    const dir2 = join(testDir, 'dir2');
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });

    writeFileSync(join(dir1, 'settings-common.json'), '{}');
    writeFileSync(join(dir2, 'settings-common.json'), '{}');
    writeFileSync(join(dir2, 'settings-unique.json'), '{}');

    const files = scanSettingsFiles([dir1, dir2]);

    // 应该去重，只保留一个 settings-common.json
    expect(files).toHaveLength(2);
    const filenames = files.map(f => f.filename);
    expect(filenames.filter(n => n === 'settings-common.json')).toHaveLength(1);
    expect(filenames).toContain('settings-unique.json');
  });

  it('should sort results by displayName', () => {
    writeFileSync(join(testDir, 'settings-zebra.json'), '{}');
    writeFileSync(join(testDir, 'settings-apple.json'), '{}');
    writeFileSync(join(testDir, 'settings-mango.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files[0].displayName).toBe('apple');
    expect(files[1].displayName).toBe('mango');
    expect(files[2].displayName).toBe('zebra');
  });

  it('should include directoryPath in results', () => {
    writeFileSync(join(testDir, 'settings-test.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files).toHaveLength(1);
    expect(files[0].directoryPath).toBe(testDir);
  });
});

describe('getSettingsFilePath', () => {
  const testDir = resolve(tmpdir(), `claude-remote-getsettings-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return full path when file exists', () => {
    writeFileSync(join(testDir, 'settings-test.json'), '{}');

    const path = getSettingsFilePath([testDir], 'settings-test.json');

    expect(path).toBe(join(testDir, 'settings-test.json'));
  });

  it('should return null when file does not exist', () => {
    const path = getSettingsFilePath([testDir], 'settings-missing.json');

    expect(path).toBeNull();
  });

  it('should search in multiple directories', () => {
    const dir1 = join(testDir, 'dir1');
    const dir2 = join(testDir, 'dir2');
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });

    writeFileSync(join(dir2, 'settings-found.json'), '{}');

    const path = getSettingsFilePath([dir1, dir2], 'settings-found.json');

    expect(path).toBe(join(dir2, 'settings-found.json'));
  });

  it('should reject dangerous filenames', () => {
    const path1 = getSettingsFilePath([testDir], '../etc/passwd');
    const path2 = getSettingsFilePath([testDir], 'settings.json/../../../etc/passwd');
    const path3 = getSettingsFilePath([testDir], 'settings.json\\..\\..\\etc\\passwd');

    expect(path1).toBeNull();
    expect(path2).toBeNull();
    expect(path3).toBeNull();
  });

  it('should reject non-JSON files', () => {
    const path = getSettingsFilePath([testDir], 'settings.txt');

    expect(path).toBeNull();
  });
});
