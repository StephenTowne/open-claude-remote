import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../../../src/auth/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 60_000); // 3 attempts per minute
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow attempts within limit', () => {
    expect(limiter.attempt('1.2.3.4')).toBe(true);
    expect(limiter.attempt('1.2.3.4')).toBe(true);
    expect(limiter.attempt('1.2.3.4')).toBe(true);
  });

  it('should block attempts exceeding limit', () => {
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(false);
  });

  it('should track IPs independently', () => {
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(false);
    expect(limiter.attempt('5.6.7.8')).toBe(true);
  });

  it('should reset after window expires', () => {
    vi.useFakeTimers();

    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(61_000);
    expect(limiter.attempt('1.2.3.4')).toBe(true);

    vi.useRealTimers();
  });

  it('should report correct remaining attempts', () => {
    expect(limiter.remaining('1.2.3.4')).toBe(3);
    limiter.attempt('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(2);
    limiter.attempt('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(1);
    limiter.attempt('1.2.3.4');
    expect(limiter.remaining('1.2.3.4')).toBe(0);
  });

  it('should reset counter for an IP', () => {
    // Exhaust the limit
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(false);

    // Reset should allow new attempts
    limiter.reset('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(true);
    expect(limiter.remaining('1.2.3.4')).toBe(2);
  });

  it('should only reset the specified IP', () => {
    // Exhaust limit for both IPs
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('1.2.3.4');
    limiter.attempt('5.6.7.8');
    limiter.attempt('5.6.7.8');
    limiter.attempt('5.6.7.8');

    // Reset only 1.2.3.4
    limiter.reset('1.2.3.4');
    expect(limiter.attempt('1.2.3.4')).toBe(true);
    expect(limiter.attempt('5.6.7.8')).toBe(false);
  });
});
