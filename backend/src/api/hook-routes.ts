import { Router, Request, Response } from 'express';
import type { InstanceManager } from '../instance/instance-manager.js';
import { logger } from '../logger/logger.js';

export function createHookRoutes(instanceManager: InstanceManager): Router {
  const router = Router();

  router.post('/hook/:instanceId', async (req: Request, res: Response) => {
    // Only accept from localhost
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocalhost) {
      logger.warn({ ip }, 'Hook request from non-localhost rejected');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const instanceId = req.params.instanceId as string;
    const session = instanceManager.getInstance(instanceId);
    if (!session) {
      logger.warn({ instanceId }, 'Hook request for unknown instance');
      res.status(404).json({ error: 'Instance not found' });
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const result = session.hookReceiver.processHook(payload);

    switch (result.type) {
      case 'notification':
        res.json({ ok: true, tool: result.notification!.tool });
        break;
      case 'ignored':
      default:
        res.json({ ok: true, ignored: true });
        break;
    }
  });

  return router;
}
