import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { SettingsFile } from '#shared';

interface SettingsFileSelectorProps {
  settingsFiles: SettingsFile[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Settings 文件选择器组件
 *
 * 特性：
 * - 可搜索：输入关键词过滤 settings 文件
 * - 智能显示：显示 displayName 为标题，directory 为副标题
 * - 键盘导航：↑↓ 选择，Enter 确认，Escape 关闭
 * - 支持 "None" 选项（不选择任何 settings 文件）
 * - 纯 CSS 绘制的设置图标前缀
 */
export function SettingsFileSelector({
  settingsFiles,
  value,
  onChange,
  placeholder = '选择 Settings 文件…',
  disabled = false,
  id,
}: SettingsFileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 过滤 settings 文件（支持搜索）
  const filteredItems = useMemo(() => {
    const items: (SettingsFile | null)[] = [null]; // null 代表 "None" 选项
    if (!searchValue.trim()) {
      items.push(...settingsFiles);
      return items;
    }
    const searchLower = searchValue.toLowerCase();
    const filtered = settingsFiles.filter(
      (sf) =>
        sf.displayName.toLowerCase().includes(searchLower) ||
        sf.filename.toLowerCase().includes(searchLower)
    );
    items.push(...filtered);
    return items;
  }, [settingsFiles, searchValue]);

  // 获取当前选中项的显示名称
  const selectedDisplayName = useMemo(() => {
    if (!value) return null;
    const selected = settingsFiles.find((sf) => sf.filename === value);
    return selected?.displayName || value;
  }, [value, settingsFiles]);

  // 打开下拉面板
  const handleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setHighlightedIndex(-1);
      setSearchValue('');
    }
  }, [disabled]);

  // 关闭下拉面板
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
    setHighlightedIndex(-1);
  }, []);

  // 选择 settings 文件
  const handleSelect = useCallback(
    (filename: string | null) => {
      onChange(filename || '');
      handleClose();
    },
    [onChange, handleClose]
  );

  // 处理键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const itemCount = filteredItems.length;

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
            const selected = filteredItems[highlightedIndex];
            handleSelect(selected?.filename || null);
          }
          break;

        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
      }
    },
    [filteredItems, highlightedIndex, handleSelect, handleClose]
  );

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  return (
    <div style={styles.container}>
      {/* 触发器 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        id={id}
        style={{
          ...styles.trigger,
          ...(disabled ? styles.triggerDisabled : {}),
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <SettingsIcon />
        <span style={styles.triggerText}>
          {selectedDisplayName || placeholder}
        </span>
        <span style={styles.triggerArrow}>▼</span>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div ref={dropdownRef} style={styles.dropdown} role="listbox">
          {/* 搜索框 */}
          <div style={styles.searchContainer}>
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索 Settings 文件…"
              autoComplete="off"
              style={styles.searchInput}
            />
          </div>

          {/* Settings 文件列表 */}
          <div style={styles.listContainer}>
            {filteredItems.length === 1 && !filteredItems[0] ? (
              <div style={styles.emptyList}>没有匹配的 Settings 文件</div>
            ) : (
              filteredItems.map((item, index) => (
                <div
                  key={item?.filename || 'none'}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onClick={() => handleSelect(item?.filename || null)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    ...styles.option,
                    ...(highlightedIndex === index
                      ? styles.optionHighlighted
                      : {}),
                    ...(value === (item?.filename || '')
                      ? styles.optionSelected
                      : {}),
                  }}
                  title={item ? `${item.directoryPath}/${item.filename}` : '不使用 Settings 文件'}
                >
                  {item ? <SettingsIcon /> : <NoneIcon />}
                  <div style={styles.optionContent}>
                    <span style={styles.optionName}>
                      {item?.displayName || 'None'}
                    </span>
                    {item && (
                      <span style={styles.optionPath}>{item.directory}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SVG 设置图标（齿轮）
 */
function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={styles.settingsIcon}
    >
      <path
        d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M12.9247 8.99999C12.9692 8.66999 13 8.33749 13 7.99999C13 7.66249 12.9692 7.32999 12.9247 6.99999L14.3622 5.91249C14.4872 5.81249 14.5197 5.63749 14.4372 5.48749L13.0622 3.01249C12.9797 2.86249 12.8122 2.81249 12.6622 2.86249L10.9247 3.51249C10.4247 3.13749 9.87468 2.82499 9.28718 2.58749L9.01218 0.787487C8.98718 0.624987 8.84968 0.499987 8.68718 0.499987H5.93718C5.77468 0.499987 5.63718 0.624987 5.61218 0.787487L5.33718 2.58749C4.74968 2.82499 4.19968 3.14999 3.69968 3.51249L1.96218 2.86249C1.81218 2.81249 1.64468 2.86249 1.56218 3.01249L0.187178 5.49999C0.099678 5.64999 0.137178 5.82499 0.262178 5.92499L1.69968 6.99999C1.65518 7.32999 1.62468 7.66249 1.62468 7.99999C1.62468 8.33749 1.65518 8.66999 1.69968 8.99999L0.262178 10.0875C0.137178 10.1875 0.104678 10.3625 0.187178 10.5125L1.56218 12.9875C1.64468 13.1375 1.81218 13.1875 1.96218 13.1375L3.69968 12.4875C4.19968 12.8625 4.74968 13.175 5.33718 13.4125L5.61218 15.2125C5.63718 15.375 5.77468 15.5 5.93718 15.5H8.68718C8.84968 15.5 8.98718 15.375 9.01218 15.2125L9.28718 13.4125C9.87468 13.175 10.4247 12.85 10.9247 12.4875L12.6622 13.1375C12.8122 13.1875 12.9797 13.1375 13.0622 12.9875L14.4372 10.5C14.5197 10.35 14.4872 10.175 14.3622 10.075L12.9247 8.99999ZM8 10.5C6.62468 10.5 5.49968 9.37499 5.49968 7.99999C5.49968 6.62499 6.62468 5.49999 8 5.49999C9.37532 5.49999 10.5003 6.62499 10.5003 7.99999C10.5003 9.37499 9.37532 10.5 8 10.5Z"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * SVG "None" 选项图标（横线）
 */
function NoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={styles.settingsIcon}
    >
      <path
        d="M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
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
  container: {
    position: 'relative',
    width: '100%',
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

  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    overflow: 'hidden',
  },

  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
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

  listContainer: {
    maxHeight: 240,
    overflow: 'auto',
    padding: '4px 0',
  },

  emptyList: {
    padding: '16px 12px',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },

  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
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

  optionName: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  optionPath: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  settingsIcon: {
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },
};
