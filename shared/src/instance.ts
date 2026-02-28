export interface InstanceInfo {
  instanceId: string;   // UUID
  name: string;         // 项目名 (CWD basename 或 --name)
  host: string;
  port: number;
  pid: number;
  cwd: string;
  startedAt: string;    // ISO
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

/** 共享 Token 文件名 */
export const TOKEN_FILENAME = 'token';
