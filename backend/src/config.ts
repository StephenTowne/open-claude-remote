import {
  DEFAULT_PORT,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_MAX_BUFFER_LINES,
  SETTINGS_DIR,
  CLAUDE_REMOTE_DIR,
} from '@claude-remote/shared';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { detectLanIp, detectNonLoopbackIp } from './utils/network.js';
import { logger } from './logger/logger.js';

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
      Notification: [
        {
          matcher: "permission_prompt",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ],
      PreToolUse: [
        {
          matcher: "AskUserQuestion",
          hooks: [{ type: "command", command: hookCommand }]
        }
      ]
    }
  };

  // 如果有现有 settings，合并 hooks 配置（保留用户自定义的其他 hook 事件）
  // 注意：同名 hook 事件（Notification / PreToolUse）会被我们的配置覆盖，
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
