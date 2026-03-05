import { useRef, useEffect, useState, type ReactNode } from 'react';

/**
 * 选项数据结构
 */
export interface SegmentedControlOption<T> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  title?: string;
}

/**
 * SegmentedControl 组件 Props
 */
export interface SegmentedControlProps<T> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * 检测用户是否偏好减少动效
 */
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * iOS 风格分段控件组件
 *
 * 特性：
 * - 圆角容器 + 内部滑块指示器（pill indicator）
 * - 平滑的选中动画
 * - 最小高度 44px，确保移动端触控友好
 * - 支持无障碍属性
 */
export function SegmentedControl<T>({
  options,
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // 找到当前选中项的索引
  const selectedIndex = options.findIndex((opt) => opt.value === value);

  // 更新指示器位置和大小
  useEffect(() => {
    const container = containerRef.current;
    const selectedElement = optionRefs.current[selectedIndex];

    const updateIndicator = () => {
      if (selectedElement && container) {
        const containerRect = container.getBoundingClientRect();
        const selectedRect = selectedElement.getBoundingClientRect();

        // 计算相对于容器的位置（加入 scrollLeft 以正确处理滚动）
        const left = selectedRect.left - containerRect.left + container.scrollLeft - 3; // 减去容器 padding
        const width = selectedRect.width;

        setIndicatorStyle({
          transform: `translateX(${left}px)`,
          width: `${width}px`,
        });
      }
    };

    updateIndicator();

    // 监听容器滚动事件，确保滚动时指示器位置正确
    container?.addEventListener('scroll', updateIndicator);
    return () => {
      container?.removeEventListener('scroll', updateIndicator);
    };
  }, [selectedIndex, options]);

  // 处理选项点击
  const handleSelect = (optionValue: T) => {
    if (!disabled) {
      onChange(optionValue);
    }
  };

  // 处理键盘导航
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return;

    let newIndex = index;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = index > 0 ? index - 1 : options.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = index < options.length - 1 ? index + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = options.length - 1;
        break;
      default:
        return;
    }

    onChange(options[newIndex].value);
    optionRefs.current[newIndex]?.focus();
  };

  // 无障碍属性
  const ariaProps = {
    role: 'radiogroup' as const,
    'aria-label': ariaLabel,
  };

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        ...(disabled ? styles.containerDisabled : {}),
      }}
      {...ariaProps}
    >
      {/* 滑动指示器 */}
      <div
        style={{
          ...styles.indicator,
          ...indicatorStyle,
          ...(prefersReducedMotion ? {} : styles.indicatorAnimated),
          ...(selectedIndex === -1 ? styles.indicatorHidden : {}),
        }}
        aria-hidden="true"
      />

      {/* 选项按钮 */}
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={String(option.value)}
            ref={(el) => { optionRefs.current[index] = el; }}
            type="button"
            role="radio"
            title={option.title}
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => handleSelect(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              ...styles.option,
              ...(isSelected ? styles.optionSelected : {}),
            }}
          >
            {option.icon && (
              <span style={styles.icon}>{option.icon}</span>
            )}
            <span style={styles.labelWrapper}>
              <span style={styles.label}>{option.label}</span>
            </span>
            {option.description && (
              <span style={styles.descriptionWrapper}>
                <span style={styles.description}>{option.description}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    maxWidth: '100%',
    overflowX: 'auto',
    background: 'var(--bg-tertiary)',
    borderRadius: 10,
    padding: 3,
    position: 'relative',
    gap: 2,
    // 隐藏滚动条 - Firefox
    scrollbarWidth: 'none',
    // 隐藏滚动条 - IE/Edge
    msOverflowStyle: 'none',
  },

  containerDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    background: 'var(--status-running)',
    borderRadius: 7,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    zIndex: 0,
  },

  indicatorAnimated: {
    transition: 'transform 0.2s ease, width 0.2s ease',
  },

  indicatorHidden: {
    opacity: 0,
  },

  option: {
    flexShrink: 0,
    minWidth: 80,
    minHeight: 44,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    borderRadius: 7,
    padding: '6px 8px',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    lineHeight: 1.2,
    overflow: 'visible',
  },

  optionSelected: {
    color: '#fff',
    fontWeight: 500,
  },

  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },

  labelWrapper: {
    textAlign: 'center' as const,
    maxWidth: '100%',
  },

  label: {
    whiteSpace: 'nowrap',
  },

  descriptionWrapper: {
    textAlign: 'center' as const,
    maxWidth: '100%',
  },

  description: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 1,
    whiteSpace: 'nowrap',
  },
};
