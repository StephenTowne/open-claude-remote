import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

const mockWrite = vi.fn((_data: string, callback?: () => void) => {
  callback?.();
});
const mockScrollToBottom = vi.fn();
const mockAdaptToPtyCols = vi.fn();

vi.mock('../../src/hooks/useTerminal.js', () => ({
  useTerminal: () => ({
    write: mockWrite,
    scrollToBottom: mockScrollToBottom,
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
    viewportState.keyboardHeight = 0;
    mockScrollToBottom.mockClear();

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

  it('should auto dismiss toast after 3 seconds', () => {
    vi.useFakeTimers();

    useAppStore.setState({ toastMessage: '测试提示消息' });
    render(<ConsolePage />);

    expect(screen.getByText('测试提示消息')).toBeDefined();

    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('测试提示消息')).toBeNull();
  });

  // ---- ask_question WS message tests ----

  it('should show QuestionPanel when ask_question WS message is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Which library?',
            header: 'Library',
            options: [
              { label: 'React', description: 'UI lib' },
              { label: 'Vue', description: 'Progressive' },
            ],
          },
        ],
      });
    });

    expect(screen.getByTestId('question-panel')).toBeDefined();
    expect(screen.getByText('Which library?')).toBeDefined();
    expect(screen.getByText('React')).toBeDefined();
    expect(screen.getByText('Vue')).toBeDefined();
    // InputBar and VirtualKeyBar should be hidden
    expect(screen.queryByTestId('virtual-key-bar')).toBeNull();
  });

  it('should send arrow keys + Enter and dismiss panel when single-select option is clicked', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Choose?',
            options: [
              { label: 'Yes' },
              { label: 'No' },
            ],
          },
        ],
      });
    });

    expect(screen.getByTestId('question-panel')).toBeDefined();

    // Click second option (No), current selectedIndex=0, target=1
    await act(async () => {
      fireEvent.click(screen.getByText('No'));
    });

    // Should send 1 down arrow + Enter
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\x1b[B' });
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\r' });

    // Panel should be dismissed
    expect(screen.queryByTestId('question-panel')).toBeNull();
  });

  it('should handle multiSelect: toggle selected options without dismissing panel', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Which features?',
            options: [
              { label: 'Auth' },
              { label: 'API' },
              { label: 'DB' },
            ],
            multiSelect: true,
          },
        ],
      });
    });

    // Click first option (Auth)
    await act(async () => {
      fireEvent.click(screen.getByText('Auth'));
    });

    // Panel should still be visible (multiSelect doesn't auto-dismiss)
    expect(screen.getByTestId('question-panel')).toBeDefined();
    // Sends Enter for selection
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\r' });
  });

  it('should show text input when Other option is selected', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Choose?',
            options: [
              { label: 'A' },
              { label: 'Other' },
            ],
          },
        ],
      });
    });

    // Click Other option (index 1)
    await act(async () => {
      fireEvent.click(screen.getByText('Other'));
    });

    // Panel should still be visible with text input
    expect(screen.getByTestId('question-panel')).toBeDefined();
    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should handle multiple questions sequentially', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Q1?',
            options: [{ label: 'A1' }, { label: 'B1' }],
          },
          {
            question: 'Q2?',
            options: [{ label: 'A2' }, { label: 'B2' }],
          },
        ],
      });
    });

    // Should show first question
    expect(screen.getByText('Q1?')).toBeDefined();
    expect(screen.getByText('1 / 2')).toBeDefined();

    // Answer first question (click first option, no arrow needed)
    await act(async () => {
      fireEvent.click(screen.getByText('A1'));
    });

    // Should advance to second question
    expect(screen.getByText('Q2?')).toBeDefined();
    expect(screen.getByText('2 / 2')).toBeDefined();

    // Answer second question
    await act(async () => {
      fireEvent.click(screen.getByText('A2'));
    });

    // Panel should be dismissed
    expect(screen.queryByTestId('question-panel')).toBeNull();
  });

  it('should clear askState when status_update with non-waiting_input is received', async () => {
    render(<ConsolePage />);

    // Show question panel
    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          { question: 'Q?', options: [{ label: 'A' }] },
        ],
      });
    });

    expect(screen.getByTestId('question-panel')).toBeDefined();

    // Receive status_update with 'running'
    await act(async () => {
      capturedHandleMessage?.({
        type: 'status_update',
        status: 'running',
      });
    });

    // Panel should be dismissed
    expect(screen.queryByTestId('question-panel')).toBeNull();
  });

  it('should keep ask panel when status_update waiting_input is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [{ question: 'Q?', options: [{ label: 'A' }] }],
      });
    });

    await act(async () => {
      capturedHandleMessage?.({
        type: 'status_update',
        status: 'waiting_input',
      });
    });

    expect(screen.getByTestId('question-panel')).toBeDefined();
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
    expect(screen.queryByTestId('question-panel')).toBeNull();
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

  it('should submit Other input only when trimmed value is non-empty', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Choose?',
            options: [{ label: 'A' }, { label: 'Other' }],
          },
        ],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Other'));
    });

    const input = screen.getByPlaceholderText('输入自定义内容...');

    await act(async () => {
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const callsAfterBlank = mockSend.mock.calls.length;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'custom value' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(mockSend.mock.calls.length).toBeGreaterThan(callsAfterBlank);
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: 'custom value' });
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\r' });
  });

  it('should treat 输入文字 as free-text option', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Choose?',
            options: [{ label: 'A' }, { label: '输入文字' }],
          },
        ],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('输入文字'));
    });

    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should treat chat about this as free-text option', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [
          {
            question: 'Choose?',
            options: [{ label: 'A' }, { label: 'chat about this' }],
          },
        ],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('chat about this'));
    });

    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should send ESC and dismiss ask panel when Escape is pressed during ask state', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'ask_question',
        questions: [{ question: 'Q?', options: [{ label: 'A' }] }],
      });
    });

    expect(screen.getByTestId('question-panel')).toBeDefined();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(mockSend).toHaveBeenCalledWith({ type: 'user_input', data: '\x1b' });
    expect(screen.queryByTestId('question-panel')).toBeNull();
  });

  it('should not send ESC when Escape is pressed outside ask state', async () => {
    render(<ConsolePage />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(mockSend).not.toHaveBeenCalledWith({ type: 'user_input', data: '\x1b' });
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

    expect(mockAdaptToPtyCols).toHaveBeenCalledWith(208);
    expect(mockWrite).toHaveBeenCalledWith('hello');
    expect(mockScrollToBottom).toHaveBeenCalled();
  });

  it('should not call adaptToPtyCols when history_sync has no cols', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'history_sync',
        data: 'hello',
        seq: 1,
        status: 'running',
      });
    });

    expect(mockAdaptToPtyCols).not.toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith('hello');
    expect(mockScrollToBottom).toHaveBeenCalled();
  });

  it('should call adaptToPtyCols when terminal_resize message is received', async () => {
    render(<ConsolePage />);

    await act(async () => {
      capturedHandleMessage?.({
        type: 'terminal_resize',
        cols: 120,
        rows: 40,
      });
    });

    expect(mockAdaptToPtyCols).toHaveBeenCalledWith(120);
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
