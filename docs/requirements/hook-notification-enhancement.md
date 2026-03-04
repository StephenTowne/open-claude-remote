# Claude Code Hooks 通知增强

## 背景

当 Claude Code CLI 任务需要人工介入或人工继续工作时，需要发送准确的通知。通知渠道包括 WebApp 通知和钉钉通知。

## 触发场景

### 需要发送所有渠道通知（websocket + push + dingtalk）

1. **PermissionRequest** - 权限审批请求
   - Claude 请求使用某个工具需要用户审批
   - 通知内容：工具名称、操作详情

2. **Notification.permission_prompt** - 权限提示
   - Claude 需要权限继续操作
   - 通知内容：从 message 中提取工具名

3. **Notification.idle_prompt** - 空闲等待输入
   - Claude 空闲等待用户输入
   - 通知内容：等待用户操作

4. **Notification.elicitation_dialog** - 用户问题对话框
   - Claude 弹出问题对话框等待回答
   - 通知内容：问题内容

5. **PreToolUse.AskUserQuestion** - 等待回答问题
   - Claude 使用 AskUserQuestion 工具询问用户
   - 通知内容：问题列表

### 仅发送 WebSocket 通知

1. **SessionEnd** - 会话结束
   - 会话终止时的状态通知
   - 仅 WebApp 内状态更新，不发送外部通知

2. **Stop** - 任务完成
   - 用于检测用户响应后任务继续执行
   - 触发 `task_completed` 事件，将状态从 `waiting_input` 恢复为 `running`

### 不发送通知的事件

- **SessionStart** - 会话开始
- **UserPromptSubmit** - 用户提交 prompt
- **PostToolUse** - 工具调用成功
- **PostToolUseFailure** - 工具调用失败（按用户要求不发送通知）

## 通知内容原则

1. 使用 payload 内容生成准确的通知
2. 避免模糊的 "unknown" 描述
3. 优先从明确字段提取信息（如 `tool_name`、`tool_input`）
4. 仅在必要时从 `message` 字段正则提取

## 架构设计

### 通知渠道列表

使用渠道列表 `NotificationChannel[]` 而非优先级，便于扩展新渠道：

```typescript
export type NotificationChannel = 'websocket' | 'push' | 'dingtalk';
```

### Hook 事件处理流程

```
Claude Code CLI
  → HTTP POST /api/hook
  → HookReceiver.processHook()
  → emit('notification', HookNotification)  // 需要用户注意
  → emit('task_completed', TaskCompletedData)  // 任务继续执行
  → SessionController.sendNotificationByChannel()
```

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/src/hooks/hook-types.ts` | 新建 | Hook payload 类型定义 |
| `backend/src/hooks/hook-receiver.ts` | 重构 | 扩展支持更多事件 |
| `backend/src/config.ts` | 修改 | 注册新 hook 事件 |
| `backend/src/session/session-controller.ts` | 修改 | 处理新通知类型 |
| `backend/tests/unit/hooks/hook-receiver.test.ts` | 修改 | 添加测试用例 |

## 配置示例

Claude Code settings.json 中注册的 hooks：

```json
{
  "hooks": {
    "PermissionRequest": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "curl ..." }] }
    ],
    "Notification": [
      { "matcher": "permission_prompt", "hooks": [...] },
      { "matcher": "idle_prompt", "hooks": [...] },
      { "matcher": "elicitation_dialog", "hooks": [...] }
    ],
    "PreToolUse": [
      { "matcher": "AskUserQuestion", "hooks": [...] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [...] }
    ],
    "SessionEnd": [
      { "matcher": "", "hooks": [...] }
    ]
  }
}
```