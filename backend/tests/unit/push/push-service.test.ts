import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushService } from '../../../src/push/push-service.js';

// Mock web-push to avoid real crypto and network calls
vi.mock('web-push', () => ({
  generateVAPIDKeys: vi.fn(() => ({
    publicKey: 'test-public-key',
    privateKey: 'test-private-key',
  })),
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(() => Promise.resolve()),
}));

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env['VAPID_PUBLIC_KEY'];
    delete process.env['VAPID_PRIVATE_KEY'];
    delete process.env['VAPID_SUBJECT'];
  });

  it('should start with zero subscribers', () => {
    const service = new PushService();
    expect(service.subscriberCount).toBe(0);
  });

  it('should add and remove subscriptions', () => {
    const service = new PushService();
    const sub = {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
    };

    service.subscribe(sub);
    expect(service.subscriberCount).toBe(1);

    const removed = service.unsubscribe('https://push.example.com/sub1');
    expect(removed).toBe(true);
    expect(service.subscriberCount).toBe(0);
  });

  it('should return false when unsubscribing unknown endpoint', () => {
    const service = new PushService();
    expect(service.unsubscribe('https://nonexistent.com')).toBe(false);
  });

  it('should generate VAPID keys when env vars are not set', async () => {
    const service = new PushService();
    const key = await service.waitForVapidPublicKey();
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(10);
  });


  it('should use VAPID keys from env vars when provided', () => {
    process.env['VAPID_PUBLIC_KEY'] = 'env-public';
    process.env['VAPID_PRIVATE_KEY'] = 'env-private';

    const service = new PushService();
    expect(service.getVapidPublicKey()).toBe('env-public');
  });

  it('should skip notification when no subscribers', async () => {
    const service = new PushService();
    // Should not throw
    await service.notifyAll({
      title: 'Test',
      body: 'Test body',
    });
  });

  it('should send notification to all subscribers', async () => {
    const webpush = await import('web-push');
    const service = new PushService();
    // Wait for key generation
    await new Promise((r) => setTimeout(r, 50));

    service.subscribe({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
    });
    service.subscribe({
      endpoint: 'https://push.example.com/sub2',
      keys: { p256dh: 'key2', auth: 'auth2' },
    });

    await service.notifyAll({
      title: 'Claude Code 需要输入',
      body: 'Test notification',
      tag: 'claude-input',
    });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('should remove expired subscriptions (410 Gone)', async () => {
    const webpush = await import('web-push');
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });

    const service = new PushService();
    await new Promise((r) => setTimeout(r, 50));

    service.subscribe({
      endpoint: 'https://push.example.com/expired',
      keys: { p256dh: 'key1', auth: 'auth1' },
    });

    await service.notifyAll({ title: 'Test', body: 'Body' });

    expect(service.subscriberCount).toBe(0);
  });
});
