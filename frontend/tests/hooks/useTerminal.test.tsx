import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

// ---- xterm.js mocks（必须在 import useTerminal 之前声明）----

let resizeObserverCallback: (() => void) | null = null;
let rafCallback: FrameRequestCallback | null = null;

const mockFitAddonFit = vi.fn();
const mockProposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
const mockTermState = { cols: 80, rows: 24 };
const mockTermOptions = { fontSize: 14 };
const mockUnicodeState = { activeVersion: '6' };
const mockTermOpen = vi.fn();
const mockTermDispose = vi.fn();
const mockTermLoadAddon = vi.fn();
const mockTermWrite = vi.fn();
const mockTermResize = vi.fn();
const mockTermReset = vi.fn();
const mockTermClear = vi.fn();
const mockTermScrollToBottom = vi.fn();
const mockTermScrollToTop = vi.fn();
const mockTermOnScroll = vi.fn();
const mockBuffer = {
  active: {
    viewportY: 0,
    length: 100,
  },
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    get cols() { return mockTermState.cols; },
    get rows() { return mockTermState.rows; },
    get buffer() { return mockBuffer; },
    options: mockTermOptions,
    unicode: mockUnicodeState,
    write: mockTermWrite,
    clear: mockTermClear,
    reset: mockTermReset,
    scrollToBottom: mockTermScrollToBottom,
    scrollToTop: mockTermScrollToTop,
    resize: mockTermResize,
    open: mockTermOpen,
    dispose: mockTermDispose,
    loadAddon: mockTermLoadAddon,
    onScroll: mockTermOnScroll,
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: mockFitAddonFit,
    proposeDimensions: mockProposeDimensions,
  })),
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn(() => ({
    onContextLoss: vi.fn(),
    dispose: vi.fn(),
  })),
}));

const mockUnicodeAddon = { unicodeVersion: '6' };
vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: vi.fn(() => mockUnicodeAddon),
}));

// Mock ResizeObserver
class MockResizeObserver {
  private cb: () => void;
  constructor(callback: () => void) {
    this.cb = callback;
    resizeObserverCallback = callback;
  }
  observe(_target: Element) {}
  disconnect() {
    resizeObserverCallback = null;
  }
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
  rafCallback = cb;
  return 1;
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// ---- Import hook after mocks ----
import { useTerminal } from '../../src/hooks/useTerminal.js';

// ---- Tests ----

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFitAddonFit.mockReset();
    mockProposeDimensions.mockReset();
    mockProposeDimensions.mockReturnValue({ cols: 80, rows: 24 });
    resizeObserverCallback = null;
    rafCallback = null;
    mockTermState.cols = 80;
    mockTermState.rows = 24;
    mockTermOptions.fontSize = 14;
    mockUnicodeState.activeVersion = '6';
    mockTermWrite.mockReset();
    mockTermResize.mockReset();
    mockTermReset.mockReset();
    mockTermClear.mockReset();
    mockTermScrollToBottom.mockReset();
    mockTermScrollToTop.mockReset();
    mockTermOnScroll.mockReset();
    mockBuffer.active.viewportY = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderUseTerminal(onResize?: (cols: number, rows: number) => void) {
    const div = document.createElement('div');
    document.body.appendChild(div);

    return renderHook(() => {
      const containerRef = useRef<HTMLDivElement>(div);
      return useTerminal(containerRef, onResize);
    });
  }

  it('should call onResize when ResizeObserver triggers after fitAddon.fit()', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 50;
      mockTermState.rows = 20;
    });

    renderUseTerminal(onResize);

    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).toHaveBeenCalledWith(50, 20);
  });

  it('should not throw if onResize is not provided', () => {
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 50;
      mockTermState.rows = 20;
    });

    expect(() => {
      renderUseTerminal(undefined);
      act(() => {
        resizeObserverCallback?.();
      });
    }).not.toThrow();
  });

  it('should call onResize with correct cols and rows after resize observer fires', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 60;
      mockTermState.rows = 22;
    });

    renderUseTerminal(onResize);

    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).toHaveBeenCalledWith(60, 22);
  });

  it('should return write, clear, reset, scrollToBottom, setAutoFollow, showScrollHint, adaptToPtyCols', () => {
    const { result } = renderUseTerminal();

    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.scrollToBottom).toBe('function');
    expect(typeof result.current.setAutoFollow).toBe('function');
    expect(typeof result.current.adaptToPtyCols).toBe('function');
    expect(result.current.showScrollHint).toBe(false);
  });

  it('reset should call terminal.reset()', () => {
    const { result } = renderUseTerminal();

    act(() => {
      result.current.reset();
    });

    expect(mockTermReset).toHaveBeenCalledOnce();
  });

  it('should report initial size through requestAnimationFrame callback', () => {
    const onResize = vi.fn();
    renderUseTerminal(onResize);

    expect(rafCallback).toBeTypeOf('function');

    act(() => {
      rafCallback?.(0);
    });

    expect(onResize).toHaveBeenCalledWith(80, 24);
  });

  it('should dispose terminal on unmount', () => {
    const { unmount } = renderUseTerminal();
    unmount();

    expect(mockTermDispose).toHaveBeenCalledOnce();
  });

  it('should batch write calls and flush once in animation frame', () => {
    const { result } = renderUseTerminal();

    act(() => {
      result.current.write('A');
      result.current.write('B');
    });

    expect(mockTermWrite).not.toHaveBeenCalled();

    act(() => {
      rafCallback?.(0);
    });

    expect(mockTermWrite).toHaveBeenCalledWith('AB');
  });

  it('should flush pending write queue on unmount', () => {
    const { result, unmount } = renderUseTerminal();

    act(() => {
      result.current.write('tail');
    });

    expect(mockTermWrite).not.toHaveBeenCalled();

    unmount();

    expect(mockTermWrite).toHaveBeenCalledWith('tail');
  });

  it('should load Unicode11 addon and set unicodeVersion to 11', () => {
    renderUseTerminal();

    expect(mockTermLoadAddon.mock.calls.some((call) => call[0] === mockUnicodeAddon)).toBe(true);
    expect(mockUnicodeState.activeVersion).toBe('11');
  });

  // ---- resize throttling tests (emitResize) ----

  describe('resize throttling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

  // ---- Auto-follow feature tests ----

  describe('auto-follow feature', () => {
    it('should initialize with showScrollHint false', () => {
      const { result } = renderUseTerminal();

      expect(result.current.showScrollHint).toBe(false);
    });

    it('should auto-scroll when autoFollow is true and data is written', async () => {
      const { result } = renderUseTerminal();

      // 模拟写入数据
      act(() => {
        result.current.write('test data');
      });

      // 等待 RAF 执行
      await act(async () => {
        rafCallback?.(0);
      });

      // scrollToBottom 应该被调用（因为 autoFollow 默认为 true）
      expect(mockTermScrollToBottom).toHaveBeenCalled();
    });

    it('should not auto-scroll when autoFollow is false', async () => {
      const { result } = renderUseTerminal();

      // 关闭 auto-follow
      act(() => {
        result.current.setAutoFollow(false);
      });

      // 清空之前的调用记录
      mockTermScrollToBottom.mockClear();

      // 写入数据
      act(() => {
        result.current.write('test data');
      });

      await act(async () => {
        rafCallback?.(0);
      });

      // scrollToBottom 不应该被调用
      expect(mockTermScrollToBottom).not.toHaveBeenCalled();
    });

    it('should show scroll hint when user scrolls up', () => {
      const { result } = renderUseTerminal();

      expect(mockTermOnScroll).toHaveBeenCalled();
      const scrollCallback = mockTermOnScroll.mock.calls[0][0];

      // 模拟用户向上滚动（viewportY 变小,不在底部）
      mockBuffer.active.viewportY = 50;
      mockBuffer.active.length = 100;
      mockTermState.rows = 24;

      act(() => {
        scrollCallback();
      });

      // showScrollHint 应该为 true
      expect(result.current.showScrollHint).toBe(true);
    });

    it('should hide scroll hint when setAutoFollow(true) is called', () => {
      const { result } = renderUseTerminal();

      // 模拟用户滚动上去，触发 showScrollHint
      expect(mockTermOnScroll).toHaveBeenCalled();
      const scrollCallback = mockTermOnScroll.mock.calls[0][0];
      mockBuffer.active.viewportY = 50;
      mockBuffer.active.length = 100;
      mockTermState.rows = 24;

      act(() => {
        scrollCallback();
      });

      expect(result.current.showScrollHint).toBe(true);

      // 重新开启 auto-follow
      act(() => {
        result.current.setAutoFollow(true);
      });

      expect(result.current.showScrollHint).toBe(false);
    });

    it('should update showScrollHint based on scroll position', () => {
      const { result } = renderUseTerminal();

      expect(mockTermOnScroll).toHaveBeenCalled();
      const scrollCallback = mockTermOnScroll.mock.calls[0][0];

      // 模拟不在底部 → showScrollHint = true
      mockBuffer.active.viewportY = 50;
      mockBuffer.active.length = 100;
      mockTermState.rows = 24;

      act(() => {
        scrollCallback();
      });

      expect(result.current.showScrollHint).toBe(true);

      // 模拟回到底部 → showScrollHint = false（autoFollow 已关闭，但 atBottom 为 true）
      mockBuffer.active.viewportY = 76; // length - rows = 100 - 24 = 76

      act(() => {
        scrollCallback();
      });

      expect(result.current.showScrollHint).toBe(false);
    });
  });

    it('should deduplicate identical resize events', () => {
      const onResize = vi.fn();
      renderUseTerminal(onResize);

      // Initial RAF → emitResize(80, 24)
      act(() => { rafCallback?.(0); });
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith(80, 24);

      // Trigger ResizeObserver with same dimensions (80x24)
      act(() => { resizeObserverCallback?.(); });
      expect(onResize).toHaveBeenCalledTimes(1); // deduplicated
    });

    it('should throttle rapid resize events and emit trailing value', () => {
      const onResize = vi.fn();
      renderUseTerminal(onResize);

      // Initial
      act(() => { rafCallback?.(0); });
      expect(onResize).toHaveBeenCalledTimes(1);

      // Immediate resize with different dimensions (0ms elapsed < 50ms window)
      mockTermState.cols = 100;
      mockTermState.rows = 30;
      act(() => { resizeObserverCallback?.(); });
      expect(onResize).toHaveBeenCalledTimes(1); // throttled

      // Advance past throttle window → trailing emit
      act(() => { vi.advanceTimersByTime(50); });
      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize).toHaveBeenLastCalledWith(100, 30);
    });

    it('should emit immediately when outside throttle window', () => {
      const onResize = vi.fn();
      renderUseTerminal(onResize);

      // Initial
      act(() => { rafCallback?.(0); });
      expect(onResize).toHaveBeenCalledTimes(1);

      // Advance past throttle window (50ms)
      vi.advanceTimersByTime(50);

      // Change dimensions and trigger
      mockTermState.cols = 100;
      mockTermState.rows = 30;
      act(() => { resizeObserverCallback?.(); });

      // Should fire immediately (elapsed >= 50ms)
      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize).toHaveBeenLastCalledWith(100, 30);
    });
  });

  // ---- adaptToPtyCols tests (read-only mode: no font shrinking, no forced rows) ----

  it('adaptToPtyCols should ignore PTY cols/rows params and emit actual terminal size', () => {
    // 测试场景：history_sync 返回 PC 端尺寸(120x40)，但移动端实际是小屏(46x24)
    // adaptToPtyCols 应该发送移动端的实际尺寸，而不是 PC 端尺寸
    const onResize = vi.fn();

    // 模拟移动端小屏尺寸
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 46;
      mockTermState.rows = 24;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // 传入 PC 端的大尺寸参数（来自 history_sync）
    act(() => {
      result.current.adaptToPtyCols(120, 40); // PC 端尺寸
    });

    // 应该发送移动端的实际尺寸，而不是 PC 端尺寸
    expect(onResize).toHaveBeenCalledWith(46, 24);
    expect(onResize).not.toHaveBeenCalledWith(120, 40);
  });

  it('adaptToPtyCols should NOT change font size regardless of ptyCols', () => {
    // 模拟窄屏手机（46 cols at font 14）
    mockProposeDimensions.mockReturnValue({ cols: 46, rows: 24 });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(200); // PTY 远宽于手机
    });

    // 字体应保持默认 14，不缩放
    expect(mockTermOptions.fontSize).toBe(14);
    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  it('adaptToPtyCols should call fitAddon.fit() to use natural container size', () => {
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal();
    mockFitAddonFit.mockClear();

    act(() => {
      result.current.adaptToPtyCols(200, 50);
    });

    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  it('adaptToPtyCols should NOT force terminal rows to match PTY rows', () => {
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33; // container fits 33 rows
    });

    const { result } = renderUseTerminal();
    mockTermResize.mockClear();

    act(() => {
      result.current.adaptToPtyCols(200, 50); // PTY has 50 rows
    });

    // 不应强制 resize（50 行会溢出容器）
    expect(mockTermResize).not.toHaveBeenCalled();
  });

  it('adaptToPtyCols should emit resize after fit', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // adaptToPtyCols 应该立即发送 resize
    act(() => {
      result.current.adaptToPtyCols(200);
    });

    expect(onResize).toHaveBeenCalledWith(42, 33);
  });

  it('should NOT emit duplicate resize when ResizeObserver triggers after adaptToPtyCols with same size', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // adaptToPtyCols 发送第一次 resize (42, 33)
    act(() => {
      result.current.adaptToPtyCols(200);
    });
    expect(onResize).toHaveBeenCalledTimes(1);
    onResize.mockClear();

    // ResizeObserver 触发，但尺寸相同，不应重复发送
    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('should emit resize from ResizeObserver when size changes significantly after adaptToPtyCols', async () => {
    vi.useFakeTimers();

    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // adaptToPtyCols 发送第一次 resize (42, 33)
    act(() => {
      result.current.adaptToPtyCols(200);
    });
    expect(onResize).toHaveBeenCalledWith(42, 33);
    onResize.mockClear();

    // 等待 throttle 窗口过去
    await vi.advanceTimersByTimeAsync(100);

    // 模拟 ResizeObserver 触发时尺寸变化（fit 后变成新尺寸）
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 50;
      mockTermState.rows = 20;
    });

    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).toHaveBeenCalledWith(50, 20);

    vi.useRealTimers();
  });

  it('should call fitAddon.fit() from ResizeObserver after adaptToPtyCols', () => {
    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(200);
    });
    mockFitAddonFit.mockClear();

    // ResizeObserver 触发
    act(() => {
      resizeObserverCallback?.();
    });

    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  // ---- resize only records on successful send ----

  it('should NOT record resize if onResize returns false (WebSocket not connected)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    // First call returns false (WebSocket not connected)
    // Second call returns true (WebSocket connected)
    const onResize = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    renderUseTerminal(onResize);

    // Initial RAF → emitResize(42, 33)
    act(() => { rafCallback?.(0); });

    // onResize was called but returned false on first call
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith(42, 33);

    // Wait for throttle window to pass
    await vi.advanceTimersByTimeAsync(100);

    // Trigger same resize again (e.g., from adaptToPtyCols)
    act(() => { resizeObserverCallback?.(); });

    // Should be called again because previous send was not recorded (returned false)
    expect(onResize).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenLastCalledWith(42, 33);

    vi.useRealTimers();
  });

  it('should record resize when onResize returns true and deduplicate subsequent same-size calls', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    const onResize = vi.fn().mockReturnValue(true);

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 24;
    });

    renderUseTerminal(onResize);

    // First call: WebSocket connected → recorded
    act(() => { rafCallback?.(0); });
    expect(onResize).toHaveBeenCalledTimes(1);

    // Wait for throttle window to pass
    await vi.advanceTimersByTimeAsync(100);

    // Second call: Same size → deduplicated
    act(() => { resizeObserverCallback?.(); });
    expect(onResize).toHaveBeenCalledTimes(1); // Not called again

    vi.useRealTimers();
  });
});
