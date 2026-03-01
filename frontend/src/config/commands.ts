/**
 * 快捷键 - 点击直接发送 ANSI 控制字符
 */
export interface ShortcutKey {
  label: string;   // 显示文本
  data: string;    // ANSI 序列
}

/**
 * 命令 - 点击填入输入框
 */
export interface CommandItem {
  label: string;   // 显示文本
  command: string; // 实际命令
}

/**
 * 可配置的快捷键（包含 enabled 字段）
 */
export interface ConfigurableShortcut extends ShortcutKey {
  enabled: boolean;
  desc?: string;   // 可选描述
}

/**
 * 可配置的命令（包含 enabled 字段）
 */
export interface ConfigurableCommand extends CommandItem {
  enabled: boolean;
  desc?: string;   // 可选描述
}

/**
 * 用户配置文件结构
 */
export interface UserConfig {
  shortcuts: ConfigurableShortcut[];
  commands: ConfigurableCommand[];
}

/**
 * 默认快捷键列表（当配置文件不存在时使用）
 */
export const DEFAULT_SHORTCUTS: ShortcutKey[] = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'S-Tab', data: '\x1b[Z' },
  { label: '↑', data: '\x1b[A' },
  { label: '↓', data: '\x1b[B' },
  { label: '←', data: '\x1b[D' },
  { label: '→', data: '\x1b[C' },
  { label: '^C', data: '\x03' },
];

/**
 * 默认命令列表（当配置文件不存在时使用）
 */
export const DEFAULT_COMMANDS: CommandItem[] = [
  { label: '/help', command: '/help' },
  { label: '/clear', command: '/clear' },
  { label: '/compact', command: '/compact' },
  { label: '/terminal-setup', command: '/terminal-setup' },
  { label: '/review', command: '/review' },
  { label: '/init', command: '/init' },
];

/**
 * 从可配置列表中过滤出启用的项
 */
export function filterEnabled<T extends { enabled: boolean; desc?: string }>(items: T[]): Omit<T, 'enabled' | 'desc'>[] {
  return items
    .filter(item => item.enabled)
    .map(({ enabled, desc: _desc, ...rest }) => rest);
}