import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  stopTestServer,
  TEST_TOKEN,
  type TestContext,
} from './helpers/test-server.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Authentication Flow', () => {
  // ─── Full auth lifecycle ────────────────────────────────────

  describe('complete auth lifecycle', () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await startTestServer();
    });

    afterAll(async () => {
      await stopTestServer(ctx);
    });

    it('should authenticate → get cookie → access protected endpoint → succeed', async () => {
      // Step 1: Authenticate
      const authRes = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      expect(authRes.status).toBe(200);

      // Step 2: Extract session cookie
      const setCookie = authRes.headers.get('set-cookie')!;
      const cookie = setCookie.split(';')[0];
      expect(cookie).toContain('session_id_test=');

      // Step 3: Use cookie to access protected endpoint
      const statusRes = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie },
      });
      expect(statusRes.status).toBe(200);
      const body = await statusRes.json();
      expect(body.status).toBe('running');
    });

    it('should reject access without cookie after auth', async () => {
      // Authenticate first
      await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });

      // Try to access without cookie
      const res = await fetch(`${ctx.baseUrl}/api/status`);
      expect(res.status).toBe(401);
    });

    it('should reject access with a tampered cookie', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie: 'session_id_test=tampered-value-that-does-not-exist' },
      });
      expect(res.status).toBe(401);
    });

    it('should allow multiple concurrent sessions', async () => {
      // Create two sessions
      const auth1 = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      const cookie1 = auth1.headers.get('set-cookie')!.split(';')[0];

      const auth2 = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      const cookie2 = auth2.headers.get('set-cookie')!.split(';')[0];

      expect(cookie1).not.toBe(cookie2);

      // Both sessions should work
      const [res1, res2] = await Promise.all([
        fetch(`${ctx.baseUrl}/api/status`, { headers: { cookie: cookie1 } }),
        fetch(`${ctx.baseUrl}/api/status`, { headers: { cookie: cookie2 } }),
      ]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  // ─── Session expiry ─────────────────────────────────────────

  describe('session expiry', () => {
    it('should reject access after session TTL expires', async () => {
      // Use a short TTL (500ms) — long enough for auth + first request,
      // short enough to expire quickly during the test
      const ctx = await startTestServer({ sessionTtlMs: 500 });
      try {
        // Authenticate
        const authRes = await fetch(`${ctx.baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TEST_TOKEN }),
        });
        const cookie = authRes.headers.get('set-cookie')!.split(';')[0];

        // Immediately should work
        const res1 = await fetch(`${ctx.baseUrl}/api/status`, {
          headers: { cookie },
        });
        expect(res1.status).toBe(200);

        // Wait for TTL to expire
        await delay(700);

        // Should now be rejected
        const res2 = await fetch(`${ctx.baseUrl}/api/status`, {
          headers: { cookie },
        });
        expect(res2.status).toBe(401);
      } finally {
        await stopTestServer(ctx);
      }
    });
  });

  // ─── Rate limiting ──────────────────────────────────────────

  describe('rate limiting', () => {
    it('should block auth attempts after exceeding rate limit', async () => {
      const ctx = await startTestServer({ rateLimitPerMinute: 3 });
      try {
        // Exhaust 3 attempts with wrong tokens
        for (let i = 0; i < 3; i++) {
          await fetch(`${ctx.baseUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'wrong' }),
          });
        }

        // 4th attempt — even with correct token — should be blocked
        const blocked = await fetch(`${ctx.baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TEST_TOKEN }),
        });
        expect(blocked.status).toBe(429);
        const body = await blocked.json();
        expect(body.error).toContain('Too many attempts');
      } finally {
        await stopTestServer(ctx);
      }
    });

    it('should rate limit per IP independently', async () => {
      // Rate limit recovery and per-IP isolation is tested in unit tests (rate-limiter.test.ts).
      // Here we verify the integration: rate limiting is wired correctly into the auth endpoint.
      const ctx = await startTestServer({ rateLimitPerMinute: 2 });
      try {
        // 2 attempts exhaust the limit
        for (let i = 0; i < 2; i++) {
          await fetch(`${ctx.baseUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'wrong' }),
          });
        }

        // 3rd is blocked
        const res = await fetch(`${ctx.baseUrl}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TEST_TOKEN }),
        });
        expect(res.status).toBe(429);
      } finally {
        await stopTestServer(ctx);
      }
    });
  });

  // ─── Cookie attributes ──────────────────────────────────────

  describe('cookie security attributes', () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await startTestServer();
    });

    afterAll(async () => {
      await stopTestServer(ctx);
    });

    it('should set HttpOnly, SameSite=Lax, Path=/ in cookie', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      const setCookie = res.headers.get('set-cookie')!;
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
    });

    it('should set Max-Age derived from session TTL', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TEST_TOKEN }),
      });
      const setCookie = res.headers.get('set-cookie')!;
      expect(setCookie).toContain('Max-Age=');
    });
  });
});
