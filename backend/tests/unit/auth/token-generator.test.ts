import { describe, it, expect } from 'vitest';
import { generateToken, generateSessionId } from '../../../src/auth/token-generator.js';

describe('Token Generator', () => {
  it('should generate a 64-char hex token (32 bytes)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateToken()));
    expect(tokens.size).toBe(10);
  });

  it('should generate a 64-char hex session ID', () => {
    const sid = generateSessionId();
    expect(sid).toMatch(/^[0-9a-f]{64}$/);
  });
});
