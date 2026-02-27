<!-- auto-doc: 文件增删时更新 -->
# shared/src/ - 前后端共享类型与常量（唯一真相源）

- ws-protocol.ts: WebSocket 消息协议类型定义，ServerMessage (terminal_output/status_update/approval_request/history_sync/heartbeat/error/session_ended) + ClientMessage (user_input/approval_response/resize/heartbeat)
- constants.ts: 共享常量，DEFAULT_PORT/SESSION_TTL/AUTH_RATE_LIMIT/MAX_BUFFER_LINES/WS_HEARTBEAT_INTERVAL/TOKEN_BYTES/MAX_WS_MESSAGE_SIZE
- index.ts: barrel re-export，统一导出 ws-protocol + constants
