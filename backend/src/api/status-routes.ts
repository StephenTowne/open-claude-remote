import { Router } from 'express';
import type { SessionController } from '../session/session-controller.js';
import { AuthModule } from '../auth/auth-middleware.js';

export function createStatusRoutes(authModule: AuthModule, getController: () => SessionController | null): Router {
  const router = Router();

  router.get('/status', authModule.requireAuth, (_req, res) => {
    const controller = getController();
    if (!controller) {
      res.json({ status: 'not_started' });
      return;
    }
    res.json({
      status: controller.status,
      pendingApproval: controller.pendingApproval,
      connectedClients: controller.connectedClients,
    });
  });

  return router;
}
