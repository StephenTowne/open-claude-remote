import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollToBottomButton } from '../../src/components/terminal/ScrollToBottomButton.js';

describe('ScrollToBottomButton', () => {
  it('should not render when visible is false', () => {
    const { container } = render(<ScrollToBottomButton visible={false} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when visible is true', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button', { name: '跳转到最新输出' });
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
    expect(button.getAttribute('aria-label')).toBe('跳转到最新输出');
  });

  it('should apply visible class when visible is true', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('visible');
  });

  it('should remove from DOM after fade-out animation ends', () => {
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

    // Simulate animation end
    fireEvent.animationEnd(button!);

    // Button should be removed from DOM
    expect(container.querySelector('.scroll-to-bottom-btn')).toBeNull();
  });
});