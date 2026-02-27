import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function TerminalView({ containerRef }: TerminalViewProps) {
  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    />
  );
}
