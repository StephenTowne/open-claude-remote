import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ConfigurableShortcut } from '../../config/commands.js';
import { generateId } from '../../utils/id.js';
import type { WithId } from './SettingsModal.js';
import { SortableItemShell } from './SortableItemShell.js';
import { useDndSensors } from './useDndSensors.js';

/** 按 enabled 状态排序：启用的在前，禁用的在后（稳定排序保持相对顺序） */
const sortByEnabled = <T extends { enabled: boolean }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(b.enabled) - Number(a.enabled));

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
  const sensors = useDndSensors();

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
    onChange(sortByEnabled(newShortcuts));
  };

  const addShortcut = () => {
    // 新项添加到列表开头，enabled: true，排序后自然在最前面
    const newShortcuts = [
      { label: 'New', data: '', enabled: true, _id: generateId() },
      ...shortcuts,
    ];
    onChange(sortByEnabled(newShortcuts));
    // 自动开始捕获新添加的项（索引 0）
    setCapturingIndex(0);
  };

  const deleteShortcut = (index: number) => {
    const newShortcuts = shortcuts.filter((_, i) => i !== index);
    onChange(newShortcuts);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = shortcuts.findIndex((s) => s._id === active.id);
      const newIndex = shortcuts.findIndex((s) => s._id === over.id);

      const newShortcuts = [...shortcuts];
      const [removed] = newShortcuts.splice(oldIndex, 1);
      newShortcuts.splice(newIndex, 0, removed);
      onChange(newShortcuts);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 6,
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={shortcuts.map((s) => s._id)}
          strategy={verticalListSortingStrategy}
        >
          {shortcuts.map((shortcut, index) => (
            <SortableItemShell
              key={shortcut._id}
              id={shortcut._id}
              enabled={shortcut.enabled}
              onToggle={() => toggleEnabled(index)}
              onDelete={() => deleteShortcut(index)}
            >
              {/* 按键捕获输入框 */}
              <input
                type="text"
                value={shortcut.label}
                readOnly
                placeholder="按键捕获"
                onClick={() => setCapturingIndex(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onBlur={() => setCapturingIndex(null)}
                aria-label={`快捷键 ${index + 1}`}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: capturingIndex === index
                    ? '2px solid var(--status-running)'
                    : '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              />

              {/* ANSI 序列预览 */}
              <span style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                flexShrink: 0,
                marginLeft: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 80,
              }}>
                {shortcut.data
                  ? shortcut.data.replace(/\x1b/g, 'ESC').replace(/\r/g, 'CR').replace(/\t/g, 'TAB')
                  : '(未设置)'}
              </span>
            </SortableItemShell>
          ))}
        </SortableContext>
      </DndContext>

      {capturingIndex !== null && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 4,
        }}>
          请按下要捕获的按键…
        </div>
      )}
    </div>
  );
}
