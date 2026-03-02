import { logger } from '../logger/logger.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { withFileLockAsync } from '../utils/file-lock.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  renotify?: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Web Push notification service.
 * Manages VAPID keys, subscriptions, and notification delivery.
 *
 * 多实例支持：订阅数据通过文件持久化并跨实例共享。
 * subscribe/unsubscribe 使用最终一致性语义——内存立即更新，
 * 文件持久化异步执行（不阻塞调用方）。如果进程在持久化完成前崩溃，
 * 该订阅需客户端重新注册。
 */
export class PushService {
  private subscriptions = new Map<string, PushSubscriptionData>();
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;
  private vapidInitPromise: Promise<void>;

  private readonly vapidKeysFile: string;
  private readonly vapidLockPath: string;
  private readonly subscriptionsFile: string;
  private readonly subscriptionsLockPath: string;
  private readonly dataDir: string;

  constructor(baseDir: string) {
    this.dataDir = baseDir;
    this.vapidKeysFile = join(baseDir, 'vapid-keys.json');
    this.vapidLockPath = this.vapidKeysFile + '.lock';
    this.subscriptionsFile = join(baseDir, 'push-subscriptions.json');
    this.subscriptionsLockPath = this.subscriptionsFile + '.lock';

    this.vapidSubject = process.env['VAPID_SUBJECT'] ?? 'mailto:noreply@localhost';

    const envPublic = process.env['VAPID_PUBLIC_KEY'];
    const envPrivate = process.env['VAPID_PRIVATE_KEY'];

    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic;
      this.vapidPrivateKey = envPrivate;
      logger.info('Using VAPID keys from environment variables');
      // 即使使用环境变量，也要加载持久化的订阅
      this.vapidInitPromise = this.loadSubscriptions();
    } else {
      // Lazy init — 加载或生成 VAPID 密钥，然后加载订阅
      this.vapidPublicKey = '';
      this.vapidPrivateKey = '';
      this.vapidInitPromise = this.initVapidAndSubscriptions();
    }
  }

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (err) {
      logger.error({ err, path: this.dataDir }, 'Failed to create data directory');
      throw err;
    }
  }

  /**
   * 从文件加载 VAPID 密钥
   */
  private async loadVapidKeys(): Promise<VapidKeys | null> {
    try {
      const content = await fs.readFile(this.vapidKeysFile, 'utf-8');
      const keys = JSON.parse(content) as VapidKeys;
      if (keys.publicKey && keys.privateKey) {
        return keys;
      }
    } catch {
      // 文件不存在或解析失败
    }
    return null;
  }

  /**
   * 保存 VAPID 密钥到文件
   */
  private async saveVapidKeys(keys: VapidKeys): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(this.vapidKeysFile, JSON.stringify(keys, null, 2), { encoding: 'utf-8', mode: 0o600 });
  }

  /**
   * 从文件加载订阅数据
   */
  private async loadSubscriptions(): Promise<void> {
    try {
      const content = await fs.readFile(this.subscriptionsFile, 'utf-8');
      const data = JSON.parse(content) as PushSubscriptionData[];
      for (const sub of data) {
        this.subscriptions.set(sub.endpoint, sub);
      }
      logger.info({ count: this.subscriptions.size }, 'Loaded push subscriptions from file');
    } catch {
      // 文件不存在或解析失败，不加载任何订阅
      logger.debug('No existing push subscriptions file found');
    }
  }

  /**
   * 从文件读取所有订阅（包含其他实例写入的）。
   * 通过文件锁保护，防止读到半写的 JSON。
   */
  private async readSubscriptionsFromFile(): Promise<PushSubscriptionData[]> {
    try {
      return await withFileLockAsync(this.subscriptionsLockPath, async () => {
        const content = await fs.readFile(this.subscriptionsFile, 'utf-8');
        return JSON.parse(content) as PushSubscriptionData[];
      });
    } catch {
      return [];
    }
  }

  /**
   * 锁定读-合并-写订阅变更。
   * type='add': 将 sub 合并到文件中（按 endpoint 去重）
   * type='remove': 从文件中移除一个或多个 endpoints
   */
  private async persistSubscriptionChange(
    type: 'add' | 'remove',
    endpoints: string[],
    sub?: PushSubscriptionData,
  ): Promise<void> {
    await withFileLockAsync(this.subscriptionsLockPath, async () => {
      await this.ensureDataDir();

      let fileSubs: PushSubscriptionData[] = [];
      try {
        const content = await fs.readFile(this.subscriptionsFile, 'utf-8');
        fileSubs = JSON.parse(content) as PushSubscriptionData[];
      } catch { /* 文件不存在 */ }

      const merged = new Map<string, PushSubscriptionData>();

      // 先加载文件中的
      for (const s of fileSubs) {
        merged.set(s.endpoint, s);
      }

      // 再合并内存中的
      for (const s of this.subscriptions.values()) {
        merged.set(s.endpoint, s);
      }

      if (type === 'add' && sub) {
        merged.set(sub.endpoint, sub);
      } else if (type === 'remove') {
        for (const ep of endpoints) {
          merged.delete(ep);
        }
      }

      const data = Array.from(merged.values());
      await fs.writeFile(this.subscriptionsFile, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug({ count: data.length, type }, 'Persisted subscription change to file');
    });
  }

  /**
   * 初始化 VAPID 密钥和订阅数据。
   * VAPID 密钥生成通过文件锁保护，防止多实例并发生成不同密钥对。
   */
  private async initVapidAndSubscriptions(): Promise<void> {
    // 确保数据目录存在（锁目录在 baseDir 下，必须先创建父目录）
    await this.ensureDataDir();
    // 使用文件锁保护 VAPID 密钥的 check-then-generate 操作
    await withFileLockAsync(this.vapidLockPath, async () => {
      // 锁内 double-check：先读文件，另一个实例可能已写入
      const savedKeys = await this.loadVapidKeys();
      if (savedKeys) {
        this.vapidPublicKey = savedKeys.publicKey;
        this.vapidPrivateKey = savedKeys.privateKey;
        logger.info('Loaded VAPID keys from file');
        return;
      }

      // 生成新的 VAPID 密钥
      try {
        const webpush = (await import('web-push')).default;
        const keys = webpush.generateVAPIDKeys();
        this.vapidPublicKey = keys.publicKey;
        this.vapidPrivateKey = keys.privateKey;
        await this.saveVapidKeys(keys);
        logger.info('Generated and saved VAPID keys to file');
      } catch (err) {
        logger.warn({ err }, 'web-push not available, push notifications disabled');
      }
    });

    // 加载持久化的订阅
    await this.loadSubscriptions();
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  async waitForVapidPublicKey(timeoutMs: number = 2000): Promise<string | null> {
    if (this.vapidPublicKey) return this.vapidPublicKey;

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const result = await Promise.race([
      this.vapidInitPromise.then(() => 'ready' as const),
      timeoutPromise,
    ]);

    if (result === 'timeout') {
      return this.vapidPublicKey || null;
    }

    return this.vapidPublicKey || null;
  }

  /**
   * 添加推送订阅。
   * 内存立即更新，文件持久化异步执行（最终一致性）。
   */
  subscribe(subscription: PushSubscriptionData): void {
    this.subscriptions.set(subscription.endpoint, subscription);
    logger.info({ endpoint: subscription.endpoint }, 'Push subscription added');
    this.persistSubscriptionChange('add', [subscription.endpoint], subscription).catch((err) => {
      logger.error({ err }, 'Failed to persist push subscription add');
    });
  }

  /**
   * 移除推送订阅。
   * 内存立即更新，文件持久化异步执行（最终一致性）。
   */
  unsubscribe(endpoint: string): boolean {
    const deleted = this.subscriptions.delete(endpoint);
    if (deleted) {
      logger.info({ endpoint }, 'Push subscription removed');
      this.persistSubscriptionChange('remove', [endpoint]).catch((err) => {
        logger.error({ err }, 'Failed to persist push subscription remove');
      });
    }
    return deleted;
  }

  get subscriberCount(): number {
    return this.subscriptions.size;
  }

  async notifyAll(payload: PushNotificationPayload): Promise<void> {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      logger.warn('VAPID keys not ready, skipping push notification');
      return;
    }

    // 发送前从文件重新加载所有订阅（获取其他实例添加的订阅），使用文件锁防止读到半写 JSON
    const fileSubs = await this.readSubscriptionsFromFile();
    for (const sub of fileSubs) {
      if (!this.subscriptions.has(sub.endpoint)) {
        this.subscriptions.set(sub.endpoint, sub);
      }
    }

    if (this.subscriptions.size === 0) {
      logger.debug('No push subscribers, skipping notification');
      return;
    }

    let webpush;
    try {
      webpush = (await import('web-push')).default;
    } catch {
      logger.warn('web-push not available, skipping notification');
      return;
    }

    webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);

    const body = JSON.stringify(payload);
    const promises: Promise<unknown>[] = [];
    const expiredEndpoints: string[] = [];

    for (const [endpoint, sub] of this.subscriptions) {
      const p = webpush.sendNotification(
        { endpoint, keys: sub.keys },
        body,
      ).catch((err: any) => {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410) {
          this.subscriptions.delete(endpoint);
          expiredEndpoints.push(endpoint);
          logger.info({ endpoint }, 'Removed expired push subscription');
        } else {
          logger.error({ err, endpoint }, 'Failed to send push notification');
        }
      });
      promises.push(p);
    }

    await Promise.allSettled(promises);

    // 有过期订阅被删除时，从内存和文件中同时移除（锁定写）
    if (expiredEndpoints.length > 0) {
      this.persistSubscriptionChange('remove', expiredEndpoints).catch((err) => {
        logger.error({ err }, 'Failed to persist push subscription cleanup');
      });
    }

    logger.info({ count: this.subscriptions.size }, 'Push notifications sent');
  }
}
