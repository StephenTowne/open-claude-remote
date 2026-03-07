import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientMessage } from '#shared';
import { useAppStore } from '../stores/app-store.js';
import { authenticate } from '../services/api-client.js';
import { loadToken } from '../services/token-storage.js';

const DEFAULT_INSTANCE_ID = '__default__';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export function useWebSocket(
  onMessage: (msg: ServerMessage) => void,
  wsUrl?: string,
  instanceId = DEFAULT_INSTANCE_ID,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMessageRef = useRef(onMessage);
  const connectionTokenRef = useRef(0);
  const isDisposedRef = useRef(false);

  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const setConnectionStatusRef = useRef(setConnectionStatus);
  const setInstanceConnectionStatus = useAppStore((s) => s.setInstanceConnectionStatus);
  const setInstanceConnectionStatusRef = useRef(setInstanceConnectionStatus);

  const setStatus = useCallback((status: 'connecting' | 'connected' | 'disconnected') => {
    // Only update global connectionStatus for default (single-instance) connections.
    // In multi-instance mode, UI components read instanceConnectionStatus instead.
    if (instanceId === DEFAULT_INSTANCE_ID) {
      setConnectionStatusRef.current(status);
    }
    setInstanceConnectionStatusRef.current(instanceId, status);
  }, [instanceId]);

  // Keep refs up to date without causing re-renders
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    setConnectionStatusRef.current = setConnectionStatus;
  }, [setConnectionStatus]);

  useEffect(() => {
    setInstanceConnectionStatusRef.current = setInstanceConnectionStatus;
  }, [setInstanceConnectionStatus]);

  const connectRef = useRef<(() => void) | undefined>(undefined);

  const scheduleReconnect = useCallback((token: number) => {
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(() => {
      if (isDisposedRef.current || token !== connectionTokenRef.current) {
        return;
      }
      connectRef.current?.();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    // 无有效 URL 时不连接（等待实例加载完成）
    if (!wsUrl) {
      setStatus('disconnected');
      return;
    }

    // Prevent duplicate connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const url = wsUrl;

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }

    // Safe to reset: this hook relies on key={instanceId} for rebuild,
    // so connect() is never called after cleanup within the same hook instance.
    isDisposedRef.current = false;
    const connectionToken = ++connectionTokenRef.current;

    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isDisposedRef.current || connectionToken !== connectionTokenRef.current || wsRef.current !== ws) {
        return;
      }
      setStatus('connected');
      reconnectAttempt.current = 0;
      // 连接成功后立即发送 activate，通知后端切换到此客户端
      ws.send(JSON.stringify({ type: 'activate' }));
    };

    ws.onmessage = (event) => {
      if (isDisposedRef.current || connectionToken !== connectionTokenRef.current || wsRef.current !== ws) {
        return;
      }
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore invalid messages
      }
    };

    ws.onclose = async () => {
      if (isDisposedRef.current || connectionToken !== connectionTokenRef.current || wsRef.current !== ws) {
        return;
      }
      wsRef.current = null;
      setStatus('disconnected');

      // Try to re-authenticate before reconnecting (handles backend restart)
      const cachedToken = loadToken();
      if (cachedToken) {
        try {
          await authenticate(cachedToken);
        } catch {
          // Auth may fail if server is still restarting, will retry on reconnect
        }
      }

      scheduleReconnect(connectionToken);
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [scheduleReconnect, setStatus, wsUrl]);

  // Keep connectRef in sync
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const send = useCallback((msg: ClientMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    isDisposedRef.current = true;
    connectionTokenRef.current++;

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }

    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      wsRef.current?.close();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'activate' }));
      }
    };
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isDisposedRef.current = true;
      connectionTokenRef.current++;
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = undefined;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, []);

  return { connect, disconnect, send };
}
