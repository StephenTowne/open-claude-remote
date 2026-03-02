import { logger } from '../logger/logger.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter per IP.
 * Window: 1 minute. Configurable max attempts.
 *
 * 多实例限制：各实例独立计数，不共享状态。
 * 在多实例场景下，同一 IP 的有效总尝试次数 = maxAttempts × 实例数。
 * 这在实际场景中可接受：token 为 256 位（64 hex chars），暴力破解不可行。
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxAttempts: number = 5, windowMs: number = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    // Periodic cleanup of stale entries
    this.cleanupTimer = setInterval(() => this.cleanup(), windowMs * 2);
    // Don't block process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if an IP is allowed. Returns true if allowed, false if rate limited.
   * Automatically increments the counter.
   */
  attempt(ip: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(ip);

    if (!entry || now >= entry.resetAt) {
      // First attempt or window expired
      this.entries.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    entry.count++;
    if (entry.count > this.maxAttempts) {
      logger.warn({ ip, count: entry.count, maxAttempts: this.maxAttempts }, 'Rate limit exceeded');
      return false;
    }

    return true;
  }

  /**
   * Get remaining attempts for an IP.
   */
  remaining(ip: string): number {
    const now = Date.now();
    const entry = this.entries.get(ip);
    if (!entry || now >= entry.resetAt) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - entry.count);
  }

  /**
   * Clean up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(ip);
      }
    }
  }

  /**
   * Reset rate limit counter for an IP (e.g., after successful auth).
   */
  reset(ip: string): void {
    this.entries.delete(ip);
  }

  /**
   * Stop cleanup timer.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
