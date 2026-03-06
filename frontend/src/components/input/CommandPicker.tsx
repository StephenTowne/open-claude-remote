import type { CSSProperties } from 'react';
import { useUserConfig } from '../../hooks/useUserConfig.js';

interface CommandPickerProps {
  onShortcut: (data: string) => void;         // 快捷键点击回调
  onCommandSelect: (command: string) => void; // 命令点击回调（填入输入框）
  onCommandSend: (command: string) => void;   // 命令点击回调（直接发送）
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
 * 在 touchstart/mousedown 时立即让输入框失焦
 * 用于移动端防止点击按钮时唤起软键盘
 */
function handleButtonTouchStart() {
  // 立即 blur 当前焦点元素（移动端输入框）
  // 这比在 onClick 中 blur 更早，可以避免焦点恢复问题
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/**
 * 处理按钮点击并确保焦点不会恢复到输入框
 */
function handleButtonClick<T>(
  e: React.MouseEvent<HTMLButtonElement>,
  callback: (data: T) => void,
  data: T
) {
  // 阻止默认行为
  e.preventDefault();

  // 再次确保失焦
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  callback(data);

  // 多重保险：防止某些移动端浏览器在点击后恢复焦点
  const ensureBlur = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  requestAnimationFrame(ensureBlur);
  setTimeout(ensureBlur, 0);
}

/**
 * 命令选择器组件
 * - 快捷键行：点击直接发送 ANSI 控制字符
 * - 命令行：根据 autoSend 决定是直接发送还是填入输入框
 *
 * 配置从 ~/.claude-remote/config.json 加载
 */
export function CommandPicker({ onShortcut, onCommandSelect, onCommandSend, visible = true }: CommandPickerProps) {
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
      <div data-testid="shortcut-bar" data-scrollable style={{
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
            onTouchStart={handleButtonTouchStart}
            onMouseDown={(e) => {
              e.preventDefault();
              handleButtonTouchStart();
            }}
            style={shortcutButtonStyle}
          >
            {key.label}
          </button>
        ))}
      </div>

      {/* 命令行 - 支持横向滚动 */}
      <div data-testid="command-buttons" data-scrollable style={{
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
        {commands.map((cmd) => {
          const shouldAutoSend = cmd.autoSend ?? true;
          return (
            <button
              key={cmd.label}
              type="button"
              className="cmd-picker-btn"
              onClick={(e) => {
                if (shouldAutoSend) {
                  handleButtonClick(e, onCommandSend, cmd.command);
                } else {
                  handleButtonClick(e, onCommandSelect, cmd.command + ' ');
                }
              }}
              onTouchStart={handleButtonTouchStart}
              onMouseDown={(e) => {
                e.preventDefault();
                handleButtonTouchStart();
              }}
              style={commandButtonStyle}
            >
              {cmd.label}
            </button>
          );
        })}
      </div>

      <style>{`
        [data-scrollable]::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: no-preference) {
          .cmd-picker-btn:hover {
            filter: brightness(1.2);
          }
          .cmd-picker-btn:active {
            transform: scale(0.95);
            filter: brightness(0.9);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cmd-picker-btn:hover {
            filter: brightness(1.2);
          }
          .cmd-picker-btn:active {
            filter: brightness(0.9);
          }
        }
      `}</style>
    </div>
  );
}