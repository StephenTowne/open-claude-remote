import {
  DEFAULT_PORT,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_MAX_BUFFER_LINES,
  SETTINGS_DIR,
} from '@claude-remote/shared';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { detectLanIp, detectNonLoopbackIp } from './utils/network.js';
import { logger } from './logger/logger.js';

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

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    logger.warn({ value }, 'Failed to parse JSON array from env');
  }
  return [];
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

export function loadConfig(): AppConfig {
  // Detect IP for display (try private IP first, then any non-loopback)
  const displayIp = process.env.DISPLAY_IP ?? detectLanIp() ?? detectNonLoopbackIp() ?? '127.0.0.1';
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const config: AppConfig = {
    port,
    host: process.env.HOST ?? '0.0.0.0', // Default: bind to all interfaces for remote access
    displayIp,
    claudeCommand: process.env.CLAUDE_COMMAND ?? 'claude',
    claudeArgs: parseJsonArray(process.env.CLAUDE_ARGS),
    claudeCwd: process.env.CLAUDE_CWD ?? process.cwd(),
    token: process.env.AUTH_TOKEN ?? null,
    sessionTtlMs: parseInt(process.env.SESSION_TTL ?? String(DEFAULT_SESSION_TTL_MS), 10),
    authRateLimit: parseInt(process.env.AUTH_RATE_LIMIT ?? String(DEFAULT_AUTH_RATE_LIMIT), 10),
    maxBufferLines: parseInt(process.env.MAX_BUFFER_LINES ?? String(DEFAULT_MAX_BUFFER_LINES), 10),
    instanceName: process.env.INSTANCE_NAME ?? basename(process.env.CLAUDE_CWD ?? process.cwd()),
    logDir: process.env.LOG_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'logs'),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? createSessionCookieName(port),
  };

  logger.info({
    port: config.port,
    host: config.host,
    displayIp: config.displayIp,
    claudeCommand: config.claudeCommand,
    sessionCookieName: config.sessionCookieName,
  }, 'Configuration loaded');
  return config;
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
