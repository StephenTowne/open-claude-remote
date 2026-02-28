import { Router } from 'express';
import type { InstanceInfo, InstanceListItem } from '@claude-remote/shared';
import { AuthModule } from '../auth/auth-middleware.js';
import { createAuthRoutes } from './auth-routes.js';

export function createInstanceRoutes(
  authModule: AuthModule,
  listInstances: () => InstanceInfo[],
  currentInstanceId: string,
): Router {
  const router = Router();

  // 复用 auth 路由以支持 supertest 认证
  router.use(createAuthRoutes(authModule));

  router.get('/instances', authModule.requireAuth, (_req, res) => {
    const instances = listInstances();
    const result: InstanceListItem[] = instances.map(inst => ({
      ...inst,
      isCurrent: inst.instanceId === currentInstanceId,
    }));
    res.json(result);
  });

  return router;
}
