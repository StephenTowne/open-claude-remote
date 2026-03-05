import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';

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
  searchPlaceholder?: string;
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
 * - 内置搜索功能
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
  searchPlaceholder = 'Search…',
  emptyMessage = 'No options available',
  triggerIcon,
  getDisplayLabel,
}: ActionSheetSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchActive, setSearchActive] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!searchValue.trim()) {
      return options;
    }
    const searchLower = searchValue.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.description?.toLowerCase().includes(searchLower) ||
        String(opt.value).toLowerCase().includes(searchLower)
    );
  }, [options, searchValue]);

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
    setSearchValue('');
    // 移动端不激活搜索框，桌面端自动激活
    const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
    setSearchActive(!isTouchDevice);
  }, [disabled, options.length]);

  // 关闭面板
  const handleClose = useCallback(() => {
    setIsAnimating(false);
    if (prefersReducedMotion) {
      setIsOpen(false);
    } else {
      setTimeout(() => setIsOpen(false), ANIMATION_DURATION);
    }
  }, []);

  // 选择选项
  const handleSelect = useCallback(
    (option: ActionSheetOption<T>) => {
      onChange(option.value);
      handleClose();
    },
    [onChange, handleClose]
  );

  // 动画控制
  useEffect(() => {
    if (isOpen) {
      if (prefersReducedMotion) {
        setIsAnimating(true);
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsAnimating(true));
        });
      }
    }
  }, [isOpen]);

  // 打开后聚焦搜索框（仅桌面端）
  useEffect(() => {
    if (isOpen && isAnimating && searchActive) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, isAnimating, searchActive]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = filteredOptions.length;

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
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
      }
    },
    [filteredOptions, highlightedIndex, handleSelect, handleClose]
  );

  // 空状态
  if (options.length === 0) {
    return (
      <div style={styles.emptyState}>
        {emptyMessage}
      </div>
    );
  }

  const transitionStyle = prefersReducedMotion ? 'none' : `transform ${ANIMATION_DURATION}ms ease-out`;
  const overlayTransition = prefersReducedMotion ? 'none' : `background ${ANIMATION_DURATION}ms ease-out`;

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
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.sheet,
              transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
              transition: transitionStyle,
            }}
          >
            {/* 拖拽手柄 */}
            <div style={styles.handle} />

            {/* 搜索框 */}
            <div
              style={{
                ...styles.searchContainer,
                ...(searchActive ? {} : styles.searchContainerInactive),
              }}
            >
              <SearchIcon />
              {searchActive ? (
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  style={styles.searchInput}
                />
              ) : (
                <div
                  onClick={() => {
                    setSearchActive(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                  style={styles.searchPlaceholder}
                >
                  {searchPlaceholder}
                </div>
              )}
            </div>

            {/* 选项列表 */}
            <div style={styles.listContainer} role="listbox">
              {filteredOptions.length === 0 ? (
                <div style={styles.emptyList}>{emptyMessage}</div>
              ) : (
                filteredOptions.map((option, index) => (
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
                    <div style={styles.optionContent}>
                      <span style={styles.optionLabel}>{option.label}</span>
                      {option.description && (
                        <span style={styles.optionDescription}>{option.description}</span>
                      )}
                    </div>
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
 * SVG 搜索图标
 */
function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={styles.searchIcon}
    >
      <circle
        cx="5.5"
        cy="5.5"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M9 9L12.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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
    height: '80vh',
    maxHeight: '80vh',
    borderRadius: '16px 16px 0 0',
    background: 'var(--bg-secondary)',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingTop: 'env(safe-area-inset-top, 0)',
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

  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    flexShrink: 0,
  },

  searchIcon: {
    marginRight: 8,
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },

  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
  },

  searchContainerInactive: {
    background: 'var(--bg-tertiary)',
  },

  searchPlaceholder: {
    flex: 1,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    padding: '6px 0',
    cursor: 'pointer',
  },

  listContainer: {
    flex: 1,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    padding: '4px 0',
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
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  },

  optionHighlighted: {
    background: 'rgba(88, 166, 255, 0.15)',
  },

  optionSelected: {
    background: 'rgba(88, 166, 255, 0.08)',
  },

  optionContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },

  optionLabel: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  optionDescription: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};