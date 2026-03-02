import pino from 'pino';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../..');  // logger/ → src/ → backend/ → root/
const logDir = process.env.LOG_DIR ?? resolve(projectRoot, 'logs');

// Ensure log directory exists
try {
  mkdirSync(logDir, { recursive: true });
} catch {
  // ignore - may not have write access in test environment
}

const logFilePath = resolve(logDir, 'app.log');
const errorLogPath = resolve(logDir, 'error.log');

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isCli = process.env.CLI_MODE === 'true';
const isStderrTTY = process.stderr.isTTY === true;

function createLogger() {
  if (isTest) {
    // Silent logger in test environment
    return pino({ level: 'silent' });
  }

  if (isCli) {
    // CLI mode: only write to files, keep terminal clean
    return pino({
      level: 'info',
      transport: {
        targets: [
          { target: 'pino/file', options: { destination: logFilePath }, level: 'info' },
          { target: 'pino/file', options: { destination: errorLogPath }, level: 'error' },
        ],
      },
    });
  }

  if (isDev && isStderrTTY) {
    // Pretty console output in dev (only when stderr is a TTY)
    return pino({
      level: 'debug',
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            options: { destination: 2 }, // stderr — keep stdout clean for PTY relay
            level: 'info',
          },
          {
            target: 'pino/file',
            options: { destination: logFilePath },
            level: 'info',
          },
          {
            target: 'pino/file',
            options: { destination: errorLogPath },
            level: 'error',
          },
        ],
      },
    });
  }

  // Production: JSON to files
  return pino({
    level: 'info',
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: logFilePath },
          level: 'info',
        },
        {
          target: 'pino/file',
          options: { destination: errorLogPath },
          level: 'error',
        },
      ],
    },
  });
}

export let logger = createLogger();

/**
 * 设置实例上下文，使后续所有日志自动包含 instancePort 字段。
 * 在端口确定后调用一次。ESM live binding 确保所有 importer 自动获取新值。
 */
export function setInstanceContext(port: number): void {
  logger = logger.child({ instancePort: port });
}
