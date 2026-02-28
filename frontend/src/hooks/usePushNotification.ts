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
      return;
    }

    (async () => {
      try {
        // 1. Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');

        // 2. Check if already subscribed
        const existing = await registration.pushManager.getSubscription();
        if (existing) return; // Already subscribed

        // 3. Get VAPID key from server (cold-start tolerant)
        let vapidPublicKey = '';
        for (let i = 0; i < 5; i++) {
          const vapidRes = await fetch('/api/push/vapid-key', { credentials: 'include' });
          if (vapidRes.ok) {
            const body = await vapidRes.json();
            if (body?.vapidPublicKey) {
              vapidPublicKey = body.vapidPublicKey;
              break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
        }
        if (!vapidPublicKey) return;

        // 4. Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // 5. Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });

        // 6. Send subscription to server
        const json = subscription.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });
      } catch {
        // Silently ignore push setup failures
      }
    })();
  }, []);
}
