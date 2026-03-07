export interface InstanceInfo {
  instanceId: string;   // UUID
  name: string;         // 项目名 (CWD basename 或 --name)
  cwd: string;
  startedAt: string;    // ISO
  /** 会话状态 */
  status?: string;
  /** 是否为无终端模式（web 创建的实例） */
  headless?: boolean;
  /** 当前连接的客户端数量 */
  clientCount?: number;
  /** 创建时的 Claude 参数（可选，包含 --settings 等） */
  claudeArgs?: string[];
}

export interface InstanceListItem extends InstanceInfo {
  isCurrent: boolean;
}

/** ~/.claude-remote 目录名 */
export const CLAUDE_REMOTE_DIR = '.claude-remote';

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
