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
const mockTermScrollToLine = vi.fn();
const mockTermOnScroll = vi.fn(() => ({ dispose: vi.fn() }));
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
    scrollToLine: mockTermScrollToLine,
    onScroll: mockTermOnScroll,
    resize: mockTermResize,
    open: mockTermOpen,
    dispose: mockTermDispose,
    loadAddon: mockTermLoadAddon,
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
    mockTermScrollToLine.mockReset();
    mockTermOnScroll.mockReset();
    mockTermOnScroll.mockReturnValue({ dispose: vi.fn() });
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

  it('should return write, clear, reset, scrollToBottom, scrollToTop, setOnScrollPositionChange functions', () => {
    const { result } = renderUseTerminal();

    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.scrollToBottom).toBe('function');
    expect(typeof result.current.scrollToTop).toBe('function');
    expect(typeof result.current.setOnScrollPositionChange).toBe('function');
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

  // ---- onScroll callback tests ----

  describe('onScroll callback', () => {
    let scrollCallback: (() => void) | null = null;

    beforeEach(() => {
      scrollCallback = null;
      mockTermOnScroll.mockImplementation((cb: () => void) => {
        scrollCallback = cb;
        return { dispose: vi.fn() };
      });
      // 模拟足够的缓冲区内容让滚动有意义
      mockBuffer.active.length = 200; // 200 行内容
      mockBuffer.active.viewportY = 0; // 初始在顶部
      mockTermState.rows = 24; // 可见 24 行
    });

    it('should trigger onScroll callback with correct viewportY and isAtBottom when user scrolls', () => {
      const onScrollPositionChange = vi.fn();
      const { result } = renderUseTerminal();

      // 注册滚动回调
      act(() => {
        result.current.setOnScrollPositionChange(onScrollPositionChange);
      });

      // 模拟用户向上滚动（手指上滑，内容向下滚动）
      mockBuffer.active.viewportY = 100; // 滚动到第 100 行
      act(() => {
        scrollCallback?.();
      });

      // maxViewportY = 200 - 24 = 176
      // viewportY = 100, isAtBottom = false (100 < 176)
      expect(onScrollPositionChange).toHaveBeenCalledWith(100, false);
      onScrollPositionChange.mockClear();

      // 模拟滚动到底部
      mockBuffer.active.viewportY = 176; // maxViewportY
      act(() => {
        scrollCallback?.();
      });

      // viewportY = 176, isAtBottom = true (176 >= 176)
      expect(onScrollPositionChange).toHaveBeenCalledWith(176, true);
    });

    it('should trigger onScroll callback after programmatic scrollToBottom', () => {
      const onScrollPositionChange = vi.fn();
      const { result } = renderUseTerminal();

      act(() => {
        result.current.setOnScrollPositionChange(onScrollPositionChange);
      });

      // 初始状态：中部位置
      mockBuffer.active.viewportY = 100;
      act(() => {
        scrollCallback?.();
      });
      expect(onScrollPositionChange).toHaveBeenCalledWith(100, false);
      onScrollPositionChange.mockClear();

      // 程序化滚动到底部 → scrollToBottom 修改 viewportY
      mockBuffer.active.viewportY = 176; // scrollToBottom 会导致 xterm 修改 buffer.viewportY
      act(() => {
        result.current.scrollToBottom();
        // xterm 在 scrollToBottom 后会触发 onScroll 回调
        scrollCallback?.();
      });

      expect(onScrollPositionChange).toHaveBeenCalledWith(176, true);
    });

    it('should continue to trigger onScroll after scrollToBottom + scroll again', () => {
      const onScrollPositionChange = vi.fn();
      const { result } = renderUseTerminal();

      act(() => {
        result.current.setOnScrollPositionChange(onScrollPositionChange);
      });

      // 1. 用户向上滚动
      mockBuffer.active.viewportY = 100;
      act(() => {
        scrollCallback?.();
      });
      expect(onScrollPositionChange).toHaveBeenCalledWith(100, false);
      onScrollPositionChange.mockClear();

      // 2. 点击「滚动到底部」按钮
      mockBuffer.active.viewportY = 176;
      act(() => {
        result.current.scrollToBottom();
        scrollCallback?.();
      });
      expect(onScrollPositionChange).toHaveBeenCalledWith(176, true);
      onScrollPositionChange.mockClear();

      // 3. 用户再次向上滚动
      mockBuffer.active.viewportY = 50;
      act(() => {
        scrollCallback?.();
      });
      // **关键断言**：再次滚动时，回调应该被触发
      expect(onScrollPositionChange).toHaveBeenCalledWith(50, false);
    });
  });
});
