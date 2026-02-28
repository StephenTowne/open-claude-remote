import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TOKEN_FILENAME } from '@claude-remote/shared';
import { generateToken } from '../auth/token-generator.js';
import { logger } from '../logger/logger.js';

export interface SharedTokenResult {
  token: string;
  source: 'env' | 'file' | 'generated';
}

/**
 * 获取或创建共享 Token。
 * 优先级：AUTH_TOKEN 环境变量 > ~/.claude-remote/token 文件 > 自动生成并持久化。
 */
export function getOrCreateSharedToken(baseDir: string): SharedTokenResult {
  // 1. 环境变量最高优先级
  const envToken = process.env.AUTH_TOKEN;
  if (envToken) {
    logger.info('Using AUTH_TOKEN from environment');
    return { token: envToken, source: 'env' };
  }

  // 确保目录存在
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    logger.info({ dir: baseDir }, 'Created shared config directory');
  }

  // 2. 尝试读取已有 Token 文件
  const tokenPath = join(baseDir, TOKEN_FILENAME);
  if (existsSync(tokenPath)) {
    try {
      const content = readFileSync(tokenPath, 'utf-8').trim();
      if (content) {
        logger.info('Using shared token from file');
        return { token: content, source: 'file' };
      }
    } catch (err) {
      logger.warn({ err, tokenPath }, 'Failed to read token file');
    }
  }

  // 3. 生成新 Token 并持久化
  const newToken = generateToken();
  writeFileSync(tokenPath, newToken, { mode: 0o600 });
  logger.info({ tokenPath }, 'Generated and saved new shared token');
  return { token: newToken, source: 'generated' };
}
