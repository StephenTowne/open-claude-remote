import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputBar } from '../../src/components/input/InputBar.js';

describe('InputBar', () => {
  it('should call onSend with text + \\r\\r on Send button click', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    fireEvent.change(screen.getByPlaceholderText('Type a message...'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByText('Send'));

    // Claude Code TUI needs \r\r to submit: first \r ends the line,
    // second \r submits from the resulting empty line.
    expect(onSend).toHaveBeenCalledWith('hello\r\r');
  });

  it('should call onSend with text + \\r\\r on Enter key', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('hello\r\r');
  });

  it('should not call onSend when input is empty', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    fireEvent.click(screen.getByText('Send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should clear input after send', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    expect(input.value).toBe('');
  });
});
