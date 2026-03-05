import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSpotlight } from '../../../src/components/onboarding/useSpotlight.js';

// Mock spotlight-steps to control steps
vi.mock('../../../src/components/onboarding/spotlight-steps.js', async () => {
  const actual = await vi.importActual('../../../src/components/onboarding/spotlight-steps.js');
  return {
    ...actual as object,
    SPOTLIGHT_STEPS: [
      { target: '[data-spotlight="test-target"]', title: 'Test Step', description: 'Test' }
    ],
  };
});

describe('useSpotlight', () => {
  let mockGetBoundingClientRect: ReturnType<typeof vi.fn>;
  let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;
  let isolationWrapper: HTMLElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Clear any existing DOM and isolated wrappers
    document.body.innerHTML = '';
    document.querySelectorAll('[data-isolated]').forEach(el => el.remove());

    // Setup basic DOM structure with isolated namespace
    // Note: using data-testid="console-page" to match ConsolePage structure
    isolationWrapper = document.createElement('div');
    isolationWrapper.setAttribute('data-isolated', 'true');
    isolationWrapper.innerHTML = `
      <div data-testid="console-page" style="position: relative; width: 100%; height: 100%;">
        <div data-spotlight="test-target" style="position: absolute; left: 100px; top: 200px; width: 150px; height: 50px;"></div>
      </div>
    `;
    document.body.appendChild(isolationWrapper);

    // Mock getBoundingClientRect
    mockGetBoundingClientRect = vi.fn();
    const targetElement = document.querySelector('[data-spotlight="test-target"]');
    if (targetElement) {
      Object.defineProperty(targetElement, 'getBoundingClientRect', {
        value: mockGetBoundingClientRect,
        configurable: true,
      });
    }

    // Spy on getComputedStyle - restore original after each test
    getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      transform: 'none',
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    // Restore original getComputedStyle
    getComputedStyleSpy.mockRestore();
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    // Clean up our isolated DOM
    if (isolationWrapper && isolationWrapper.parentNode) {
      isolationWrapper.parentNode.removeChild(isolationWrapper);
    }
    isolationWrapper = null;
  });

  it('should calculate target rect without transform', () => {
    // Mock no transform (already set in beforeEach)
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 50,
    });

    const { result } = renderHook(() => useSpotlight());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.targetRect).toBeTruthy();
    expect(result.current.targetRect?.left).toBe(100);
    expect(result.current.targetRect?.top).toBe(200);
    expect(result.current.targetRect?.width).toBe(150);
    expect(result.current.targetRect?.height).toBe(50);
  });

  it('should compensate for parent container transform offset', () => {
    // When parent has translateY(-100px) which browser reports as matrix(1, 0, 0, 1, 0, -100):
    // - Original element position (without transform): top = 200
    // - With transform, getBoundingClientRect returns: 200 + (-100) = 100 (visual position)
    // - getComputedStyle returns: matrix(1, 0, 0, 1, 0, -100), so offsetY = -100
    // - We compensate: rect.top - offsetY = 100 - (-100) = 200 (back to original)

    const offsetY = -100;
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200 + offsetY, // Visual position: 100
      width: 150,
      height: 50,
    });

    // Browser returns matrix format for translateY
    getComputedStyleSpy.mockImplementation(() => ({
      transform: `matrix(1, 0, 0, 1, 0, ${offsetY})`,
    } as CSSStyleDeclaration));

    const { result } = renderHook(() => useSpotlight());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.targetRect).toBeTruthy();
    expect(result.current.targetRect?.left).toBe(100);
    // rect.top (100) - offsetY (-100) = 200
    expect(result.current.targetRect?.top).toBe(200);
    expect(result.current.targetRect?.width).toBe(150);
    expect(result.current.targetRect?.height).toBe(50);
  });

  it('should handle matrix transform format', () => {
    const offsetY = -150;
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200 + offsetY, // Visual position: 50
      width: 150,
      height: 50,
    });

    getComputedStyleSpy.mockImplementation(() => ({
      transform: `matrix(1, 0, 0, 1, 0, ${offsetY})`,
    } as CSSStyleDeclaration));

    const { result } = renderHook(() => useSpotlight());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.targetRect).toBeTruthy();
    // rect.top (50) - offsetY (-150) = 200
    expect(result.current.targetRect?.top).toBe(200);
  });

  it('should handle non-matrix transform gracefully', () => {
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 50,
    });

    // Scale transform doesn't fit matrix pattern - won't be parsed
    getComputedStyleSpy.mockImplementation(() => ({
      transform: 'scale(1.5)',
    } as CSSStyleDeclaration));

    const { result } = renderHook(() => useSpotlight());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.targetRect).toBeTruthy();
    // Unable to parse scale, so no compensation
    expect(result.current.targetRect?.top).toBe(200);
  });

  it('should recalculate when recalculate is called', () => {
    // No transform initially
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 50,
    });
    // transform: 'none' is already the default in beforeEach

    const { result } = renderHook(() => useSpotlight());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.targetRect?.top).toBe(200);

    // Now apply transform and update visual position
    const offsetY = -50;
    mockGetBoundingClientRect.mockReturnValue({
      left: 100,
      top: 200 + offsetY, // Visual position: 150
      width: 150,
      height: 50,
    });
    getComputedStyleSpy.mockImplementation(() => ({
      transform: `matrix(1, 0, 0, 1, 0, ${offsetY})`,
    } as CSSStyleDeclaration));

    // Recalculate
    act(() => {
      result.current.recalculate();
    });

    // rect.top (150) - offsetY (-50) = 200
    expect(result.current.targetRect?.top).toBe(200);
  });
});
