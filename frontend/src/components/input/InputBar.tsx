import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';

export interface InputBarRef {
  setText: (text: string) => void;
  focus: () => void;
}

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const InputBar = forwardRef<InputBarRef, InputBarProps>(
  function InputBar({ onSend, disabled }, ref) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
      inputRef.current?.focus();
    },
    focus: () => inputRef.current?.focus(),
  }), []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }, [text, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const hasText = text.trim().length > 0;

  return (
    <div style={{
      height: 'var(--inputbar-height)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      paddingBottom: 'calc(8px + var(--safe-bottom))',
      gap: 8,
      flexShrink: 0,
    }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="输入命令或数字选择..."
        style={{
          flex: 1,
          height: 40,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          fontSize: 16,
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled}
        style={{
          minWidth: 'var(--min-touch-target)',
          height: 'var(--min-touch-target)',
          borderRadius: 8,
          background: hasText ? 'var(--status-running)' : 'var(--bg-tertiary)',
          color: hasText ? '#fff' : 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: hasText ? 14 : 20,
          transition: 'background 0.15s',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {hasText ? 'Send' : '↵'}
      </button>
    </div>
  );
});
