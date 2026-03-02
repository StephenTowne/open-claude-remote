import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from '../../src/hooks/useViewport.js';

interface VisualViewportMock {
  height: number;
  offsetTop: number;
  addEventListener: (type: 'resize' | 'scroll', cb: () => void) => void;
  removeEventListener: (type: 'resize' | 'scroll', cb: () => void) => void;
  triggerResize: () => void;
  triggerScroll: () => void;
}

function createVisualViewportMock(initialHeight: number, initialOffsetTop = 0): VisualViewportMock {
  const listeners = new Map<string, Set<() => void>>();

  return {
    height: initialHeight,
    offsetTop: initialOffsetTop,
    addEventListener: (type, cb) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type, cb) => {
      listeners.get(type)?.delete(cb);
    },
    triggerResize: () => listeners.get('resize')?.forEach((cb) => cb()),
    triggerScroll: () => listeners.get('scroll')?.forEach((cb) => cb()),
  };
}

describe('useViewport', () => {
  let originalVisualViewport: VisualViewport | undefined;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalVisualViewport = window.visualViewport;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });

    vi.restoreAllMocks();
  });

  it('should return 0 when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useViewport());

    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should update keyboardHeight using offsetTop when visual viewport shrinks', () => {
    vi.useFakeTimers();

    const vv = createVisualViewportMock(800, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 模拟键盘弹出：offsetTop = 150（键盘将 viewport 推上去的距离）
    act(() => {
      vv.height = 700;
      vv.offsetTop = 150;
      vv.triggerResize();
      vi.advanceTimersByTime(20);
    });

    // keyboardHeight 应该等于 offsetTop，而不是 windowHeight - viewportHeight
    expect(result.current.keyboardHeight).toBe(150);

    vi.useRealTimers();
  });

  it('should return 0 when offsetTop is exactly at threshold (100px)', () => {
    const vv = createVisualViewportMock(800, 100);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初始 offsetTop = 100，恰好等于阈值，应返回 0
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should detect keyboard when offsetTop exceeds threshold (101px)', () => {
    // viewportHeight = 799，windowHeight = 900，差值 = 101 > 阈值
    const vv = createVisualViewportMock(799, 101);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // offsetTop = 101 > 阈值，应返回 offsetTop 值
    expect(result.current.keyboardHeight).toBe(101);
  });

  it('should return 0 when offsetTop is below threshold (50px)', () => {
    const vv = createVisualViewportMock(850, 50);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // offsetTop = 50px < 阈值，不应误判为键盘弹出
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should clamp keyboardHeight to 0 when offsetTop is 0', () => {
    const vv = createVisualViewportMock(1000, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    act(() => {
      vv.triggerResize();
    });

    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should respond to scroll events (captures toolbar changes)', () => {
    vi.useFakeTimers();

    // 初态：viewportHeight = 800，windowHeight = 900，差值 = 100，等于阈值，不触发键盘
    const vv = createVisualViewportMock(800, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初值为 0（差值 = 100 未超过阈值）
    expect(result.current.keyboardHeight).toBe(0);

    // 通过 scroll 事件更新（模拟华为工具栏变化场景）
    // 同时更新 height 和 offsetTop，让差值超过阈值
    act(() => {
      vv.height = 700;
      vv.offsetTop = 150;
      vv.triggerScroll();
      vi.advanceTimersByTime(20);
    });

    expect(result.current.keyboardHeight).toBe(150);

    vi.useRealTimers();
  });

  it('should handle Huawei keyboard scenario: toolbar space vs actual keyboard', () => {
    // 模拟华为手机场景：
    // - windowHeight = 900
    // - viewportHeight = 650（键盘 + 工具栏空白 = 250）
    // - offsetTop = 200（键盘真正推上去的距离，不含工具栏空白）
    const vv = createVisualViewportMock(650, 200);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // keyboardHeight 应该是 offsetTop (200)，而不是 windowHeight - viewportHeight (250)
    expect(result.current.keyboardHeight).toBe(200);
  });
});
