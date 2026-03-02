import { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { InstanceInfo, InstanceListItem } from '@claude-remote/shared';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';
import { InstanceSpawner, type SpawnOptions } from '../registry/instance-spawner.js';
import { loadUserConfig } from '../config.js';
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
async function getAllowedCwds(
  listInstances: () => Promise<InstanceInfo[]>,
): Promise<string[]> {
  const config = loadUserConfig();
  const configWorkspaces = config.workspaces ?? [];
  const instances = await listInstances();
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
}

export interface InstanceConfigResponse {
  /** 预设工作目录列表 */
  workspaces: string[];
  /** 默认 Claude 参数 */
  defaultClaudeArgs: string[];
}

export function createInstanceRoutes(
  authModule: AuthModule,
  listInstances: () => Promise<InstanceInfo[]>,
  currentInstanceId: string,
  spawner?: InstanceSpawner,
): Router {
  const router = Router();

  // 复用 auth 路由以支持 supertest 认证
  router.use(createAuthRoutes(authModule));

  router.get('/instances', authModule.requireAuth, async (_req, res) => {
    const instances = await listInstances();
    const result: InstanceListItem[] = instances.map(inst => ({
      ...inst,
      isCurrent: inst.instanceId === currentInstanceId,
    }));
    res.json(result);
  });

  /**
   * GET /api/instances/config - 获取实例创建配置
   * 返回合并后的工作目录白名单和默认参数
   * 白名单 = 配置文件 workspaces + 已启动实例的 cwd（去重）
   */
  router.get('/instances/config', authModule.requireAuth, async (_req, res) => {
    try {
      const config = loadUserConfig();
      const allowedCwds = await getAllowedCwds(listInstances);

      const response: InstanceConfigResponse = {
        workspaces: allowedCwds,
        defaultClaudeArgs: config.defaultClaudeArgs ?? [],
      };
      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get instance config');
      res.status(500).json({ error: 'Failed to get instance config' });
    }
  });

  /**
   * POST /api/instances/create - 创建新实例
   */
  router.post('/instances/create', authModule.requireAuth, async (req, res) => {
    try {
      const { cwd, name, claudeArgs } = req.body as CreateInstanceRequest;

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

      // 加载用户配置（用于 workspaces 白名单和默认参数）
      const userConfig = loadUserConfig();
      const allowedCwds = await getAllowedCwds(listInstances);

      // 路径安全检查：cwd 必须在白名单中
      if (!isCwdAllowed(absoluteCwd, allowedCwds)) {
        logger.warn({ absoluteCwd, allowedCwds }, 'Cwd path not allowed');
        res.status(403).json({
          error: 'Directory not allowed. Must be in allowed workspaces list.',
        });
        return;
      }

      // 检查 spawner 是否可用
      if (!spawner) {
        res.status(500).json({ error: 'Instance spawner not configured' });
        return;
      }

      // 合并默认参数
      const finalClaudeArgs = claudeArgs ?? userConfig.defaultClaudeArgs ?? [];

      const spawnOptions: SpawnOptions = {
        cwd: absoluteCwd,
        name: name || undefined,
        claudeArgs: finalClaudeArgs,
        headless: true,
      };

      const result = await spawner.spawn(spawnOptions);

      logger.info({
        pid: result.pid,
        cwd: absoluteCwd,
        name: result.name,
      }, 'Instance created via API');

      res.json({
        success: true,
        instance: {
          pid: result.pid,
          cwd: result.cwd,
          name: result.name,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create instance');
      res.status(500).json({ error: 'Failed to create instance' });
    }
  });

  return router;
}
