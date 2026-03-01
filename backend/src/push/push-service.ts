import { logger } from '../logger/logger.js';

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

/**
 * Web Push notification service.
 * Manages VAPID keys, subscriptions, and notification delivery.
 */
export class PushService {
  private subscriptions = new Map<string, PushSubscriptionData>();
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;
  private vapidInitPromise: Promise<void> | null = null;

  constructor() {
    this.vapidSubject = process.env['VAPID_SUBJECT'] ?? 'mailto:noreply@localhost';

    const envPublic = process.env['VAPID_PUBLIC_KEY'];
    const envPrivate = process.env['VAPID_PRIVATE_KEY'];

    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic;
      this.vapidPrivateKey = envPrivate;
      logger.info('Using VAPID keys from environment variables');
    } else {
      // Lazy init — generate asynchronously on startup
      this.vapidPublicKey = '';
      this.vapidPrivateKey = '';
      this.vapidInitPromise = this.generateVapidKeys();
    }
  }

  private async generateVapidKeys(): Promise<void> {
    try {
      const webpush = (await import('web-push')).default;
      const keys = webpush.generateVAPIDKeys();
      this.vapidPublicKey = keys.publicKey;
      this.vapidPrivateKey = keys.privateKey;
      logger.info('Generated VAPID keys (ephemeral, will change on restart)');
    } catch (err) {
      logger.warn({ err }, 'web-push not available, push notifications disabled');
    }
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  async waitForVapidPublicKey(timeoutMs: number = 2000): Promise<string | null> {
    if (this.vapidPublicKey) return this.vapidPublicKey;

    if (!this.vapidInitPromise) {
      return this.vapidPublicKey || null;
    }

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

  subscribe(subscription: PushSubscriptionData): void {
    this.subscriptions.set(subscription.endpoint, subscription);
    logger.info({ endpoint: subscription.endpoint }, 'Push subscription added');
  }

  unsubscribe(endpoint: string): boolean {
    const deleted = this.subscriptions.delete(endpoint);
    if (deleted) {
      logger.info({ endpoint }, 'Push subscription removed');
    }
    return deleted;
  }

  get subscriberCount(): number {
    return this.subscriptions.size;
  }

  async notifyAll(payload: PushNotificationPayload): Promise<void> {
    if (this.subscriptions.size === 0) {
      logger.debug('No push subscribers, skipping notification');
      return;
    }

    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      logger.warn('VAPID keys not ready, skipping push notification');
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

    for (const [endpoint, sub] of this.subscriptions) {
      const p = webpush.sendNotification(
        { endpoint, keys: sub.keys },
        body,
      ).catch((err: any) => {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410) {
          this.subscriptions.delete(endpoint);
          logger.info({ endpoint }, 'Removed expired push subscription');
        } else {
          logger.error({ err, endpoint }, 'Failed to send push notification');
        }
      });
      promises.push(p);
    }

    await Promise.allSettled(promises);
    logger.info({ count: this.subscriptions.size }, 'Push notifications sent');
  }
}
