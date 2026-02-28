import { Router, Request, Response } from 'express';
import { AuthModule } from '../auth/auth-middleware.js';
import { PushService } from '../push/push-service.js';
import { logger } from '../logger/logger.js';

export function createPushRoutes(authModule: AuthModule, pushService: PushService): Router {
  const router = Router();

  // Get VAPID public key (needed by frontend to subscribe)
  router.get('/push/vapid-key', authModule.requireAuth, async (_req: Request, res: Response) => {
    const key = await pushService.waitForVapidPublicKey(2000);
    if (!key) {
      res.status(503).json({ error: 'Push notifications not available' });
      return;
    }
    res.json({ vapidPublicKey: key });
  });

  // Subscribe to push notifications
  router.post('/push/subscribe', authModule.requireAuth, (req: Request, res: Response) => {
    const { endpoint, keys } = req.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription data' });
      return;
    }

    pushService.subscribe({ endpoint, keys });
    logger.info({ endpoint }, 'Push subscription registered via API');
    res.json({ ok: true });
  });

  // Unsubscribe from push notifications
  router.delete('/push/subscribe', authModule.requireAuth, (req: Request, res: Response) => {
    const { endpoint } = req.body ?? {};
    if (!endpoint) {
      res.status(400).json({ error: 'Missing endpoint' });
      return;
    }

    const removed = pushService.unsubscribe(endpoint);
    res.json({ ok: true, removed });
  });

  return router;
}
