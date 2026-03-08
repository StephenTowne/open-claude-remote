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

/**
 * CommandSettings 组件
 * 管理可配置的命令列表，支持拖拽排序、启用/禁用、编辑、删除
 */

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
      aria-label="Auto-send toggle"
      title="Auto-send toggle"
      style={{
        width: 32,
        height: 32,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const sensors = useDndSensors();

  const startEdit = (id: string) => {
    const cmd = commands.find((c) => c._id === id);
    if (!cmd) return;
    setEditingId(id);
    setEditValue(cmd.command);
  };

  const saveEdit = (id: string | null) => {
    // 取消编辑
    if (!id) {
      setEditingId(null);
      setEditValue('');
      return;
    }

    let value = editValue.trim();
    if (!value) {
      // 空值直接删除
      deleteCommand(id);
      return;
    }

    // 自动补足 / 前缀
    if (!value.startsWith('/')) {
      value = '/' + value;
    }

    const newCommands = commands.map((c) =>
      c._id === id ? { ...c, label: value, command: value } : c,
    );
    onChange(newCommands);
    setEditingId(null);
    setEditValue('');
  };

  const toggleEnabled = (id: string) => {
    const newCommands = commands.map((c) =>
      c._id === id ? { ...c, enabled: !c.enabled } : c,
    );
    onChange(newCommands);
  };

  const showToast = useAppStore((s) => s.showToast);

  const toggleAutoSend = (id: string) => {
    const cmd = commands.find((c) => c._id === id);
    if (!cmd) return;
    const newAutoSendValue = !(cmd.autoSend ?? true);
    const newCommands = commands.map((c) =>
      c._id === id ? { ...c, autoSend: newAutoSendValue } : c,
    );
    onChange(newCommands);
    showToast(newAutoSendValue ? 'Commands will auto-send on tap' : 'Commands will be inserted for editing');
  };

  const addCommand = () => {
    const newId = generateId();
    // 新项目添加到列表末尾，不再自动排序
    const newCommands: WithId<ConfigurableCommand>[] = [...commands, { label: '/new', command: '/new', enabled: true, autoSend: true, _id: newId }];
    onChange(newCommands);
    setEditingId(newId);
    setEditValue('/new');
  };

  const deleteCommand = (id: string) => {
    const newCommands = commands.filter((c) => c._id !== id);
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

  const moveToFirst = (id: string) => {
    const index = commands.findIndex((c) => c._id === id);
    if (index <= 0) return;
    const newCommands = [...commands];
    const [removed] = newCommands.splice(index, 1);
    newCommands.unshift(removed);
    onChange(newCommands);
  };

  const moveToLast = (id: string) => {
    const index = commands.findIndex((c) => c._id === id);
    if (index === -1 || index === commands.length - 1) return;
    const newCommands = [...commands];
    const [removed] = newCommands.splice(index, 1);
    newCommands.push(removed);
    onChange(newCommands);
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
          {commands.map((cmd) => (
            <SortableItemShell
              key={cmd._id}
              id={cmd._id}
              enabled={cmd.enabled}
              onToggle={() => toggleEnabled(cmd._id)}
              onDelete={() => deleteCommand(cmd._id)}
              onMoveToFirst={() => moveToFirst(cmd._id)}
              onMoveToLast={() => moveToLast(cmd._id)}
              extraAction={
                <AutoSendButton
                  autoSend={cmd.autoSend ?? true}
                  onToggle={() => toggleAutoSend(cmd._id)}
                />
              }
            >
              {/* 命令输入/显示 */}
              {editingId === cmd._id ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEdit(cmd._id);
                    }
                    if (e.key === 'Escape') {
                      setEditValue('');
                      saveEdit(null);
                    }
                  }}
                  onBlur={() => saveEdit(cmd._id)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                  rows={1}
                  placeholder="Enter command…"
                  aria-label={`Edit ${cmd.label}`}
                  style={mergeTextareaStyle({
                    flex: '1 1 180px',
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
                  onClick={() => startEdit(cmd._id)}
                  aria-label={`Edit command ${cmd.label}`}
                  style={{
                    flex: '1 1 180px',
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