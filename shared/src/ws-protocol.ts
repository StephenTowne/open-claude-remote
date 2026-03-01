// ==============================
// Server → Client Messages
// ==============================

export interface TerminalOutputMessage {
  type: 'terminal_output';
  data: string;
  seq: number;
}

export type SessionStatus = 'idle' | 'running' | 'waiting_input';

export interface StatusUpdateMessage {
  type: 'status_update';
  status: SessionStatus;
  detail?: string;
}

export interface HistorySyncMessage {
  type: 'history_sync';
  data: string;
  seq: number;
  status: SessionStatus;
  cols?: number;
  rows?: number;
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

export interface TerminalResizeMessage {
  type: 'terminal_resize';
  cols: number;
  rows: number;
}

export interface IpChangedMessage {
  type: 'ip_changed';
  oldIp: string;
  newIp: string;
  newUrl: string;
}

export type ServerMessage =
  | TerminalOutputMessage
  | StatusUpdateMessage
  | HistorySyncMessage
  | HeartbeatMessage
  | ErrorMessage
  | SessionEndedMessage
  | TerminalResizeMessage
  | IpChangedMessage;

// ==============================
// Client → Server Messages
// ==============================

export interface UserInputMessage {
  type: 'user_input';
  data: string;
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
  | ResizeMessage
  | ClientHeartbeatMessage;
