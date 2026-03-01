import { describe, it, expect } from 'vitest';
import { createSessionCookieName, createClaudeSettings } from '../../../src/config.js';

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

describe('createClaudeSettings', () => {
  it('should generate valid JSON string', () => {
    const settings = createClaudeSettings(3000);
    expect(() => JSON.parse(settings)).not.toThrow();
  });

  it('should include hook URL with correct port for port 3000', () => {
    const settings = createClaudeSettings(3000);
    expect(settings).toContain('localhost:3000');
    expect(settings).toContain('/api/hook');
  });

  it('should include hook URL with correct port for port 3001', () => {
    const settings = createClaudeSettings(3001);
    expect(settings).toContain('localhost:3001');
    expect(settings).toContain('/api/hook');
  });

  it('should contain required hook types', () => {
    const settings = createClaudeSettings(3000);
    const parsed = JSON.parse(settings);

    expect(parsed.hooks).toHaveProperty('Notification');
    expect(parsed.hooks).toHaveProperty('PreToolUse');
    expect(parsed.hooks).toHaveProperty('PermissionRequest');
  });

  it('should use native HTTP hooks instead of command hooks', () => {
    const settings = createClaudeSettings(3000);
    const parsed = JSON.parse(settings);

    // Notification hook
    const notificationHook = parsed.hooks.Notification[0].hooks[0];
    expect(notificationHook.type).toBe('http');
    expect(notificationHook.url).toBe('http://localhost:3000/api/hook');

    // PreToolUse hook
    const preToolUseHook = parsed.hooks.PreToolUse[0].hooks[0];
    expect(preToolUseHook.type).toBe('http');
    expect(preToolUseHook.url).toBe('http://localhost:3000/api/hook');

    // PermissionRequest hook
    const permissionRequestHook = parsed.hooks.PermissionRequest[0].hooks[0];
    expect(permissionRequestHook.type).toBe('http');
    expect(permissionRequestHook.url).toBe('http://localhost:3000/api/hook');
  });

  it('should produce different settings for different ports', () => {
    const settings3000 = createClaudeSettings(3000);
    const settings3001 = createClaudeSettings(3001);

    expect(settings3000).not.toBe(settings3001);
    expect(settings3000).toContain('localhost:3000');
    expect(settings3001).toContain('localhost:3001');
  });
});
