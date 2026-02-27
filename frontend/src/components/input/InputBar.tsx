import { useState, useCallback, useRef } from 'react';

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed + '\n');
    setText('');
    inputRef.current?.focus();
  }, [text, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

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
        placeholder="Type a message..."
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
        disabled={disabled || !text.trim()}
        style={{
          minWidth: 'var(--min-touch-target)',
          height: 'var(--min-touch-target)',
          borderRadius: 8,
          background: text.trim() ? 'var(--status-running)' : 'var(--bg-tertiary)',
          color: text.trim() ? '#fff' : 'var(--text-muted)',
          fontWeight: 600,
          fontSize: 14,
          transition: 'background 0.15s',
        }}
      >
        Send
      </button>
    </div>
  );
}
