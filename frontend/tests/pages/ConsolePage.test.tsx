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

const mockReadLastLines = vi.fn(() => [] as string[]);
const mockWrite = vi.fn((_data: string, callback?: () => void) => {
  // 同步调用 callback，模拟 xterm 处理完成后触发扫描
  callback?.();
});

vi.mock('../../src/hooks/useTerminal.js', () => ({
  useTerminal: () => ({
    write: mockWrite,
    scrollToBottom: vi.fn(),
    readLastLines: mockReadLastLines,
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
    capturedHandleMessage = null;
    mockReadLastLines.mockReturnValue([]);
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

  it('should show PromptSelector when terminal output contains selection prompt', async () => {
    const promptLines = [
      '  1. Option A',
      '❯ 2. Option B',
      '  3. Option C',
      'Enter to select · Tab/Arrow keys to navigate · Esc to cancel',
    ];
    mockReadLastLines.mockReturnValue(promptLines);

    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: 'some data', seq: 1 });
    });

    expect(screen.getByTestId('prompt-selector')).toBeDefined();
    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
    expect(screen.getByText('Option C')).toBeDefined();
    // InputBar 和 VirtualKeyBar 应被隐藏
    expect(screen.queryByTestId('virtual-key-bar')).toBeNull();
  });

  it('should hide PromptSelector and restore InputBar after selecting an option', async () => {
    const promptLines = [
      '❯ 1. Yes',
      '  2. No',
      'Enter to select · Tab/Arrow keys to navigate · Esc to cancel',
    ];
    mockReadLastLines.mockReturnValue(promptLines);

    render(<ConsolePage />);

    // 触发提示出现
    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: 'some data', seq: 1 });
    });

    expect(screen.getByTestId('prompt-selector')).toBeDefined();

    // 点击第二个选项（No），当前选中 0，目标为 1，需要发送 1 次 ↓
    mockReadLastLines.mockReturnValue([]);
    await act(async () => {
      screen.getByText('No').click();
    });

    // PromptSelector 应消失，InputBar 应恢复
    expect(screen.queryByTestId('prompt-selector')).toBeNull();
    // 应发送一次 ↓ 箭头和 Enter
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\x1b[B' });
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\r' });
  });

  it('should update PromptSelector when options text changes with same length and selected index', async () => {
    mockReadLastLines.mockReturnValue([
      '❯ 1. Alpha',
      '  2. Beta',
      'Enter to select · Tab/Arrow keys to navigate · Esc to cancel',
    ]);

    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: 'first output', seq: 1 });
    });

    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();

    // 长度和 selectedIndex 保持不变，仅文本变化
    mockReadLastLines.mockReturnValue([
      '❯ 1. Gamma',
      '  2. Delta',
      'Enter to select · Tab/Arrow keys to navigate · Esc to cancel',
    ]);

    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: 'second output', seq: 2 });
    });

    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.getByText('Gamma')).toBeDefined();
    expect(screen.getByText('Delta')).toBeDefined();
  });

  it('should not show PromptSelector when terminal output has no prompt marker', async () => {
    mockReadLastLines.mockReturnValue([
      '  1. Some text',
      '  2. Other text',
      // 无 "Tab/Arrow keys to navigate"
    ]);

    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({ type: 'terminal_output', data: 'normal output', seq: 1 });
    });

    expect(screen.queryByTestId('prompt-selector')).toBeNull();
    expect(screen.getByTestId('virtual-key-bar')).toBeDefined();
  });
});
