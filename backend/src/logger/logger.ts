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

function createLogger() {
  if (isTest) {
    // Silent logger in test environment
    return pino({ level: 'silent' });
  }

  if (isDev) {
    // Pretty console output in dev
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

export const logger = createLogger();
