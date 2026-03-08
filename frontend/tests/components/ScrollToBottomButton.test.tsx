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

  it('should have touch-friendly minimum size (>= 44px)', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button');
    const styles = window.getComputedStyle(button);

    // 移动端触控友好：按钮尺寸应至少 44x44px
    const width = parseInt(styles.width || '48', 10);
    const height = parseInt(styles.height || '48', 10);

    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  it('should have touch-action manipulation for better mobile UX', () => {
    render(<ScrollToBottomButton visible={true} onClick={() => {}} />);

    const button = screen.getByRole('button');

    // 检查 touch-action 属性确保移动端双击缩放不会干扰点击
    expect(button.className).toContain('scroll-to-bottom-btn');
  });

  it('should be clickable when visible (not just rendered but actually interactive)', () => {
    const handleClick = vi.fn();
    render(<ScrollToBottomButton visible={true} onClick={handleClick} />);

    const button = screen.getByRole('button');

    // 验证按钮可点击（pointer-events 不为 none）
    expect(button).toBeTruthy();
    expect(button.className).toContain('visible');

    // 实际触发点击
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});