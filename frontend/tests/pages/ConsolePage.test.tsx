import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { ConsolePage } from '../../src/pages/ConsolePage.js';
import { useAppStore } from '../../src/stores/app-store.js';
import { useInstanceStore } from '../../src/stores/instance-store.js';
import { authenticate } from '../../src/services/api-client.js';

const viewportState = {
  offsetTop: 0,
  needsCompensation: false,
};

// Mock window.innerHeight for isKeyboardOpen calculation
const originalInnerHeight = window.innerHeight;
beforeAll(() => {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 900,
  });
});

afterAll(() => {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  });
});

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
const mockSetAutoFollow = vi.fn();

vi.mock('../../src/hooks/useTerminal.js', () => ({
  useTerminal: () => ({
    write: mockWrite,
    reset: mockReset,
    scrollToBottom: mockScrollToBottom,
    scrollToTop: mockScrollToTop,
    setOnScrollPositionChange: mockSetOnScrollPositionChange,
    adaptToPtyCols: mockAdaptToPtyCols,
    setAutoFollow: mockSetAutoFollow,
    showScrollHint: true, // 默认显示以测试按钮渲染
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
let capturedOnCopySuccess: ((newInstanceName: string) => void) | null = null;
vi.mock('../../src/components/instances/InstanceTabs.js', () => ({
  InstanceTabs: ({ onSwitch, onCopySuccess }: { onSwitch: (id: string) => void; onCopySuccess?: (name: string) => void }) => {
    capturedOnSwitch = onSwitch;
    capturedOnCopySuccess = onCopySuccess ?? null;
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

const mockScrollToBottomButtonClick = vi.fn();
vi.mock('../../src/components/terminal/ScrollToBottomButton.js', () => ({
  ScrollToBottomButton: ({ visible, onClick }: { visible: boolean; onClick: () => void }) => {
    return visible ? (
      <button data-testid="scroll-to-bottom-btn" onClick={onClick}>
        Jump to latest
      </button>
    ) : null;
  },
}));

vi.mock('../../src/services/instance-api.js', () => ({
  buildInstanceWsUrl: vi.fn((instanceId: string) => `ws://mock-host/ws/${instanceId}`),
}));

vi.mock('../../src/services/api-client.js', () => ({
  authenticate: vi.fn(),
}));

const mockedAuthenticate = vi.mocked(authenticate);

describe('ConsolePage', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    capturedHandleMessage = null;
    capturedOnSwitch = null;
    viewportState.offsetTop = 0;
    viewportState.needsCompensation = false;
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
    viewportState.offsetTop = 0;

    render(<ConsolePage />);

    // 使用 getAllByText 因为有多个 Esc 按钮
    expect(screen.getAllByText('Esc').length).toBeGreaterThan(0);
  });

  it('should hide virtual key bar and apply transform when keyboard is open', () => {
    // 模拟键盘打开：needsCompensation=true，offsetTop 增加
    viewportState.offsetTop = 180;
    viewportState.needsCompensation = true;

    render(<ConsolePage />);

    const root = screen.getByTestId('console-page');
    // 使用 fixed 定位保持高度不变，用 transform 实现平滑滚动
    expect(root.style.position).toBe('fixed');
    expect(root.style.top).toBe('0px');
    // transform 用于平滑滚动（替代动态修改 top/height）
    expect(root.style.transform).toBe('translateY(-180px)');
    // 当键盘打开时，虚拟键栏应该隐藏，不再有 Esc 按钮
    expect(screen.queryAllByText('Esc')).toHaveLength(0);
  });

  it('should auto switch to next available instance when active instance disconnects', async () => {
    mockedAuthenticate.mockResolvedValue(true);
    useAppStore.setState({ instanceConnectionStatus: { 'inst-1': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:01:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-3',
          name: 'C',
          cwd: '/tmp/c',
          startedAt: '2026-01-01T00:02:00.000Z',
          isCurrent: true,
        },
      ],
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-2');
    });

    // 同源认证
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
    expect(screen.getByText('Switched to B')).toBeDefined();
  });

  it('should not switch when no candidate instances are available', async () => {
    useAppStore.setState({ instanceConnectionStatus: { 'inst-1': 'disconnected' } });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    expect(screen.queryByText(/Switched to/)).toBeNull();
  });

  it('should switch to oldest candidate when active instance disconnects', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useAppStore.setState({ instanceConnectionStatus: { 'inst-3': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'A',
          cwd: '/tmp/a',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:01:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-3',
          name: 'C',
          cwd: '/tmp/c',
          startedAt: '2026-01-01T00:02:00.000Z',
          isCurrent: true,
        },
      ],
      activeInstanceId: 'inst-3',
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
    expect(screen.getByText('Switched to A')).toBeDefined();
  });

  it('should use same-origin authenticate() during auto switch', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useAppStore.setState({ instanceConnectionStatus: { 'inst-2': 'disconnected' } });
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:01:00.000Z',
          isCurrent: true,
        },
      ],
      activeInstanceId: 'inst-2',
    });

    render(<ConsolePage />);

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });

    // 所有实例同源，使用 authenticate()
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
    expect(screen.getByText('Switched to Current')).toBeDefined();
  });

  it('should use same-origin authenticate() during manual switch', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'B',
          cwd: '/tmp/b',
          startedAt: '2026-01-01T00:01:00.000Z',
          isCurrent: true,
        },
      ],
      activeInstanceId: 'inst-2',
    });

    render(<ConsolePage />);

    // 通过 capturedOnSwitch 模拟手动切换
    await act(async () => {
      capturedOnSwitch?.('inst-1');
    });

    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    expect(mockedAuthenticate).toHaveBeenCalledWith('cached-token');
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

  it('should mark instance as disconnected when session_ended message is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'session_ended',
      });
    });

    // session_ended 应该触发 setSessionStatus('idle') 和 setInstanceConnectionStatus(instanceId, 'disconnected')
    expect(useAppStore.getState().sessionStatus).toBe('idle');
    expect(useAppStore.getState().instanceConnectionStatus['inst-1']).toBe('disconnected');
  });

  it('should trigger auto switch immediately when session_ended is received', async () => {
    mockedAuthenticate.mockResolvedValue(true);

    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'Other',
          cwd: '/tmp/other',
          startedAt: '2026-01-01T00:01:00.000Z',
          isCurrent: true,
        },
      ],
    });

    render(<ConsolePage />);

    // 收到 session_ended 后立即标记为 disconnected，触发自动切换
    await act(async () => {
      capturedHandleMessage?.({
        type: 'session_ended',
      });
    });

    // 验证：应该立即（不等待轮询）切换到另一个实例
    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-2');
    });

    expect(screen.getByText('Switched to Other')).toBeDefined();
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

  it('should call adaptToPtyCols when history_sync has cols (without forced scroll)', async () => {
    mockScrollToBottom.mockClear();
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
    // 不再强制滚动到底部，尊重用户的当前滚动位置
    expect(mockScrollToBottom).not.toHaveBeenCalled();
  });

  it('should call adaptToPtyCols(0,0) when history_sync has no cols (respect user scroll position)', async () => {
    mockScrollToBottom.mockClear();
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
    // 不再强制滚动到底部，尊重用户的当前滚动位置
    expect(mockScrollToBottom).not.toHaveBeenCalled();
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

  it('should update ipChangeInfo when ip_changed is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ip_changed',
        oldIp: '192.168.1.10',
        newIp: '192.168.1.20',
        newUrl: 'http://192.168.1.20:8866',
      });
    });

    expect(useAppStore.getState().ipChangeInfo).toEqual({
      oldIp: '192.168.1.10',
      newIp: '192.168.1.20',
      newUrl: 'http://192.168.1.20:8866',
    });
  });

  // ---- Copy instance success auto-switch tests ----

  it('should auto switch to new instance when onCopySuccess is called', async () => {
    // 预设 store 中的实例列表（模拟 InstanceTabs 轮询后已更新 store）
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-copy',
          name: 'Current-copy',
          cwd: '/tmp/current',
          startedAt: '2026-01-02T00:00:00.000Z',
          isCurrent: true,
        },
      ],
    });

    render(<ConsolePage />);

    // 通过 capturedOnCopySuccess 模拟复制成功回调（直接从 store 读取，无轮询）
    await act(async () => {
      capturedOnCopySuccess?.('Current-copy');
    });

    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-copy');
    expect(screen.getByText('Created and switched to Current-copy')).toBeDefined();
  });

  it('should pick newest instance when duplicate names exist', async () => {
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Current',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-old-copy',
          name: 'Current-copy',
          cwd: '/tmp/current',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-new-copy',
          name: 'Current-copy',
          cwd: '/tmp/current',
          startedAt: '2026-01-03T00:00:00.000Z',
          isCurrent: true,
        },
      ],
    });

    render(<ConsolePage />);

    await act(async () => {
      capturedOnCopySuccess?.('Current-copy');
    });

    // 应选中 startedAt 最新的 inst-new-copy，而非 inst-old-copy
    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-new-copy');
  });

  // ---- Scroll-to-bottom integration tests ----

  it('should render ScrollToBottomButton when showScrollHint is true', () => {
    render(<ConsolePage />);

    // 按钮应该渲染（useTerminal mock 返回 showScrollHint: true）
    expect(screen.getByTestId('scroll-to-bottom-btn')).toBeTruthy();
  });

  it('should call scrollToBottom and setAutoFollow when scroll to bottom button is clicked', async () => {
    mockScrollToBottom.mockClear();
    mockSetAutoFollow.mockClear();

    render(<ConsolePage />);

    // 获取按钮并点击
    const button = screen.getByTestId('scroll-to-bottom-btn');
    await act(async () => {
      button.click();
    });

    // 验证回调被正确调用
    expect(mockScrollToBottom).toHaveBeenCalled();
    expect(mockSetAutoFollow).toHaveBeenCalledWith(true);
  });
});
