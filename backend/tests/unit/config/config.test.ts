import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClaudeSettings, saveClaudeSettings, loadUserConfig, loadConfig, loadWorkdirConfig, mergeConfigs, type CliOverrides, type UserConfig, type WorkdirConfig, getDefaultSettingsDirs, getSettingsDirs, scanSettingsFiles, getSettingsFilePath } from '../../../src/config.js';
import { SESSION_COOKIE_NAME, DEFAULT_PORT } from '#shared';

describe('createClaudeSettings', () => {
  const testInstanceId = '550e8400-e29b-41d4-a716-446655440000';

  it('should generate valid settings object', () => {
    const settings = createClaudeSettings(testInstanceId);
    expect(settings).toHaveProperty('hooks');
    expect(typeof settings).toBe('object');
  });

  it('should include hook URL with instanceId', () => {
    const settings = createClaudeSettings(testInstanceId);
    const hookCommand = settings.hooks?.Notification[0].hooks[0].command;
    expect(hookCommand).toContain(`localhost:${DEFAULT_PORT}`);
    expect(hookCommand).toContain(`/api/hook/${testInstanceId}`);
  });

  it('should use different hook URLs for different instanceIds', () => {
    const id1 = '550e8400-e29b-41d4-a716-446655440001';
    const id2 = '550e8400-e29b-41d4-a716-446655440002';
    const settings1 = createClaudeSettings(id1);
    const settings2 = createClaudeSettings(id2);

    const cmd1 = settings1.hooks?.Notification[0].hooks[0].command;
    const cmd2 = settings2.hooks?.Notification[0].hooks[0].command;

    expect(cmd1).toContain(id1);
    expect(cmd2).toContain(id2);
    expect(cmd1).not.toBe(cmd2);
  });

  it('should contain required hook types', () => {
    const settings = createClaudeSettings(testInstanceId);
    expect(settings.hooks).toHaveProperty('Notification');
    expect(settings.hooks).toHaveProperty('Stop');
  });

  it('should use command hooks with curl', () => {
    const settings = createClaudeSettings(testInstanceId);

    // Notification hook
    const notificationHook = settings.hooks?.Notification[0].hooks[0];
    expect(notificationHook.type).toBe('command');
    expect(notificationHook.command).toContain('curl');
    expect(notificationHook.command).toContain(`/api/hook/${testInstanceId}`);

    // Stop hook
    const stopHook = settings.hooks?.Stop[0].hooks[0];
    expect(stopHook.type).toBe('command');
    expect(stopHook.command).toContain('curl');
    expect(stopHook.command).toContain(`/api/hook/${testInstanceId}`);
  });

  it('should merge with existing settings', () => {
    const existingSettings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://example.com',
      },
      someOtherOption: true,
    };

    const settings = createClaudeSettings(testInstanceId, existingSettings);

    // Should have original settings
    expect(settings.env).toEqual({ ANTHROPIC_BASE_URL: 'https://example.com' });
    expect(settings.someOtherOption).toBe(true);

    // Should also have hooks
    expect(settings.hooks).toHaveProperty('Notification');
    expect(settings.hooks).toHaveProperty('Stop');
  });

  it('should deep merge hooks — preserve user custom hook events', () => {
    const existingSettings = {
      hooks: {
        PostToolUse: [
          { matcher: '.*', hooks: [{ type: 'command', command: 'echo done' }] },
        ],
      },
    };

    const settings = createClaudeSettings(testInstanceId, existingSettings);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // 应保留用户自定义的 PostToolUse
    expect(hooks).toHaveProperty('PostToolUse');
    expect(hooks.PostToolUse).toEqual(existingSettings.hooks.PostToolUse);

    // 同时也有我们注入的 Notification 和 Stop
    expect(hooks).toHaveProperty('Notification');
    expect(hooks).toHaveProperty('Stop');
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

    const settings = createClaudeSettings(testInstanceId, existingSettings);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // Notification 应使用我们注入的配置（覆盖用户的）
    expect(hooks.Notification[0]).toHaveProperty('matcher', 'permission_prompt');

    // PostToolUse 应保留
    expect(hooks.PostToolUse).toEqual(existingSettings.hooks.PostToolUse);
  });
});

describe('saveClaudeSettings', () => {
  const testDir = resolve(tmpdir(), `claude-remote-test-${Date.now()}`);
  const testInstanceId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should save settings to file and return path', () => {
    const settings = createClaudeSettings(testInstanceId);
    const path = saveClaudeSettings(settings, testInstanceId, testDir);

    expect(path).toBe(resolve(testDir, 'settings', `${testInstanceId}.json`));
    expect(existsSync(path)).toBe(true);
  });

  it('should save valid JSON that can be parsed', () => {
    const settings = createClaudeSettings(testInstanceId);
    const path = saveClaudeSettings(settings, testInstanceId, testDir);

    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.hooks).toHaveProperty('Notification');
    expect(parsed.hooks).toHaveProperty('Stop');
  });

  it('should save with pretty formatting (2-space indent)', () => {
    const settings = createClaudeSettings(testInstanceId);
    const path = saveClaudeSettings(settings, testInstanceId, testDir);

    const content = readFileSync(path, 'utf-8');

    // Should have newlines and indentation (pretty formatted)
    expect(content).toContain('\n');
    expect(content).toContain('  '); // 2-space indent
  });

  it('should create settings directory if not exists', () => {
    const settings = createClaudeSettings(testInstanceId);
    const path = saveClaudeSettings(settings, testInstanceId, testDir);

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

  it('should load valid settings.json file', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({ claudeArgs: ['--test'] }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.claudeArgs).toEqual(['--test']);
  });

  it('should migrate config.json to settings.json', () => {
    // 写入旧版 config.json
    const oldPath = resolve(testDir, 'config.json');
    writeFileSync(oldPath, JSON.stringify({ token: 'abc123', claudeArgs: ['--test'] }), 'utf-8');

    const config = loadUserConfig(testDir);

    // 应该读到旧版内容
    expect(config.token).toBe('abc123');
    expect(config.claudeArgs).toEqual(['--test']);

    // config.json 应该被重命名为 settings.json
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(resolve(testDir, 'settings.json'))).toBe(true);
  });

  it('should not migrate if settings.json already exists', () => {
    const oldPath = resolve(testDir, 'config.json');
    const newPath = resolve(testDir, 'settings.json');
    writeFileSync(oldPath, JSON.stringify({ token: 'old' }), 'utf-8');
    writeFileSync(newPath, JSON.stringify({ token: 'new' }), 'utf-8');

    const config = loadUserConfig(testDir);

    // 应该读取新版 settings.json
    expect(config.token).toBe('new');

    // 旧版 config.json 应该保留（不覆盖）
    expect(existsSync(oldPath)).toBe(true);
  });

  it('should migrate defaultClaudeArgs to claudeArgs when claudeArgs is not set', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({ defaultClaudeArgs: ['--migrated'] }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.claudeArgs).toEqual(['--migrated']);
  });

  it('should NOT overwrite existing claudeArgs with defaultClaudeArgs', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({
      claudeArgs: ['--keep'],
      defaultClaudeArgs: ['--migrated'],
    }), 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config.claudeArgs).toEqual(['--keep']);
  });

  it('should return empty object on invalid JSON', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, 'not valid json', 'utf-8');

    const config = loadUserConfig(testDir);
    expect(config).toEqual({});
  });

  it('should remove deprecated port field from config', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({ port: 3000, token: 'abc' }), 'utf-8');

    const config = loadUserConfig(testDir);

    // port 应该被移除
    expect((config as Record<string, unknown>).port).toBeUndefined();
    // 其他字段保留
    expect(config.token).toBe('abc');

    // 文件应已更新
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(saved.port).toBeUndefined();
  });

  it('should migrate legacy dingtalk config to notifications.dingtalk', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({
      dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123', enabled: true },
    }), 'utf-8');

    const config = loadUserConfig(testDir);

    // 旧版 dingtalk 应迁移到 notifications.dingtalk
    expect(config.notifications?.dingtalk).toEqual({
      webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=abc123',
      enabled: true,
    });
    // 旧版字段应被删除
    expect((config as Record<string, unknown>).dingtalk).toBeUndefined();
  });

  it('should not overwrite existing notifications.dingtalk when migrating', () => {
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify({
      dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=legacy' },
      notifications: {
        dingtalk: { webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=new', enabled: false },
      },
    }), 'utf-8');

    const config = loadUserConfig(testDir);

    // notifications.dingtalk 已存在时，旧版不应覆盖新版
    expect(config.notifications?.dingtalk?.webhookUrl).toBe('https://oapi.dingtalk.com/robot/send?access_token=new');
    expect(config.notifications?.dingtalk?.enabled).toBe(false);
    // 旧版字段仍应被删除
    expect((config as Record<string, unknown>).dingtalk).toBeUndefined();
  });
});

describe('loadWorkdirConfig', () => {
  const testDir = resolve(tmpdir(), `claude-remote-workdir-test-${Date.now()}`);

  beforeEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should return empty object when config does not exist', () => {
    const config = loadWorkdirConfig(testDir);
    expect(config).toEqual({});
  });

  it('should load workdir config from <cwd>/.claude-remote/settings.json', () => {
    const configDir = resolve(testDir, '.claude-remote');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(resolve(configDir, 'settings.json'), JSON.stringify({
      claudeCommand: '/usr/local/bin/claude',
      instanceName: 'my-project',
      maxBufferLines: 5000,
    }), 'utf-8');

    const config = loadWorkdirConfig(testDir);

    expect(config.claudeCommand).toBe('/usr/local/bin/claude');
    expect(config.instanceName).toBe('my-project');
    expect(config.maxBufferLines).toBe(5000);
  });

  it('should only extract allowed fields', () => {
    const configDir = resolve(testDir, '.claude-remote');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(resolve(configDir, 'settings.json'), JSON.stringify({
      claudeCommand: 'claude',
      instanceName: 'test',
      token: 'should-be-ignored',
      notifications: { dingtalk: { webhookUrl: 'ignored' } },
    }), 'utf-8');

    const config = loadWorkdirConfig(testDir);

    expect(config.claudeCommand).toBe('claude');
    expect(config.instanceName).toBe('test');
    // token and notifications should not be in WorkdirConfig
    expect((config as Record<string, unknown>).token).toBeUndefined();
    expect((config as Record<string, unknown>).notifications).toBeUndefined();
  });

  it('should return empty object on invalid JSON', () => {
    const configDir = resolve(testDir, '.claude-remote');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(resolve(configDir, 'settings.json'), 'invalid json', 'utf-8');

    const config = loadWorkdirConfig(testDir);
    expect(config).toEqual({});
  });
});

describe('mergeConfigs', () => {
  it('should return global config when workdir is empty', () => {
    const global: UserConfig = { claudeCommand: 'claude', token: 'abc' };
    const workdir: WorkdirConfig = {};

    const result = mergeConfigs(global, workdir);

    expect(result.claudeCommand).toBe('claude');
    expect(result.token).toBe('abc');
  });

  it('should let workdir override scalar fields', () => {
    const global: UserConfig = { claudeCommand: 'claude', instanceName: 'global-name' };
    const workdir: WorkdirConfig = { claudeCommand: '/usr/local/bin/claude', instanceName: 'project-name' };

    const result = mergeConfigs(global, workdir);

    expect(result.claudeCommand).toBe('/usr/local/bin/claude');
    expect(result.instanceName).toBe('project-name');
  });

  it('should merge and deduplicate claudeArgs arrays', () => {
    const global: UserConfig = { claudeArgs: ['--arg1', '--arg2'] };
    const workdir: WorkdirConfig = { claudeArgs: ['--arg2', '--arg3'] };

    const result = mergeConfigs(global, workdir);

    expect(result.claudeArgs).toEqual(['--arg1', '--arg2', '--arg3']);
  });

  it('should not modify global token or notifications', () => {
    const global: UserConfig = { token: 'secret', notifications: { dingtalk: { webhookUrl: 'url' } } };
    const workdir: WorkdirConfig = { instanceName: 'test' };

    const result = mergeConfigs(global, workdir);

    expect(result.token).toBe('secret');
    expect(result.notifications?.dingtalk?.webhookUrl).toBe('url');
  });

  it('should merge shortcuts with workdir priority', () => {
    const global: UserConfig = {
      shortcuts: [
        { label: 'Esc', data: '\x1b', enabled: true },
        { label: 'Enter', data: '\r', enabled: true },
      ],
    };
    const workdir: WorkdirConfig = {
      shortcuts: [
        { label: 'Esc', data: '\x1b[A', enabled: false }, // Override
        { label: 'Custom', data: 'custom', enabled: true }, // New
      ],
    };

    const result = mergeConfigs(global, workdir);

    // workdir's Esc should override global's
    const esc = result.shortcuts!.find(s => s.label === 'Esc');
    expect(esc?.data).toBe('\x1b[A');
    expect(esc?.enabled).toBe(false);

    // Enter from global should be preserved
    expect(result.shortcuts!.find(s => s.label === 'Enter')).toBeDefined();

    // Custom from workdir should be included
    expect(result.shortcuts!.find(s => s.label === 'Custom')).toBeDefined();
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
    const configPath = resolve(testDir, 'settings.json');
    writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');
    return loadConfig(cliOverrides, testDir);
  }

  it('should always use fixed port (DEFAULT_PORT)', () => {
    const config = loadConfigWithMocks({});
    expect(config.port).toBe(DEFAULT_PORT);
  });

  it('should always use fixed sessionCookieName', () => {
    const config = loadConfigWithMocks({});
    expect(config.sessionCookieName).toBe(SESSION_COOKIE_NAME);
  });

  it('should merge CLI claudeArgs with config file args (deduped)', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--settings', '/path/to/settings.json'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    // CLI 参数与配置文件参数合并，去重
    expect(config.claudeArgs.sort()).toEqual(['--dangerously-skip-permissions', '--settings', '/path/to/settings.json'].sort());
  });

  it('should use empty CLI claudeArgs when CLI provides empty array', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = { claudeArgs: [] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    // 空数组表示用户明确要清空参数，不使用配置文件参数
    expect(config.claudeArgs).toEqual([]);
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

  it('should merge args from both sources and dedupe', () => {
    const userConfig = { claudeArgs: ['--arg1', '--arg2'] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--arg3', '--arg4'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    // CLI 参数与配置文件参数合并
    expect(config.claudeArgs.sort()).toEqual(['--arg1', '--arg2', '--arg3', '--arg4'].sort());
  });

  it('should deduplicate repeated args when merging', () => {
    const userConfig = { claudeArgs: ['--dangerously-skip-permissions'] };
    const cliOverrides: CliOverrides = { claudeArgs: ['--dangerously-skip-permissions', '--settings', '/path/to/settings.json'] };

    const config = loadConfigWithMocks(userConfig, cliOverrides);

    // 重复的参数应该去重
    expect(config.claudeArgs.sort()).toEqual(['--dangerously-skip-permissions', '--settings', '/path/to/settings.json'].sort());
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

  it('should ignore UUID-based config files (instance settings)', () => {
    writeFileSync(join(testDir, 'settings-project.json'), '{}');
    writeFileSync(join(testDir, '550e8400-e29b-41d4-a716-446655440000.json'), '{}');

    const files = scanSettingsFiles([testDir]);

    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('settings-project.json');
  });

  it('should reject files with path traversal', () => {
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
