import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { generateToken } from '../auth/token-generator.js';
import { logger } from '../logger/logger.js';
import { withFileLock } from '../utils/file-lock.js';
import type { UserConfig } from '../config.js';

export interface SharedTokenResult {
  token: string;
  source: 'cli' | 'file' | 'generated';
}

/**
 * 读取 settings.json 文件
 */
function loadConfigFile(configPath: string): UserConfig | null {
  try {
    if (!existsSync(configPath)) {
      return null;
    }
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as UserConfig;
  } catch (err) {
    logger.warn({ err, configPath }, 'Failed to read settings.json');
    return null;
  }
}

/**
 * 保存 settings.json 文件
 */
function saveConfigFile(configPath: string, config: UserConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * 获取或创建共享 Token。
 * 优先级：CLI 参数 > settings.json 中的 token > 自动生成并持久化到 settings.json。
 * 支持从旧的 token 文件迁移到 settings.json。
 */
export function getOrCreateSharedToken(baseDir: string, cliToken?: string): SharedTokenResult {
  // 1. CLI 参数最高优先级
  if (cliToken) {
    logger.info('Using token from CLI argument');
    return { token: cliToken, source: 'cli' };
  }

  // 确保目录存在
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    logger.info({ dir: baseDir }, 'Created shared config directory');
  }

  const configPath = join(baseDir, 'settings.json');
  const lockPath = configPath + '.lock';

  // 使用文件锁防止多实例并发生成不同 token
  return withFileLock(lockPath, () => {
    // 锁内 double-check：另一个进程可能已写入 token
    let config = loadConfigFile(configPath);

    // 2. 如果 settings.json 有有效 token，直接返回
    if (config?.token?.trim()) {
      logger.info('Using token from settings.json');
      return { token: config.token.trim(), source: 'file' as const };
    }

    // 3. 迁移：检查旧 token 文件是否存在
    const oldTokenPath = join(baseDir, 'token');
    if (existsSync(oldTokenPath)) {
      try {
        const oldToken = readFileSync(oldTokenPath, 'utf-8').trim();
        if (oldToken) {
          config = config ?? {};
          config.token = oldToken;
          saveConfigFile(configPath, config);
          unlinkSync(oldTokenPath);
          logger.info({ configPath }, 'Migrated token from old file to settings.json');
          return { token: oldToken, source: 'file' as const };
        }
      } catch (err) {
        logger.warn({ err, oldTokenPath }, 'Failed to migrate old token file');
      }
    }

    // 4. 生成新 Token 并写入 settings.json
    const newToken = generateToken();
    config = config ?? {};
    config.token = newToken;
    saveConfigFile(configPath, config);
    logger.info({ configPath }, 'Generated and saved new token to settings.json');
    return { token: newToken, source: 'generated' as const };
  });
}