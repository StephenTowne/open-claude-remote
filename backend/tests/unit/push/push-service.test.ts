import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushService } from '../../../src/push/push-service.js';

// Mock web-push to avoid real crypto and network calls
const mockSendNotification = vi.fn(() => Promise.resolve());
vi.mock('web-push', () => ({
  default: {
    generateVAPIDKeys: vi.fn(() => ({
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
    })),
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}));

// Mock fs module to avoid actual file system operations
const mockMkdir = vi.fn(() => Promise.resolve());
const mockReadFile = vi.fn(() => Promise.reject(new Error('File not found')));
const mockWriteFile = vi.fn(() => Promise.resolve());
vi.mock('fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

// Mock file-lock to avoid actual filesystem locking in unit tests
vi.mock('../../../src/utils/file-lock.js', () => ({
  withFileLock: (_lockPath: string, fn: () => unknown) => fn(),
  withFileLockAsync: (_lockPath: string, fn: () => Promise<unknown>) => fn(),
}));

// 有效的 p256dh 测试数据（Base64 URL-safe 编码，65 字节 ECDH 公钥）
const VALID_P256DH_1 = 'BEl62iUYfUZJshBh4y7n4mZ3Y4Z5Y6Y7Y8Y9Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0Z1Z2Z3Z4Z5Z6Y=';
const VALID_P256DH_2 = 'BEl62iUYfUZJshBh4y7n4mZ3Y4Z5Y6Y7Y8Y9Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0Z1Z2Z3Z4Z5Z6X=';
const VALID_P256DH_3 = 'BEl62iUYfUZJshBh4y7n4mZ3Y4Z5Y6Y7Y8Y9Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0Z1Z2Z3Z4Z5Z6W=';
const VALID_P256DH_4 = 'BEl62iUYfUZJshBh4y7n4mZ3Y4Z5Y6Y7Y8Y9Z0Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0Z1Z2Z3Z4Z5Z6V=';

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env['VAPID_PUBLIC_KEY'];
    delete process.env['VAPID_PRIVATE_KEY'];
    delete process.env['VAPID_SUBJECT'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start with zero subscribers', () => {
    const service = new PushService('/tmp/test-push');
    expect(service.subscriberCount).toBe(0);
  });

  it('should add and remove subscriptions', () => {
    const service = new PushService('/tmp/test-push');
    const sub = {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: VALID_P256DH_1, auth: 'auth1' },
    };

    service.subscribe(sub);
    expect(service.subscriberCount).toBe(1);

    const removed = service.unsubscribe('https://push.example.com/sub1');
    expect(removed).toBe(true);
    expect(service.subscriberCount).toBe(0);
  });

  it('should return false when unsubscribing unknown endpoint', () => {
    const service = new PushService('/tmp/test-push');
    expect(service.unsubscribe('https://nonexistent.com')).toBe(false);
  });

  it('should generate VAPID keys when env vars are not set', async () => {
    const service = new PushService('/tmp/test-push');
    const key = await service.waitForVapidPublicKey();
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(10);
  });


  it('should use VAPID keys from env vars when provided', () => {
    process.env['VAPID_PUBLIC_KEY'] = 'env-public';
    process.env['VAPID_PRIVATE_KEY'] = 'env-private';

    const service = new PushService('/tmp/test-push');
    expect(service.getVapidPublicKey()).toBe('env-public');
  });

  it('should skip notification when no subscribers', async () => {
    const service = new PushService('/tmp/test-push');
    // Wait for initialization
    await service.waitForVapidPublicKey(1000);
    // Should not throw
    await service.notifyAll({
      title: 'Test',
      body: 'Test body',
    });
  });

  it('should send notification to all subscribers', async () => {
    const service = new PushService('/tmp/test-push');
    // Wait for VAPID key initialization
    const key = await service.waitForVapidPublicKey(1000);
    expect(key).toBeTruthy();

    service.subscribe({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: VALID_P256DH_1, auth: 'auth1' },
    });
    service.subscribe({
      endpoint: 'https://push.example.com/sub2',
      keys: { p256dh: VALID_P256DH_2, auth: 'auth2' },
    });

    await service.notifyAll({
      title: 'Claude Code 需要输入',
      body: 'Test notification',
      tag: 'claude-input',
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('should load VAPID keys from file when available', async () => {
    const savedKeys = { publicKey: 'saved-public', privateKey: 'saved-private' };
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('vapid-keys.json')) {
        return Promise.resolve(JSON.stringify(savedKeys));
      }
      return Promise.reject(new Error('File not found'));
    });

    const service = new PushService('/tmp/test-push');
    const key = await service.waitForVapidPublicKey(1000);
    expect(key).toBe('saved-public');
  });

  it('should load subscriptions from file when available', async () => {
    const savedSubs = [
      { endpoint: 'https://push.example.com/saved1', keys: { p256dh: VALID_P256DH_1, auth: 'a1' } },
      { endpoint: 'https://push.example.com/saved2', keys: { p256dh: VALID_P256DH_2, auth: 'a2' } },
    ];
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('push-subscriptions.json')) {
        return Promise.resolve(JSON.stringify(savedSubs));
      }
      // VAPID keys not found → generate new
      return Promise.reject(new Error('File not found'));
    });

    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);
    expect(service.subscriberCount).toBe(2);
  });

  it('should persist subscriptions after expired subscription cleanup', async () => {
    mockSendNotification.mockRejectedValueOnce({ statusCode: 410 });

    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    service.subscribe({
      endpoint: 'https://push.example.com/expired',
      keys: { p256dh: VALID_P256DH_1, auth: 'auth1' },
    });

    // Clear mock to isolate the save call triggered by notifyAll cleanup
    mockWriteFile.mockClear();

    await service.notifyAll({ title: 'Test', body: 'Body' });

    expect(service.subscriberCount).toBe(0);
    // saveSubscriptions should have been called to persist the removal
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should remove expired subscriptions (410 Gone)', async () => {
    mockSendNotification.mockRejectedValueOnce({ statusCode: 410 });

    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    service.subscribe({
      endpoint: 'https://push.example.com/expired',
      keys: { p256dh: VALID_P256DH_1, auth: 'auth1' },
    });

    await service.notifyAll({ title: 'Test', body: 'Body' });

    expect(service.subscriberCount).toBe(0);
  });

  it('should merge subscriptions from file on subscribe (not overwrite)', async () => {
    // 模拟文件中已有另一个实例的订阅
    const existingSubs = [
      { endpoint: 'https://push.example.com/other-instance', keys: { p256dh: VALID_P256DH_1, auth: 'oa1' } },
    ];
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('push-subscriptions.json')) {
        return Promise.resolve(JSON.stringify(existingSubs));
      }
      return Promise.reject(new Error('File not found'));
    });

    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    // subscribe 应该执行读-合并-写
    service.subscribe({
      endpoint: 'https://push.example.com/new-sub',
      keys: { p256dh: VALID_P256DH_2, auth: 'na1' },
    });

    // 等待异步保存完成
    await new Promise(resolve => setTimeout(resolve, 50));

    // 验证写入时包含两个订阅（合并而非覆盖）
    const lastWriteCall = mockWriteFile.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).includes('push-subscriptions.json'),
    ).pop();
    if (lastWriteCall) {
      const written = JSON.parse(lastWriteCall[1] as string);
      expect(written).toHaveLength(2);
      const endpoints = written.map((s: { endpoint: string }) => s.endpoint);
      expect(endpoints).toContain('https://push.example.com/other-instance');
      expect(endpoints).toContain('https://push.example.com/new-sub');
    }
  });

  it('should reload subscriptions from file before notifyAll', async () => {
    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    // 只在内存中添加一个订阅
    service.subscribe({
      endpoint: 'https://push.example.com/local',
      keys: { p256dh: VALID_P256DH_1, auth: 'la1' },
    });

    // 模拟文件中有一个来自其他实例的订阅
    const fileSubs = [
      { endpoint: 'https://push.example.com/local', keys: { p256dh: VALID_P256DH_1, auth: 'la1' } },
      { endpoint: 'https://push.example.com/remote', keys: { p256dh: VALID_P256DH_2, auth: 'ra1' } },
    ];
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('push-subscriptions.json')) {
        return Promise.resolve(JSON.stringify(fileSubs));
      }
      return Promise.reject(new Error('File not found'));
    });
    mockSendNotification.mockResolvedValue(undefined);

    await service.notifyAll({ title: 'Cross', body: 'Instance' });

    // 应该发送给两个订阅者（包括从文件加载的远程订阅）
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('should skip subscriptions with invalid p256dh from file', async () => {
    // 文件中包含无效的 p256dh 数据
    const savedSubs = [
      { endpoint: 'https://push.example.com/invalid', keys: { p256dh: 'short-key', auth: 'a1' } },
      { endpoint: 'https://push.example.com/valid', keys: { p256dh: VALID_P256DH_1, auth: 'a2' } },
    ];
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('push-subscriptions.json')) {
        return Promise.resolve(JSON.stringify(savedSubs));
      }
      return Promise.reject(new Error('File not found'));
    });

    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    // 只有有效的订阅被加载
    await service.notifyAll({ title: 'Test', body: 'Body' });

    // 只发送给有效订阅者
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example.com/valid' }),
      expect.any(String),
    );
  });

  it('should skip subscriptions with invalid p256dh in notifyAll loop', async () => {
    const service = new PushService('/tmp/test-push');
    await service.waitForVapidPublicKey(1000);

    // 直接在内存中设置无效订阅（模拟绕过 API 验证的情况）
    service.subscribe({
      endpoint: 'https://push.example.com/valid',
      keys: { p256dh: VALID_P256DH_1, auth: 'auth1' },
    });

    // 模拟文件返回包含无效订阅的数据
    const fileSubs = [
      { endpoint: 'https://push.example.com/valid', keys: { p256dh: VALID_P256DH_1, auth: 'auth1' } },
      { endpoint: 'https://push.example.com/invalid', keys: { p256dh: 'bad', auth: 'auth2' } },
    ];
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes('push-subscriptions.json')) {
        return Promise.resolve(JSON.stringify(fileSubs));
      }
      return Promise.reject(new Error('File not found'));
    });

    await service.notifyAll({ title: 'Test', body: 'Body' });

    // 只发送给有效订阅
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });
});
