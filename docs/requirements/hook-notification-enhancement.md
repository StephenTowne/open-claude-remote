# Claude Code Hooks 通知增强

## 背景

当 Claude Code CLI 任务需要人工介入或人工继续工作时，需要发送准确的通知。通知渠道包括 WebApp 通知和钉钉通知。

## 触发场景

### 需要发送所有渠道通知（websocket + push + dingtalk + wechat_work）

1. **Notification.permission_prompt** - 权限提示
   - Claude 需要权限继续操作
   - 通知内容：从 message 中提取工具名

2. **Notification.idle_prompt** - 空闲等待输入
   - Claude 空闲等待用户输入
   - 通知内容：等待用户操作

3. **Notification.elicitation_dialog** - 用户问题对话框
   - Claude 弹出问题对话框等待回答
   - 通知内容：问题内容

### 不发送通知但触发事件

1. **Stop** - 任务完成
   - 用于检测用户响应后任务继续执行
   - 触发 `task_completed` 事件，将状态从 `waiting_input` 恢复为 `running`

### 不发送通知的事件

- **SessionStart** - 会话开始
- **UserPromptSubmit** - 用户提交 prompt
- **PreToolUse** - 工具调用前
- **PostToolUse** - 工具调用成功
- **PostToolUseFailure** - 工具调用失败

## 通知内容原则

1. 使用 payload 内容生成准确的通知
2. 避免模糊的 "unknown" 描述
3. 从 `message` 字段正则提取工具名（Pattern: "Claude needs your permission to use <ToolName>"）

## 架构设计

### 通知渠道列表

使用渠道列表 `NotificationChannel[]` 而非优先级，便于扩展新渠道：

```typescript
export type NotificationChannel = 'websocket' | 'push' | 'dingtalk' | 'wechat_work';
```

### Hook 事件处理流程

```
Claude Code CLI
  → HTTP POST /api/hook
  → HookReceiver.processHook()
  → emit('notification', HookNotification)  // Notification 事件
  → emit('task_completed', TaskCompletedData)  // Stop 事件
  → SessionController.sendNotificationByChannel()
```

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/src/hooks/hook-types.ts` | 修改 | Hook payload 类型定义 |
| `backend/src/hooks/hook-receiver.ts` | 修改 | 处理 Notification 和 Stop 事件 |
| `backend/src/config.ts` | 修改 | 注册 Notification 和 Stop hooks |
| `backend/src/session/session-controller.ts` | 修改 | 处理通知 |
| `backend/tests/unit/hooks/hook-receiver.test.ts` | 修改 | 测试用例 |

## 配置示例

Claude Code settings.json 中注册的 hooks：

```json
{
  "hooks": {
    "Notification": [
      { "matcher": "permission_prompt", "hooks": [...] },
      { "matcher": "idle_prompt", "hooks": [...] },
      { "matcher": "elicitation_dialog", "hooks": [...] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [...] }
    ]
  }
}
```