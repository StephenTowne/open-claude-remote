import {
  DEFAULT_SHORTCUTS as SHARED_DEFAULT_SHORTCUTS,
  DEFAULT_COMMANDS as SHARED_DEFAULT_COMMANDS,
  type ConfigurableShortcut as SharedConfigurableShortcut,
  type ConfigurableCommand as SharedConfigurableCommand,
} from '@claude-remote/shared';

/**
 * 快捷键 - 点击直接发送 ANSI 控制字符
 */
export interface ShortcutKey {
  label: string;   // 显示文本
  data: string;    // ANSI 序列
}

/**
 * 命令 - 点击填入输入框或直接发送
 */
export interface CommandItem {
  label: string;   // 显示文本
  command: string; // 实际命令
  autoSend?: boolean; // true=点击直接发送（默认），false=填入输入框
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
  dingtalk?: {
    webhookUrl: string;
  };
}

/**
 * 用于 API 返回的安全配置（不包含敏感字段）
 */
export interface SafeUserConfig {
  shortcuts: ConfigurableShortcut[];
  commands: ConfigurableCommand[];
  dingtalk?: {
    configured: boolean;
  };
}

/**
 * 默认快捷键列表 - 从 shared 包导入并转换为前端格式（去除 enabled 字段）
 */
export const DEFAULT_SHORTCUTS: ShortcutKey[] = SHARED_DEFAULT_SHORTCUTS.map(
  ({ enabled: _enabled, desc: _desc, ...rest }) => rest
);

/**
 * 默认命令列表 - 从 shared 包导入并转换为前端格式（去除 enabled 字段）
 */
export const DEFAULT_COMMANDS: CommandItem[] = SHARED_DEFAULT_COMMANDS.map(
  ({ enabled: _enabled, desc: _desc, ...rest }) => rest
);

/**
 * 从可配置列表中过滤出启用的项
 */
export function filterEnabled<T extends { enabled: boolean; desc?: string }>(items: T[]): Omit<T, 'enabled' | 'desc'>[] {
  return items
    .filter(item => item.enabled)
    .map(({ enabled, desc: _desc, ...rest }) => rest);
}