import { describe, it, expect } from 'vitest';
import { createSessionCookieName } from '../../../src/config.js';

describe('createSessionCookieName', () => {
  it('should generate cookie name based on port number', () => {
    expect(createSessionCookieName(3000)).toBe('session_id_p3000');
    expect(createSessionCookieName(3001)).toBe('session_id_p3001');
    expect(createSessionCookieName(8080)).toBe('session_id_p8080');
  });

  it('should produce different names for different ports', () => {
    const name3000 = createSessionCookieName(3000);
    const name3001 = createSessionCookieName(3001);
    expect(name3000).not.toBe(name3001);
  });
});
