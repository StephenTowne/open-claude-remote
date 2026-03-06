import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { mergeTextareaStyle } from '../../styles/input.js';

export interface InputBarRef {
  setText: (text: string) => void;
  focus: () => void;
}

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  isKeyboardOpen?: boolean;
}

export const InputBar = forwardRef<InputBarRef, InputBarProps>(
  function InputBar({ onSend, disabled, isKeyboardOpen }, ref) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
    },
    focus: () => textareaRef.current?.focus(),
  }), []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div data-testid="input-bar" style={{
      height: 'var(--inputbar-height)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      // 键盘弹出时移除 safe-bottom padding，避免在华为手机上产生空白
      paddingBottom: isKeyboardOpen ? '8px' : 'calc(8px + var(--safe-bottom))',
      // 添加过渡动画，与页面 transform 同步
      transition: 'padding-bottom 0.25s ease-out',
      gap: 8,
      flexShrink: 0,
    }}>
      <textarea
        ref={textareaRef}
        data-testid="command-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        rows={1}
        placeholder="Enter command or number to select…"
        aria-label="Command input"
        style={mergeTextareaStyle({
          flex: 1,
          height: 40,
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          fontSize: 16,
          fontFamily: 'inherit',
        })}
      />
    </div>
  );
});
