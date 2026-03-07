import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import { useAppStore } from '../../stores/app-store.js';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ConfigurableCommand } from '../../config/commands.js';
import { generateId } from '../../utils/id.js';
import type { WithId } from './SettingsModal.js';
import { SortableItemShell } from './SortableItemShell.js';
import { useDndSensors } from './useDndSensors.js';
import { mergeTextareaStyle } from '../../styles/input.js';

/** 按 enabled 状态排序：启用的在前，禁用的在后（稳定排序保持相对顺序） */
const sortByEnabled = <T extends { enabled: boolean }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(b.enabled) - Number(a.enabled));

/**
 * Auto-send 图标按钮
 * 显示当前状态，点击切换
 */
function AutoSendButton({
  autoSend,
  onToggle,
}: {
  autoSend: boolean;
  onToggle: () => void;
}) {
  const isAutoSend = autoSend ?? true;
  return (
    <button
      onClick={onToggle}
      aria-label={isAutoSend ? 'Auto-send is on. Click to edit in input box instead.' : 'Auto-send is off. Click to send directly.'}
      title={isAutoSend ? 'Auto-send on click' : 'Edit in input box'}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 6,
        border: 'none',
        background: isAutoSend ? 'var(--status-running)' : 'var(--bg-primary)',
        color: isAutoSend ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isAutoSend ? '↗' : '✎'}
    </button>
  );
}

interface CommandSettingsProps {
  commands: WithId<ConfigurableCommand>[];
  onChange: (commands: WithId<ConfigurableCommand>[]) => void;
}

export function CommandSettings({ commands, onChange }: CommandSettingsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const sensors = useDndSensors();

  const startEdit = (index: number) => {
    setEditingIndex(index);
    // 编辑时显示实际命令（去掉 / 前缀以便编辑）
    setEditValue(commands[index].command);
  };

  const saveEdit = (index: number) => {
    // 取消编辑
    if (index < 0) {
      setEditingIndex(null);
      setEditValue('');
      return;
    }

    let value = editValue.trim();
    if (!value) {
      // 空值直接删除
      deleteCommand(index);
      return;
    }

    // 自动补足 / 前缀
    if (!value.startsWith('/')) {
      value = '/' + value;
    }

    const newCommands = [...commands];
    // label 默认为命令本身
    newCommands[index] = {
      ...newCommands[index],
      label: value,
      command: value,
    };
    onChange(newCommands);
    setEditingIndex(null);
    setEditValue('');
  };

  const toggleEnabled = (index: number) => {
    const newCommands = [...commands];
    newCommands[index] = {
      ...newCommands[index],
      enabled: !newCommands[index].enabled,
    };
    onChange(sortByEnabled(newCommands));
  };

  const showToast = useAppStore((s) => s.showToast);

  const toggleAutoSend = (index: number) => {
    const newAutoSendValue = !(commands[index].autoSend ?? true);
    const newCommands = [...commands];
    newCommands[index] = {
      ...newCommands[index],
      autoSend: newAutoSendValue,
    };
    onChange(newCommands);
    // 显示 Toast 反馈
    showToast(newAutoSendValue ? '点击命令直接发送' : '点击后在输入框编辑');
  };

  const addCommand = () => {
    // 新项添加到列表开头，enabled: true，autoSend: true（默认），排序后自然在最前面
    const newCommands: WithId<ConfigurableCommand>[] = [{ label: '/new', command: '/new', enabled: true, autoSend: true, _id: generateId() }, ...commands];
    onChange(sortByEnabled(newCommands));
    // 自动开始编辑新添加的项（索引 0）
    setEditingIndex(0);
    setEditValue('/new');
  };

  const deleteCommand = (index: number) => {
    const newCommands = commands.filter((_, i) => i !== index);
    onChange(newCommands);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = commands.findIndex((c) => c._id === active.id);
      const newIndex = commands.findIndex((c) => c._id === over.id);

      const newCommands = [...commands];
      const [removed] = newCommands.splice(oldIndex, 1);
      newCommands.splice(newIndex, 0, removed);
      onChange(newCommands);
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
          Commands
        </span>
        <button
          onClick={addCommand}
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
          + Add
        </button>
      </div>

      {commands.length === 0 && (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          No commands yet. Click the button above to add one.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={commands.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {commands.map((cmd, index) => (
            <SortableItemShell
              key={cmd._id}
              id={cmd._id}
              enabled={cmd.enabled}
              onToggle={() => toggleEnabled(index)}
              onDelete={() => deleteCommand(index)}
              extraAction={
                <AutoSendButton
                  autoSend={cmd.autoSend ?? true}
                  onToggle={() => toggleAutoSend(index)}
                />
              }
            >
              {/* 命令输入/显示 */}
              {editingIndex === index ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEdit(index);
                    }
                    if (e.key === 'Escape') {
                      // 取消编辑
                      setEditValue('');
                      saveEdit(-1); // -1 表示取消
                    }
                  }}
                  onBlur={() => saveEdit(index)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                  rows={1}
                  placeholder="Enter command…"
                  aria-label={`Command ${index + 1}`}
                  style={mergeTextareaStyle({
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    padding: '0 12px',
                    border: '2px solid var(--status-running)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    lineHeight: '36px',
                  })}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(index)}
                  aria-label={`Edit command ${cmd.label}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cmd.label}
                </button>
              )}
            </SortableItemShell>
          ))}
        </SortableContext>
      </DndContext>

      <div style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        marginTop: 8,
      }}>
        Tip: Commands are auto-prefixed with / (e.g., help → /help)
      </div>
    </div>
  );
}