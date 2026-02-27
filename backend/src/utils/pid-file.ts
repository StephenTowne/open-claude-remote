import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../logger/logger.js';

/**
 * Writes the current process PID to a file.
 * Creates parent directories if they don't exist.
 */
export function writePidFile(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, String(process.pid), 'utf-8');
  logger.info({ pid: process.pid, path: filePath }, 'PID file written');
}

/**
 * Removes the PID file. Silently ignores if file doesn't exist.
 */
export function removePidFile(filePath: string): void {
  try {
    unlinkSync(filePath);
    logger.info({ path: filePath }, 'PID file removed');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err, path: filePath }, 'Failed to remove PID file');
    }
  }
}
