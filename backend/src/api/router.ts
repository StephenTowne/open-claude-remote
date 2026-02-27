import { Router } from 'express';
import { createHealthRoutes } from './health-routes.js';
import { createAuthRoutes } from './auth-routes.js';
import { createStatusRoutes } from './status-routes.js';
import { createHookRoutes } from './hook-routes.js';
import { AuthModule } from '../auth/auth-middleware.js';
import { HookReceiver } from '../hooks/hook-receiver.js';
import type { SessionController } from '../session/session-controller.js';

export function createApiRouter(
  authModule: AuthModule,
  hookReceiver: HookReceiver,
  getController: () => SessionController | null,
): Router {
  const router = Router();

  router.use(createHealthRoutes());
  router.use(createAuthRoutes(authModule));
  router.use(createStatusRoutes(authModule, getController));
  router.use(createHookRoutes(hookReceiver));

  return router;
}
