import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFocusInput?: () => void;
}

export function TerminalView({ containerRef, onFocusInput }: TerminalViewProps) {
  const handleClick = () => {
    onFocusInput?.();
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    />
  );
}
