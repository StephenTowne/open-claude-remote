import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Toggle } from '../../src/components/common/Toggle';

describe('Toggle', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render with checked state', () => {
    render(<Toggle checked={true} onChange={() => {}} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('should render with unchecked state', () => {
    render(<Toggle checked={false} onChange={() => {}} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('should call onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Toggle checked={false} onChange={handleChange} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('should not call onChange when disabled', () => {
    const handleChange = vi.fn();
    render(
      <Toggle checked={false} onChange={handleChange} disabled aria-label="Test toggle" />
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should have disabled attribute when disabled', () => {
    render(<Toggle checked={false} onChange={() => {}} disabled aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });

  it('should have correct aria-label', () => {
    render(<Toggle checked={false} onChange={() => {}} aria-label="Enable notifications" />);

    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-label')).toBe('Enable notifications');
  });

  it('should toggle from unchecked to checked', () => {
    const handleChange = vi.fn();
    render(<Toggle checked={false} onChange={handleChange} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('should toggle from checked to unchecked', () => {
    const handleChange = vi.fn();
    render(<Toggle checked={true} onChange={handleChange} aria-label="Test toggle" />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(handleChange).toHaveBeenCalledWith(false);
  });
});