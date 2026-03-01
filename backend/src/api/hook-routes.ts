import { Router, Request, Response } from 'express';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { logger } from '../logger/logger.js';

export function createHookRoutes(hookReceiver: HookReceiver): Router {
  const router = Router();

  router.post('/hook', async (req: Request, res: Response) => {
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

    const result = hookReceiver.processHook(payload);

    switch (result.type) {
      case 'permission_request': {
        // Wait for user decision asynchronously
        const decision = await hookReceiver.waitForDecision(result.permissionRequest!.requestId);
        if (decision) {
          res.json({
            hookSpecificOutput: {
              hookEventName: 'PermissionRequest',
              decision: {
                behavior: decision.behavior,
                updatedPermissions: decision.updatedPermissions,
              },
            },
          });
        } else {
          // Timeout - deny by default
          res.json({
            hookSpecificOutput: {
              hookEventName: 'PermissionRequest',
              decision: { behavior: 'deny' },
            },
          });
        }
        break;
      }
      case 'ask_question':
        // Empty JSON response — PreToolUse hook with empty stdout defaults to approve
        res.json({});
        break;
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
