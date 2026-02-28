import { Router } from 'express';
import { createHealthRoutes } from './health-routes.js';
import { createAuthRoutes } from './auth-routes.js';
import { createStatusRoutes } from './status-routes.js';
import { createHookRoutes } from './hook-routes.js';
import { createPushRoutes } from './push-routes.js';
import { createInstanceRoutes } from './instance-routes.js';
import { AuthModule } from '../auth/auth-middleware.js';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { PushService } from '../push/push-service.js';
import type { SessionController } from '../session/session-controller.js';
import type { InstanceInfo } from '@claude-remote/shared';

export interface ApiRouterOptions {
  authModule: AuthModule;
  hookReceiver: HookReceiver;
  getController: () => SessionController | null;
  pushService?: PushService;
  listInstances?: () => InstanceInfo[];
  currentInstanceId?: string;
}

export function createApiRouter(opts: ApiRouterOptions): Router;
export function createApiRouter(
  authModule: AuthModule,
  hookReceiver: HookReceiver,
  getController: () => SessionController | null,
  pushService?: PushService,
): Router;
export function createApiRouter(
  authModuleOrOpts: AuthModule | ApiRouterOptions,
  hookReceiver?: HookReceiver,
  getController?: () => SessionController | null,
  pushService?: PushService,
): Router {
  let opts: ApiRouterOptions;
  if (authModuleOrOpts instanceof AuthModule) {
    opts = {
      authModule: authModuleOrOpts,
      hookReceiver: hookReceiver!,
      getController: getController!,
      pushService,
    };
  } else {
    opts = authModuleOrOpts;
  }

  const router = Router();

  router.use(createHealthRoutes());
  router.use(createAuthRoutes(opts.authModule));
  router.use(createStatusRoutes(opts.authModule, opts.getController));
  router.use(createHookRoutes(opts.hookReceiver));

  if (opts.pushService) {
    router.use(createPushRoutes(opts.authModule, opts.pushService));
  }

  if (opts.listInstances && opts.currentInstanceId) {
    router.use(createInstanceRoutes(opts.authModule, opts.listInstances, opts.currentInstanceId));
  }

  return router;
}
