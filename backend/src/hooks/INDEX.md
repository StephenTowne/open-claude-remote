<!-- auto-doc: 文件增删时更新 -->
# backend/src/hooks/ - Claude Code Hook 接收与解析

## 文件说明

- **hook-types.ts**: Hook payload 类型定义，包含所有事件类型的 TypeScript 类型、通知事件枚举、通知渠道类型
- **hook-receiver.ts**: HookReceiver 类，接收 Claude Code hook 回调，解析各类事件（PermissionRequest、Notification、PreToolUse、SessionEnd、Stop），emit 'notification' 和 'task_completed' 事件

## 支持的 Hook 事件

| 事件类型 | 触发场景 | 通知渠道 |
|---------|---------|---------|
| PermissionRequest | 权限审批对话框 | websocket + push + dingtalk |
| Notification.permission_prompt | 权限提示 | websocket + push + dingtalk |
| Notification.idle_prompt | 空闲等待输入 | websocket + push + dingtalk |
| Notification.elicitation_dialog | 用户问题对话框 | websocket + push + dingtalk |
| PreToolUse.AskUserQuestion | 等待回答问题 | websocket + push + dingtalk |
| SessionEnd | 会话结束 | websocket only |
| Stop | 任务完成 | 不发送通知，触发 task_completed 事件 |

## 事件流

```
Claude Code CLI → HTTP POST /api/hook → HookReceiver.processHook()
  → emit('notification', HookNotification)  // 需要用户注意
  → emit('task_completed', TaskCompletedData)  // 任务继续执行
```
