import type { CSSProperties } from 'react';
import { useUserConfig } from '../../hooks/useUserConfig.js';

interface CommandPickerProps {
  onShortcut: (data: string) => void;         // 快捷键点击回调
  onCommandSelect: (command: string) => void; // 命令点击回调
  visible?: boolean;
}

const baseButtonStyle: CSSProperties = {
  height: 36,
  borderRadius: 6,
  border: 'none',
  background: 'var(--bg-tertiary)',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, transform 0.1s',
};

const shortcutButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  minWidth: 44,
  flexShrink: 0,  // 防止按钮被压缩，支持横向滚动
  color: 'var(--text-primary)',
  fontSize: 13,
  padding: '0 12px',
};

const commandButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  minWidth: 60,
  flexShrink: 0,  // 防止按钮被压缩，保持文字完整
  color: 'var(--text-secondary)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  padding: '0 12px',
};

/**
 * 阻止按钮获得焦点并触发回调
 * 用于移动端防止点击按钮时唤起软键盘
 */
function handleButtonClick<T>(
  e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>,
  callback: (data: T) => void,
  data: T
) {
  // 阻止默认行为
  e.preventDefault();

  // 让当前页面所有获得焦点的元素失去焦点（特别是输入框）
  // 这样可以确保移动端软键盘收起
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  callback(data);
}

/**
 * 命令选择器组件
 * - 快捷键行：点击直接发送 ANSI 控制字符
 * - 命令行：点击填入输入框 + 空格
 *
 * 配置从 ~/.claude-remote/config.json 加载
 */
export function CommandPicker({ onShortcut, onCommandSelect, visible = true }: CommandPickerProps) {
  const { shortcuts, commands, isLoading } = useUserConfig();

  if (!visible || isLoading) {
    return null;
  }

  return (
    <div data-testid="command-picker" style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      flexShrink: 0,
    }}>
      {/* 快捷键行 - 支持横向滚动 */}
      <div data-scrollable style={{
        height: 'var(--keybar-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {shortcuts.map((key) => (
          <button
            key={key.label}
            type="button"
            className="cmd-picker-btn"
            onClick={(e) => handleButtonClick(e, onShortcut, key.data)}
            style={shortcutButtonStyle}
            onMouseDown={(e) => e.preventDefault()}
          >
            {key.label}
          </button>
        ))}
      </div>

      {/* 命令行 - 支持横向滚动 */}
      <div data-scrollable style={{
        height: 'var(--keybar-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {commands.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            className="cmd-picker-btn"
            onClick={(e) => handleButtonClick(e, onCommandSelect, cmd.command + ' ')}
            style={commandButtonStyle}
            onMouseDown={(e) => e.preventDefault()}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <style>{`
        [data-scrollable]::-webkit-scrollbar {
          display: none;
        }
        .cmd-picker-btn:hover {
          filter: brightness(1.2);
        }
        .cmd-picker-btn:active {
          transform: scale(0.95);
          filter: brightness(0.9);
        }
      `}</style>
    </div>
  );
}