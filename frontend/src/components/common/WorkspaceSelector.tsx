import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface WorkspaceSelectorProps {
  workspaces: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * 从完整路径中提取目录名
 */
function getDirectoryName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

/**
 * 获取智能显示的父目录路径
 * 例如：/Users/tom/projects/claude-code-remote -> .../projects
 */
function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return path;
  }
  return '.../' + parts[parts.length - 2];
}

/**
 * 工作目录选择器组件
 *
 * 特性：
 * - 可搜索：输入关键词过滤工作目录
 * - 智能路径：显示 `.../parent/current` 格式
 * - 键盘导航：↑↓ 选择，Enter 确认，Escape 关闭
 * - 纯 CSS 绘制的文件夹图标前缀
 */
export function WorkspaceSelector({
  workspaces,
  value,
  onChange,
  placeholder = '选择工作目录…',
  disabled = false,
  id,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 过滤工作目录
  const filteredWorkspaces = useMemo(() => {
    if (!searchValue.trim()) {
      return workspaces;
    }
    const searchLower = searchValue.toLowerCase();
    return workspaces.filter((ws) =>
      ws.toLowerCase().includes(searchLower)
    );
  }, [workspaces, searchValue]);

  // 获取当前选中项的显示名称
  const selectedDisplayName = value ? getDirectoryName(value) : null;

  // 打开下拉面板
  const handleOpen = useCallback(() => {
    if (!disabled && workspaces.length > 0) {
      setIsOpen(true);
      setHighlightedIndex(-1);
      setSearchValue('');
    }
  }, [disabled, workspaces.length]);

  // 关闭下拉面板
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
    setHighlightedIndex(-1);
  }, []);

  // 选择工作目录
  const handleSelect = useCallback((workspace: string) => {
    onChange(workspace);
    handleClose();
  }, [onChange, handleClose]);

  // 处理键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const itemCount = filteredWorkspaces.length;

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
          handleSelect(filteredWorkspaces[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  }, [filteredWorkspaces, highlightedIndex, handleSelect, handleClose]);

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

  // 空状态
  if (workspaces.length === 0) {
    return (
      <div style={styles.emptyState}>
        没有可用的工作目录
      </div>
    );
  }

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
        <FolderIcon />
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
              placeholder="搜索工作目录…"
              autoComplete="off"
              style={styles.searchInput}
            />
          </div>

          {/* 工作目录列表 */}
          <div style={styles.listContainer}>
            {filteredWorkspaces.length === 0 ? (
              <div style={styles.emptyList}>
                没有匹配的工作目录
              </div>
            ) : (
              filteredWorkspaces.map((workspace, index) => (
                <div
                  key={workspace}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onClick={() => handleSelect(workspace)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    ...styles.option,
                    ...(highlightedIndex === index ? styles.optionHighlighted : {}),
                    ...(value === workspace ? styles.optionSelected : {}),
                  }}
                  title={workspace}
                >
                  <FolderIcon />
                  <div style={styles.optionContent}>
                    <span style={styles.optionName}>
                      {getDirectoryName(workspace)}
                    </span>
                    <span style={styles.optionPath}>
                      {getParentPath(workspace)}
                    </span>
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
 * SVG 文件夹图标
 */
function FolderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={styles.folderIcon}
    >
      <path
        d="M2 4C2 3.44772 2.44772 3 3 3H6.17157C6.43678 3 6.69114 3.10536 6.87868 3.29289L7.58579 4H13C13.5523 4 14 4.44772 14 5V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M2 5.5V12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12V5.5C14 5.22386 13.7761 5 13.5 5H2.5C2.22386 5 2 5.22386 2 5.5Z"
        fill="currentColor"
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

  folderIcon: {
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },
};