import {
  DEFAULT_PORT,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_MAX_BUFFER_LINES,
  SETTINGS_DIR,
  CLAUDE_REMOTE_DIR,
  DEFAULT_SHORTCUTS as SHARED_DEFAULT_SHORTCUTS,
  DEFAULT_COMMANDS as SHARED_DEFAULT_COMMANDS,
  type ConfigurableShortcut,
  type ConfigurableCommand,
  type NotificationConfigs,
  type DingtalkConfig,
  type SettingsFile,
  mergeNotificationConfigs,
} from '#shared';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { detectLanIp, detectNonLoopbackIp } from './utils/network.js';
import { logger } from './logger/logger.js';
import { withFileLockAsync } from './utils/file-lock.js';

/**
 * 用户配置文件结构 (~/.claude-remote/config.json)
 * 这些是用户可以持久化的配置项
 */
export interface UserConfig {
  // === 服务配置 ===
  /** 服务端口 (默认: 3000) */
  port?: number;
  /** 绑定地址 (默认: 0.0.0.0) */
  host?: string;
  /** 认证 Token (默认: 自动生成共享 Token) */
  token?: string;

  // === Claude CLI 配置 ===
  /** Claude CLI 命令路径 (默认: claude) */
  claudeCommand?: string;
  /** Claude CLI 额外参数 */
  claudeArgs?: string[];
  /** Claude 工作目录 (默认: 当前目录) */
  claudeCwd?: string;

  // === 运行时配置 ===
  /** Session TTL 毫秒数 (默认: 24小时) */
  sessionTtlMs?: number;
  /** 认证速率限制 (每分钟每 IP 次数, 默认: 5) */
  authRateLimit?: number;
  /** 输出缓冲区最大行数 (默认: 10000) */
  maxBufferLines?: number;
  /** 实例名称 (默认: 工作目录名) */
  instanceName?: string;

  // === 用户偏好 ===
  /** 快捷输入列表 */
  shortcuts?: Array<{ label: string; data: string; enabled: boolean; desc?: string }>;
  /** 自定义命令列表 */
  commands?: Array<{ label: string; command: string; enabled: boolean; desc?: string }>;

  // === 实例创建配置 ===
  /** 预设工作目录列表 */
  workspaces?: string[];

  // === 钉钉通知配置（旧版，向后兼容）===
  /** 钉钉群机器人 Webhook 配置（旧版字段，向后兼容） */
  dingtalk?: DingtalkConfig;

  // === 多渠道通知配置（新版）===
  /** 多渠道通知配置 */
  notifications?: NotificationConfigs;

  // === Settings 文件配置 ===
  /** Settings 文件扫描目录列表（默认: ["~/.claude/", "~/.claude-remote/settings/"]） */
  settingsDirs?: string[];
}

/**
 * 运行时配置结构 (融合用户配置 + CLI 参数 + 默认值)
 */
export interface AppConfig {
  port: number;
  host: string; // Server bind address (usually 0.0.0.0)
  displayIp: string; // IP to display in connection info
  claudeCommand: string;
  claudeArgs: string[];
  claudeCwd: string;
  token: string | null; // null means auto-generate
  sessionTtlMs: number;
  authRateLimit: number;
  maxBufferLines: number;
  instanceName: string;
  logDir: string;
  sessionCookieName: string;
}

/** 配置文件名 */
const CONFIG_FILENAME = 'config.json';

/**
 * 获取用户配置目录路径 (~/.claude-remote/)
 */
export function getUserConfigDir(): string {
  return resolve(homedir(), CLAUDE_REMOTE_DIR);
}

/**
 * 获取用户配置文件路径 (~/.claude-remote/config.json)
 */
export function getUserConfigPath(): string {
  return resolve(getUserConfigDir(), CONFIG_FILENAME);
}

/**
 * 加载用户配置文件
 * @param configDir 配置目录路径 (默认: ~/.claude-remote/)
 * @returns 用户配置对象，文件不存在或解析失败返回空对象
 */
export function loadUserConfig(configDir?: string): UserConfig {
  const dir = configDir ?? getUserConfigDir();
  const configPath = resolve(dir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    logger.debug({ configPath }, 'User config file not found, using defaults');
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as UserConfig;

    // 向后兼容：迁移旧的 defaultClaudeArgs 到 claudeArgs
    const rawConfig = config as Record<string, unknown>;
    if (!config.claudeArgs && rawConfig.defaultClaudeArgs) {
      config.claudeArgs = rawConfig.defaultClaudeArgs as string[];
      logger.info('Migrated defaultClaudeArgs to claudeArgs');
    }

    logger.info({ configPath, keys: Object.keys(config) }, 'User config loaded');
    return config;
  } catch (err) {
    logger.warn({ configPath, err }, 'Failed to parse user config, using defaults');
    return {};
  }
}

/**
 * CLI 覆盖参数 (优先级最高)
 */
export interface CliOverrides {
  port?: number;
  host?: string;
  token?: string;
  instanceName?: string;
  claudeArgs?: string[];
  noTerminal?: boolean;
}

/**
 * 加载运行时配置
 * 优先级: CLI 参数 > 用户配置文件 > 默认值
 *
 * @param cliOverrides CLI 传入的覆盖参数
 * @param configDir 配置目录路径 (默认: ~/.claude-remote/)
 */
export function loadConfig(cliOverrides: CliOverrides = {}, configDir?: string): AppConfig {
  const userConfig = loadUserConfig(configDir);

  // Detect IP for display (try private IP first, then any non-loopback)
  const displayIp = detectLanIp() ?? detectNonLoopbackIp() ?? '127.0.0.1';

  // 优先级: CLI > 用户配置 > 默认值
  const port = cliOverrides.port ?? userConfig.port ?? DEFAULT_PORT;
  const claudeCwd = userConfig.claudeCwd ?? process.cwd();

  // 合并 claudeArgs：配置文件参数在前，命令行参数在后
  const userArgs = userConfig.claudeArgs ?? [];
  const cliArgs = cliOverrides.claudeArgs ?? [];
  const mergedArgs = [...userArgs, ...cliArgs];

  if (userArgs.length > 0 && cliArgs.length > 0) {
    logger.info({ userArgs, cliArgs, mergedArgs }, 'Merged claudeArgs from config file and CLI');
  }

  const config: AppConfig = {
    port,
    host: cliOverrides.host ?? userConfig.host ?? '0.0.0.0',
    displayIp,
    claudeCommand: userConfig.claudeCommand ?? 'claude',
    claudeArgs: mergedArgs,
    claudeCwd,
    token: cliOverrides.token ?? userConfig.token ?? null,
    sessionTtlMs: userConfig.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
    authRateLimit: userConfig.authRateLimit ?? DEFAULT_AUTH_RATE_LIMIT,
    maxBufferLines: userConfig.maxBufferLines ?? DEFAULT_MAX_BUFFER_LINES,
    instanceName: cliOverrides.instanceName ?? userConfig.instanceName ?? basename(claudeCwd),
    logDir: resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'logs'),
    sessionCookieName: createSessionCookieName(port),
  };

  logger.info({
    port: config.port,
    host: config.host,
    displayIp: config.displayIp,
    claudeCommand: config.claudeCommand,
    sessionCookieName: config.sessionCookieName,
    configSource: {
      cli: Object.keys(cliOverrides).filter(k => cliOverrides[k as keyof CliOverrides] !== undefined),
      user: Object.keys(userConfig).filter(k => userConfig[k as keyof UserConfig] !== undefined),
    },
  }, 'Configuration loaded');

  return config;
}

export function createSessionCookieName(port: number): string {
  return `session_id_p${port}`;
}

/** 默认快捷键列表 - 从 shared 包导入 */
export const DEFAULT_SHORTCUTS: NonNullable<UserConfig['shortcuts']> = SHARED_DEFAULT_SHORTCUTS;

/** 默认命令列表 - 从 shared 包导入 */
export const DEFAULT_COMMANDS: NonNullable<UserConfig['commands']> = SHARED_DEFAULT_COMMANDS;

/**
 * 填充缺失的 shortcuts 到配置对象
 */
export function fillDefaultShortcuts(config: UserConfig): UserConfig {
  if (config.shortcuts) return config;
  return { ...config, shortcuts: DEFAULT_SHORTCUTS };
}

/**
 * 填充缺失的 commands 到配置对象
 */
export function fillDefaultCommands(config: UserConfig): UserConfig {
  if (config.commands) return config;
  return { ...config, commands: DEFAULT_COMMANDS };
}

/**
 * 生成 Claude Code 专属配置（包含 hook URL）
 * @param port 服务端口
 * @param existingSettings 可选的现有 settings 对象，会与 hooks 合并
 */
export function createClaudeSettings(port: number, existingSettings?: Record<string, unknown>): Record<string, unknown> {
  const hookUrl = `http://localhost:${port}/api/hook`;
  // 使用 -d @- 从 stdin 读取 hook payload，避免 shell 转义问题
  const hookCommand = `curl -s -X POST ${hookUrl} -H 'Content-Type: application/json' -d @-`;

  const hooksConfig = {
    hooks: {
      // 权限审批请求
      PermissionRequest: [
        {
          matcher: "",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ],
      // 通知事件（permission_prompt, idle_prompt, elicitation_dialog）
      Notification: [
        {
          matcher: "permission_prompt",
          hooks: [{ type: "command", command: hookCommand }]
        },
        {
          matcher: "idle_prompt",
          hooks: [{ type: "command", command: hookCommand }]
        },
        {
          matcher: "elicitation_dialog",
          hooks: [{ type: "command", command: hookCommand }]
        },
      ],
      // 用户提问工具
      PreToolUse: [
        {
          matcher: "AskUserQuestion",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ],
      // 任务完成（用于检测用户响应后任务继续执行）
      Stop: [
        {
          matcher: "",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ],
      // 会话结束
      SessionEnd: [
        {
          matcher: "",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ],
    }
  };

  // 如果有现有 settings，合并 hooks 配置（保留用户自定义的其他 hook 事件）
  // 注意：同名 hook 事件会被我们的配置覆盖，
  // 因为这些事件是 claude-remote 正常工作的必要条件
  if (existingSettings) {
    const existingHooks = (existingSettings.hooks ?? {}) as Record<string, unknown[]>;
    const overriddenKeys = Object.keys(hooksConfig.hooks).filter(k => k in existingHooks);
    if (overriddenKeys.length > 0) {
      logger.warn({ overriddenKeys }, 'User hook events overridden by claude-remote hooks');
    }
    return {
      ...existingSettings,
      hooks: { ...existingHooks, ...hooksConfig.hooks },
    };
  }

  return hooksConfig;
}

/**
 * 保存 Claude Code settings 到文件，返回文件路径
 * 文件保存在 ~/.claude-remote/settings/{port}.json
 * 注意：使用同步写入，仅在启动阶段调用
 */
export function saveClaudeSettings(
  settings: Record<string, unknown>,
  port: number,
  sharedConfigDir: string
): string {
  const settingsDir = resolve(sharedConfigDir, SETTINGS_DIR);

  // 确保目录存在
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  const settingsPath = resolve(settingsDir, `${port}.json`);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

  logger.info({ settingsPath, port }, 'Claude settings saved to file');
  return settingsPath;
}

/**
 * 确保用户配置文件包含默认的 shortcuts 和 commands
 * - 配置文件不存在时创建
 * - shortcuts 或 commands 缺失或为空数组时写入默认值
 * - 使用文件锁保护并发写入
 *
 * @param configDir 配置目录路径 (默认: ~/.claude-remote/)
 * @returns shortcutsWritten/commandsWritten 是否写入了默认值
 */
export async function ensureDefaultUserConfig(configDir?: string): Promise<{
  shortcutsWritten: boolean;
  commandsWritten: boolean;
}> {
  const dir = configDir ?? getUserConfigDir();
  const configPath = resolve(dir, CONFIG_FILENAME);
  const lockPath = `${configPath}.lock`;

  const result = { shortcutsWritten: false, commandsWritten: false };

  try {
    await withFileLockAsync(lockPath, async () => {
      // 确保配置目录存在
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 });
      }

      // 读取现有配置（使用 try-catch 处理文件不存在和解析错误）
      let config: UserConfig;
      let needsWrite = false;

      try {
        const content = await readFile(configPath, 'utf-8');
        config = JSON.parse(content) as UserConfig;
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          // 文件不存在，使用空对象
          config = {};
        } else if (err instanceof SyntaxError) {
          // JSON 解析失败，备份损坏文件后覆盖默认值
          const backupPath = `${configPath}.backup-${Date.now()}`;
          try {
            const corruptContent = await readFile(configPath, 'utf-8');
            await writeFile(backupPath, corruptContent, { mode: 0o600 });
            logger.warn({ configPath, backupPath }, 'Failed to parse user config, backed up corrupt file and overwriting with defaults');
          } catch (backupErr) {
            logger.warn({ configPath, backupErr }, 'Failed to backup corrupt config file, proceeding with defaults');
          }
          config = {};
        } else {
          throw err;
        }
      }

      // 检查 shortcuts
      if (!config.shortcuts || config.shortcuts.length === 0) {
        config.shortcuts = DEFAULT_SHORTCUTS;
        result.shortcutsWritten = true;
        needsWrite = true;
      }

      // 检查 commands
      if (!config.commands || config.commands.length === 0) {
        config.commands = DEFAULT_COMMANDS;
        result.commandsWritten = true;
        needsWrite = true;
      }

      // 写入配置（如果需要）
      if (needsWrite) {
        await writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        logger.info({
          configPath,
          shortcutsWritten: result.shortcutsWritten,
          commandsWritten: result.commandsWritten,
        }, 'Default shortcuts/commands written to user config');
      }
    });
  } catch (err) {
    // 失败时记录日志但不阻塞启动
    logger.warn({ configPath, err }, 'Failed to ensure default user config, continuing startup');
  }

  return result;
}

/**
 * 从 claudeArgs 中找到 --settings 参数的值
 * 返回 { settingsPath: string, settingsValue: object, otherArgs: string[] } 或 null
 */
export function extractSettingsFromArgs(args: string[]): { settingsPath: string; settingsValue: Record<string, unknown>; otherArgs: string[] } | null {
  let settingsPath: string | null = null;
  let settingsValue: Record<string, unknown> | null = null;
  const otherArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--settings' && i + 1 < args.length) {
      const value = args[i + 1];
      i++; // 无论解析成功与否，都跳过 value 参数
      // 检查是文件路径还是 JSON 字符串
      if (existsSync(value)) {
        settingsPath = value;
        try {
          settingsValue = JSON.parse(readFileSync(value, 'utf-8'));
          logger.info({ settingsPath }, 'Loaded user settings file for merging');
        } catch (e) {
          logger.warn({ settingsPath, err: e }, 'Failed to parse user settings file, ignoring');
          otherArgs.push(arg, value);
        }
      } else {
        // 可能是 JSON 字符串，尝试解析
        try {
          settingsValue = JSON.parse(value);
          logger.info('Detected inline JSON settings for merging');
        } catch {
          // 不是 JSON，保留原样
          otherArgs.push(arg, value);
        }
      }
    } else if (arg.startsWith('--settings=')) {
      const value = arg.slice('--settings='.length);
      if (existsSync(value)) {
        settingsPath = value;
        try {
          settingsValue = JSON.parse(readFileSync(value, 'utf-8'));
          logger.info({ settingsPath }, 'Loaded user settings file for merging');
        } catch (e) {
          logger.warn({ settingsPath, err: e }, 'Failed to parse user settings file, ignoring');
          otherArgs.push(arg);
        }
      } else {
        try {
          settingsValue = JSON.parse(value);
          logger.info('Detected inline JSON settings for merging');
        } catch {
          otherArgs.push(arg);
        }
      }
    } else {
      otherArgs.push(arg);
    }
  }

  if (settingsValue) {
    return { settingsPath: settingsPath || 'inline', settingsValue, otherArgs };
  }
  return null;
}

/**
 * 获取默认 Settings 扫描目录列表
 * @returns 默认目录路径数组（已展开 ~ 为实际路径）
 */
export function getDefaultSettingsDirs(): string[] {
  const home = homedir();
  return [
    resolve(home, '.claude'),
    resolve(home, CLAUDE_REMOTE_DIR, SETTINGS_DIR),
  ];
}

/**
 * 获取配置的 Settings 目录列表
 * @param userConfig 用户配置（可选）
 * @returns 目录路径数组（已展开 ~ 为实际路径）
 */
export function getSettingsDirs(userConfig?: UserConfig): string[] {
  if (!userConfig?.settingsDirs || userConfig.settingsDirs.length === 0) {
    return getDefaultSettingsDirs();
  }

  // 展开 ~ 为 home 目录
  const home = homedir();
  return userConfig.settingsDirs.map(dir => {
    if (dir.startsWith('~/')) {
      return resolve(home, dir.slice(2));
    }
    return resolve(dir);
  });
}

/**
 * 安全检查：文件名是否合法
 * - 不能包含路径分隔符
 * - 不能包含路径遍历字符
 * - 必须以 .json 结尾
 */
function isSafeSettingsFilename(filename: string): boolean {
  // 禁止路径分隔符和遍历
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }
  // 必须以 .json 结尾
  if (!filename.endsWith('.json')) {
    return false;
  }
  return true;
}

/**
 * 检查文件名是否为有效的 settings 文件
 * - 以 "settings" 开头（不区分大小写）
 * - 或者为有效的自定义配置文件名（非纯数字）
 */
function isValidSettingsFilename(filename: string): boolean {
  const baseName = filename.slice(0, -5); // 去掉 .json 后缀

  // 排除纯数字文件名（如 3000.json，这些是端口配置）
  if (/^\d+$/.test(baseName)) {
    return false;
  }

  // 以 settings 开头的文件
  if (baseName.toLowerCase().startsWith('settings')) {
    return true;
  }

  // 可选：未来可扩展支持其他命名规则
  return false;
}

/**
 * 生成显示名称
 * - 去掉 settings 前缀和 .json 后缀
 * - 如果结果为空，使用原文件名
 */
function makeDisplayName(filename: string): string {
  const baseName = filename.slice(0, -5); // 去掉 .json 后缀

  // 去掉 settings 前缀（不区分大小写）
  const withoutPrefix = baseName.replace(/^settings[-._]?/i, '');

  // 如果结果为空或只有分隔符，使用原 baseName
  return withoutPrefix.trim() || baseName;
}

/**
 * 扫描多个目录中的 settings 文件
 * @param settingsDirs 要扫描的目录列表
 * @returns Settings 文件列表（已去重）
 */
export function scanSettingsFiles(settingsDirs: string[]): SettingsFile[] {
  const seen = new Set<string>();
  const results: SettingsFile[] = [];

  for (const dir of settingsDirs) {
    // 目录不存在则跳过
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 只处理文件
        if (!entry.isFile()) continue;

        const filename = entry.name;

        // 安全检查
        if (!isSafeSettingsFilename(filename)) continue;

        // 有效性检查
        if (!isValidSettingsFilename(filename)) continue;

        // 去重（基于 filename）
        if (seen.has(filename)) continue;
        seen.add(filename);

        // 取目录的 basename 用于显示（如 .claude 或 settings）
        const dirDisplay = basename(dir);

        results.push({
          filename,
          displayName: makeDisplayName(filename),
          directory: dirDisplay,
          directoryPath: dir,
        });
      }
    } catch (err) {
      // 目录读取失败，记录日志并跳过
      logger.warn({ dir, err }, 'Failed to scan settings directory');
    }
  }

  // 按显示名称排序
  results.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return results;
}

/**
 * 从多个目录中查找 settings 文件的完整路径
 * @param settingsDirs 要搜索的目录列表
 * @param filename 文件名
 * @returns 完整文件路径，未找到返回 null
 */
export function getSettingsFilePath(settingsDirs: string[], filename: string): string | null {
  // 安全检查
  if (!isSafeSettingsFilename(filename)) {
    logger.warn({ filename }, 'Invalid settings filename rejected');
    return null;
  }

  for (const dir of settingsDirs) {
    const fullPath = join(dir, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
