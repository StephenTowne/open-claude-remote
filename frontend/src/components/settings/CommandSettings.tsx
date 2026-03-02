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
    onChange(newCommands);
  };

  const addCommand = () => {
    const newCommands: WithId<ConfigurableCommand>[] = [...commands, { label: '/new', command: '/new', enabled: true, _id: generateId() }];
    onChange(newCommands);
    // 自动开始编辑新添加的项
    setEditingIndex(newCommands.length - 1);
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
          命令
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
          + 添加
        </button>
      </div>

      {commands.length === 0 && (
        <div style={{
          padding: 16,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          暂无命令，点击上方按钮添加
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
                  placeholder="输入命令…"
                  aria-label={`命令 ${index + 1}`}
                  style={{
                    flex: 1,
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
                  aria-label={`编辑命令 ${cmd.label}`}
                  style={{
                    flex: 1,
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
        提示：命令会自动补足 / 前缀（如 help → /help）
      </div>
    </div>
  );
}
