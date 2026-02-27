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
      expect(setCookie).toContain('session_id=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
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
        headers: { cookie: 'session_id=invalid-session-id' },
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
      expect(body.approvalId).toBeTruthy();
    });

    it('should return 400 for invalid payload', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '"not an object"',
      });
      expect(res.status).toBe(400);
    });

    it('should return approval ID as UUID format', async () => {
      const res = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', tool_name: 'Read' }),
      });
      const body = await res.json();
      expect(body.approvalId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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
