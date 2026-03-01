import { Router } from 'express';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';
import { logger } from '../logger/logger.js';
import type { UserConfig } from '../registry/shared-token.js';

const CONFIG_DIR = join(homedir(), '.claude-remote');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * 读取用户配置文件
 */
async function loadUserConfig(): Promise<UserConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as UserConfig;
  } catch (error) {
    logger.error({ error, path: CONFIG_FILE }, 'Failed to load user config');
    return null;
  }
}

export function createConfigRoutes(authModule: AuthModule): Router {
  const router = Router();

  // 复用 auth 路由以支持测试认证
  router.use(createAuthRoutes(authModule));

  /**
   * GET /api/config - 获取用户配置
   */
  router.get('/config', authModule.requireAuth.bind(authModule), async (req, res) => {
    try {
      const config = await loadUserConfig();
      if (!config) {
        // 配置文件不存在，返回null让前端使用默认值
        res.json({ config: null, configPath: CONFIG_FILE });
      } else {
        // 排除敏感字段 token
        const { token: _, ...safeConfig } = config;
        res.json({ config: safeConfig, configPath: CONFIG_FILE });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get config');
      res.status(500).json({ error: 'Failed to load config' });
    }
  });

  return router;
}