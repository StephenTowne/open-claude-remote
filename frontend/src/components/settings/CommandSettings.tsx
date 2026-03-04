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
import type { ConfigurableCommand } from '../../config/commands.js';
import { generateId } from '../../utils/id.js';
import type { WithId } from './SettingsModal.js';
import { SortableItemShell } from './SortableItemShell.js';
import { useDndSensors } from './useDndSensors.js';

/** 按 enabled 状态排序：启用的在前，禁用的在后（稳定排序保持相对顺序） */
const sortByEnabled = <T extends { enabled: boolean }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(b.enabled) - Number(a.enabled));

interface CommandSettingsProps {
  commands: WithId<ConfigurableCommand>[];
  onChange: (commands: WithId<ConfigurableCommand>[]) => void;
}

export function CommandSettings({ commands, onChange }: CommandSettingsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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

  const toggleAutoSend = (index: number) => {
    const newCommands = [...commands];
    newCommands[index] = {
      ...newCommands[index],
      autoSend: !(newCommands[index].autoSend ?? true),
    };
    onChange(newCommands);
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(prev => prev === index ? null : index);
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
    // 如果删除的是展开的项，关闭展开状态
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      // 如果删除的项在展开项之前，更新展开项索引
      setExpandedIndex(expandedIndex - 1);
    }
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

      // 更新展开状态索引
      if (expandedIndex !== null) {
        if (expandedIndex === oldIndex) {
          setExpandedIndex(newIndex);
        } else if (oldIndex < expandedIndex && newIndex >= expandedIndex) {
          setExpandedIndex(expandedIndex - 1);
        } else if (oldIndex > expandedIndex && newIndex <= expandedIndex) {
          setExpandedIndex(expandedIndex + 1);
        }
      }
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
              isExpandable={true}
              isExpanded={expandedIndex === index}
              onToggleExpand={() => toggleExpand(index)}
              detailContent={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    role="switch"
                    aria-checked={cmd.autoSend ?? true}
                    aria-label={(cmd.autoSend ?? true) ? 'Auto-send is on, click to turn off' : 'Auto-send is off, click to turn on'}
                    onClick={() => toggleAutoSend(index)}
                    style={{
                      width: 36,
                      height: 22,
                      borderRadius: 11,
                      border: 'none',
                      background: (cmd.autoSend ?? true) ? 'var(--status-running)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      position: 'relative' as const,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute' as const,
                      top: 2,
                      left: (cmd.autoSend ?? true) ? 16 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.15s ease',
                    }} />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Auto-send on click
                  </span>
                </div>
              }
            >
              {/* 命令输入/显示 */}
              {editingIndex === index ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(index);
                    if (e.key === 'Escape') {
                      // 取消编辑
                      setEditValue('');
                      saveEdit(-1); // -1 表示取消
                    }
                  }}
                  onBlur={() => saveEdit(index)}
                  placeholder="Enter command…"
                  aria-label={`Command ${index + 1}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '2px solid var(--status-running)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
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