import { useState } from 'react';
import type { ConfigurableShortcut } from '../../config/commands.js';
import type { WithId } from './SettingsModal.js';

interface ShortcutSettingsProps {
  shortcuts: WithId<ConfigurableShortcut>[];
  onChange: (shortcuts: WithId<ConfigurableShortcut>[]) => void;
}

/**
 * 将按键事件转换为 ANSI 序列和友好标签
 */
function keyEventToAnsi(e: React.KeyboardEvent): { label: string; data: string } | null {
  // 忽略单独的修饰键
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return null;
  }

  let label = '';
  let data = '';

  // 组合键: Ctrl+X, Alt+X 等
  if (e.ctrlKey || e.altKey || e.metaKey) {
    const key = e.key.toUpperCase();
    const modifier = e.ctrlKey ? 'Ctrl' : e.altKey ? 'Alt' : 'Meta';

    if (e.key.length === 1) {
      label = `${modifier}+${key}`;
      // Ctrl+字母 -> ASCII 控制字符 (A=1, B=2, ..., Z=26)
      if (e.ctrlKey) {
        data = String.fromCharCode(e.key.toUpperCase().charCodeAt(0) - 64);
      } else {
        // Alt/Meta 组合键暂时不支持
        return null;
      }
    } else {
      return null;
    }
  }
  // 方向键
  else if (e.key.startsWith('Arrow')) {
    const arrowMap: Record<string, { label: string; code: string }> = {
      ArrowUp: { label: '↑', code: 'A' },
      ArrowDown: { label: '↓', code: 'B' },
      ArrowRight: { label: '→', code: 'C' },
      ArrowLeft: { label: '←', code: 'D' },
    };
    const mapping = arrowMap[e.key];
    if (mapping) {
      label = mapping.label;
      data = `\x1b[${mapping.code}`;
    } else {
      return null;
    }
  }
  // 特殊按键
  else if (e.key === 'Escape') {
    label = 'Esc';
    data = '\x1b';
  } else if (e.key === 'Enter') {
    label = 'Enter';
    data = '\r';
  } else if (e.key === 'Tab') {
    label = e.shiftKey ? 'Shift+Tab' : 'Tab';
    data = e.shiftKey ? '\x1b[Z' : '\t';
  } else if (e.key === 'Backspace') {
    label = 'Backspace';
    data = '\x7f';
  } else if (e.key === 'Delete') {
    label = 'Delete';
    data = '\x1b[3~';
  } else if (e.key === 'Home') {
    label = 'Home';
    data = '\x1b[H';
  } else if (e.key === 'End') {
    label = 'End';
    data = '\x1b[F';
  } else if (e.key === 'PageUp') {
    label = 'PageUp';
    data = '\x1b[5~';
  } else if (e.key === 'PageDown') {
    label = 'PageDown';
    data = '\x1b[6~';
  }
  // F1-F12 功能键（xterm 标准序列）
  else if (e.key.match(/^F([1-9]|1[0-2])$/)) {
    const fKeyMap: Record<string, string> = {
      F1: '\x1bOP', F2: '\x1bOQ', F3: '\x1bOR', F4: '\x1bOS',
      F5: '\x1b[15~', F6: '\x1b[17~', F7: '\x1b[18~', F8: '\x1b[19~',
      F9: '\x1b[20~', F10: '\x1b[21~', F11: '\x1b[23~', F12: '\x1b[24~',
    };
    label = e.key;
    data = fKeyMap[e.key] ?? '';
  }
  // 普通字符键
  else if (e.key.length === 1) {
    label = e.key.toUpperCase();
    data = e.key;
  } else {
    return null;
  }

  return { label, data };
}

export function ShortcutSettings({ shortcuts, onChange }: ShortcutSettingsProps) {
  const [capturingIndex, setCapturingIndex] = useState<number | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const result = keyEventToAnsi(e);
    if (result) {
      const newShortcuts = [...shortcuts];
      newShortcuts[index] = {
        ...newShortcuts[index],
        label: result.label,
        data: result.data,
      };
      onChange(newShortcuts);
      setCapturingIndex(null);
    }
  };

  const toggleEnabled = (index: number) => {
    const newShortcuts = [...shortcuts];
    newShortcuts[index] = {
      ...newShortcuts[index],
      enabled: !newShortcuts[index].enabled,
    };
    onChange(newShortcuts);
  };

  const addShortcut = () => {
    onChange([
      ...shortcuts,
      { label: 'New', data: '', enabled: true, _id: crypto.randomUUID() },
    ]);
  };

  const deleteShortcut = (index: number) => {
    const newShortcuts = shortcuts.filter((_, i) => i !== index);
    onChange(newShortcuts);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          快捷键
        </span>
        <button
          onClick={addShortcut}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          + 添加
        </button>
      </div>

      {shortcuts.length === 0 && (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          暂无快捷键，点击上方按钮添加
        </div>
      )}

      {shortcuts.map((shortcut, index) => (
        <div
          key={shortcut._id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
          }}
        >
          {/* 启用开关 */}
          <button
            onClick={() => toggleEnabled(index)}
            style={{
              width: 32,
              height: 20,
              borderRadius: 10,
              border: 'none',
              background: shortcut.enabled ? 'var(--status-running)' : 'var(--bg-primary)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 2,
              left: shortcut.enabled ? 14 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>

          {/* 按键捕获输入框 */}
          <input
            type="text"
            value={shortcut.label}
            readOnly
            placeholder="按键捕获"
            onClick={() => setCapturingIndex(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onBlur={() => setCapturingIndex(null)}
            style={{
              flex: 1,
              height: 32,
              padding: '0 8px',
              borderRadius: 4,
              border: capturingIndex === index
                ? '2px solid var(--status-running)'
                : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          />

          {/* ANSI 序列预览 */}
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            minWidth: 60,
          }}>
            {shortcut.data
              ? shortcut.data.replace(/\x1b/g, 'ESC').replace(/\r/g, 'CR').replace(/\t/g, 'TAB')
              : '(未设置)'}
          </span>

          {/* 删除按钮 */}
          <button
            onClick={() => deleteShortcut(index)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      ))}

      {capturingIndex !== null && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 4,
        }}>
          请按下要捕获的按键...
        </div>
      )}
    </div>
  );
}