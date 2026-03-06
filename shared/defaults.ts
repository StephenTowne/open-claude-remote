/**
 * 快捷键配置项（存储格式，包含 enabled 字段）
 */
export interface ConfigurableShortcut {
  label: string;
  data: string;
  enabled: boolean;
  desc?: string;
}

/**
 * 命令配置项（存储格式，包含 enabled 字段）
 */
export interface ConfigurableCommand {
  label: string;
  command: string;
  enabled: boolean;
  desc?: string;
  autoSend?: boolean; // true=点击直接发送（默认），false=填入输入框
}

/**
 * 默认快捷键列表（只包含 enabled: true 的项）
 * 真相源：前后端共用此定义
 */
export const DEFAULT_SHORTCUTS: ConfigurableShortcut[] = [
  { label: 'Esc', data: '\x1b', enabled: true },
  { label: 'Enter', data: '\r', enabled: true },
  { label: 'Tab', data: '\t', enabled: true },
  { label: '↑', data: '\x1b[A', enabled: true },
  { label: '↓', data: '\x1b[B', enabled: true },
  { label: '←', data: '\x1b[D', enabled: true },
  { label: '→', data: '\x1b[C', enabled: true },
  { label: 'S-Tab', data: '\x1b[Z', enabled: true, desc: 'Shift+Tab, 向前切换' },
  { label: 'Ctrl+O', data: '\x0f', enabled: true },
  { label: 'Ctrl+E', data: '\x05', enabled: true },
];

/**
 * 默认命令列表（只包含 enabled: true 的项）
 * 真相源：前后端共用此定义
 */
export const DEFAULT_COMMANDS: ConfigurableCommand[] = [
  { label: '/clear', command: '/clear', enabled: true },
  { label: '/compact', command: '/compact', enabled: true },
  { label: '/resume', command: '/resume', enabled: true },
  { label: '/stats', command: '/stats', enabled: true },
  { label: '/exit', command: '/exit', enabled: true },
  { label: '/commit-commands:commit', command: '/commit-commands:commit', enabled: true },
  { label: '/feature-dev:feature-dev', command: '/feature-dev:feature-dev', enabled: true },
  { label: '/auto-doc', command: '/auto-doc', enabled: true },
  { label: '/code-review-expert', command: '/code-review-expert', enabled: true },
  { label: '/systematic-debugging', command: '/systematic-debugging', enabled: true },
];