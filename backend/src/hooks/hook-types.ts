/**
 * Claude Code Hook Payload 类型定义
 * 参考: https://code.claude.com/docs/en/hooks
 */

// ==============================
// Hook 事件名称
// ==============================

export type HookEventName =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'SessionEnd'
  | 'PreCompact';

// ==============================
// Notification 子类型
// ==============================

/**
 * Notification 事件的通知类型
 * - permission_prompt: 需要权限审批
 * - idle_prompt: Claude 空闲等待输入
 * - auth_success: 认证成功
 * - elicitation_dialog: 用户问题对话框
 */
export type NotificationType =
  | 'permission_prompt'
  | 'idle_prompt'
  | 'auth_success'
  | 'elicitation_dialog';

// ==============================
// 基础 Payload（所有事件共享字段）
// ==============================

export interface BaseHookPayload {
  /** 当前会话标识 */
  session_id?: string;
  /** 会话 JSON 文件路径 */
  transcript_path?: string;
  /** hook 调用时的工作目录 */
  cwd?: string;
  /** 当前权限模式 */
  permission_mode?: string;
  /** 事件名称 */
  hook_event_name: HookEventName;
  /** 允许其他字段 */
  [key: string]: unknown;
}

// ==============================
// 各事件类型 Payload
// ==============================

/** SessionStart: 会话开始或恢复 */
export interface SessionStartPayload extends BaseHookPayload {
  hook_event_name: 'SessionStart';
  /** 会话启动方式 */
  source?: 'startup' | 'resume' | 'clear' | 'compact';
  /** 模型标识 */
  model?: string;
  /** agent 类型（如果以 --agent 启动） */
  agent_type?: string;
}

/** UserPromptSubmit: 用户提交 prompt */
export interface UserPromptSubmitPayload extends BaseHookPayload {
  hook_event_name: 'UserPromptSubmit';
  /** 用户提交的文本 */
  prompt: string;
}

/** PreToolUse: 工具调用前 */
export interface PreToolUsePayload extends BaseHookPayload {
  hook_event_name: 'PreToolUse';
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  tool_input: Record<string, unknown>;
  /** 工具调用 ID */
  tool_use_id: string;
}

/** PermissionRequest: 权限对话框出现 */
export interface PermissionRequestPayload extends BaseHookPayload {
  hook_event_name: 'PermissionRequest';
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  tool_input: Record<string, unknown>;
  /** 权限建议选项 */
  permission_suggestions?: unknown[];
}

/** PostToolUse: 工具调用成功 */
export interface PostToolUsePayload extends BaseHookPayload {
  hook_event_name: 'PostToolUse';
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  tool_input: Record<string, unknown>;
  /** 工具响应结果 */
  tool_response: unknown;
  /** 工具调用 ID */
  tool_use_id: string;
}

/** PostToolUseFailure: 工具调用失败 */
export interface PostToolUseFailurePayload extends BaseHookPayload {
  hook_event_name: 'PostToolUseFailure';
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  tool_input: Record<string, unknown>;
  /** 错误描述 */
  error: string;
  /** 是否为用户中断 */
  is_interrupt?: boolean;
  /** 工具调用 ID */
  tool_use_id?: string;
}

/** Notification: 通知事件 */
export interface NotificationPayload extends BaseHookPayload {
  hook_event_name: 'Notification';
  /** 通知消息 */
  message: string;
  /** 通知标题 */
  title?: string;
  /** 通知类型 */
  notification_type: NotificationType;
}

/** SubagentStart: 子 agent 启动 */
export interface SubagentStartPayload extends BaseHookPayload {
  hook_event_name: 'SubagentStart';
  /** 子 agent 唯一标识 */
  agent_id: string;
  /** agent 类型名称 */
  agent_type: string;
}

/** SubagentStop: 子 agent 结束 */
export interface SubagentStopPayload extends BaseHookPayload {
  hook_event_name: 'SubagentStop';
  /** 是否已有 stop hook 激活 */
  stop_hook_active?: boolean;
  /** 子 agent 唯一标识 */
  agent_id: string;
  /** agent 类型名称 */
  agent_type: string;
  /** 子 agent 的 transcript 路径 */
  agent_transcript_path?: string;
  /** 最后一条 assistant 消息 */
  last_assistant_message?: string;
}

/** Stop: 主 agent 响应完成 */
export interface StopPayload extends BaseHookPayload {
  hook_event_name: 'Stop';
  /** 是否已有 stop hook 激活 */
  stop_hook_active: boolean;
  /** 最后一条 assistant 消息 */
  last_assistant_message?: string;
}

/** SessionEnd: 会话结束 */
export interface SessionEndPayload extends BaseHookPayload {
  hook_event_name: 'SessionEnd';
  /** 结束原因 */
  reason: string;
}

/** PreCompact: 压缩前 */
export interface PreCompactPayload extends BaseHookPayload {
  hook_event_name: 'PreCompact';
  /** 触发方式 */
  trigger: 'manual' | 'auto';
  /** 自定义指令 */
  custom_instructions?: string;
}

// ==============================
// 联合类型
// ==============================

export type HookPayload =
  | SessionStartPayload
  | UserPromptSubmitPayload
  | PreToolUsePayload
  | PermissionRequestPayload
  | PostToolUsePayload
  | PostToolUseFailurePayload
  | NotificationPayload
  | SubagentStartPayload
  | SubagentStopPayload
  | StopPayload
  | SessionEndPayload
  | PreCompactPayload;

// ==============================
// 通知相关类型
// ==============================

/**
 * 通知事件类型（用于 HookNotification）
 */
export enum HookEventType {
  /** 权限审批请求 */
  PERMISSION_REQUEST = 'permission_request',
  /** 等待用户输入 */
  NOTIFICATION = 'notification',
  /** 会话结束 */
  SESSION_ENDED = 'session_ended',
}

/**
 * 通知渠道类型
 */
export type NotificationChannel = 'websocket' | 'push' | 'dingtalk';

/**
 * 扩展的通知结构
 * 用于 HookReceiver 向 SessionController 传递通知信息
 */
export interface HookNotification {
  /** 事件类型 */
  eventType: HookEventType;
  /** 发送渠道列表 */
  channels: NotificationChannel[];
  /** 相关工具名称 */
  tool: string;
  /** 通知标题 */
  title: string;
  /** 通知消息 */
  message: string;
  /** 额外详情 */
  detail?: string;
}

/**
 * 任务完成事件数据
 */
export interface TaskCompletedData {
  /** 最后一条消息 */
  lastMessage?: string;
}