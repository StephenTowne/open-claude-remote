import type { SessionStatus } from '#shared';

/**
 * 创建实例的选项
 */
export interface CreateInstanceOptions {
  /** 工作目录 */
  cwd: string;
  /** 实例名称 (默认: cwd 的 basename) */
  name?: string;
  /** Claude CLI 命令路径 (默认: 'claude') */
  claudeCommand?: string;
  /** Claude CLI 额外参数 */
  claudeArgs?: string[];
  /** 输出缓冲区最大行数 */
  maxBufferLines?: number;
  /** 是否为 headless 模式（无终端绑定） */
  headless?: boolean;
}

/**
 * 实例信息（运行时状态）
 */
export interface InstanceInfo {
  instanceId: string;
  name: string;
  cwd: string;
  status: SessionStatus;
  startedAt: string;
  headless: boolean;
  clientCount: number;
  claudeArgs?: string[];
}

/**
 * InstanceManager 事件类型
 */
export interface InstanceManagerEvents {
  instance_created: (info: InstanceInfo) => void;
  instance_removed: (instanceId: string, reason: string) => void;
}
