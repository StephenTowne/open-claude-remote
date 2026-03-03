import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  stopTestServer,
  authenticate,
  TEST_TOKEN,
  type TestContext,
} from './helpers/test-server.js';

describe('REST API Endpoints', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(ctx);
  });

  // ─── GET /api/health ────────────────────────────────────────

  describe('GET /api/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('should not require authentication', async () => {
      // No cookie sent
      const res = await fetch(`${ctx.baseUrl}/api/health`);
      expect(res.status).toBe(200);
    });

    it('should not leak sensitive information', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/health`);
      const body = await res.json();
      // Only { status: 'ok' } — no token, no session info, no internal details
      expect(Object.keys(body)).toEqual(['status']);
    });
  });

  // ─── POST /api/auth ─────────────────────────────────────────

  describe('POST /api/auth', () => {
    it('should return 200 and set session cookie for correct token', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('session_id_test=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('should return 401 for wrong token', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'wrong-token' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 for missing token field', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 for empty token', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });
      expect(res.status).toBe(401);
    });

    it('should not set Secure flag over HTTP', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      const setCookie = res.headers.get('set-cookie');
      // Over plain HTTP the Secure flag should NOT be set
      expect(setCookie).not.toContain('Secure');
    });

    it('should return 429 after exceeding rate limit', async () => {
      // Create a fresh server with low rate limit for isolation
      const rlCtx = await startTestServer({ rateLimitPerMinute: 5 });
      try {
        // Exhaust 5 attempts with wrong tokens
        for (let i = 0; i < 5; i++) {
          await fetch(`${rlCtx.baseUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'wrong' }),
          });
        }

        // 6th attempt — even with correct token — should be rate limited
        const res = await fetch(`${rlCtx.baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TEST_TOKEN }),
        });
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toContain('Too many attempts');
      } finally {
        await stopTestServer(rlCtx);
      }
    });
  });

  // ─── GET /api/status ────────────────────────────────────────

  describe('GET /api/status', () => {
    it('should return 401 without authentication', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/status`);
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid session cookie', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie: 'session_id_test=invalid-session-id' },
      });
      expect(res.status).toBe(401);
    });

    it('should return session status when authenticated', async () => {
      const cookie = await authenticate(ctx.baseUrl);
      const res = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('running'); // PTY (cat) was spawned and setStatus('running') called
      expect(typeof body.connectedClients).toBe('number');
    });
  });

  // ─── POST /api/hook ─────────────────────────────────────────

  describe('Push API', () => {
    it('should return 503 for /api/push/vapid-key when VAPID key is not ready in time', async () => {
      const cookie = await authenticate(ctx.baseUrl);
      const originalWait = ctx.pushService.waitForVapidPublicKey.bind(ctx.pushService);
      ctx.pushService.waitForVapidPublicKey = async () => null;

      try {
        const res = await fetch(`${ctx.baseUrl}/api/push/vapid-key`, {
          headers: { cookie },
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body).toEqual({ error: 'Push notifications not available' });
      } finally {
        ctx.pushService.waitForVapidPublicKey = originalWait;
      }
    });

    it('should return 401 for /api/push/vapid-key without authentication', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/push/vapid-key`);
      expect(res.status).toBe(401);
    });

    it('should return vapidPublicKey for authenticated request', async () => {
      const cookie = await authenticate(ctx.baseUrl);
      const res = await fetch(`${ctx.baseUrl}/api/push/vapid-key`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.vapidPublicKey).toBe('string');
      expect(body.vapidPublicKey.length).toBeGreaterThan(10);
    });

    it('should return 400 for invalid /api/push/subscribe payload', async () => {
      const cookie = await authenticate(ctx.baseUrl);
      const res = await fetch(`${ctx.baseUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ endpoint: 'https://push.example.com/sub1' }),
      });
      expect(res.status).toBe(400);
    });

    it('should subscribe and unsubscribe successfully with valid payload', async () => {
      const cookie = await authenticate(ctx.baseUrl);
      const endpoint = 'https://push.example.com/sub1';

      const subRes = await fetch(`${ctx.baseUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh: 'BEl62iUYfUZJshBh4y7n4mZ3Y4Z5Y6Y7Y8Y9Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0Z1Z2Z3Z4Z5Z6Y=', auth: 'auth1' },
        }),
      });
      expect(subRes.status).toBe(200);
      expect(await subRes.json()).toEqual({ ok: true });

      const unsubRes = await fetch(`${ctx.baseUrl}/api/push/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ endpoint }),
      });
      expect(unsubRes.status).toBe(200);
      expect(await unsubRes.json()).toEqual({ ok: true, removed: true });
    });
  });

  describe('POST /api/hook', () => {
    it('should accept valid hook payload from localhost', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Claude wants to run: ls',
          tool_name: 'Bash',
          tool_input: { command: 'ls' },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.tool).toBe('Bash');
    });

    it('should return 400 for invalid payload', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '"not an object"',
      });
      expect(res.status).toBe(400);
    });

    it('should return tool name in response', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', tool_name: 'Read' }),
      });
      const body = await res.json();
      expect(body.tool).toBe('Read');
    });

    it('should not require auth (it is internal-only by localhost check)', async () => {
      // No cookie sent — should still work since we connect from localhost
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' }),
      });
      expect(res.status).toBe(200);
    });
  });
});
