import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemShellProps {
  id: string;
  enabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
}

/**
 * 可排序列表项的外壳组件
 * 提供：拖拽手柄 | toggle 开关 | {children} | 删除按钮
 */
export function SortableItemShell({
  id,
  enabled,
  onToggle,
  onDelete,
  children,
}: SortableItemShellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        background: 'var(--bg-tertiary)',
        minHeight: 'var(--min-touch-target, 44px)',
      }}
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        aria-label="拖拽排序"
        style={{
          width: 24,
          color: 'var(--text-muted)',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        ⋮⋮
      </div>

      {/* 启用开关 */}
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? '已启用，点击禁用' : '已禁用，点击启用'}
        onClick={onToggle}
        style={{
          width: 32,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: enabled ? 'var(--status-running)' : 'var(--bg-primary)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: enabled ? 14 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
        }} />
      </button>

      {/* 中间内容（由调用者提供） */}
      {children}

      {/* 删除按钮 */}
      <button
        aria-label="删除"
        onClick={onDelete}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
