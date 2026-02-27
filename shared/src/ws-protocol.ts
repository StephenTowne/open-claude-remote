// ==============================
// Server → Client Messages
// ==============================

export interface TerminalOutputMessage {
  type: 'terminal_output';
  data: string;
  seq: number;
}

export type SessionStatus = 'idle' | 'running' | 'waiting_approval';

export interface StatusUpdateMessage {
  type: 'status_update';
  status: SessionStatus;
  detail?: string;
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  description: string;
  params?: Record<string, unknown>;
}

export interface ApprovalRequestMessage {
  type: 'approval_request';
  approval: ApprovalRequest;
}

export interface HistorySyncMessage {
  type: 'history_sync';
  data: string;
  seq: number;
  status: SessionStatus;
  pendingApproval?: ApprovalRequest;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface SessionEndedMessage {
  type: 'session_ended';
  exitCode: number;
  reason: string;
}

export type ServerMessage =
  | TerminalOutputMessage
  | StatusUpdateMessage
  | ApprovalRequestMessage
  | HistorySyncMessage
  | HeartbeatMessage
  | ErrorMessage
  | SessionEndedMessage;

// ==============================
// Client → Server Messages
// ==============================

export interface UserInputMessage {
  type: 'user_input';
  data: string;
}

export interface ApprovalResponseMessage {
  type: 'approval_response';
  id: string;
  approved: boolean;
}

export interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface ClientHeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

export type ClientMessage =
  | UserInputMessage
  | ApprovalResponseMessage
  | ResizeMessage
  | ClientHeartbeatMessage;
