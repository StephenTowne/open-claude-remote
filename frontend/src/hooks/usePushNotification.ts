import { useEffect, useRef } from 'react';

/**
 * Convert a base64 URL-safe string to Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

/**
 * Hook to register Service Worker and subscribe to Web Push notifications.
 * Runs once on mount. Silently no-ops if push is unavailable.
 */
export function usePushNotification() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Service Worker or PushManager not supported');
      return;
    }

    (async () => {
      try {
        // 1. Register service worker
        console.log('[Push] Registering service worker...');
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[Push] Service worker registered:', registration.scope);

        // 2. Check if already subscribed
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          console.log('[Push] Already subscribed, endpoint:', existing.endpoint);
          return;
        }

        // 3. Get VAPID key from server (cold-start tolerant, ~5s total timeout)
        console.log('[Push] Fetching VAPID key from server...');
        let vapidPublicKey = '';
        for (let i = 0; i < 8; i++) {
          const vapidRes = await fetch('/api/push/vapid-key', { credentials: 'include' });
          if (vapidRes.ok) {
            const body = await vapidRes.json();
            if (body?.vapidPublicKey) {
              vapidPublicKey = body.vapidPublicKey;
              console.log('[Push] Got VAPID key:', vapidPublicKey.substring(0, 20) + '...');
              break;
            }
          } else {
            console.log('[Push] VAPID key fetch failed, attempt', i + 1, 'status:', vapidRes.status);
          }
          await new Promise((resolve) => setTimeout(resolve, Math.min(300 * (i + 1), 1500)));
        }
        if (!vapidPublicKey) {
          console.warn('[Push] Failed to get VAPID key after retries');
          return;
        }

        // 4. Request notification permission
        console.log('[Push] Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('[Push] Permission result:', permission);
        if (permission !== 'granted') {
          console.warn('[Push] Notification permission not granted');
          return;
        }

        // 5. Subscribe
        console.log('[Push] Creating push subscription...');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
        console.log('[Push] Subscription created:', subscription.endpoint);

        // 6. Send subscription to server
        const json = subscription.toJSON();
        console.log('[Push] Sending subscription to server...');
        const subRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });
        if (subRes.ok) {
          console.log('[Push] Subscription sent to server successfully');
        } else {
          console.error('[Push] Failed to send subscription, status:', subRes.status);
        }
      } catch (err) {
        console.error('[Push] Setup failed:', err);
      }
    })();
  }, []);
}
