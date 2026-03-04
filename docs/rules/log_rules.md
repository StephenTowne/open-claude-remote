# Logging Rules

> 目标：每条日志都能在生产环境中帮助定位问题。写不写这条日志的判断标准：出了问题后，这条日志能否帮你在 5 分钟内找到根因？

## 1. 技术栈

- **Logger**: `pino`（项目已配置），统一使用 `import { logger } from '../logger/logger.js'`
- **输出**: `logs/app.log`（INFO+）、`logs/error.log`（ERROR），测试环境自动静默
- **风格**: pino 结构化日志 — 第一参数传对象，第二参数传消息字符串

```ts
// ✅ 正确
logger.info({ sessionId, tool }, 'Approval request broadcast to clients');
logger.error({ err, sessionId }, 'PTY spawn failed');

// ❌ 错误 — 不要用模板字符串拼接
logger.info(`Session ${sessionId} started`);
```

## 2. 日志级别

| 级别 | 用途 | 示例场景 |
|------|------|----------|
| **ERROR** | 需要立即关注的严重故障 | PTY 进程崩溃、WebSocket 服务启动失败、不可恢复的异常 |
| **WARN** | 可容忍但需跟踪的异常情况 | 认证失败、配置回退默认值、非核心组件初始化失败 |
| **INFO** | 关键业务节点（正常流转） | 服务启动、Session 创建/销毁、审批流程状态变更 |
| **DEBUG** | 开发调试细节 | 用户输入内容、PTY 原始输出、WS 消息路由细节 |

**ERROR 不可滥用** — ERROR 触发告警，只在"需要人立即处理"时使用。可恢复的问题用 WARN。

## 3. 何时必须打日志

### 必须打（INFO+）
- 服务/模块启动，附带关键配置参数
- Session 生命周期：创建、关闭、异常退出
- 审批流程状态变更：请求创建 → 广播 → 用户响应
- 外部调用（PTY spawn、CLI 交互）的入口和结果

### 必须打（ERROR/WARN）
- 所有 catch 块（除非异常是预期的正常控制流）
- 外部依赖失败（PTY 进程异常退出、WS 连接断开）
- 输入校验失败、鉴权拒绝

### 不要打
- 循环体内的 INFO 日志
- 正常分支中没有业务信息的确认日志（`"step 1 done"`）
- 与上层/下层重复的日志（选一层打，不要每层都打同一件事）

## 4. 强制规则

### 4.1 日志不能中断业务流程
```ts
// ❌ 如果 session 为 undefined 则 NPE 中断流程
logger.info({ id: session.id }, 'Session created');

// ✅ 安全访问
logger.info({ id: session?.id }, 'Session created');
```

### 4.2 禁止 console.log / console.error
所有日志必须通过 `logger` 输出。`console.*` 不会写入日志文件，无法被收集。

### 4.3 异常日志必须携带完整错误对象
```ts
// ❌ 丢失堆栈信息
logger.error('PTY failed');
logger.error({ msg: err.message }, 'PTY failed');

// ✅ pino 会自动序列化 err（包含 message + stack + cause）
logger.error({ err }, 'PTY failed');
logger.error({ err, sessionId }, 'PTY failed');
```

### 4.4 日志必须携带业务上下文
```ts
// ❌ 无法定位是哪个 session 出了问题
logger.warn('WS upgrade rejected');

// ✅ 可直接用 sessionId 搜索关联日志
logger.warn({ url: req.url, sessionId }, 'WS upgrade rejected: invalid session');
```

### 4.5 禁止记录敏感信息
- 不打印：token、password、cookie 全文、用户身份证/手机号
- 如需标记存在性，用脱敏方式：`token: token ? '***' : 'none'`

### 4.6 不要 log-and-throw
```ts
// ❌ 导致同一错误被打印两次
catch (err) {
  logger.error({ err }, 'Failed');
  throw err; // 外层还会再打一次
}

// ✅ 二选一：打日志并处理，或直接 throw 让外层统一处理
catch (err) {
  logger.error({ err }, 'Failed, returning fallback');
  return fallback;
}
```

### 4.7 不要用 JSON.stringify 序列化大对象
```ts
// ❌ 性能差，可能抛异常
logger.info({ data: JSON.stringify(bigObject) }, 'Received');

// ✅ 只打必要字段
logger.info({ id: data.id, type: data.type }, 'Received');
```

## 5. 日志消息格式约定

- **使用英文** — 避免编码问题，便于 grep 搜索
- **消息用现在时态的动作短语** — `'Session created'` 而非 `'Creating session...'`
- **上下文对象放前面，描述消息放后面**（pino 风格）
- **关键 ID 必须作为结构化字段** — `sessionId`、`approvalId`、`clientId` 等

```ts
// ✅ 好的日志消息
logger.info({ port, host }, 'Server started');
logger.info({ sessionId, exitCode }, 'Claude Code session ended');
logger.warn({ approvalId }, 'Approval response for unknown request');
logger.error({ err, command }, 'PTY spawn failed');
```

## 6. Checklist（写代码时对照）

- [ ] 新增函数有关键节点日志？（入口参数 / 异常 / 重要分支）
- [ ] catch 块有 `logger.error({ err, ...上下文 })` ？
- [ ] 日志级别合理？（不该 ERROR 的别 ERROR）
- [ ] 日志含业务标识？（sessionId / approvalId / clientId）
- [ ] 无敏感信息泄露？
- [ ] 无循环内 INFO？无重复日志？
