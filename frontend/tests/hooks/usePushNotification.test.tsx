import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePushNotification } from '../../src/hooks/usePushNotification.js';

describe('usePushNotification', () => {
  const registerMock = vi.fn();
  const getSubscriptionMock = vi.fn();
  const subscribeMock = vi.fn();
  const permissionMock = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const subscription = {
      toJSON: () => ({
        endpoint: 'https://push.example.com/sub1',
        keys: { p256dh: 'k1', auth: 'a1' },
      }),
    };

    getSubscriptionMock.mockResolvedValue(null);
    subscribeMock.mockResolvedValue(subscription);
    registerMock.mockResolvedValue({
      pushManager: {
        getSubscription: getSubscriptionMock,
        subscribe: subscribeMock,
      },
    });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          register: registerMock,
        },
      },
    });

    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() {},
    });

    permissionMock.mockResolvedValue('granted');
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: {
        requestPermission: permissionMock,
      },
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/push/vapid-key') {
        return {
          ok: true,
          json: async () => ({ vapidPublicKey: 'BElongFakeVapidPublicKey1234567890' }),
        } as Response;
      }
      if (url === '/api/push/subscribe' && init?.method === 'POST') {
        return { ok: true } as Response;
      }
      return { ok: false } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should retry vapid-key fetch and then subscribe when key becomes available', async () => {
    let vapidCall = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/push/vapid-key') {
        vapidCall += 1;
        if (vapidCall < 3) {
          return { ok: false } as Response;
        }
        return {
          ok: true,
          json: async () => ({ vapidPublicKey: 'BElongFakeVapidPublicKey1234567890' }),
        } as Response;
      }
      if (url === '/api/push/subscribe' && init?.method === 'POST') {
        return { ok: true } as Response;
      }
      return { ok: false } as Response;
    });

    renderHook(() => usePushNotification());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({ method: 'POST' }));
    });

    expect(vapidCall).toBe(3);
  });
});
