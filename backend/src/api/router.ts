import { Router } from 'express';
import { createHealthRoutes } from './health-routes.js';
import { createAuthRoutes } from './auth-routes.js';
import { createStatusRoutes } from './status-routes.js';
import { createHookRoutes } from './hook-routes.js';
import { createPushRoutes } from './push-routes.js';
import { AuthModule } from '../auth/auth-middleware.js';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { PushService } from '../push/push-service.js';
import type { SessionController } from '../session/session-controller.js';

export function createApiRouter(
  authModule: AuthModule,
  hookReceiver: HookReceiver,
  getController: () => SessionController | null,
  pushService?: PushService,
): Router {
  const router = Router();

  router.use(createHealthRoutes());
  router.use(createAuthRoutes(authModule));
  router.use(createStatusRoutes(authModule, getController));
  router.use(createHookRoutes(hookReceiver));

  if (pushService) {
    router.use(createPushRoutes(authModule, pushService));
  }

  return router;
}
