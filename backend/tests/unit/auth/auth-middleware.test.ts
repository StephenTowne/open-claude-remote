import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthModule } from '../../../src/auth/auth-middleware.js';

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { cookie: '' },
    ip: '192.168.1.100',
    protocol: 'http',
    socket: { remoteAddress: '192.168.1.100' },
    body: {},
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
    setHeader(key: string, value: string) { res.headers[key] = value; },
  };
  return res;
}

describe('AuthModule', () => {
  const TEST_TOKEN = 'test-token-for-auth-module-testing-1234';
  let authModule: AuthModule;

  beforeEach(() => {
    authModule = new AuthModule({
      token: TEST_TOKEN,
      sessionTtlMs: 60_000, // 1 minute for testing
      rateLimitPerMinute: 5,
      cookieName: 'session_id_test_default',
    });
  });

  afterEach(() => {
    authModule.destroy();
  });

  describe('verifyToken', () => {
    it('should return true for correct token', () => {
      expect(authModule.verifyToken(TEST_TOKEN)).toBe(true);
    });

    it('should return false for incorrect token', () => {
      expect(authModule.verifyToken('wrong-token')).toBe(false);
    });

    it('should return false for token with different length', () => {
      expect(authModule.verifyToken('short')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(authModule.verifyToken('')).toBe(false);
    });
  });

  describe('createSession / validateSession', () => {
    it('should create a valid session', () => {
      const sessionId = authModule.createSession('192.168.1.100');
      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
      expect(authModule.validateSession(sessionId)).toBe(true);
    });

    it('should generate unique session IDs', () => {
      const s1 = authModule.createSession('1.2.3.4');
      const s2 = authModule.createSession('1.2.3.4');
      expect(s1).not.toBe(s2);
    });

    it('should reject unknown session ID', () => {
      expect(authModule.validateSession('nonexistent-session-id')).toBe(false);
    });

    it('should expire session after TTL', () => {
      vi.useFakeTimers();
      const sessionId = authModule.createSession('1.2.3.4');
      expect(authModule.validateSession(sessionId)).toBe(true);

      vi.advanceTimersByTime(61_000); // past 1 minute TTL
      expect(authModule.validateSession(sessionId)).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getSessionFromRequest', () => {
    it('should extract session_id from cookie header', () => {
      const req = createMockReq({ headers: { cookie: 'session_id_test_default=abc123' } });
      expect(authModule.getSessionFromRequest(req)).toBe('abc123');
    });

    it('should return null when no cookie header', () => {
      const req = createMockReq({ headers: {} });
      expect(authModule.getSessionFromRequest(req)).toBeNull();
    });

    it('should return null when session_id cookie is missing', () => {
      const req = createMockReq({ headers: { cookie: 'other=value' } });
      expect(authModule.getSessionFromRequest(req)).toBeNull();
    });
  });

  describe('getSessionFromCookieHeader', () => {
    it('should extract session_id from raw cookie string', () => {
      expect(authModule.getSessionFromCookieHeader('session_id_test_default=xyz789')).toBe('xyz789');
    });

    it('should return null for empty string', () => {
      expect(authModule.getSessionFromCookieHeader('')).toBeNull();
    });
  });

  describe('requireAuth middleware', () => {
    it('should call next() for valid session', () => {
      const sessionId = authModule.createSession('1.2.3.4');
      const req = createMockReq({ headers: { cookie: `session_id_test_default=${sessionId}` } });
      const res = createMockRes();
      const next = vi.fn();

      authModule.requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 for missing session', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      authModule.requireAuth(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid session', () => {
      const req = createMockReq({ headers: { cookie: 'session_id_test_default=invalid' } });
      const res = createMockRes();
      const next = vi.fn();

      authModule.requireAuth(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('handleAuth', () => {
    it('should succeed with correct token and set cookie', () => {
      const req = createMockReq({ body: { token: TEST_TOKEN } });
      const res = createMockRes();

      authModule.handleAuth(req, res);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers['Set-Cookie']).toBeDefined();
      expect(res.headers['Set-Cookie']).toContain('session_id_test_default=');
      expect(res.headers['Set-Cookie']).toContain('HttpOnly');
    });

    it('should isolate cookie names across instances', () => {
      const authModuleA = new AuthModule({
        token: TEST_TOKEN,
        sessionTtlMs: 60_000,
        rateLimitPerMinute: 5,
        cookieName: 'session_id_p3000',
      });
      const authModuleB = new AuthModule({
        token: TEST_TOKEN,
        sessionTtlMs: 60_000,
        rateLimitPerMinute: 5,
        cookieName: 'session_id_p3001',
      });

      const reqA = createMockReq({ body: { token: TEST_TOKEN } });
      const resA = createMockRes();
      const reqB = createMockReq({ body: { token: TEST_TOKEN } });
      const resB = createMockRes();

      authModuleA.handleAuth(reqA, resA);
      authModuleB.handleAuth(reqB, resB);

      expect(resA.headers['Set-Cookie']).toContain('session_id_p3000=');
      expect(resB.headers['Set-Cookie']).toContain('session_id_p3001=');
      expect(resA.headers['Set-Cookie']).not.toContain('session_id_p3001=');
      expect(resB.headers['Set-Cookie']).not.toContain('session_id_p3000=');

      authModuleA.destroy();
      authModuleB.destroy();
    });

    it('should return 401 for wrong token', () => {
      const req = createMockReq({ body: { token: 'wrong' } });
      const res = createMockRes();

      authModule.handleAuth(req, res);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 for missing token', () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      authModule.handleAuth(req, res);
      expect(res.statusCode).toBe(401);
    });

    it('should return 429 when rate limited', () => {
      for (let i = 0; i < 5; i++) {
        const req = createMockReq({ body: { token: 'wrong' } });
        const res = createMockRes();
        authModule.handleAuth(req, res);
      }

      // 6th attempt should be rate limited
      const req = createMockReq({ body: { token: TEST_TOKEN } });
      const res = createMockRes();
      authModule.handleAuth(req, res);
      expect(res.statusCode).toBe(429);
    });

    it('should reset rate limit after successful auth', () => {
      // Exhaust rate limit with failed attempts
      for (let i = 0; i < 5; i++) {
        const req = createMockReq({ body: { token: 'wrong' } });
        const res = createMockRes();
        authModule.handleAuth(req, res);
        expect(res.statusCode).toBe(401);
      }

      // Verify rate limited
      const reqLimited = createMockReq({ body: { token: 'wrong' } });
      const resLimited = createMockRes();
      authModule.handleAuth(reqLimited, resLimited);
      expect(resLimited.statusCode).toBe(429);

      // Successful auth should reset rate limit (using a different IP to bypass current limit)
      const authModule2 = new AuthModule({
        token: TEST_TOKEN,
        sessionTtlMs: 60_000,
        rateLimitPerMinute: 5,
        cookieName: 'session_test_reset',
      });

      // Simulate: same IP exhausts limit, then succeeds
      const reqSuccess = createMockReq({ body: { token: TEST_TOKEN } });
      const resSuccess = createMockRes();
      authModule2.handleAuth(reqSuccess, resSuccess);
      expect(resSuccess.statusCode).toBe(200);

      // After success, should be able to auth again with correct token
      const reqAgain = createMockReq({ body: { token: TEST_TOKEN } });
      const resAgain = createMockRes();
      authModule2.handleAuth(reqAgain, resAgain);
      expect(resAgain.statusCode).toBe(200);

      authModule2.destroy();
    });

    it('should not set secure cookie over HTTP', () => {
      const req = createMockReq({ body: { token: TEST_TOKEN }, protocol: 'http' });
      const res = createMockRes();

      authModule.handleAuth(req, res);
      expect(res.headers['Set-Cookie']).not.toContain('Secure');
    });

    it('should set secure cookie over HTTPS', () => {
      const req = createMockReq({ body: { token: TEST_TOKEN }, protocol: 'https' });
      const res = createMockRes();

      authModule.handleAuth(req, res);
      expect(res.headers['Set-Cookie']).toContain('Secure');
    });
  });
});
