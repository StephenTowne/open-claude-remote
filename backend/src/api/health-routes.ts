import { Router } from 'express';
import { DEFAULT_PORT } from '#shared';
import { getCurrentVersion } from '../update.js';
import type { InstanceManager } from '../instance/instance-manager.js';

/** Daemon 启动时间（ISO 格式） */
let daemonStartTime: string | null = null;

/** 设置 daemon 启动时间 */
export function setDaemonStartTime(time: string): void {
  daemonStartTime = time;
}

export function createHealthRoutes(instanceManager?: InstanceManager): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: getCurrentVersion(),
      pid: process.pid,
      port: DEFAULT_PORT,
      startedAt: daemonStartTime,
      uptime: daemonStartTime
        ? Math.floor((Date.now() - new Date(daemonStartTime).getTime()) / 1000)
        : null,
      instanceCount: instanceManager?.listInstances().length ?? 0,
    });
  });

  return router;
}
