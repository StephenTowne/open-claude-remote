import { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { InstanceListItem, SettingsFile } from '#shared';
import { AuthModule } from '../auth/auth-middleware.js';
import type { InstanceManager } from '../instance/instance-manager.js';
import { loadUserConfig, getSettingsDirs, scanSettingsFiles } from '../config.js';
import { logger } from '../logger/logger.js';

/**
 * 检查 cwd 是否在允许的路径范围内
 * 只允许白名单中的目录或其子目录
 */
function isCwdAllowed(absoluteCwd: string, allowedCwds: string[]): boolean {
  for (const allowed of allowedCwds) {
    const absAllowed = resolve(allowed);
    const rel = relative(absAllowed, absoluteCwd);
    // rel 为空字符串表示路径相同，不以 '..' 开头表示是子目录
    if (rel === '' || (rel && !rel.startsWith('..'))) {
      return true;
    }
  }
  return false;
}

/**
 * 获取合并后的允许 cwd 白名单
 * 来源：配置文件 workspaces + 已启动实例的 cwd（去重）
 */
function getAllowedCwds(instanceManager: InstanceManager): string[] {
  const config = loadUserConfig();
  const configWorkspaces = config.workspaces ?? [];
  const instances = instanceManager.listInstances();
  const instanceCwds = instances.map(inst => inst.cwd);
  return [...new Set([...configWorkspaces, ...instanceCwds])];
}

export interface CreateInstanceRequest {
  /** 工作目录 */
  cwd: string;
  /** 实例名称（可选） */
  name?: string;
  /** Claude 额外参数（可选） */
  claudeArgs?: string[];
  /** 是否为 headless 模式（默认 true，Web 端创建的实例无 PC 终端） */
  headless?: boolean;
}

export interface InstanceConfigResponse {
  /** 预设工作目录列表 */
  workspaces: string[];
  /** Claude 参数 */
  claudeArgs: string[];
  /** 可用的 settings 文件列表 */
  settingsFiles: SettingsFile[];
  /** 扫描的 settings 目录列表（用于显示） */
  settingsDirs: string[];
}

export function createInstanceRoutes(
  authModule: AuthModule,
  instanceManager: InstanceManager,
): Router {
  const router = Router();

  router.get('/instances', authModule.requireAuth, (_req, res) => {
    const instances = instanceManager.listInstances();
    const result: InstanceListItem[] = instances.map(inst => ({
      ...inst,
      isCurrent: false, // daemon 模式下无 "当前" 概念，前端按 activeInstanceId 判断
    }));
    res.json(result);
  });

  /**
   * GET /api/instances/config - 获取实例创建配置
   * 返回合并后的工作目录白名单和默认参数
   * 白名单 = 配置文件 workspaces + 已启动实例的 cwd（去重）
   */
  router.get('/instances/config', authModule.requireAuth, (_req, res) => {
    try {
      const config = loadUserConfig();
      const allowedCwds = getAllowedCwds(instanceManager);
      const settingsDirs = getSettingsDirs(config);
      const settingsFiles = scanSettingsFiles(settingsDirs);

      const response: InstanceConfigResponse = {
        workspaces: allowedCwds,
        claudeArgs: config.claudeArgs ?? [],
        settingsFiles,
        settingsDirs,
      };
      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get instance config');
      res.status(500).json({ error: 'Failed to get instance config' });
    }
  });

  /**
   * POST /api/instances/create - 创建新实例（进程内创建）
   */
  router.post('/instances/create', authModule.requireAuth, (req, res) => {
    try {
      const { cwd, name, claudeArgs, headless } = req.body as CreateInstanceRequest;

      // 参数验证
      if (!cwd || typeof cwd !== 'string') {
        res.status(400).json({ error: 'cwd is required and must be a string' });
        return;
      }

      // 检查目录是否存在
      const absoluteCwd = resolve(cwd);
      if (!existsSync(absoluteCwd)) {
        res.status(400).json({ error: `Directory does not exist: ${absoluteCwd}` });
        return;
      }

      // 路径安全检查
      const allowedCwds = getAllowedCwds(instanceManager);
      if (!isCwdAllowed(absoluteCwd, allowedCwds)) {
        logger.warn({ absoluteCwd, allowedCwds }, 'Cwd path not allowed');
        res.status(403).json({
          error: 'Directory not allowed. Must be in allowed workspaces list.',
        });
        return;
      }

      // 进程内创建实例
      // headless 默认 true：Web 端创建的实例无 PC 终端；CLI 创建时显式传 false
      const session = instanceManager.createInstance({
        cwd: absoluteCwd,
        name: name || undefined,
        claudeArgs,
        headless: headless ?? true,
      });

      logger.info({
        instanceId: session.instanceId,
        cwd: absoluteCwd,
        name: session.name,
      }, 'Instance created via API');

      res.json({
        success: true,
        instance: {
          instanceId: session.instanceId,
          cwd: session.cwd,
          name: session.name,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create instance');
      res.status(500).json({ error: 'Failed to create instance' });
    }
  });

  /**
   * DELETE /api/instances/:instanceId - 销毁实例
   */
  router.delete('/instances/:instanceId', authModule.requireAuth, (req, res) => {
    const instanceId = req.params.instanceId as string;
    const destroyed = instanceManager.destroyInstance(instanceId);

    if (!destroyed) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }

    logger.info({ instanceId }, 'Instance destroyed via API');
    res.json({ success: true });
  });

  return router;
}
