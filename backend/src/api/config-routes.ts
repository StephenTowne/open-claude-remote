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
  getNotificationStatus,
} from '#shared';
import type { NotificationChannel } from '../hooks/hook-types.js';
import type { NotificationManager } from '../notification/notification-manager.js';
import type { NotificationServiceFactory } from '../notification/notification-service-factory.js';
import type { InstanceManager } from '../instance/instance-manager.js';

const CONFIG_DIR = join(homedir(), '.claude-remote');
const CONFIG_FILE = join(CONFIG_DIR, 'settings.json');
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

    // notifications.wechat_work 可选，如果存在必须是对象且包含 sendKey
    if (notif.wechat_work !== undefined) {
      if (typeof notif.wechat_work !== 'object' || notif.wechat_work === null) return false;
      const wc = notif.wechat_work as Record<string, unknown>;
      if (typeof wc.sendKey !== 'string') return false;
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

export function createConfigRoutes(
  authModule: AuthModule,
  notificationManager?: NotificationManager,
  notificationServiceFactory?: NotificationServiceFactory,
  instanceManager?: InstanceManager,
): Router {
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

      // 安全处理：不暴露敏感字段（token、webhook URL 等）
      const { token: _, notifications: _notif, ...safeConfig } = filledConfig;

      // 构建通知配置的安全视图
      const safeNotifications: SafeNotificationConfigs = getNotificationStatus(filledConfig.notifications);

      const responseConfig = {
        ...safeConfig,
        notifications: safeNotifications,
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

        // 处理通知配置：逐渠道深合并，保留已有字段（如 enabled）
        if (newConfig.notifications) {
          const existingNotif = existingConfig.notifications ?? {};
          const merged: NotificationConfigs = { ...existingNotif };

          // 逐渠道合并：新值覆盖，但保留已有字段
          if (newConfig.notifications.dingtalk) {
            merged.dingtalk = { ...existingNotif.dingtalk, ...newConfig.notifications.dingtalk };
          }
          if (newConfig.notifications.wechat_work) {
            merged.wechat_work = { ...existingNotif.wechat_work, ...newConfig.notifications.wechat_work };
          }

          mergedConfig.notifications = merged;
        }

        await saveUserConfig(mergedConfig as UserConfig);
      });

      // 触发服务缓存刷新（当前实例即时生效）
      if (notificationServiceFactory) {
        notificationServiceFactory.refresh();
      }

      // 广播刷新消息通知其他实例
      if (instanceManager) {
        instanceManager.broadcastAll({
          type: 'service_refresh',
          source: 'config_update',
        });
      }

      logger.info({ configPath: CONFIG_FILE }, 'User config updated');
      res.json({ success: true, configPath: CONFIG_FILE });
    } catch (error) {
      logger.error({ error }, 'Failed to update config');
      res.status(500).json({ error: 'Failed to save config' });
    }
  });

  /**
   * PATCH /api/config/notifications/:channel/enabled - 更新通知渠道启用状态
   */
  router.patch('/config/notifications/:channel/enabled', authModule.requireAuth.bind(authModule), async (req, res) => {
    try {
      const { channel } = req.params;
      const { enabled } = req.body;

      // 验证参数
      const validChannels: NotificationChannel[] = ['dingtalk', 'wechat_work'];
      if (!validChannels.includes(channel as NotificationChannel)) {
        res.status(400).json({ error: 'Invalid channel type' });
        return;
      }
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be a boolean' });
        return;
      }

      // 文件锁保护 read-modify-write，返回结果供外部统一处理响应
      const result = await withFileLockAsync(CONFIG_LOCK, async () => {
        const config = (await loadUserConfig()) ?? {};
        const notifications = config.notifications ?? {};

        // 检查渠道是否已配置
        if (channel === 'dingtalk') {
          const dtConfig = notifications.dingtalk;
          if (!dtConfig?.webhookUrl) {
            return { error: 'Channel not configured' } as const;
          }
          config.notifications = {
            ...notifications,
            dingtalk: { ...dtConfig, enabled },
          };
        } else if (channel === 'wechat_work') {
          const wcConfig = notifications.wechat_work;
          if (!wcConfig?.sendKey) {
            return { error: 'Channel not configured' } as const;
          }
          config.notifications = {
            ...notifications,
            wechat_work: { ...wcConfig, enabled },
          };
        }

        await saveUserConfig(config);
        return { error: null } as const;
      });

      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      // 主动刷新缓存（当前实例即时生效）
      if (notificationManager) {
        notificationManager.refresh(channel as NotificationChannel);
      }

      // 刷新服务缓存
      if (notificationServiceFactory) {
        notificationServiceFactory.refresh(channel as NotificationChannel);
      }

      // 广播刷新消息通知其他实例
      if (instanceManager) {
        instanceManager.broadcastAll({
          type: 'service_refresh',
          channel: channel as 'dingtalk' | 'wechat_work',
          source: 'config_update',
        });
      }

      logger.info({ channel, enabled }, 'Notification channel enabled status updated');
      res.json({ success: true, channel, enabled });
    } catch (error) {
      logger.error({ error }, 'Failed to update notification channel enabled status');
      res.status(500).json({ error: 'Failed to update notification channel status' });
    }
  });

  return router;
}