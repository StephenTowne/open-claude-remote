import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';
import { logger } from '../logger/logger.js';
import { withFileLockAsync } from '../utils/file-lock.js';
import {
  type UserConfig,
  fillDefaultShortcuts,
  fillDefaultCommands,
} from '../config.js';
import {
  type NotificationConfigs,
  type SafeNotificationConfigs,
  mergeNotificationConfigs,
  getNotificationStatus,
  type DingtalkConfig,
} from '#shared';

const CONFIG_DIR = join(homedir(), '.claude-remote');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const CONFIG_LOCK = CONFIG_FILE + '.lock';

/**
 * 验证配置结构
 */
function validateConfigStructure(config: unknown): config is UserConfig {
  if (!config || typeof config !== 'object') return false;

  const cfg = config as Record<string, unknown>;

  // 所有字段都是可选的，但如果存在必须类型正确

  // 服务配置
  if ('port' in cfg && typeof cfg.port !== 'number') return false;
  if ('host' in cfg && typeof cfg.host !== 'string') return false;
  if ('token' in cfg && typeof cfg.token !== 'string') return false;

  // Claude CLI 配置
  if ('claudeCommand' in cfg && typeof cfg.claudeCommand !== 'string') return false;
  if ('claudeCwd' in cfg && typeof cfg.claudeCwd !== 'string') return false;
  if ('claudeArgs' in cfg && !Array.isArray(cfg.claudeArgs)) return false;

  // 运行时配置
  if ('sessionTtlMs' in cfg && typeof cfg.sessionTtlMs !== 'number') return false;
  if ('authRateLimit' in cfg && typeof cfg.authRateLimit !== 'number') return false;
  if ('maxBufferLines' in cfg && typeof cfg.maxBufferLines !== 'number') return false;
  if ('instanceName' in cfg && typeof cfg.instanceName !== 'string') return false;

  // shortcuts 可选，如果存在必须是数组
  if ('shortcuts' in cfg && cfg.shortcuts !== undefined) {
    if (!Array.isArray(cfg.shortcuts)) return false;
    for (const item of cfg.shortcuts) {
      if (!item || typeof item !== 'object') return false;
      const s = item as Record<string, unknown>;
      if (typeof s.label !== 'string' || typeof s.data !== 'string' || typeof s.enabled !== 'boolean') {
        return false;
      }
      if (s.desc !== undefined && typeof s.desc !== 'string') return false;
    }
  }

  // commands 可选，如果存在必须是数组
  if ('commands' in cfg && cfg.commands !== undefined) {
    if (!Array.isArray(cfg.commands)) return false;
    for (const item of cfg.commands) {
      if (!item || typeof item !== 'object') return false;
      const c = item as Record<string, unknown>;
      if (typeof c.label !== 'string' || typeof c.command !== 'string' || typeof c.enabled !== 'boolean') {
        return false;
      }
      if (c.desc !== undefined && typeof c.desc !== 'string') return false;
      if (c.autoSend !== undefined && typeof c.autoSend !== 'boolean') return false;
    }
  }

  // dingtalk 可选，如果存在必须是对象且包含 webhookUrl（旧版字段，向后兼容）
  if ('dingtalk' in cfg && cfg.dingtalk !== undefined) {
    if (typeof cfg.dingtalk !== 'object' || cfg.dingtalk === null) return false;
    const dt = cfg.dingtalk as Record<string, unknown>;
    if (typeof dt.webhookUrl !== 'string') return false;
  }

  // notifications 可选，如果存在必须是对象
  if ('notifications' in cfg && cfg.notifications !== undefined) {
    if (typeof cfg.notifications !== 'object' || cfg.notifications === null) return false;
    const notif = cfg.notifications as Record<string, unknown>;

    // notifications.dingtalk 可选，如果存在必须是对象且包含 webhookUrl
    if (notif.dingtalk !== undefined) {
      if (typeof notif.dingtalk !== 'object' || notif.dingtalk === null) return false;
      const dt = notif.dingtalk as Record<string, unknown>;
      if (typeof dt.webhookUrl !== 'string') return false;
    }
  }

  return true;
}

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

/**
 * 保存配置文件
 */
async function saveUserConfig(config: UserConfig): Promise<void> {
  // 确保目录存在
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  // 直接写入文件
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
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
        // 配置文件不存在，返回 null 让前端使用自己的默认值
        res.json({ config: null, configPath: CONFIG_FILE });
        return;
      }

      // 懒填充默认值（不持久化，仅返回时填充）
      // 好处：配置文件保持精简，默认值更新时用户自动受益
      let filledConfig = config;
      if (!config.shortcuts) {
        filledConfig = fillDefaultShortcuts(filledConfig);
      }
      if (!config.commands) {
        filledConfig = fillDefaultCommands(filledConfig);
      }

      // 合并通知配置：新版优先，回退旧版
      const mergedNotifications = mergeNotificationConfigs(
        filledConfig.notifications,
        filledConfig.dingtalk
      );

      // 安全处理：不暴露敏感字段（token、webhook URL 等）
      const { token: _, dingtalk: _dt, notifications: _notif, ...safeConfig } = filledConfig;

      // 构建通知配置的安全视图
      const safeNotifications: SafeNotificationConfigs = getNotificationStatus(mergedNotifications);

      const responseConfig = {
        ...safeConfig,
        // 返回新版 notifications 结构
        notifications: safeNotifications,
        // 保留 dingtalk 字段向后兼容（旧版前端）
        dingtalk: safeNotifications.dingtalk ?? { configured: false },
      };

      res.json({ config: responseConfig, configPath: CONFIG_FILE });
    } catch (error) {
      logger.error({ error }, 'Failed to get config');
      res.status(500).json({ error: 'Failed to load config' });
    }
  });

  /**
   * PUT /api/config - 更新用户配置
   */
  router.put('/config', authModule.requireAuth.bind(authModule), async (req, res) => {
    try {
      const newConfig = req.body as UserConfig & { notifications?: NotificationConfigs };

      // 验证配置结构
      if (!validateConfigStructure(newConfig)) {
        res.status(400).json({ error: 'Invalid config structure' });
        return;
      }

      // 文件锁保护 read-modify-write，防止与其他模块并发写入冲突
      await withFileLockAsync(CONFIG_LOCK, async () => {
        // 合并现有配置和新配置（前端可能只发送部分字段）
        const existingConfig = (await loadUserConfig()) ?? {};
        const mergedConfig: UserConfig & { notifications?: NotificationConfigs } = { ...existingConfig, ...newConfig };

        // 处理通知配置：
        // 1. 如果请求包含 notifications.dingtalk，写入新版结构
        // 2. 如果请求包含 dingtalk（旧版），同时写入新旧两个字段（双写兼容）
        if (newConfig.notifications?.dingtalk) {
          mergedConfig.notifications = {
            ...existingConfig.notifications,
            ...newConfig.notifications,
          };
          // 同时更新旧版 dingtalk 字段（向后兼容）
          mergedConfig.dingtalk = newConfig.notifications.dingtalk;
        } else if (newConfig.dingtalk?.webhookUrl) {
          // 旧版前端只发送 dingtalk，写入两个字段
          mergedConfig.dingtalk = newConfig.dingtalk;
          mergedConfig.notifications = {
            ...existingConfig.notifications,
            dingtalk: newConfig.dingtalk,
          };
        }

        await saveUserConfig(mergedConfig as UserConfig);
      });

      logger.info({ configPath: CONFIG_FILE }, 'User config updated');
      res.json({ success: true, configPath: CONFIG_FILE });
    } catch (error) {
      logger.error({ error }, 'Failed to update config');
      res.status(500).json({ error: 'Failed to save config' });
    }
  });

  return router;
}