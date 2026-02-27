import { Router } from 'express';
import { AuthModule } from '../auth/auth-middleware.js';

export function createAuthRoutes(authModule: AuthModule): Router {
  const router = Router();

  router.post('/auth', authModule.handleAuth);

  return router;
}
