import { Router, Request, Response } from 'express';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { logger } from '../logger/logger.js';

export function createHookRoutes(hookReceiver: HookReceiver): Router {
  const router = Router();

  router.post('/hook', (req: Request, res: Response) => {
    // Only accept from localhost
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocalhost) {
      logger.warn({ ip }, 'Hook request from non-localhost rejected');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const notification = hookReceiver.processHook(payload);
    if (!notification) {
      res.json({ ok: true, ignored: true });
      return;
    }

    res.json({ ok: true, tool: notification.tool });
  });

  return router;
}
