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
import { useIsMobile } from '../../hooks/useIsMobile.js';

/**
 * ShortcutSettings 组件
 * 管理可配置的快捷键列表，支持拖拽排序、启用/禁用、按键捕获、删除
 * 移动端禁止新增快捷键（虚拟键盘无法输入组合键），但允许编辑已有快捷键
 */

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
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const sensors = useDndSensors();
  const isMobile = useIsMobile();

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const result = keyEventToAnsi(e);
    if (result) {
      const newShortcuts = shortcuts.map((s) =>
        s._id === id ? { ...s, label: result.label, data: result.data } : s
      );
      onChange(newShortcuts);
      setCapturingId(null);
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
    if (isMobile) {
      setShowMobileWarning(true);
      setTimeout(() => setShowMobileWarning(false), 3000);
      return;
    }
    const newId = generateId();
    // 新项目添加到列表末尾，不再自动排序
    const newShortcuts = [
      ...shortcuts,
      { label: 'New', data: '', enabled: true, _id: newId },
    ];
    onChange(newShortcuts);
    // 自动开始捕获新添加的项
    setCapturingId(newId);
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

  const moveToFirst = (id: string) => {
    const index = shortcuts.findIndex((s) => s._id === id);
    if (index <= 0) return;
    const newShortcuts = [...shortcuts];
    const [removed] = newShortcuts.splice(index, 1);
    newShortcuts.unshift(removed);
    onChange(newShortcuts);
  };

  const moveToLast = (id: string) => {
    const index = shortcuts.findIndex((s) => s._id === id);
    if (index === -1 || index === shortcuts.length - 1) return;
    const newShortcuts = [...shortcuts];
    const [removed] = newShortcuts.splice(index, 1);
    newShortcuts.push(removed);
    onChange(newShortcuts);
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
          Shortcuts
        </span>
        <button
          onClick={addShortcut}
          disabled={isMobile}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: isMobile ? 'not-allowed' : 'pointer',
            opacity: isMobile ? 0.5 : 1,
          }}
        >
          + Add
        </button>
      </div>

      {/* 移动端提示 */}
      {isMobile && (
        <div style={{
          padding: '10px 12px',
          backgroundColor: 'var(--bg-warning, #fff8e6)',
          border: '1px solid var(--border-warning, #ffd666)',
          borderRadius: 6,
          fontSize: 13,
          color: 'var(--text-warning, #ad6800)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>移动端无法新增快捷键，请在PC端浏览器中添加</span>
        </div>
      )}

      {shortcuts.length === 0 && (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          No shortcuts yet. Click the button above to add one.
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
          {shortcuts.map((shortcut) => (
            <SortableItemShell
              key={shortcut._id}
              id={shortcut._id}
              enabled={shortcut.enabled}
              onToggle={() => {
                const index = shortcuts.findIndex((s) => s._id === shortcut._id);
                if (index !== -1) toggleEnabled(index);
              }}
              onDelete={() => {
                const index = shortcuts.findIndex((s) => s._id === shortcut._id);
                if (index !== -1) deleteShortcut(index);
              }}
              onMoveToFirst={() => moveToFirst(shortcut._id)}
              onMoveToLast={() => moveToLast(shortcut._id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {/* 按键捕获输入框 */}
                <input
                  type="text"
                  value={shortcut.label}
                  readOnly
                  autoComplete="off"
                  placeholder="Press key to capture"
                  onClick={() => setCapturingId(shortcut._id)}
                  onKeyDown={(e) => handleKeyDown(e, shortcut._id)}
                  onBlur={() => setCapturingId(null)}
                  aria-label={`Shortcut ${shortcut.label}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: capturingId === shortcut._id
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
                <span
                  title={shortcut.data
                    ? shortcut.data.replace(/\x1b/g, 'ESC').replace(/\r/g, 'CR').replace(/\t/g, 'TAB')
                    : '(not set)'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    width: 35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortcut.data
                    ? shortcut.data.replace(/\x1b/g, 'ESC').replace(/\r/g, 'CR').replace(/\t/g, 'TAB')
                    : '(not set)'}
                </span>
              </div>
            </SortableItemShell>
          ))}
        </SortableContext>
      </DndContext>

      {capturingId !== null && !isMobile && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: 4,
        }}>
          Press a key to capture…
        </div>
      )}

      {/* 移动端新增警告提示（临时显示） */}
      {showMobileWarning && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 20px',
          backgroundColor: 'var(--bg-secondary, #333)',
          color: 'var(--text-inverse, #fff)',
          borderRadius: 8,
          fontSize: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          animation: 'fadeInOut 3s ease',
        }}>
          请在PC端浏览器中新增快捷键
        </div>
      )}
    </div>
  );
}
