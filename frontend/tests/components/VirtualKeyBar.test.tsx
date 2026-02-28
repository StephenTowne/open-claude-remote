import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualKeyBar } from '../../src/components/input/VirtualKeyBar.js';

describe('VirtualKeyBar', () => {
  it('should render all virtual keys', () => {
    render(<VirtualKeyBar onKeyPress={() => {}} />);

    expect(screen.getByText('Esc')).toBeDefined();
    expect(screen.getByText('Tab')).toBeDefined();
    expect(screen.getByText('↑')).toBeDefined();
    expect(screen.getByText('↓')).toBeDefined();
    expect(screen.getByText('←')).toBeDefined();
    expect(screen.getByText('→')).toBeDefined();
    expect(screen.getByText('^C')).toBeDefined();
  });

  it('should send ESC sequence when Esc is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('Esc'));
    expect(onKeyPress).toHaveBeenCalledWith('\x1b');
  });

  it('should send Tab sequence when Tab is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('Tab'));
    expect(onKeyPress).toHaveBeenCalledWith('\t');
  });

  it('should send arrow up sequence when ↑ is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('↑'));
    expect(onKeyPress).toHaveBeenCalledWith('\x1b[A');
  });

  it('should send arrow down sequence when ↓ is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('↓'));
    expect(onKeyPress).toHaveBeenCalledWith('\x1b[B');
  });

  it('should send arrow left sequence when ← is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('←'));
    expect(onKeyPress).toHaveBeenCalledWith('\x1b[D');
  });

  it('should send arrow right sequence when → is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('→'));
    expect(onKeyPress).toHaveBeenCalledWith('\x1b[C');
  });

  it('should send Ctrl+C sequence when ^C is pressed', () => {
    const onKeyPress = vi.fn();
    render(<VirtualKeyBar onKeyPress={onKeyPress} />);

    fireEvent.click(screen.getByText('^C'));
    expect(onKeyPress).toHaveBeenCalledWith('\x03');
  });

  it('should not render when visible is false', () => {
    render(<VirtualKeyBar onKeyPress={() => {}} visible={false} />);

    expect(screen.queryByTestId('virtual-key-bar')).toBeNull();
    expect(screen.queryByText('Esc')).toBeNull();
  });
});
