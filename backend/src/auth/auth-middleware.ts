import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import * as cookie from 'cookie';
import { generateSessionId } from './token-generator.js';
import { RateLimiter } from './rate-limiter.js';
import { logger } from '../logger/logger.js';

export interface AuthModuleOptions {
  token: string;
  sessionTtlMs: number;
  rateLimitPerMinute: number;
  cookieName: string;
}

interface SessionEntry {
  createdAt: number;
  ip: string;
}

/**
 * Authentication module managing token verification, session cookies, and rate limiting.
 */
export class AuthModule {
  private readonly token: string;
  private readonly sessionTtlMs: number;
  private readonly cookieName: string;
  private readonly sessions: Map<string, SessionEntry> = new Map();
  private readonly rateLimiter: RateLimiter;

  constructor(options: AuthModuleOptions) {
    this.token = options.token;
    this.sessionTtlMs = options.sessionTtlMs;
    this.cookieName = options.cookieName;
    this.rateLimiter = new RateLimiter(options.rateLimitPerMinute);
  }

  /**
   * Verify a token using timing-safe comparison.
   */
  verifyToken(candidate: string): boolean {
    const a = Buffer.from(this.token);
    const b = Buffer.from(candidate);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Create a new session and return the session ID.
   */
  createSession(ip: string): string {
    const sessionId = generateSessionId();
    this.sessions.set(sessionId, { createdAt: Date.now(), ip });
    logger.info({ ip }, 'Session created');
    return sessionId;
  }

  /**
   * Validate a session ID. Returns true if valid and not expired.
   */
  validateSession(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > this.sessionTtlMs) {
      this.sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  /**
   * Extract session ID from request cookies.
   */
  getSessionFromRequest(req: Request): string | null {
    const cookies = cookie.parse(req.headers.cookie ?? '');
    return cookies[this.cookieName] ?? null;
  }

  /**
   * Extract session ID from a raw cookie header string.
   */
  getSessionFromCookieHeader(cookieHeader: string): string | null {
    const cookies = cookie.parse(cookieHeader);
    return cookies[this.cookieName] ?? null;
  }

  getCookieName(): string {
    return this.cookieName;
  }

  /**
   * Express middleware that protects routes with session auth.
   */
  requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const sessionId = this.getSessionFromRequest(req);
    const isValid = sessionId ? this.validateSession(sessionId) : false;
    if (!isValid) {
      logger.warn({
        path: req.path,
        instanceCookieName: this.cookieName,
        hasSessionCookie: Boolean(sessionId),
        sessionFound: Boolean(sessionId && this.sessions.has(sessionId)),
      }, 'Auth rejected: invalid session');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  /**
   * Handle auth POST (verify token, create session, return cookie).
   */
  handleAuth = (req: Request, res: Response): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    if (!this.rateLimiter.attempt(ip)) {
      logger.warn({ ip }, 'Auth rate limit hit');
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const { token } = req.body as { token?: string };
    if (!token || !this.verifyToken(token)) {
      logger.warn({ ip }, 'Auth failed: invalid token');
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const sessionId = this.createSession(ip);

    // Reset rate limiter on successful auth - user has proven they know the token
    this.rateLimiter.reset(ip);

    res.setHeader('Set-Cookie', cookie.serialize(this.cookieName, sessionId, {
      httpOnly: true,
      secure: req.protocol === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(this.sessionTtlMs / 1000),
    }));

    logger.info({ ip, instanceCookieName: this.cookieName }, 'Auth successful');
    res.json({ ok: true });
  };

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.rateLimiter.destroy();
  }
}
