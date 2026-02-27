<!-- auto-doc: 文件增删时更新 -->
# backend/src/session/ - 核心会话协调器

- session-controller.ts: SessionController 类，连接 PTY ↔ WS ↔ Terminal ↔ Hook 四个模块，管理 OutputBuffer + 状态机 (idle/running/waiting_approval) + 审批响应 PTY 按键写入
