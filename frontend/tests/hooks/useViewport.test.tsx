import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from '../../src/hooks/useViewport.js';

interface VisualViewportMock {
  height: number;
  addEventListener: (type: 'resize', cb: () => void) => void;
  removeEventListener: (type: 'resize', cb: () => void) => void;
  triggerResize: () => void;
}

function createVisualViewportMock(initialHeight: number): VisualViewportMock {
  const listeners = new Set<() => void>();

  return {
    height: initialHeight,
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
    triggerResize: () => listeners.forEach((cb) => cb()),
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

  it('should update keyboardHeight when visual viewport shrinks', () => {
    const vv = createVisualViewportMock(800);

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
      vv.height = 700;
      vv.triggerResize();
    });

    expect(result.current.keyboardHeight).toBe(200);
  });

  it('should return 0 when viewport diff is exactly at threshold (100px)', () => {
    const vv = createVisualViewportMock(800);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初始 diff = 900 - 800 = 100，恰好等于阈值，应返回 0
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should detect keyboard when viewport diff exceeds threshold (101px)', () => {
    const vv = createVisualViewportMock(799);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // 初始 diff = 900 - 799 = 101 > 阈值，应返回 101
    expect(result.current.keyboardHeight).toBe(101);
  });

  it('should return 0 when address bar causes small viewport change (50px)', () => {
    const vv = createVisualViewportMock(850);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useViewport());

    // diff = 50px < 阈值，不应误判为键盘弹出
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('should clamp keyboardHeight to 0 when viewport is larger than innerHeight', () => {
    const vv = createVisualViewportMock(1000);

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
});
