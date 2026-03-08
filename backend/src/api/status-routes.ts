import { Router } from 'express';
import { AuthModule } from '../auth/auth-middleware.js';
import type { InstanceManager } from '../instance/instance-manager.js';
import { getAllNetworkInterfaces, isInCidrRange } from '../utils/network.js';
import { loadUserConfig } from '../config.js';

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

  // Network information endpoint - returns all available network interfaces
  router.get('/network', authModule.requireAuth, (req, res) => {
    // Infer port from request headers or use default
    const port = req.headers.host?.includes(':')
      ? parseInt(req.headers.host.split(':')[1], 10)
      : 8866;
    const customRanges = loadUserConfig().customPrivateRanges ?? [];
    const interfaces = getAllNetworkInterfaces();

    const networkInfo = interfaces.map(iface => {
      const isCustom = customRanges.some(range => isInCidrRange(iface.address, range));
      return {
        name: iface.name,
        address: iface.address,
        type: iface.isVpn ? 'vpn' : iface.isPrivate ? 'private' : isCustom ? 'custom' : 'public',
        isVpn: iface.isVpn,
        isPrivate: iface.isPrivate,
        url: `http://${iface.address}:${port}`,
      };
    });

    res.json({
      interfaces: networkInfo,
      preferredUrl: `http://${req.headers.host ?? `127.0.0.1:${port}`}`,
    });
  });

  return router;
}
