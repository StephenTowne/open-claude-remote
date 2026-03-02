import { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import type { InstanceInfo, InstanceListItem } from '@claude-remote/shared';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';
import { InstanceSpawner, type SpawnOptions } from '../registry/instance-spawner.js';
import { loadUserConfig } from '../config.js';
import { logger } from '../logger/logger.js';

/**
 * 检查 cwd 是否在允许的路径范围内
 * 允许：homedir() 下 或 workspaces 白名单中
 */
function isCwdAllowed(absoluteCwd: string, workspaces: string[]): boolean {
  const home = homedir();

  // 检查是否在 homedir 下
  const relToHome = relative(home, absoluteCwd);
  if (relToHome && !relToHome.startsWith('..') && !relative(absoluteCwd, home).startsWith('..')) {
    return true;
  }

  // 检查是否在 workspaces 白名单中
  for (const ws of workspaces) {
    const absWs = resolve(ws);
    const relToWs = relative(absWs, absoluteCwd);
    if (relToWs && !relToWs.startsWith('..') && !relative(absoluteCwd, absWs).startsWith('..')) {
      return true;
    }
  }

  return false;
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
   * 返回工作目录列表和默认参数
   */
  router.get('/instances/config', authModule.requireAuth, async (_req, res) => {
    try {
      const config = loadUserConfig();
      const response: InstanceConfigResponse = {
        workspaces: config.workspaces ?? [],
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
      const workspaces = userConfig.workspaces ?? [];

      // 路径安全检查：cwd 必须在 homedir 下或 workspaces 白名单中
      if (!isCwdAllowed(absoluteCwd, workspaces)) {
        logger.warn({ absoluteCwd, workspaces }, 'Cwd path not allowed');
        res.status(403).json({
          error: 'Directory not allowed. Must be under home directory or in workspaces whitelist.',
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
