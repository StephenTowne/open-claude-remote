<!-- auto-doc: 文件增删时更新 -->
# backend/src/ws/ - WebSocket 服务端与消息路由

- ws-server.ts: WsServer 类，noServer 模式 HTTP upgrade，Session Cookie 认证，/ws 路径过滤，ping/pong 心跳检测，broadcast/sendTo 消息分发
- ws-handler.ts: handleWsMessage() 纯函数，JSON 解析 + 类型校验 + 按 type 路由到 callbacks (user_input/approval_response/resize/heartbeat)
