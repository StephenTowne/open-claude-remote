import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

// ---- xterm.js mocks（必须在 import useTerminal 之前声明）----

let resizeObserverCallback: (() => void) | null = null;

const mockFitAddonFit = vi.fn();
const mockTermState = { cols: 80, rows: 24 };
const mockTermOpen = vi.fn();
const mockTermDispose = vi.fn();
const mockTermLoadAddon = vi.fn();

// buffer mock：通过 mockBufferLines 控制 readLastLines 的返回内容
const mockBufferLines: string[] = [];
const mockBuffer = {
  get length() { return mockBufferLines.length; },
  getLine: vi.fn((y: number) => {
    const text = mockBufferLines[y];
    if (text === undefined) return null;
    return { translateToString: (_trimRight?: boolean) => text };
  }),
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    get cols() { return mockTermState.cols; },
    get rows() { return mockTermState.rows; },
    write: vi.fn(),
    clear: vi.fn(),
    scrollToBottom: vi.fn(),
    resize: vi.fn(),
    open: mockTermOpen,
    dispose: mockTermDispose,
    loadAddon: mockTermLoadAddon,
    buffer: { active: mockBuffer },
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: mockFitAddonFit,
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

// ---- Import hook after mocks ----
import { useTerminal } from '../../src/hooks/useTerminal.js';

// ---- Tests ----

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resizeObserverCallback = null;
    mockTermState.cols = 80;
    mockTermState.rows = 24;
    mockBufferLines.length = 0; // 清空 buffer mock 内容
    // 每次重置 getLine 到默认实现，避免 mockImplementation 跨测试污染
    mockBuffer.getLine.mockImplementation((y: number) => {
      const text = mockBufferLines[y];
      if (text === undefined) return null;
      return { translateToString: () => text };
    });
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

    // fit() が呼ばれたときに cols/rows を変更
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

  it('should return write, clear, scrollToBottom, readLastLines functions', () => {
    const { result } = renderUseTerminal();

    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.scrollToBottom).toBe('function');
    expect(typeof result.current.readLastLines).toBe('function');
  });

  it('readLastLines should return empty array when buffer has no lines', () => {
    const { result } = renderUseTerminal();

    const lines = result.current.readLastLines(10);
    expect(lines).toEqual([]);
  });

  it('readLastLines should return all lines when buffer has fewer lines than requested', () => {
    mockBufferLines.push('line 1', 'line 2', 'line 3');
    const { result } = renderUseTerminal();

    const lines = result.current.readLastLines(10);
    expect(lines).toEqual(['line 1', 'line 2', 'line 3']);
  });

  it('readLastLines should return only the last n lines when buffer exceeds n', () => {
    for (let i = 1; i <= 20; i++) {
      mockBufferLines.push(`line ${i}`);
    }
    const { result } = renderUseTerminal();

    const lines = result.current.readLastLines(5);
    expect(lines).toEqual(['line 16', 'line 17', 'line 18', 'line 19', 'line 20']);
  });

  it('readLastLines should skip null buffer lines without throwing', () => {
    // getLine 返回 null 模拟空行槽
    mockBuffer.getLine.mockImplementation((y: number) => {
      if (y === 1) return null;
      const text = mockBufferLines[y];
      if (text === undefined) return null;
      return { translateToString: () => text };
    });
    mockBufferLines.push('line 0', 'line 1 (will be null)', 'line 2');

    const { result } = renderUseTerminal();
    const lines = result.current.readLastLines(10);
    // null 行被跳过
    expect(lines).toEqual(['line 0', 'line 2']);
  });
});
