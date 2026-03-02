import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScrollButtons } from '../../src/components/terminal/ScrollButtons.js';

describe('ScrollButtons', () => {
  const mockOnScrollToTop = vi.fn();
  const mockOnScrollToBottom = vi.fn();

  beforeEach(() => {
    mockOnScrollToTop.mockClear();
    mockOnScrollToBottom.mockClear();
  });

  it('渲染向上和向下滚动按钮', () => {
    render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
      />
    );

    expect(screen.getByLabelText('滚动到顶部')).toBeDefined();
    expect(screen.getByLabelText('滚动到底部')).toBeDefined();
  });

  it('showButtons=false 时隐藏按钮（opacity: 0）', () => {
    const { container } = render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={false}
        isAtBottom={false}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('0');
    expect(wrapper.style.pointerEvents).toBe('none');
  });

  it('showButtons=true 时显示按钮（opacity: 1）', () => {
    const { container } = render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('1');
    expect(wrapper.style.pointerEvents).toBe('auto');
  });

  it('点击向上按钮调用 onScrollToTop', () => {
    render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
      />
    );

    fireEvent.click(screen.getByLabelText('滚动到顶部'));
    expect(mockOnScrollToTop).toHaveBeenCalledTimes(1);
  });

  it('点击向下按钮调用 onScrollToBottom', () => {
    render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
      />
    );

    fireEvent.click(screen.getByLabelText('滚动到底部'));
    expect(mockOnScrollToBottom).toHaveBeenCalledTimes(1);
  });

  it('isAtBottom=true 时向下按钮禁用且半透明', () => {
    render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={true}
      />
    );

    const downButton = screen.getByLabelText('滚动到底部') as HTMLButtonElement;
    expect(downButton.disabled).toBe(true);
    expect(downButton.style.opacity).toBe('0.5');
  });

  it('默认 bottomOffset 为 60px', () => {
    const { container } = render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.bottom).toBe('60px');
  });

  it('可以自定义 bottomOffset', () => {
    const { container } = render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
        bottomOffset={156}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.bottom).toBe('156px');
  });

  it('bottomOffset=0 时 bottom 为 0px', () => {
    const { container } = render(
      <ScrollButtons
        onScrollToTop={mockOnScrollToTop}
        onScrollToBottom={mockOnScrollToBottom}
        showButtons={true}
        isAtBottom={false}
        bottomOffset={0}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.bottom).toBe('0px');
  });
});