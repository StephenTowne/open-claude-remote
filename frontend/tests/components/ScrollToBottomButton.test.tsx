import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ScrollToBottomButton } from '../../src/components/terminal/ScrollToBottomButton.js';

describe('ScrollToBottomButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('should not render when visible is false', () => {
    const { container } = render(<ScrollToBottomButton visible={false} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when visible is true', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button', { name: 'Jump to latest output' });
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('↓');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ScrollToBottomButton visible={true} onClick={handleClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have correct accessibility attributes', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Jump to latest output');
  });

  it('should apply visible class when visible is true', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('visible');
  });

  it('should remove from DOM after fade-out animation ends', async () => {
    const { rerender, container } = render(
      <ScrollToBottomButton visible={true} onClick={() => {}} />
    );

    // Button should be rendered
    expect(screen.getByRole('button')).toBeTruthy();

    // Set visible to false → fade-out starts
    rerender(<ScrollToBottomButton visible={false} onClick={() => {}} />);

    // Button still in DOM (fade-out in progress), with hidden class
    const button = container.querySelector('.scroll-to-bottom-btn');
    expect(button).toBeTruthy();
    expect(button!.className).toContain('hidden');

    // Simulate animation end event
    // In jsdom@28, we need to dispatch the event on the actual DOM element
    act(() => {
      button!.dispatchEvent(new Event('animationend', { bubbles: true }));
    });

    // Button should be removed from DOM
    expect(container.querySelector('.scroll-to-bottom-btn')).toBeNull();
  });
});