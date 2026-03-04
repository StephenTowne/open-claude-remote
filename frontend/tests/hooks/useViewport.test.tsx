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

  it('should return window.innerHeight and 0 offsetTop when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    const { result } = renderHook(() => useViewport());

    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);
  });

  it('should return visualViewport height and offsetTop', () => {
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

    expect(result.current.height).toBe(800);
    expect(result.current.offsetTop).toBe(0);
  });

  it('should update height and offsetTop when visual viewport changes via resize', () => {
    vi.useFakeTimers();

    const vv = createVisualViewportMock(900, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初始状态
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);

    // 模拟键盘弹出：viewport height 缩小，offsetTop 增加
    act(() => {
      vv.height = 700;
      vv.offsetTop = 200;
      vv.triggerResize();
      vi.advanceTimersByTime(160); // 150ms 防抖 + 余量
    });

    // 返回原始的 visualViewport 值，不做阈值判断
    expect(result.current.height).toBe(700);
    expect(result.current.offsetTop).toBe(200);

    vi.useRealTimers();
  });

  it('should respond to scroll events (captures toolbar changes)', () => {
    vi.useFakeTimers();

    const vv = createVisualViewportMock(900, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初始状态
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);

    // 通过 scroll 事件更新（模拟华为工具栏变化场景）
    act(() => {
      vv.height = 700;
      vv.offsetTop = 150;
      vv.triggerScroll();
      vi.advanceTimersByTime(160); // 150ms 防抖 + 余量
    });

    expect(result.current.height).toBe(700);
    expect(result.current.offsetTop).toBe(150);

    vi.useRealTimers();
  });

  it('should handle Huawei keyboard scenario: return raw offsetTop without threshold filtering', () => {
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

    // 返回原始值，不做阈值判断
    expect(result.current.height).toBe(650);
    expect(result.current.offsetTop).toBe(200);
  });

  it('should handle small offsetTop values (e.g., address bar changes)', () => {
    // 模拟地址栏收缩等小变化
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

    // 返回原始值，让调用方决定如何处理
    expect(result.current.height).toBe(850);
    expect(result.current.offsetTop).toBe(50);
  });
});