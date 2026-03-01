import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InputBar } from '../../src/components/input/InputBar.js';
import type { InputBarRef } from '../../src/components/input/InputBar.js';
import { createRef } from 'react';

describe('InputBar', () => {
  it('should call onSend with text on Send button click', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    fireEvent.change(screen.getByPlaceholderText('输入命令或数字选择...'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByText('Send'));

    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('should call onSend with text on Enter key', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText('输入命令或数字选择...');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('should call onSend with empty string when input is empty (empty submit)', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    // Click the Enter button (shown as ↵ when empty)
    fireEvent.click(screen.getByText('↵'));
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('should call onSend with empty string on Enter key when input is empty', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText('输入命令或数字选择...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('should clear input after send', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText('输入命令或数字选择...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Send'));

    expect(input.value).toBe('');
  });

  it('should show ↵ button when input is empty and Send when not', () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    // Empty state: should show ↵
    expect(screen.getByText('↵')).toBeDefined();

    // Type something: should show Send
    const input = screen.getByPlaceholderText('输入命令或数字选择...');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByText('Send')).toBeDefined();
  });

  describe('ref API', () => {
    it('should expose setText via ref', () => {
      const onSend = vi.fn();
      const ref = createRef<InputBarRef>();
      render(<InputBar ref={ref} onSend={onSend} />);

      // 初始输入框为空
      const input = screen.getByPlaceholderText('输入命令或数字选择...') as HTMLInputElement;
      expect(input.value).toBe('');

      // 通过 ref 设置文本（需要使用 act 包裹状态更新）
      act(() => {
        ref.current?.setText('/help ');
      });
      expect(input.value).toBe('/help ');
    });

    it('should expose focus via ref', () => {
      const onSend = vi.fn();
      const ref = createRef<InputBarRef>();
      render(<InputBar ref={ref} onSend={onSend} />);

      const input = screen.getByPlaceholderText('输入命令或数字选择...') as HTMLInputElement;

      // 先让输入框失去焦点
      input.blur();
      expect(document.activeElement).not.toBe(input);

      // 通过 ref 聚焦
      ref.current?.focus();
      expect(document.activeElement).toBe(input);
    });

    it('setText should also focus the input', () => {
      const onSend = vi.fn();
      const ref = createRef<InputBarRef>();
      render(<InputBar ref={ref} onSend={onSend} />);

      const input = screen.getByPlaceholderText('输入命令或数字选择...') as HTMLInputElement;

      // 先让输入框失去焦点
      input.blur();
      expect(document.activeElement).not.toBe(input);

      // setText 同时聚焦（需要使用 act 包裹状态更新）
      act(() => {
        ref.current?.setText('/clear ');
      });
      expect(input.value).toBe('/clear ');
      expect(document.activeElement).toBe(input);
    });
  });
});
