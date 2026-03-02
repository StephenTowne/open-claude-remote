interface ScrollButtonsProps {
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  showButtons: boolean;
  isAtBottom: boolean;
  bottomOffset?: number;
}

const buttonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
};

export function ScrollButtons({
  onScrollToTop,
  onScrollToBottom,
  showButtons,
  isAtBottom,
  bottomOffset = 60,
}: ScrollButtonsProps) {
  return (
    <div style={{
      position: 'absolute',
      right: 12,
      bottom: bottomOffset,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      opacity: showButtons ? 1 : 0,
      transition: 'opacity 0.2s ease',
      pointerEvents: showButtons ? 'auto' : 'none',
      zIndex: 100,
    }}>
      <button
        onClick={onScrollToTop}
        aria-label="滚动到顶部"
        style={buttonStyle}
      >
        ↑
      </button>
      <button
        onClick={onScrollToBottom}
        aria-label="滚动到底部"
        style={{
          ...buttonStyle,
          opacity: isAtBottom ? 0.5 : 1,
        }}
        disabled={isAtBottom}
      >
        ↓
      </button>
    </div>
  );
}