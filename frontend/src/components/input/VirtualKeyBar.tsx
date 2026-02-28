interface VirtualKeyBarProps {
  onKeyPress: (data: string) => void;
}

const KEYS = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: '↑', data: '\x1b[A' },
  { label: '↓', data: '\x1b[B' },
  { label: '←', data: '\x1b[D' },
  { label: '→', data: '\x1b[C' },
  { label: '^C', data: '\x03' },
] as const;

export function VirtualKeyBar({ onKeyPress }: VirtualKeyBarProps) {
  return (
    <div style={{
      height: 'var(--keybar-height)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '6px 12px',
      gap: 6,
      flexShrink: 0,
    }}>
      {KEYS.map((key) => (
        <button
          key={key.label}
          onClick={() => onKeyPress(key.data)}
          style={{
            minWidth: 44,
            height: 36,
            borderRadius: 6,
            border: 'none',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            transition: 'background 0.1s, transform 0.1s',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
