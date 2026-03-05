interface ToggleProps {
  /** 是否开启 */
  checked: boolean;
  /** 切换回调 */
  onChange: (checked: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 无障碍标签 */
  'aria-label'?: string;
}

/**
 * Toggle 开关组件
 * - 移动端友好：最小点击区域 44px
 * - 支持无障碍访问
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--status-running)' : 'var(--bg-tertiary)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms ease-out',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          transition: 'left 150ms ease-out',
        }}
      />
    </button>
  );
}