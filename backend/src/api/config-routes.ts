import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'node:os';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';
import { logger } from '../logger/logger.js';
import { withFileLockAsync } from '../utils/file-lock.js';
import {
  type UserConfig,
  type WorkdirConfig,
  fillDefaultShortcuts,
  fillDefaultCommands,
  loadUserConfig as loadUserConfigSync,
  loadWorkdirConfig,
  mergeConfigs,
  saveWorkdirConfig,
  getWorkdirConfigLock,
} from '../config.js';
import {
  scanSkills,
  convertSkillsToCommands,
  mergeSkillCommands,
} from '../skills/index.js';
import {
  type NotificationConfigs,
  type SafeNotificationConfigs,
  getNotificationStatus,
} from '#shared';
import type { NotificationChannel } from '../hooks/hook-types.js';
import type { NotificationManager } from '../notification/notification-manager.js';
import type { NotificationServiceFactory } from '../notification/notification-service-factory.js';
import type { InstanceManager } from '../instance/instance-manager.js';

function getGlobalConfigLock(): string {
  return getGlobalConfigFile() + '.lock';
}

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
 * 获取全局配置目录路径
 */
function getGlobalConfigDir(): string {
  return join(homedir(), '.claude-remote');
}

/**
 * 获取全局配置文件路径
 */
function getGlobalConfigFile(): string {
  return join(getGlobalConfigDir(), 'settings.json');
}

/**
 * 保存配置文件
 */
async function saveUserConfig(config: UserConfig): Promise<void> {
  const configDir = getGlobalConfigDir();
  const configFile = getGlobalConfigFile();

  // 确保目录存在
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // 直接写入文件
  await writeFile(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
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
   * 支持实例隔离：查询哪个实例就返回该实例对应的合并配置（全局 + 项目配置）
   */
  router.get('/config', authModule.requireAuth.bind(authModule), async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string | undefined;

      // 1. 加载全局配置
      const globalConfig = loadUserConfigSync();

      // 2. 确定工作目录和项目配置
      let cwd: string;
      let workdirConfig: WorkdirConfig = {};

      if (instanceId) {
        // 传入 instanceId，使用该实例的 cwd
        const instance = instanceManager?.getInstance(instanceId);
        if (instance) {
          cwd = instance.cwd;
          workdirConfig = loadWorkdirConfig(cwd);
          logger.debug({ instanceId, cwd }, 'Using specified instance for config');
        } else {
          // 实例不存在，fallback 到全局配置的 claudeCwd
          cwd = globalConfig.claudeCwd ?? process.cwd();
          workdirConfig = loadWorkdirConfig(cwd);
          logger.warn({ instanceId, fallbackCwd: cwd }, 'Instance not found, using fallback cwd');
        }
      } else {
        // 没有指定实例，检查活跃实例
        const activeInstances = instanceManager?.listInstances() ?? [];
        if (activeInstances.length > 0) {
          // 使用第一个实例的 cwd
          cwd = activeInstances[0].cwd;
          workdirConfig = loadWorkdirConfig(cwd);
          logger.debug({ instanceId: activeInstances[0].instanceId, cwd }, 'Using first instance for config');
        } else if (globalConfig.claudeCwd) {
          // 无实例但有全局配置的 claudeCwd
          cwd = globalConfig.claudeCwd;
          workdirConfig = loadWorkdirConfig(cwd);
        } else {
          // 最后 fallback
          cwd = process.cwd();
          logger.warn({ fallbackCwd: cwd }, 'No instance, falling back to process.cwd()');
        }
      }

      // 3. 合并全局配置和项目配置
      let mergedConfig = mergeConfigs(globalConfig, workdirConfig);

      // 4. 填充默认值
      if (!mergedConfig.shortcuts) {
        mergedConfig = fillDefaultShortcuts(mergedConfig);
      }
      if (!mergedConfig.commands) {
        mergedConfig = fillDefaultCommands(mergedConfig);
      }

      // 5. 扫描项目目录下的 skills（使用正确的 cwd）
      const skills = scanSkills(cwd);
      const skillCommands = convertSkillsToCommands(skills);
      const mergeResult = mergeSkillCommands(mergedConfig.commands ?? [], skillCommands);
      mergedConfig = { ...mergedConfig, commands: mergeResult.commands };

      if (mergeResult.added > 0 || mergeResult.removed > 0) {
        logger.info({
          added: mergeResult.added,
          removed: mergeResult.removed,
          preserved: mergeResult.preserved,
          total: mergeResult.total,
          cwd,
        }, 'Skill commands merged');
      }

      // 安全处理：不暴露敏感字段（token、webhook URL 等）
      const { token: _, notifications: _notif, ...safeConfig } = mergedConfig;

      // 构建通知配置的安全视图
      const safeNotifications: SafeNotificationConfigs = getNotificationStatus(mergedConfig.notifications);

      const responseConfig = {
        ...safeConfig,
        notifications: safeNotifications,
      };

      res.json({ config: responseConfig, configPath: getGlobalConfigFile() });
    } catch (error) {
      logger.error({ error }, 'Failed to get config');
      res.status(500).json({ error: 'Failed to load config' });
    }
  });

  /**
   * PUT /api/config - 更新用户配置
   * 支持实例隔离：项目级配置保存到项目目录，全局配置保存到用户目录
   */
  router.put('/config', authModule.requireAuth.bind(authModule), async (req, res) => {
    try {
      const instanceId = req.query.instanceId as string | undefined;
      const newConfig = req.body as UserConfig & { notifications?: NotificationConfigs };

      // 验证配置结构
      if (!validateConfigStructure(newConfig)) {
        res.status(400).json({ error: 'Invalid config structure' });
        return;
      }

      // 分离项目级配置和全局配置
      const { shortcuts, commands, ...globalFields } = newConfig;

      // 判断 shortcuts/commands 的保存位置：
      // - 有 instanceId 且实例存在 → 保存到项目配置
      // - 无 instanceId 或实例不存在 → 保存到全局配置（向后兼容）
      const instance = instanceId ? instanceManager?.getInstance(instanceId) : undefined;
      const hasProjectFields = shortcuts !== undefined || commands !== undefined;

      // 1. 保存全局配置
      await withFileLockAsync(getGlobalConfigLock(), async () => {
        const existingGlobal = loadUserConfigSync();
        const mergedGlobal: UserConfig & { notifications?: NotificationConfigs } = {
          ...existingGlobal,
          ...globalFields,
        };

        // 无实例时，shortcuts/commands 保存到全局配置（向后兼容）
        if (!(instance && hasProjectFields)) {
          if (shortcuts !== undefined) mergedGlobal.shortcuts = shortcuts;
          if (commands !== undefined) mergedGlobal.commands = commands;
        }

        // 处理通知配置：逐渠道深合并，保留已有字段（如 enabled）
        if (newConfig.notifications) {
          const existingNotif = existingGlobal.notifications ?? {};
          const merged: NotificationConfigs = { ...existingNotif };

          if (newConfig.notifications.dingtalk) {
            merged.dingtalk = { ...existingNotif.dingtalk, ...newConfig.notifications.dingtalk };
          }
          if (newConfig.notifications.wechat_work) {
            merged.wechat_work = { ...existingNotif.wechat_work, ...newConfig.notifications.wechat_work };
          }

          mergedGlobal.notifications = merged;
        }

        await saveUserConfig(mergedGlobal as UserConfig);
      });

      // 2. 保存项目级配置（有实例时保存 shortcuts/commands）
      let projectConfigPath: string | undefined;
      if (instance && hasProjectFields) {
        const projectLock = getWorkdirConfigLock(instance.cwd);
        await withFileLockAsync(projectLock, async () => {
          const existingProject = loadWorkdirConfig(instance.cwd);
          const mergedProject: WorkdirConfig = {
            ...existingProject,
            ...(shortcuts !== undefined && { shortcuts }),
            ...(commands !== undefined && { commands }),
          };
          await saveWorkdirConfig(instance.cwd, mergedProject);
          projectConfigPath = instance.cwd;
        });
      }

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

      logger.info({ configPath: getGlobalConfigFile(), instanceId, projectConfigPath }, 'User config updated');
      res.json({ success: true, configPath: getGlobalConfigFile() });
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
      const result = await withFileLockAsync(getGlobalConfigLock(), async () => {
        const config = loadUserConfigSync() ?? {};
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