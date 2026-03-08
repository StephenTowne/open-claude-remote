import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '../../src/hooks/useIsMobile.js';

describe('useIsMobile', () => {
  const originalNavigator = global.navigator;
  const originalInnerWidth = global.innerWidth;

  beforeEach(() => {
    // Reset mocks
    vi.restoreAllMocks();
    // Default to desktop
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('在桌面 user agent 下返回 false', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('在 iPhone user agent 下返回 true', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('在 Android user agent 下返回 true', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B)' },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('在小屏幕宽度下返回 true', () => {
    Object.defineProperty(global, 'innerWidth', {
      value: 375, // Mobile width
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('在 iPad user agent 下返回 true', () => {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)' },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('窗口大小变化时更新状态', () => {
    // 初始为桌面
    Object.defineProperty(global, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });

    const { result, rerender } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // 模拟窗口缩小到移动端
    Object.defineProperty(global, 'innerWidth', {
      value: 375,
      writable: true,
      configurable: true,
    });

    // 触发 resize 事件
    window.dispatchEvent(new Event('resize'));

    rerender();
    expect(result.current).toBe(true);
  });
});
