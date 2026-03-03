import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ConsolePage } from '../../src/pages/ConsolePage.js';
import { useAppStore } from '../../src/stores/app-store.js';
import { useInstanceStore } from '../../src/stores/instance-store.js';
import { authenticateToInstance } from '../../src/services/instance-api.js';
import { authenticate } from '../../src/services/api-client.js';

const viewportState = {
  keyboardHeight: 0,
};

vi.mock('../../src/hooks/useViewport.js', () => ({
  useViewport: () => viewportState,
}));

vi.mock('../../src/hooks/usePushNotification.js', () => ({
  usePushNotification: () => undefined,
}));

const mockShowNotification = vi.fn();
vi.mock('../../src/hooks/useLocalNotification.js', () => ({
  useLocalNotification: () => ({ showNotification: mockShowNotification }),
}));

vi.mock('../../src/hooks/useInstances.js', () => ({
  useInstances: () => ({ activeInstanceId: 'inst-1' }),
}));

const mockWrite = vi.fn((_data: string, callback?: () => void) => {
  callback?.();
});
const mockReset = vi.fn();
const mockScrollToBottom = vi.fn();
const mockScrollToTop = vi.fn();
const mockSetOnScrollPositionChange = vi.fn();
const mockAdaptToPtyCols = vi.fn();

vi.mock('../../src/hooks/useTerminal.js', () => ({
  useTerminal: () => ({
    write: mockWrite,
    reset: mockReset,
    scrollToBottom: mockScrollToBottom,
    scrollToTop: mockScrollToTop,
    setOnScrollPositionChange: mockSetOnScrollPositionChange,
    adaptToPtyCols: mockAdaptToPtyCols,
  }),
}));

let capturedHandleMessage: ((msg: unknown) => void) | null = null;
const mockSend = vi.fn();

vi.mock('../../src/hooks/useWebSocket.js', () => ({
  useWebSocket: (handleMessage: (msg: unknown) => void) => {
    capturedHandleMessage = handleMessage;
    return {
      connect: vi.fn(),
      send: mockSend,
    };
  },
}));

vi.mock('../../src/components/status/StatusBar.js', () => ({
  StatusBar: () => <div>StatusBar</div>,
}));

let capturedOnSwitch: ((targetId: string) => void) | null = null;
vi.mock('../../src/components/instances/InstanceTabs.js', () => ({
  InstanceTabs: ({ onSwitch }: { onSwitch: (id: string) => void }) => {
    capturedOnSwitch = onSwitch;
    return <div>InstanceTabs</div>;
  },
}));

vi.mock('../../src/components/common/ConnectionBanner.js', () => ({
  ConnectionBanner: () => <div>ConnectionBanner</div>,
}));

vi.mock('../../src/components/terminal/TerminalView.js', () => ({
  TerminalView: () => <div>TerminalView</div>,
}));

vi.mock('../../src/components/terminal/ScrollButtons.js', () => ({
  ScrollButtons: () => <div>ScrollButtons</div>,
}));

vi.mock('../../src/services/instance-api.js', () => ({
  authenticateToInstance: vi.fn(),
  buildInstanceWsUrl: vi.fn(() => 'ws://mock-instance/ws'),
}));

vi.mock('../../src/services/api-client.js', () => ({
  authenticate: vi.fn(),
}));

const mockedAuthenticateToInstance = vi.mocked(authenticateToInstance);
const mockedAuthenticate = vi.mocked(authenticate);

describe('ConsolePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandleMessage = null;
    capturedOnSwitch = null;
    viewportState.keyboardHeight = 0;
    mockScrollToBottom.mockClear();
    mockScrollToTop.mockClear();
    mockSetOnScrollPositionChange.mockClear();
    mockShowNotification.mockClear();

    useAppStore.setState({
      isAuthenticated: true,
      connectionStatus: 'disconnected',
      instanceConnectionStatus: {},
      sessionStatus: 'idle',
      cachedToken: 'cached-token',
      toastMessage: null,
    });

    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
      ],
      activeInstanceId: 'inst-1',
      currentHostOverride: null,
    });
  });

  it('should keep mobile single-column root container', () => {
    render(<ConsolePage />);

    const root = screen.getByTestId('console-page');
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
  });

  it('should show virtual key bar when keyboard is closed', () => {
    viewportState.keyboardHeight = 0;

    render(<ConsolePage />);

    expect(screen.getByText('Esc')).toBeDefined();
  });

  it('should hide virtual key bar and apply keyboard bottom inset when keyboard is open', () => {
    viewportState.keyboardHeight = 180;

    render(<ConsolePage />);

    const root = screen.getByTestId('console-page');
    expect(root.style.paddingBottom).toBe('180px');
    expect(screen.queryByText('Esc')).toBeNull();
  });

  it('should auto switch to next available instance by port order and show toast when active instance disconnects', async () => {
    mockedAuthenticateToInstance.mockResolvedValue(true);
    useAppStore.setState({ instanceConnectionStatus: { 'inst-1': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
        {
          instanceId: 'inst-3',
          name: 'C',
          host: '127.0.0.1',
          port: 3002,
          pid: 32345,
          cwd: '/tmp/c',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-2');
    });

    expect(mockedAuthenticateToInstance).toHaveBeenCalledWith('127.0.0.1', 3001, 'cached-token');
    expect(screen.getByText('已切换到 3001')).toBeDefined();
  });

  it('should continue trying next candidate when first candidate switch fails', async () => {
    mockedAuthenticateToInstance
      .mockRejectedValueOnce(new Error('auth failed'))
      .mockResolvedValueOnce(true);

    useAppStore.setState({ instanceConnectionStatus: { 'inst-1': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
        {
          instanceId: 'inst-3',
          name: 'C',
          host: '127.0.0.1',
          port: 3002,
          pid: 32345,
          cwd: '/tmp/c',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-3');
    });

    expect(mockedAuthenticateToInstance).toHaveBeenNthCalledWith(1, '127.0.0.1', 3001, 'cached-token');
    expect(mockedAuthenticateToInstance).toHaveBeenNthCalledWith(2, '127.0.0.1', 3002, 'cached-token');
    expect(screen.getByText('已切换到 3002')).toBeDefined();
  });

  it('should not switch when no candidate instances are available', async () => {
    useAppStore.setState({ instanceConnectionStatus: { 'inst-1': 'disconnected' } });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    expect(mockedAuthenticateToInstance).not.toHaveBeenCalled();
    expect(screen.queryByText(/已切换到/)).toBeNull();
  });

  it('should wrap around to lowest-port candidate when active instance has the highest port', async () => {
    mockedAuthenticateToInstance.mockResolvedValue(true);

    useAppStore.setState({ instanceConnectionStatus: { 'inst-3': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'A',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/a',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
        {
          instanceId: 'inst-3',
          name: 'C',
          host: '127.0.0.1',
          port: 3002,
          pid: 32345,
          cwd: '/tmp/c',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
      ],
      activeInstanceId: 'inst-3',
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    expect(mockedAuthenticateToInstance).toHaveBeenNthCalledWith(1, '127.0.0.1', 3000, 'cached-token');
    expect(screen.getByText('已切换到 3000')).toBeDefined();
  });

  it('should call authenticate() for isCurrent candidate during auto switch', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useAppStore.setState({ instanceConnectionStatus: { 'inst-2': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
      activeInstanceId: 'inst-2',
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    // isCurrent 候选应使用同源 authenticate() 而非 authenticateToInstance()
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
    expect(mockedAuthenticateToInstance).not.toHaveBeenCalled();
    expect(screen.getByText('已切换到 3000')).toBeDefined();
  });

  it('should call authenticate() for isCurrent instance during manual switch', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
      activeInstanceId: 'inst-2',
    });

    render(<ConsolePage />);

    // 通过 capturedOnSwitch 模拟手动切换到 isCurrent 实例
    await act(async () => {
      capturedOnSwitch?.('inst-1');
    });

    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    // isCurrent 实例应使用同源 authenticate()
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
    expect(mockedAuthenticateToInstance).not.toHaveBeenCalled();
  });

  it('should call authenticateToInstance() for non-isCurrent instance during manual switch', async () => {
    mockedAuthenticateToInstance.mockResolvedValue(true);

    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          host: '127.0.0.1',
          port: 3001,
          pid: 22345,
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
      activeInstanceId: 'inst-1',
    });

    render(<ConsolePage />);

    await act(async () => {
      capturedOnSwitch?.('inst-2');
    });

    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-2');
    expect(mockedAuthenticateToInstance).toHaveBeenCalledWith('127.0.0.1', 3001, 'cached-token');
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it('should auto dismiss toast after 3 seconds', () => {
    vi.useFakeTimers();

    useAppStore.setState({ toastMessage: '测试提示消息' });
    render(<ConsolePage />);

    expect(screen.getByText('测试提示消息')).toBeDefined();

    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('测试提示消息')).toBeNull();
  });

  // ---- status_update local notification tests ----

  it('should show local notification when status_update waiting_input is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'status_update',
        status: 'waiting_input',
        detail: 'Waiting for input: Bash',
      });
    });

    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Claude Code 需要输入',
      body: 'Waiting for input: Bash',
      tag: 'claude-waiting-input',
      renotify: false,
    });
  });

  it('should ignore heartbeat message without side effects', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'heartbeat',
        timestamp: Date.now(),
      });
    });

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('should write error message to terminal when error message is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'error',
        code: 'ws_error',
        message: 'socket down',
      });
    });

    expect(mockWrite).toHaveBeenCalledWith('\r\n\x1b[31m[Error] socket down\x1b[0m\r\n');
  });

  // ---- PTY cols adaptation tests ----

  it('should call adaptToPtyCols when history_sync has cols', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'history_sync',
        data: 'hello',
        seq: 1,
        status: 'running',
        cols: 208,
        rows: 50,
      });
    });

    expect(mockReset).toHaveBeenCalled(); // history_sync 应先重置终端
    // 无论 PTY 尺寸如何，始终调用 adaptToPtyCols(0,0) 让终端适配自己的可视区域
    expect(mockAdaptToPtyCols).toHaveBeenCalledWith(0, 0);
    expect(mockWrite).toHaveBeenCalledWith('hello');
    expect(mockScrollToBottom).toHaveBeenCalled();
  });

  it('should call adaptToPtyCols(0,0) when history_sync has no cols (still adapt to viewport)', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'history_sync',
        data: 'hello',
        seq: 1,
        status: 'running',
      });
    });

    expect(mockReset).toHaveBeenCalled(); // history_sync 应先重置终端
    // 即使没有 cols，仍然调用 adaptToPtyCols 以确保终端适配自己的可视区域
    expect(mockAdaptToPtyCols).toHaveBeenCalledWith(0, 0);
    expect(mockWrite).toHaveBeenCalledWith('hello');
    expect(mockScrollToBottom).toHaveBeenCalled();
  });

  it('should call adaptToPtyCols with cols and rows when terminal_resize message is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'terminal_resize',
        cols: 120,
        rows: 40,
      });
    });

    expect(mockAdaptToPtyCols).toHaveBeenCalledWith(120, 40);
  });

  it('should write terminal_output without forcing scroll to bottom', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'terminal_output',
        data: '\rRecombobulating...'
      });
    });

    expect(mockWrite).toHaveBeenCalledWith('\rRecombobulating...');
    expect(mockScrollToBottom).not.toHaveBeenCalled();
  });

  it('should keep status-line updates (\r) without forced scroll during consecutive terminal_output messages', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: '\rRecombobulating...' });
      capturedHandleMessage?.({ type: 'terminal_output', data: '\rRecombobulating....' });
      capturedHandleMessage?.({ type: 'terminal_output', data: '\rRecombobulating.....' });
    });

    expect(mockWrite).toHaveBeenNthCalledWith(1, '\rRecombobulating...');
    expect(mockWrite).toHaveBeenNthCalledWith(2, '\rRecombobulating....');
    expect(mockWrite).toHaveBeenNthCalledWith(3, '\rRecombobulating.....');
    expect(mockScrollToBottom).not.toHaveBeenCalled();
  });

  it('should update currentHostOverride when ip_changed is received for current instance', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ip_changed',
        oldIp: '192.168.1.10',
        newIp: '192.168.1.20',
        newUrl: 'http://192.168.1.20:3000',
      });
    });

    expect(useInstanceStore.getState().currentHostOverride).toBe('192.168.1.20');
  });
});
