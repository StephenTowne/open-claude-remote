import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ConsolePage } from '../../src/pages/ConsolePage.js';
import { useAppStore } from '../../src/stores/app-store.js';
import { useInstanceStore } from '../../src/stores/instance-store.js';
import { authenticateToInstance } from '../../src/services/instance-api.js';

const viewportState = {
  keyboardHeight: 0,
};

vi.mock('../../src/hooks/useViewport.js', () => ({
  useViewport: () => viewportState,
}));

vi.mock('../../src/hooks/usePushNotification.js', () => ({
  usePushNotification: () => undefined,
}));

vi.mock('../../src/hooks/useInstances.js', () => ({
  useInstances: () => ({ activeInstanceId: 'inst-1' }),
}));

vi.mock('../../src/hooks/useTerminal.js', () => ({
  useTerminal: () => ({
    write: vi.fn(),
    scrollToBottom: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useWebSocket.js', () => ({
  useWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
  }),
}));

vi.mock('../../src/components/status/StatusBar.js', () => ({
  StatusBar: () => <div>StatusBar</div>,
}));

vi.mock('../../src/components/instances/InstanceTabs.js', () => ({
  InstanceTabs: () => <div>InstanceTabs</div>,
}));

vi.mock('../../src/components/common/ConnectionBanner.js', () => ({
  ConnectionBanner: () => <div>ConnectionBanner</div>,
}));

vi.mock('../../src/components/terminal/TerminalView.js', () => ({
  TerminalView: () => <div>TerminalView</div>,
}));

vi.mock('../../src/services/instance-api.js', () => ({
  authenticateToInstance: vi.fn(),
  buildInstanceWsUrl: vi.fn(() => 'ws://mock-instance/ws'),
}));

const mockedAuthenticateToInstance = vi.mocked(authenticateToInstance);

describe('ConsolePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    viewportState.keyboardHeight = 0;

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

    // 应从最低 port（3000）开始轮询，而非停在最高 port 末尾
    expect(mockedAuthenticateToInstance).toHaveBeenNthCalledWith(1, '127.0.0.1', 3000, 'cached-token');
    expect(screen.getByText('已切换到 3000')).toBeDefined();
  });

  it('should auto dismiss toast after 3 seconds', () => {
    vi.useFakeTimers();

    useAppStore.setState({ toastMessage: '测试提示消息' });
    render(<ConsolePage />);

    expect(screen.getByText('测试提示消息')).toBeDefined();

    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('测试提示消息')).toBeNull();
  });
});
