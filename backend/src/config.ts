import {
  DEFAULT_PORT,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_AUTH_RATE_LIMIT,
  DEFAULT_MAX_BUFFER_LINES,
} from '@claude-remote/shared';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLanIp } from './utils/network.js';
import { logger } from './logger/logger.js';

export interface AppConfig {
  port: number;
  host: string;
  claudeCommand: string;
  claudeArgs: string[];
  claudeCwd: string;
  token: string | null; // null means auto-generate
  sessionTtlMs: number;
  authRateLimit: number;
  maxBufferLines: number;
  logDir: string;
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

export function loadConfig(): AppConfig {
  const host = process.env.HOST ?? detectLanIp() ?? '127.0.0.1';
  const config: AppConfig = {
    port: parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10),
    host,
    claudeCommand: process.env.CLAUDE_COMMAND ?? 'claude',
    claudeArgs: parseJsonArray(process.env.CLAUDE_ARGS),
    claudeCwd: process.env.CLAUDE_CWD ?? process.cwd(),
    token: process.env.AUTH_TOKEN ?? null,
    sessionTtlMs: parseInt(process.env.SESSION_TTL ?? String(DEFAULT_SESSION_TTL_MS), 10),
    authRateLimit: parseInt(process.env.AUTH_RATE_LIMIT ?? String(DEFAULT_AUTH_RATE_LIMIT), 10),
    maxBufferLines: parseInt(process.env.MAX_BUFFER_LINES ?? String(DEFAULT_MAX_BUFFER_LINES), 10),
    logDir: process.env.LOG_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'logs'),
  };

  logger.info({ port: config.port, host: config.host, claudeCommand: config.claudeCommand }, 'Configuration loaded');
  return config;
}
