export interface InstanceInfo {
  instanceId: string;   // UUID
  name: string;         // 项目名 (CWD basename 或 --name)
  host: string;
  port: number;
  pid: number;
  cwd: string;
  startedAt: string;    // ISO
  /** 是否为无终端模式（web 创建的实例） */
  headless?: boolean;
  /** 创建时的 Claude 参数（可选，包含 --settings 等） */
  claudeArgs?: string[];
}

export interface InstanceRegistry {
  version: 1;
  instances: InstanceInfo[];
}

export interface InstanceListItem extends InstanceInfo {
  isCurrent: boolean;
}

/** ~/.claude-remote 目录名 */
export const CLAUDE_REMOTE_DIR = '.claude-remote';

/** 注册表文件名 */
export const REGISTRY_FILENAME = 'instances.json';

/** Claude Code settings 目录名 */
export const SETTINGS_DIR = 'settings';

/** Settings 文件信息 */
export interface SettingsFile {
  /** 文件名（不含路径） */
  filename: string;
  /** 显示名称（去掉 settings 前缀和 .json 后缀） */
  displayName: string;
  /** 所在目录（用于区分同名文件） */
  directory: string;
  /** 所在目录的完整路径 */
  directoryPath: string;
}
