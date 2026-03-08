import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../src/hooks/useWebSocket.js';
import { useAppStore } from '../../src/stores/app-store.js';

vi.mock('../../src/services/api-client.js', () => ({
  authenticate: vi.fn(),
}));

vi.mock('../../src/services/token-storage.js', () => ({
  loadToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

type MockSocket = {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe('useWebSocket activate message', () => {
  const sockets: MockSocket[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useAppStore.setState({
      connectionStatus: 'disconnected',
      instanceConnectionStatus: {},
      sessionStatus: 'idle',
      isAuthenticated: false,
      cachedToken: null,
    });

    class WebSocketMock {
      static OPEN = 1;
      static CONNECTING = 0;

      url: string;
      readyState = WebSocketMock.CONNECTING;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = 3;
      });

      constructor(url: string) {
        this.url = url;
        sockets.push(this as unknown as MockSocket);
      }
    }

    vi.stubGlobal('WebSocket', WebSocketMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sockets.length = 0;
  });

  it('should send activate message on WS open', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/test', 'test-instance'),
    );

    act(() => {
      result.current.connect();
    });

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    // onopen 应发送 activate 消息
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'activate' }));
  });

  it('should send activate on visibilitychange to visible', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/test', 'test-instance'),
    );

    act(() => {
      result.current.connect();
    });

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    socket.send.mockClear();

    // 模拟页面变为可见
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'activate' }));
  });

  it('should NOT send activate on visibilitychange when hidden', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/test', 'test-instance'),
    );

    act(() => {
      result.current.connect();
    });

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    socket.send.mockClear();

    // 模拟页面变为隐藏
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(socket.send).not.toHaveBeenCalled();
  });

  it('should NOT send activate on visibilitychange when WS is not open', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/test', 'test-instance'),
    );

    act(() => {
      result.current.connect();
    });

    // socket 处于 CONNECTING 状态（未 open）

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const socket = sockets[0];
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('should cleanup visibilitychange listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/test', 'test-instance'),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
