interface PromptSelectorProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function PromptSelector({ options, selectedIndex, onSelect }: PromptSelectorProps) {
  return (
    <div
      data-testid="prompt-selector"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 12px',
        maxHeight: 260,
        overflowY: 'auto',
      }}
    >
      <div style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        marginBottom: 2,
        letterSpacing: '0.03em',
      }}>
        ↑↓ 选择选项 · Enter 确认
      </div>
      {options.map((option, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <button
            key={`${idx}-${option}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(idx)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: isSelected
                ? '1px solid #58a6ff'
                : '1px solid var(--border-color)',
              background: isSelected
                ? 'rgba(88, 166, 255, 0.12)'
                : 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.1s, border-color 0.1s',
            }}
          >
            <span style={{
              color: isSelected ? '#58a6ff' : 'var(--text-secondary)',
              minWidth: 24,
              fontWeight: isSelected ? 600 : 400,
            }}>
              {isSelected ? '❯' : `${idx + 1}.`}
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
