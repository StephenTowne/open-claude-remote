import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { generateToken } from '../auth/token-generator.js';
import { logger } from '../logger/logger.js';

export interface SharedTokenResult {
  token: string;
  source: 'env' | 'file' | 'generated';
}

export interface UserConfig {
  token?: string;
  shortcuts: Array<{ label: string; data: string; enabled: boolean; desc?: string }>;
  commands: Array<{ label: string; command: string; enabled: boolean; desc?: string }>;
}

/**
 * 读取 config.json 文件
 */
function loadConfigFile(configPath: string): UserConfig | null {
  try {
    if (!existsSync(configPath)) {
      return null;
    }
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as UserConfig;
  } catch (err) {
    logger.warn({ err, configPath }, 'Failed to read config.json');
    return null;
  }
}

/**
 * 保存 config.json 文件
 */
function saveConfigFile(configPath: string, config: UserConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * 获取或创建共享 Token。
 * 优先级：AUTH_TOKEN 环境变量 > config.json 中的 token > 自动生成并持久化到 config.json。
 * 支持从旧的 token 文件迁移到 config.json。
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

  const configPath = join(baseDir, 'config.json');
  let config = loadConfigFile(configPath);

  // 2. 如果 config.json 有有效 token，直接返回
  if (config?.token?.trim()) {
    logger.info('Using token from config.json');
    return { token: config.token.trim(), source: 'file' };
  }

  // 3. 迁移：检查旧 token 文件是否存在
  const oldTokenPath = join(baseDir, 'token');
  if (existsSync(oldTokenPath)) {
    try {
      const oldToken = readFileSync(oldTokenPath, 'utf-8').trim();
      if (oldToken) {
        // 写入 config.json
        config = config ?? { shortcuts: [], commands: [] };
        config.token = oldToken;
        saveConfigFile(configPath, config);
        // 删除旧文件
        unlinkSync(oldTokenPath);
        logger.info({ configPath }, 'Migrated token from old file to config.json');
        return { token: oldToken, source: 'file' };
      }
    } catch (err) {
      logger.warn({ err, oldTokenPath }, 'Failed to migrate old token file');
    }
  }

  // 4. 生成新 Token 并写入 config.json
  const newToken = generateToken();
  config = config ?? { shortcuts: [], commands: [] };
  config.token = newToken;
  saveConfigFile(configPath, config);
  logger.info({ configPath }, 'Generated and saved new token to config.json');
  return { token: newToken, source: 'generated' };
}