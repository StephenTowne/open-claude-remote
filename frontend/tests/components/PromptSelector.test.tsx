import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptSelector } from '../../src/components/input/PromptSelector.js';

describe('PromptSelector', () => {
  const options = ['Option A', 'Option B', 'Option C'];

  it('should render all options', () => {
    render(<PromptSelector options={options} selectedIndex={0} onSelect={() => {}} />);

    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
    expect(screen.getByText('Option C')).toBeDefined();
  });

  it('should show ❯ on the currently selected option', () => {
    render(<PromptSelector options={options} selectedIndex={1} onSelect={() => {}} />);

    const buttons = screen.getAllByRole('button');
    // 第二个按钮（selectedIndex=1）应含有 ❯
    expect(buttons[1].textContent).toContain('❯');
    // 其他按钮应含有序号
    expect(buttons[0].textContent).toContain('1.');
    expect(buttons[2].textContent).toContain('3.');
  });

  it('should call onSelect with correct index when option is clicked', () => {
    const onSelect = vi.fn();
    render(<PromptSelector options={options} selectedIndex={0} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Option C'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('should call onSelect with 0 when first option is clicked', () => {
    const onSelect = vi.fn();
    render(<PromptSelector options={options} selectedIndex={2} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Option A'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('should render with data-testid for integration testing', () => {
    render(<PromptSelector options={options} selectedIndex={0} onSelect={() => {}} />);
    expect(screen.getByTestId('prompt-selector')).toBeDefined();
  });

  it('should render single option correctly', () => {
    const onSelect = vi.fn();
    render(<PromptSelector options={['Only option']} selectedIndex={0} onSelect={onSelect} />);

    expect(screen.getByText('Only option')).toBeDefined();
    fireEvent.click(screen.getByText('Only option'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
