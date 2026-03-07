import { Router } from 'express';
import { AuthModule } from '../auth/auth-middleware.js';
import type { InstanceManager } from '../instance/instance-manager.js';

export function createStatusRoutes(authModule: AuthModule, instanceManager: InstanceManager): Router {
  const router = Router();

  // Session validation endpoint - checks if user is authenticated
  router.get('/status', authModule.requireAuth, (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/status/:instanceId', authModule.requireAuth, (req, res) => {
    const instanceId = req.params.instanceId as string;
    const session = instanceManager.getInstance(instanceId);

    if (!session) {
      res.json({ status: 'not_found' });
      return;
    }

    res.json({
      status: session.status,
      connectedClients: session.clientCount,
    });
  });

  return router;
}
