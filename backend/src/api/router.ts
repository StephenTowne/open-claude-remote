import { Router } from 'express';
import { createHealthRoutes } from './health-routes.js';
import { createAuthRoutes } from './auth-routes.js';
import { createStatusRoutes } from './status-routes.js';
import { createHookRoutes } from './hook-routes.js';
import { createPushRoutes } from './push-routes.js';
import { createInstanceRoutes } from './instance-routes.js';
import { createConfigRoutes } from './config-routes.js';
import { AuthModule } from '../auth/auth-middleware.js';
import { PushService } from '../push/push-service.js';
import type { InstanceManager } from '../instance/instance-manager.js';
import type { NotificationManager } from '../notification/notification-manager.js';
import type { NotificationServiceFactory } from '../notification/notification-service-factory.js';
import { logger } from '../logger/logger.js';

export interface ApiRouterOptions {
  authModule: AuthModule;
  instanceManager: InstanceManager;
  pushService?: PushService;
  notificationManager?: NotificationManager;
  notificationServiceFactory?: NotificationServiceFactory;
  /** 服务监听端口 */
  port: number;
  /** 自定义私有网段（CIDR 格式） */
  customPrivateRanges?: string[];
  /** 关闭 daemon 的回调 */
  onShutdown?: () => void;
}

export function createApiRouter(opts: ApiRouterOptions): Router {
  const router = Router();

  router.use(createHealthRoutes(opts.instanceManager));
  router.use(createAuthRoutes(opts.authModule));
  router.use(createStatusRoutes({
    authModule: opts.authModule,
    instanceManager: opts.instanceManager,
    port: opts.port,
    customPrivateRanges: opts.customPrivateRanges,
  }));
  router.use(createHookRoutes(opts.instanceManager));
  router.use(createConfigRoutes(
    opts.authModule,
    opts.notificationManager,
    opts.notificationServiceFactory,
    opts.instanceManager,
  ));

  if (opts.pushService) {
    router.use(createPushRoutes(opts.authModule, opts.pushService));
  }

  router.use(createInstanceRoutes(opts.authModule, opts.instanceManager));

  // Shutdown endpoint (localhost only, requires confirmation)
  if (opts.onShutdown) {
    const shutdownFn = opts.onShutdown;
    router.post('/shutdown', (req, res) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? '';
      const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      if (!isLocalhost) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // Require confirmation in request body
      const { confirm } = req.body as { confirm?: boolean };
      if (!confirm) {
        res.status(400).json({ error: 'Shutdown requires confirmation. Include { "confirm": true } in request body.' });
        return;
      }

      logger.info('Shutdown requested via API (confirmed)');
      res.json({ ok: true });
      // Delay shutdown to let the response flush
      setTimeout(shutdownFn, 100);
    });
  }

  return router;
}
