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
    expect(result.current.needsCompensation).toBe(false);
  });

  it('should return window.innerHeight by default (no occlusion)', () => {
    const vv = createVisualViewportMock(800, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    // 无活跃输入框
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: document.body,
    });

    const { result } = renderHook(() => useViewport());

    // 默认使用 window.innerHeight，不做补偿
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);
    expect(result.current.needsCompensation).toBe(false);
  });

  it('should use visualViewport values when input is occluded by keyboard', () => {
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

    // 初始状态：无遮挡
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);
    expect(result.current.needsCompensation).toBe(false);

    // 模拟键盘弹出：viewport height 缩小
    act(() => {
      vv.height = 600;
      vv.offsetTop = 300;
      vv.triggerResize();
      vi.advanceTimersByTime(60); // 50ms 防抖 + 余量
    });

    // 由于没有活跃的输入元素，仍然不需要补偿
    expect(result.current.needsCompensation).toBe(false);
    expect(result.current.height).toBe(900); // 回退到 window.innerHeight
    expect(result.current.offsetTop).toBe(0);

    vi.useRealTimers();
  });

  it('should detect occlusion when input element is below visualViewport', () => {
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

    // 创建模拟的输入元素
    const mockInput = {
      tagName: 'INPUT',
      getBoundingClientRect: () => ({
        bottom: 950, // 超出 visualViewport 底部
        top: 910,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: 910,
        toJSON: () => ({}),
      }),
    };

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: mockInput,
    });

    const { result } = renderHook(() => useViewport());

    // 初始状态
    expect(result.current.height).toBe(900);
    expect(result.current.needsCompensation).toBe(false);

    // 模拟键盘弹出：viewport height 缩小
    act(() => {
      vv.height = 600;
      vv.offsetTop = 300;
      vv.triggerResize();
      vi.advanceTimersByTime(60);
    });

    // 输入框被遮挡（bottom: 950 > vv.height + vv.offsetTop - 10 = 890）
    expect(result.current.needsCompensation).toBe(true);
    expect(result.current.height).toBe(600);
    expect(result.current.offsetTop).toBe(300);

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

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: document.body,
    });

    const { result } = renderHook(() => useViewport());

    // 初始状态
    expect(result.current.height).toBe(900);
    expect(result.current.needsCompensation).toBe(false);

    // 通过 scroll 事件更新（模拟华为工具栏变化场景）
    // 无输入框被遮挡时，仍使用 window.innerHeight
    act(() => {
      vv.height = 700;
      vv.offsetTop = 150;
      vv.triggerScroll();
      vi.advanceTimersByTime(60);
    });

    // 无遮挡，使用默认值
    expect(result.current.height).toBe(900);
    expect(result.current.needsCompensation).toBe(false);

    vi.useRealTimers();
  });

  it('should handle focus events to immediately detect occlusion', () => {
    vi.useFakeTimers();

    const vv = createVisualViewportMock(600, 300);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const mockInput = {
      tagName: 'INPUT',
      getBoundingClientRect: () => ({
        bottom: 950, // 超出 visualViewport 底部
        top: 910,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: 910,
        toJSON: () => ({}),
      }),
    };

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: document.body,
    });

    const { result } = renderHook(() => useViewport());

    // 初始无遮挡
    expect(result.current.needsCompensation).toBe(false);

    // 模拟 focus 事件
    act(() => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: mockInput,
      });
      document.dispatchEvent(new Event('focusin', { bubbles: true }));
    });

    // focus 事件应立即触发遮挡检测
    expect(result.current.needsCompensation).toBe(true);
    expect(result.current.height).toBe(600);
    expect(result.current.offsetTop).toBe(300);

    // 模拟 focusout：输入框失焦，恢复默认值
    act(() => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: document.body,
      });
      document.dispatchEvent(new Event('focusout', { bubbles: true }));
    });

    // focusout 后应重置为默认值
    expect(result.current.needsCompensation).toBe(false);
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);

    vi.useRealTimers();
  });

  it('should handle Huawei keyboard scenario with occlusion detection', () => {
    vi.useFakeTimers();

    // 模拟华为手机场景：
    // - windowHeight = 900
    // - viewportHeight = 650（键盘 + 工具栏空白 = 250）
    // - offsetTop = 200（键盘真正推上去的距离，不含工具栏空白）
    const vv = createVisualViewportMock(900, 0);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    // 模拟输入框在屏幕底部，会被键盘遮挡
    const mockInput = {
      tagName: 'INPUT',
      getBoundingClientRect: () => ({
        bottom: 900, // 在 vv.height + vv.offsetTop - 10 = 840 之下，被遮挡
        top: 860,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: 860,
        toJSON: () => ({}),
      }),
    };

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: document.body,
    });

    const { result } = renderHook(() => useViewport());

    // 初始状态：无遮挡
    expect(result.current.needsCompensation).toBe(false);
    expect(result.current.height).toBe(900);

    // 模拟键盘弹起：设置 activeElement 并触发 focusin
    act(() => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        value: mockInput,
      });
      // 更新 visualViewport 值
      vv.height = 650;
      vv.offsetTop = 200;
      document.dispatchEvent(new Event('focusin', { bubbles: true }));
    });

    // 检测到遮挡，启用补偿
    expect(result.current.needsCompensation).toBe(true);
    expect(result.current.height).toBe(650);
    expect(result.current.offsetTop).toBe(200);

    vi.useRealTimers();
  });

  it('should return window.innerHeight when input is not occluded', () => {
    vi.useFakeTimers();

    const vv = createVisualViewportMock(850, 50);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    // 输入框在可视区域内（未遮挡）
    const mockInput = {
      tagName: 'INPUT',
      getBoundingClientRect: () => ({
        bottom: 800, // 在 vv.height + vv.offsetTop = 900 之内
        top: 760,
        left: 0,
        right: 100,
        width: 100,
        height: 40,
        x: 0,
        y: 760,
        toJSON: () => ({}),
      }),
    };

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: mockInput,
    });

    const { result } = renderHook(() => useViewport());

    // 输入框未被遮挡，使用默认值
    expect(result.current.needsCompensation).toBe(false);
    expect(result.current.height).toBe(900);
    expect(result.current.offsetTop).toBe(0);

    vi.useRealTimers();
  });
});