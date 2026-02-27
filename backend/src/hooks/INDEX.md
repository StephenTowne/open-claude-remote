<!-- auto-doc: 文件增删时更新 -->
# backend/src/hooks/ - Claude Code Notification Hook 接收与解析

- hook-receiver.ts: HookReceiver 类，解析 permission_prompt hook payload，生成 ApprovalRequest (UUID)，emit 'approval' 事件通知 SessionController
