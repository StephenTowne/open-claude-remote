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

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    get cols() { return mockTermState.cols; },
    get rows() { return mockTermState.rows; },
    options: mockTermOptions,
    unicode: mockUnicodeState,
    write: mockTermWrite,
    clear: vi.fn(),
    scrollToBottom: vi.fn(),
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

  it('should return write, clear, scrollToBottom functions', () => {
    const { result } = renderUseTerminal();

    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.scrollToBottom).toBe('function');
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

  it('should still trigger onResize from ResizeObserver after adaptToPtyCols is called', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 42;
      mockTermState.rows = 33;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // adaptToPtyCols（不再进入 mobile mode）
    act(() => {
      result.current.adaptToPtyCols(200);
    });
    onResize.mockClear();

    // ResizeObserver 触发 → 应正常上报 resize
    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).toHaveBeenCalledWith(42, 33);
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
});
