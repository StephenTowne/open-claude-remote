import { useCallback, useEffect, useRef } from 'react';

export interface LocalNotificationOptions {
  title: string;
  body?: string;
  tag?: string;
  renotify?: boolean;
}

/**
 * Hook for showing local browser notifications.
 * Handles permission request and notification display.
 */
export function useLocalNotification() {
  const permissionRef = useRef<NotificationPermission>('default');
  const lastTagRef = useRef<string | null>(null);

  // Check permission status on mount
  useEffect(() => {
    if ('Notification' in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('[useLocalNotification] Notification API not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('[useLocalNotification] Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    permissionRef.current = permission;
    return permission === 'granted';
  }, []);

  const showNotification = useCallback(async (options: LocalNotificationOptions): Promise<boolean> => {
    // Skip if same tag as last notification (avoid duplicate)
    if (options.tag && options.tag === lastTagRef.current) {
      console.log('[useLocalNotification] Skipping duplicate notification with tag:', options.tag);
      return false;
    }

    // Request permission if not yet granted
    if (permissionRef.current !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        console.log('[useLocalNotification] Permission not granted, cannot show notification');
        return false;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        tag: options.tag,
        icon: '/favicon.ico',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      if (options.tag) {
        lastTagRef.current = options.tag;
      }

      console.log('[useLocalNotification] Notification shown:', options.title);
      return true;
    } catch (err) {
      console.error('[useLocalNotification] Failed to show notification:', err);
      return false;
    }
  }, [requestPermission]);

  return { showNotification, requestPermission };
}
