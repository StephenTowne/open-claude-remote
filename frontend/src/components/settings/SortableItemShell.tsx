import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemShellProps {
  id: string;
  enabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
  /** 是否可展开 */
  isExpandable?: boolean;
  /** 是否已展开 */
  isExpanded?: boolean;
  /** 展开/收起切换回调 */
  onToggleExpand?: () => void;
  /** 展开后显示的详情内容 */
  detailContent?: ReactNode;
}

/**
 * 可排序列表项的外壳组件
 * 提供：拖拽手柄 | toggle 开关 | {children} | 展开按钮 | 删除按钮
 * 支持展开详情面板
 */
export function SortableItemShell({
  id,
  enabled,
  onToggle,
  onDelete,
  children,
  isExpandable,
  isExpanded,
  onToggleExpand,
  detailContent,
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

        {/* 展开按钮 */}
        {isExpandable && (
          <button
            aria-label={isExpanded ? '收起详情' : '展开详情'}
            aria-expanded={isExpanded}
            onClick={onToggleExpand}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s ease',
            }}>
              ▼
            </span>
          </button>
        )}

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

      {/* 详情面板（展开时显示） */}
      {isExpandable && isExpanded && (
        <div style={{
          padding: '8px 16px 12px 68px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          {detailContent}
        </div>
      )}
    </div>
  );
}