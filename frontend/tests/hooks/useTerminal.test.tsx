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
const mockTermOpen = vi.fn();
const mockTermDispose = vi.fn();
const mockTermLoadAddon = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    get cols() { return mockTermState.cols; },
    get rows() { return mockTermState.rows; },
    options: mockTermOptions,
    write: vi.fn(),
    clear: vi.fn(),
    scrollToBottom: vi.fn(),
    resize: vi.fn(),
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

  // ---- adaptToPtyCols tests ----

  it('adaptToPtyCols should shrink font when container cols < ptyCols', () => {
    // 基准 proposeDimensions 返回 46 列（模拟 iPhone 390px / fontSize=14）
    mockProposeDimensions.mockReturnValue({ cols: 46, rows: 24 });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(80);
    });

    // targetFontSize = 14 * (46 / 80) = 8.05 → round to 8
    // 最终字体应缩小
    expect(mockTermOptions.fontSize).toBeLessThan(14);
    expect(mockTermOptions.fontSize).toBeGreaterThanOrEqual(7);
    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  it('adaptToPtyCols should keep default font when container cols >= ptyCols', () => {
    mockProposeDimensions.mockReturnValue({ cols: 120, rows: 24 });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(80);
    });

    // 容器已足够宽，应保持 14
    expect(mockTermOptions.fontSize).toBe(14);
    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  it('adaptToPtyCols should clamp font to MIN_FONT_SIZE (7)', () => {
    // 基准 proposeDimensions 返回 30 列
    mockProposeDimensions.mockReturnValue({ cols: 30, rows: 24 });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(208);
    });

    // targetFontSize = 14 * (30 / 208) = 2.02 → clamp to 7
    expect(mockTermOptions.fontSize).toBe(7);
    expect(mockFitAddonFit).toHaveBeenCalled();
  });

  it('adaptToPtyCols should fallback to larger font when rows become too low', () => {
    mockProposeDimensions.mockReturnValue({ cols: 46, rows: 24 });

    mockFitAddonFit.mockImplementation(() => {
      if (mockTermOptions.fontSize <= 8) {
        mockTermState.rows = 10;
      } else {
        mockTermState.rows = 13;
      }
    });

    const { result } = renderUseTerminal();

    act(() => {
      result.current.adaptToPtyCols(80);
    });

    expect(mockTermOptions.fontSize).toBe(9);
    expect(mockFitAddonFit).toHaveBeenCalledTimes(2);
  });

  it('should not trigger onResize from ResizeObserver after ptyCols is set', () => {
    const onResize = vi.fn();
    mockProposeDimensions.mockReturnValue({ cols: 46, rows: 24 });

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 46;
      mockTermState.rows = 20;
    });

    const { result } = renderUseTerminal(onResize);
    onResize.mockClear();

    // 设置 ptyCols
    act(() => {
      result.current.adaptToPtyCols(80);
    });
    onResize.mockClear();

    // ResizeObserver 触发
    act(() => {
      resizeObserverCallback?.();
    });

    // 不应向后端发送 resize
    expect(onResize).not.toHaveBeenCalled();
  });

  it('should trigger onResize from ResizeObserver when ptyCols is not set', () => {
    const onResize = vi.fn();

    mockFitAddonFit.mockImplementation(() => {
      mockTermState.cols = 60;
      mockTermState.rows = 22;
    });

    renderUseTerminal(onResize);
    onResize.mockClear();

    act(() => {
      resizeObserverCallback?.();
    });

    expect(onResize).toHaveBeenCalledWith(60, 22);
  });
});
