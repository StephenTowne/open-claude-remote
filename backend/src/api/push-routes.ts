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

    // p256dh 是 65 字节的 ECDH 公钥，Base64 URL-safe 编码后约 87 字符
    // 最小长度设为 64，允许不同编码的合理变化
    const P256DH_MIN_LENGTH = 64;
    if (keys.p256dh.length < P256DH_MIN_LENGTH) {
      logger.warn({ p256dhLength: keys.p256dh.length }, 'Invalid p256dh key length');
      res.status(400).json({ error: 'Invalid p256dh key format' });
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
