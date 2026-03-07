import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../src/hooks/useWebSocket.js';
import { useAppStore } from '../../src/stores/app-store.js';
import { authenticate } from '../../src/services/api-client.js';
import { loadToken } from '../../src/services/token-storage.js';

vi.mock('../../src/services/api-client.js', () => ({
  authenticate: vi.fn(),
}));

vi.mock('../../src/services/token-storage.js', () => ({
  loadToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

const mockedAuthenticate = vi.mocked(authenticate);
const mockedLoadToken = vi.mocked(loadToken);

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

describe('useWebSocket connection isolation', () => {
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

  it('should ignore old socket close after switching instance', () => {
    const { result: hookA, unmount: unmountA } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://a.example/ws', 'instance-a'),
    );

    act(() => {
      hookA.current.connect();
    });

    const socketA = sockets[0];

    act(() => {
      unmountA();
    });

    const { result: hookB } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://b.example/ws', 'instance-b'),
    );

    act(() => {
      hookB.current.connect();
    });

    const socketB = sockets[1];

    act(() => {
      socketB.readyState = 1;
      socketB.onopen?.();
    });

    act(() => {
      socketA.onclose?.();
    });

    const state = useAppStore.getState();
    expect(state.instanceConnectionStatus['instance-b']).toBe('connected');
  });

  it('should set disconnected and schedule reconnect only for active socket close', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://b.example/ws', 'instance-b'),
    );

    act(() => {
      result.current.connect();
    });

    const firstSocket = sockets[0];

    act(() => {
      firstSocket.readyState = 1;
      firstSocket.onopen?.();
      firstSocket.onclose?.();
    });

    expect(useAppStore.getState().instanceConnectionStatus['instance-b']).toBe('disconnected');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sockets.length).toBe(2);
  });

  it('should not allow old reconnect timer to overwrite newer connection state', () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://b.example/ws', 'instance-b'),
    );

    act(() => {
      result.current.connect();
    });

    const oldSocket = sockets[0];

    act(() => {
      oldSocket.readyState = 1;
      oldSocket.onopen?.();
      oldSocket.onclose?.();
    });

    act(() => {
      result.current.connect();
    });

    const newSocket = sockets[1];

    act(() => {
      newSocket.readyState = 1;
      newSocket.onopen?.();
    });

    expect(useAppStore.getState().instanceConnectionStatus['instance-b']).toBe('connected');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sockets.length).toBe(2);
    expect(useAppStore.getState().instanceConnectionStatus['instance-b']).toBe('connected');
  });

  it('should NOT update global connectionStatus when using a named instanceId', () => {
    useAppStore.setState({ connectionStatus: 'disconnected' });

    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://a.example/ws', 'instance-a'),
    );

    act(() => {
      result.current.connect();
    });

    // Global status should remain 'disconnected' — not changed to 'connecting'
    expect(useAppStore.getState().connectionStatus).toBe('disconnected');
    expect(useAppStore.getState().instanceConnectionStatus['instance-a']).toBe('connecting');

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    // Global status still unchanged
    expect(useAppStore.getState().connectionStatus).toBe('disconnected');
    expect(useAppStore.getState().instanceConnectionStatus['instance-a']).toBe('connected');
  });

  it('should update global connectionStatus for default (no instanceId) connections', () => {
    useAppStore.setState({ connectionStatus: 'disconnected' });

    // No instanceId → uses DEFAULT_INSTANCE_ID → should write global
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://default.example/ws'),
    );

    act(() => {
      result.current.connect();
    });

    expect(useAppStore.getState().connectionStatus).toBe('connecting');

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    expect(useAppStore.getState().connectionStatus).toBe('connected');
  });

  it('should re-authenticate with same-origin authenticate() on socket close', async () => {
    mockedLoadToken.mockReturnValue('cached-token-123');
    mockedAuthenticate.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), 'ws://localhost:8866/ws/inst-1', 'instance-test'),
    );

    await act(async () => {
      result.current.connect();
    });

    const socket = sockets[0];
    act(() => {
      socket.readyState = 1;
      socket.onopen?.();
    });

    expect(useAppStore.getState().instanceConnectionStatus['instance-test']).toBe('connected');

    await act(async () => {
      socket.onclose?.();
    });

    // 同源认证
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token-123');
    expect(useAppStore.getState().instanceConnectionStatus['instance-test']).toBe('disconnected');
  });

  it('should NOT connect when wsUrl is undefined', async () => {
    const { result } = renderHook(() =>
      useWebSocket(vi.fn(), undefined, 'no-url-instance'),
    );

    await act(async () => {
      result.current.connect();
    });

    // 不应该创建任何 WebSocket 连接
    expect(sockets.length).toBe(0);
    // 状态应该是 disconnected（不是 connecting 或 connected）
    expect(useAppStore.getState().instanceConnectionStatus['no-url-instance']).toBe('disconnected');
  });
});
