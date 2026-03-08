import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemShellProps {
  id: string;
  enabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
  /** 额外的操作按钮（如 auto-send 切换） */
  extraAction?: ReactNode;
  /** 移到最前 */
  onMoveToFirst?: () => void;
  /** 移到最后 */
  onMoveToLast?: () => void;
}

/**
 * 可排序列表项的外壳组件
 * 提供：拖拽手柄 | toggle 开关 | {children} | 额外操作 | 删除按钮
 */
export function SortableItemShell({
  id,
  enabled,
  onToggle,
  onDelete,
  children,
  extraAction,
  onMoveToFirst,
  onMoveToLast,
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
        borderRadius: 8,
        background: 'var(--bg-tertiary)',
        overflow: 'hidden',
      }}
    >
      {/* 主行：水平布局 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        minHeight: 'var(--min-touch-target, 44px)',
        overflow: 'hidden',
      }}>
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
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
          aria-label={enabled ? 'Enabled, click to disable' : 'Disabled, click to enable'}
          onClick={onToggle}
          style={{
            width: 32,
            height: 20,
            borderRadius: 10,
            border: 'none',
            background: enabled ? 'var(--status-running)' : 'var(--bg-primary)',
            cursor: 'pointer',
            position: 'relative' as const,
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute' as const,
            top: 2,
            left: enabled ? 14 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s ease',
          }} />
        </button>

        {/* 中间内容（由调用者提供） */}
        {children}

        {/* 额外操作按钮 */}
        {extraAction}

        {/* 移到首尾按钮 */}
        {(onMoveToFirst || onMoveToLast) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}>
            {onMoveToFirst && (
              <button
                aria-label="Move to first"
                onClick={onMoveToFirst}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⤒
              </button>
            )}
            {onMoveToLast && (
              <button
                aria-label="Move to last"
                onClick={onMoveToLast}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⤓
              </button>
            )}
          </div>
        )}

        {/* 删除按钮 */}
        <button
          aria-label="Delete"
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
    </div>
  );
}