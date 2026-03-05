import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';

/**
 * 拖拽配置常量
 */
const DRAG_CLOSE_THRESHOLD = 100; // 拖拽超过此距离即关闭
const DRAG_CLOSE_VELOCITY = 300; // 拖拽速度阈值 (px/s)

/**
 * 选项数据结构
 */
export interface ActionSheetOption<T> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * ActionSheetSelect 组件 Props
 *
 * 注意：T 应为原始类型（string, number 等），因为选中状态使用 === 比较。
 * 若需支持对象类型，请传入 getDisplayLabel 并确保 value 引用稳定。
 */
export interface ActionSheetSelectProps<T> {
  options: ActionSheetOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  emptyMessage?: string;
  /** 触发器图标 */
  triggerIcon?: ReactNode;
  /** 自定义触发器显示文本（默认使用选中项的 label） */
  getDisplayLabel?: (value: T | null) => string;
}

// 检测用户是否偏好减少动效
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ANIMATION_DURATION = 300;

/**
 * 通用 ActionSheet 选择器组件
 *
 * 特性：
 * - 点击触发器后，从底部弹出选择面板
 * - 面板高度约 70vh，最大化可视区域
 * - 紧凑单行布局：label (description)
 * - 流畅的滑入/滑出动画
 * - 支持键盘导航
 * - 通用设计，支持任意选项类型
 */
export function ActionSheetSelect<T>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  id,
  emptyMessage = 'No options available',
  triggerIcon,
  getDisplayLabel,
}: ActionSheetSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);

  // 获取当前选中项
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  // 触发器显示文本
  const displayText = useMemo(() => {
    if (getDisplayLabel) {
      return getDisplayLabel(value);
    }
    return selectedOption?.label || placeholder;
  }, [getDisplayLabel, value, selectedOption, placeholder]);

  // 打开面板
  const handleOpen = useCallback(() => {
    if (disabled || options.length === 0) return;
    setIsOpen(true);
    setHighlightedIndex(-1);
  }, [disabled, options.length]);

  // 关闭面板
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setDragY(0);
    if (prefersReducedMotion) {
      setIsOpen(false);
    } else {
      setTimeout(() => setIsOpen(false), ANIMATION_DURATION);
    }
  }, []);

  // 拖拽开始
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartYRef.current = clientY;
    dragStartTimeRef.current = Date.now();
    setDragY(0);
  }, []);

  // 拖拽移动
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const deltaY = clientY - dragStartYRef.current;
    if (deltaY > 0) { // 只允许向下拖拽
      setDragY(deltaY);
    }
  }, [isDragging]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const dragDistance = dragY;
    const dragDuration = Date.now() - dragStartTimeRef.current;
    const velocity = dragDuration > 0 ? dragDistance / (dragDuration / 1000) : 0;

    // 如果拖拽距离超过阈值或速度较快，则关闭面板
    if (dragDistance > DRAG_CLOSE_THRESHOLD || (dragDistance > 50 && velocity > DRAG_CLOSE_VELOCITY)) {
      handleClose();
    } else {
      // 回弹
      setDragY(0);
    }

    setIsDragging(false);
  }, [isDragging, dragY, handleClose]);

  // 选择选项
  const handleSelect = useCallback(
    (option: ActionSheetOption<T>) => {
      onChange(option.value);
      handleClose();
    },
    [onChange, handleClose]
  );

  // 动画控制 - 使用单次 RAF 确保 DOM 已渲染后再触发动画
  useEffect(() => {
    if (isOpen) {
      // 使用 setTimeout 确保浏览器已渲染初始状态（transform: translateY(100%)）
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, prefersReducedMotion ? 0 : 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = options.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < itemCount - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : itemCount - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < itemCount) {
            handleSelect(options[highlightedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
      }
    },
    [options, highlightedIndex, handleSelect, handleClose]
  );

  // 空状态
  if (options.length === 0) {
    return (
      <div style={styles.emptyState}>
        {emptyMessage}
      </div>
    );
  }

  const transitionStyle = prefersReducedMotion
    ? 'none'
    : (isDragging ? 'none' : `transform ${ANIMATION_DURATION}ms ease-out`);
  const overlayTransition = prefersReducedMotion ? 'none' : `background ${ANIMATION_DURATION}ms ease-out`;

  // 计算面板transform（考虑拖拽位移）
  const sheetTransform = isDragging
    ? `translateY(${dragY}px)`
    : (isAnimating ? 'translateY(0)' : 'translateY(100%)');

  return (
    <>
      {/* 触发器 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        onTouchStart={() => {
          // 失焦当前焦点元素，防止移动端软键盘自动弹出
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
        disabled={disabled}
        id={id}
        style={{
          ...styles.trigger,
          ...(disabled ? styles.triggerDisabled : {}),
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {triggerIcon}
        <span style={styles.triggerText}>{displayText}</span>
        <span style={styles.triggerArrow}>▼</span>
      </button>

      {/* 选择面板（全屏遮罩 + 底部面板） */}
      {isOpen && (
        <div
          onClick={handleClose}
          style={{
            ...styles.overlay,
            background: isAnimating ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
            transition: overlayTransition,
          }}
        >
          <div
            data-testid="action-sheet-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.sheet,
              transform: sheetTransform,
              transition: transitionStyle,
            }}
          >
            {/* 拖拽手柄 */}
            <div
              data-testid="drag-handle"
              style={styles.handle}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
              onTouchEnd={handleDragEnd}
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            />

            {/* 选项列表 */}
            <div style={styles.listContainer} role="listbox">
              {options.length === 0 ? (
                <div style={styles.emptyList}>{emptyMessage}</div>
              ) : (
                options.map((option, index) => (
                  <div
                    key={index}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      ...styles.option,
                      ...(highlightedIndex === index ? styles.optionHighlighted : {}),
                      ...(value === option.value ? styles.optionSelected : {}),
                    }}
                  >
                    {option.icon}
                    <span style={styles.optionLabel}>
                      {option.label}
                      {option.description && (
                        <span style={styles.optionDescriptionInline}> ({option.description})</span>
                      )}
                    </span>
                    {value === option.value && <CheckIcon />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * SVG 选中标记图标
 */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={styles.checkIcon}
    >
      <path
        d="M3 8L6.5 11.5L13 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


const styles: Record<string, React.CSSProperties> = {
  emptyState: {
    padding: '10px 12px',
    borderRadius: 8,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },

  trigger: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left' as const,
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease',
  },

  triggerDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  triggerText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
  },

  triggerArrow: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    marginLeft: 'auto',
  },

  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1100, // 高于 BottomSheet 的 1000
  },

  sheet: {
    width: '100%',
    maxWidth: 480,
    // 移除 minHeight，让面板高度由内容自然撑开
    maxHeight: 'calc(80vh - env(safe-area-inset-bottom, 0px))',
    borderRadius: '16px 16px 0 0',
    background: 'var(--bg-secondary)',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    // 底部抽屉不需要顶部安全区域边距
    paddingBottom: 'var(--safe-bottom)',
  },

  handle: {
    width: 36,
    height: 4,
    background: 'var(--text-secondary)',
    opacity: 0.5,
    borderRadius: 2,
    margin: '12px auto',
    flexShrink: 0,
  },

  listContainer: {
    flex: '1 1 auto',  // 允许伸缩，避免高度塌陷
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    padding: '8px 0',
  },

  emptyList: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },

  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  },

  optionHighlighted: {
    background: 'rgba(88, 166, 255, 0.15)',
  },

  optionSelected: {
    background: 'rgba(88, 166, 255, 0.08)',
  },

  optionLabel: {
    flex: 1,
    minWidth: 0,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  optionDescriptionInline: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },

  checkIcon: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: 'var(--status-running)',
  },
};