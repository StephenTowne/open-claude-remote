import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SpotlightProvider, useSpotlightContext } from '../../../src/components/onboarding/SpotlightContext.js';
import { STORAGE_KEY } from '../../../src/components/onboarding/spotlight-steps.js';

// Test component that uses the context
function TestComponent() {
  const { visible, currentStep, totalSteps, step, handleNext, handleSkip } = useSpotlightContext();
  return (
    <div>
      <div data-testid="visible">{visible ? 'true' : 'false'}</div>
      <div data-testid="current-step">{currentStep}</div>
      <div data-testid="total-steps">{totalSteps}</div>
      <div data-testid="step-title">{step?.title ?? 'null'}</div>
      <button data-testid="next-btn" onClick={handleNext}>Next</button>
      <button data-testid="skip-btn" onClick={handleSkip}>Skip</button>
    </div>
  );
}

describe('SpotlightContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should throw error when useSpotlightContext is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function ComponentOutsideProvider() {
      useSpotlightContext();
      return null;
    }

    expect(() => {
      render(<ComponentOutsideProvider />);
    }).toThrow('useSpotlightContext must be used within a SpotlightProvider');

    consoleSpy.mockRestore();
  });

  it('should show spotlight when localStorage key is not set', () => {
    render(
      <SpotlightProvider>
        <TestComponent />
      </SpotlightProvider>
    );

    expect(screen.getByTestId('visible').textContent).toBe('true');
    expect(screen.getByTestId('current-step').textContent).toBe('0');
    expect(screen.getByTestId('total-steps').textContent).toBe('6');
  });

  it('should hide spotlight when localStorage key is set', () => {
    localStorage.setItem(STORAGE_KEY, 'true');

    render(
      <SpotlightProvider>
        <TestComponent />
      </SpotlightProvider>
    );

    expect(screen.getByTestId('visible').textContent).toBe('false');
  });

  it('should advance to next step when handleNext is called', async () => {
    render(
      <SpotlightProvider>
        <TestComponent />
      </SpotlightProvider>
    );

    expect(screen.getByTestId('current-step').textContent).toBe('0');
    expect(screen.getByTestId('step-title').textContent).toBe('Start Here');

    await act(async () => {
      screen.getByTestId('next-btn').click();
    });

    expect(screen.getByTestId('current-step').textContent).toBe('1');
    expect(screen.getByTestId('step-title').textContent).toBe('Switch Sessions');
  });

  it('should hide spotlight when skipped', async () => {
    render(
      <SpotlightProvider>
        <TestComponent />
      </SpotlightProvider>
    );

    expect(screen.getByTestId('visible').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('skip-btn').click();
    });

    expect(screen.getByTestId('visible').textContent).toBe('false');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('should complete spotlight when all steps are done', async () => {
    render(
      <SpotlightProvider>
        <TestComponent />
      </SpotlightProvider>
    );

    // Click through all 6 steps
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        screen.getByTestId('next-btn').click();
      });
    }

    expect(screen.getByTestId('visible').textContent).toBe('false');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });
});
