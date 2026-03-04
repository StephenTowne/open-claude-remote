# Claude Code Remote — 架构设计文档

## Context

Claude Code 是强大的 CLI 编程助手，但被绑定在本地终端上。开发者离开工位后无法监控和控制正在运行的 Claude Code 会话，导致任务因等待审批而阻塞。

Claude Code Remote 在 PC 和 Claude Code CLI 之间架设轻量级代理层，开发者通过手机浏览器在局域网内远程查看输出、发送指令、审批操作。回到 PC 后，终端状态完整保留。

**注意**: Claude Code v2.1.51+ 已内置 `remote-control` 功能，但它通过 Anthropic API 公网中转，不满足纯局域网安全需求。本项目提供纯本地方案。

---

## 技术决策汇总

| 决策项 | 选择 | 原因 |
|--------|------|------|
| CLI 控制方式 | PTY 伪终端 | 保留 PC 终端原始 CLI 体验 |
| 审批识别 | Hooks 通知 + PTY 审批 | Notification hook 可靠通知审批到达，PTY 写入按键完成审批 |
| 后端 | Node.js + TypeScript (pnpm) | 与 Claude Code 同生态，node-pty 成熟，WebSocket 原生支持好 |
| 前端 | React + Vite + TypeScript (pnpm) | 组件生态丰富，xterm.js 集成好 |
| TLS | MVP 先用 HTTP | 局域网内风险可控，降低初始复杂度 |
| 部署 | 单一服务 | 前端 build 后由 Node.js 后端 serve 静态文件 |
| 多端 | PC 终端 + 手机 Web 双端 | PC 保留原始体验，手机作为辅助控制 |

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer's PC                           │
│                                                                 │
│  ┌──────────────┐     ┌────────────────────────────────────┐    │
│  │  PC Terminal  │◄───►│         Proxy Server (Node.js)     │    │
│  │  (运行 proxy  │ raw │                                    │    │
│  │   而非 claude) │ I/O │  ┌──────────┐  ┌───────────────┐  │    │
│  └──────────────┘     │  │ PTY      │  │ WebSocket     │  │    │
│                       │  │ Manager  │  │ Server        │  │    │
│                       │  └────┬─────┘  └───────┬───────┘  │    │
│                       │       │                │           │    │
│                       │  ┌────┴────────────────┴───────┐  │    │
│                       │  │     Session Controller       │  │    │
│                       │  └────┬────────────────┬───────┘  │    │
│                       │       │                │           │    │
│                       │  ┌────┴─────┐  ┌──────┴────────┐  │    │
│                       │  │ Output   │  │ Auth          │  │    │
│                       │  │ Buffer   │  │ Module        │  │    │
│                       │  └──────────┘  └───────────────┘  │    │
│                       │                                    │    │
│                       │  ┌──────────────────────────────┐  │    │
│                       │  │ HTTP Server (Express)        │  │    │
│                       │  │  ├─ REST API (/api/*)        │  │    │
│                       │  │  └─ Static Files (frontend/) │  │    │
│                       │  └──────────────────────────────┘  │    │
│                       └────────────────────────────────────┘    │
│                              ▲          ▲                       │
│  ┌──────────────┐            │          │                       │
│  │ Claude Code  │◄──── PTY ──┘          │                       │
│  │  CLI (原生)   │                       │                       │
│  └──────┬───────┘            LAN Only (bind to LAN IP)          │
│         │                    HTTP (MVP) / HTTPS (post-MVP)      │
│   Hooks │ Notification                                          │
│   (permission_prompt)                                           │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │ Hook Script  │─── HTTP POST ──► Proxy Server /api/hook       │
│  └──────────────┘                                               │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   手机浏览器         │
                    │   (Web Client)      │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ xterm.js      │  │
                    │  │ Terminal View  │  │
                    │  ├───────────────┤  │
                    │  │ WebSocket     │  │
                    │  │ Client        │  │
                    │  ├───────────────┤  │
                    │  │ Approval UI   │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

### PTY 共享原理

开发者运行 `claude-remote` (本项目) 而非直接运行 `claude`：

```
PC Terminal stdin ──┐
                    ├──► PTY stdin ──► Claude Code CLI
手机 WS input ──────┘

Claude Code CLI ──► PTY stdout ──┬──► PC Terminal stdout (process.stdout.write)
                                 └──► WebSocket broadcast to 手机
```

- 代理层设置 `process.stdin` 为 raw mode，所有按键直接透传到 PTY
- PTY 输出同时写入 `process.stdout`（PC 看到）和 WebSocket（手机看到）
- PC 终端体验与直接运行 `claude` 完全一致

### 审批流程（Hooks 通知 + PTY 审批）

```
1. Claude Code 遇到需要审批的工具调用
2. Claude Code 在终端显示审批提示
3. 同时触发 Notification hook (matcher: permission_prompt)
4. Hook script 向代理层发送 HTTP POST /api/hook (携带审批上下文)
5. 代理层通过 WebSocket 推送 approval_request 到手机
6. 用户在手机上点击 "批准" 或 "拒绝"
7. 代理层通过 PTY 写入对应按键 ('y' 或 Escape)
8. Claude Code 收到输入，继续执行或处理拒绝
9. PC 终端同步显示审批结果
```

### 核心数据流

| 操作 | 数据流 |
|------|--------|
| 查看输出 | Claude CLI → PTY stdout → OutputBuffer + process.stdout + WS broadcast |
| 发送输入（手机）| 手机 InputBar → WS user_input → PTY stdin → Claude CLI |
| 发送输入（PC）| PC stdin → raw mode → PTY stdin → Claude CLI |
| 审批请求 | Claude CLI → Notification Hook → HTTP POST → WS approval_request |
| 审批响应 | 手机 → WS approval_response → PTY stdin (按键) → Claude CLI |
| 重连恢复 | 新 WS 连接 → Server 发送 history_sync (全量缓冲区 + 状态) |

---

## 项目结构

```
claude-code-remote/
├── package.json                       # Root workspace config
├── pnpm-workspace.yaml                # pnpm workspace
├── tsconfig.base.json                 # 共享 TS 配置
├── .env.example
├── CLAUDE.md
├── ARCHITECTURE.md
│
├── docs/
│   ├── PRD.md
│   ├── adrs/                          # 架构决策记录
│   │   └── 001-pty-plus-hooks.md
│   ├── rules/
│   └── sqls/
│
├── shared/                            # 前后端共享类型
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── ws-protocol.ts             # WebSocket 消息类型定义（核心契约）
│       └── constants.ts
│
├── backend/                           # Node.js + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   # 入口：启动服务
│   │   ├── config.ts                  # 配置加载验证
│   │   │
│   │   ├── pty/                       # PTY 管理模块
│   │   │   ├── pty-manager.ts         # 进程生命周期管理
│   │   │   └── output-buffer.ts       # 环形缓冲区（10K行）
│   │   │
│   │   ├── hooks/                     # Hooks 集成模块
│   │   │   └── hook-receiver.ts       # 接收 Hook HTTP POST，解析审批上下文
│   │   │
│   │   ├── ws/                        # WebSocket 模块
│   │   │   ├── ws-server.ts           # WS 服务端 + 连接管理
│   │   │   └── ws-handler.ts          # 消息路由
│   │   │
│   │   ├── session/                   # 会话管理模块
│   │   │   └── session-controller.ts  # 核心协调器：PTY ↔ WS ↔ Terminal ↔ Hook
│   │   │
│   │   ├── auth/                      # 认证模块
│   │   │   ├── token-generator.ts     # 随机 Token 生成
│   │   │   ├── auth-middleware.ts     # Express 认证中间件
│   │   │   └── rate-limiter.ts        # 速率限制
│   │   │
│   │   ├── api/                       # REST API
│   │   │   ├── router.ts
│   │   │   ├── auth-routes.ts         # POST /api/auth
│   │   │   ├── status-routes.ts       # GET /api/status
│   │   │   ├── health-routes.ts       # GET /api/health
│   │   │   └── hook-routes.ts         # POST /api/hook（接收 Hook 通知）
│   │   │
│   │   ├── terminal/                  # PC 终端中继
│   │   │   └── terminal-relay.ts      # raw mode stdin/stdout 透传
│   │   │
│   │   ├── logger/
│   │   │   └── logger.ts             # pino 日志，文件输出
│   │   │
│   │   └── utils/
│   │       ├── network.ts            # LAN IP 检测
│   │       └── constants.ts
│   │
│   └── tests/
│       ├── unit/
│       │   ├── pty/
│       │   │   └── output-buffer.test.ts
│       │   ├── auth/
│       │   │   ├── token-generator.test.ts
│       │   │   └── rate-limiter.test.ts
│       │   ├── hooks/
│       │   │   └── hook-receiver.test.ts
│       │   └── ws/
│       │       └── ws-handler.test.ts
│       └── integration/
│           ├── auth-flow.test.ts
│           └── ws-flow.test.ts
│
├── frontend/                          # React + Vite + TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx           # 认证页
│   │   │   └── ConsolePage.tsx        # 主控制台
│   │   │
│   │   ├── components/
│   │   │   ├── terminal/
│   │   │   │   ├── TerminalView.tsx   # xterm.js 封装
│   │   │   │   └── TerminalToolbar.tsx
│   │   │   ├── input/
│   │   │   │   └── InputBar.tsx       # 底部输入栏
│   │   │   ├── approval/
│   │   │   │   └── ApprovalCard.tsx   # 审批卡片（底部弹出）
│   │   │   ├── status/
│   │   │   │   └── StatusBar.tsx      # 顶部状态指示器
│   │   │   └── common/
│   │   │       ├── ConnectionBanner.tsx
│   │   │       └── SafeArea.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        # WS 连接 + 自动重连
│   │   │   ├── useTerminal.ts         # xterm.js 生命周期
│   │   │   ├── useAuth.ts
│   │   │   ├── useApproval.ts
│   │   │   └── useViewport.ts         # 软键盘高度适配
│   │   │
│   │   ├── services/
│   │   │   ├── api-client.ts
│   │   │   └── ws-protocol.ts
│   │   │
│   │   ├── stores/
│   │   │   └── app-store.ts           # Zustand 状态管理
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   └── styles/
│   │       ├── global.css
│   │       └── variables.css
│   │
│   └── tests/
│       └── components/
│           └── ApprovalCard.test.tsx
│
└── scripts/
    ├── setup-hooks.sh                 # 配置 Claude Code Notification Hook
    ├── dev.sh
    └── build.sh
```

---

## 后端详细设计

### 入口流程 (`backend/src/index.ts`)

```
1. 加载配置 (环境变量 + CLI 参数 + 默认值)
2. 生成随机 auth token (crypto.randomBytes)
3. 检测局域网 IP
4. 创建 Express app
5. 创建 HTTP server
6. 挂载静态文件 (frontend/dist)
7. 挂载 REST API 路由
8. 创建 WebSocket server (noServer 模式，同一 HTTP server)
9. 通过 PTY 启动 Claude Code CLI
10. 创建 SessionController (连接 PTY ↔ WS ↔ Terminal ↔ Hook)
11. 启动 Terminal Relay (raw mode stdin/stdout 透传)
12. 打印访问信息 (URL + Token)
13. server.listen(port, lanIp)
```

### PTY Manager (`backend/src/pty/pty-manager.ts`)

- 使用 `node-pty` 启动 Claude Code CLI
- EventEmitter 模式，emit: `data`, `exit`, `error`
- 方法: `spawn()`, `write()`, `resize()`, `destroy()`
- 终端类型: `xterm-256color`
- PTY 尺寸跟随 PC 终端 (`process.stdout.columns/rows`)

### Output Buffer (`backend/src/pty/output-buffer.ts`)

- 环形缓冲区，最大 10,000 行
- 存储原始 ANSI 字符串（保留格式）
- 方法: `append()`, `getFullContent()`, `sequenceNumber`
- 单调递增序列号，用于重连后增量同步
- 内存上限约 40MB (10K × ~4KB/行)

### Hook Receiver (`backend/src/hooks/hook-receiver.ts`)

- 接收来自 Claude Code Notification Hook 的 HTTP POST
- 解析审批上下文 (tool name, params 等)
- 生成 ApprovalRequest 对象 (带 UUID)
- 触发事件通知 SessionController

**Hook 配置** (需要写入 `~/.claude/settings.json`):
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:3000/api/hook -H 'Content-Type: application/json' -d \"$(cat)\""
          }
        ]
      }
    ]
  }
}
```

Hook 触发时，Claude Code 会将审批上下文通过 stdin 传递给 hook command。`$(cat)` 读取 stdin 内容作为 POST body 发送给代理层。

### WebSocket Server (`backend/src/ws/ws-server.ts`)

- 基于 `ws` 库，noServer 模式
- 在 HTTP upgrade 阶段验证 Session Cookie
- 连接后立即发送 `history_sync` 消息
- 心跳检测: 30 秒间隔 ping/pong
- 方法: `broadcast()`, `sendTo()`, `startHeartbeat()`

### Session Controller (`backend/src/session/session-controller.ts`)

核心协调器，连接所有模块：

```
PTY data  ──► OutputBuffer.append()
          ──► WS broadcast (terminal_output)
          ──► process.stdout.write() (PC 终端)

WS user_input  ──► PTY.write()
WS approval_response ──► PTY.write('y' 或 '\x1b')

Hook notification ──► 生成 ApprovalRequest
                  ──► WS broadcast (approval_request)
                  ──► 更新 status 为 waiting_approval

WS client_connected ──► 发送 history_sync (缓冲区 + 状态 + 待审批)

PTY exit ──► WS broadcast (session_ended)
```

### Terminal Relay (`backend/src/terminal/terminal-relay.ts`)

- 启动时设置 `process.stdin.setRawMode(true)`
- `process.stdin.on('data')` → `ptyManager.write()`
- `process.stdout.on('resize')` → `ptyManager.resize()`
- 退出时恢复 raw mode

### REST API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth` | No | 提交 Token 获取 Session Cookie |
| GET | `/api/status` | Yes | Claude Code 当前状态 |
| GET | `/api/health` | No | 健康检查（不泄露信息）|
| POST | `/api/hook` | Internal | 接收 Hook 通知（仅限 localhost）|

### WebSocket 消息协议 (`shared/src/ws-protocol.ts`)

**Server → Client:**

| type | payload | 说明 |
|------|---------|------|
| `terminal_output` | `{data: string, seq: number}` | 原始 ANSI 终端输出 |
| `status_update` | `{status: "idle"\|"running"\|"waiting_approval", detail?: string}` | 状态变更 |
| `approval_request` | `{id: string, tool: string, description: string, params?: object}` | 审批请求 |
| `history_sync` | `{data: string, seq: number, status: string, pendingApproval?: object}` | 重连恢复 |
| `heartbeat` | `{timestamp: number}` | 心跳 |
| `error` | `{code: string, message: string}` | 错误 |
| `session_ended` | `{exitCode: number, reason: string}` | 会话结束 |

**Client → Server:**

| type | payload | 说明 |
|------|---------|------|
| `user_input` | `{data: string}` | 用户文本输入 |
| `approval_response` | `{id: string, approved: boolean}` | 审批决策 |
| `resize` | `{cols: number, rows: number}` | 终端尺寸（忽略，PTY 跟随 PC）|
| `heartbeat` | `{timestamp: number}` | 心跳 |

### 配置项 (`backend/src/config.ts`)

| 配置 | 默认值 | 环境变量 |
|------|--------|---------|
| port | 3000 | PORT |
| host | 自动检测 LAN IP | HOST |
| claudeCommand | "claude" | CLAUDE_COMMAND |
| claudeArgs | [] | CLAUDE_ARGS |
| claudeCwd | process.cwd() | CLAUDE_CWD |
| token | 自动生成 | AUTH_TOKEN |
| sessionTtlMs | 86400000 (24h) | SESSION_TTL |
| authRateLimit | 5/分钟 | AUTH_RATE_LIMIT |
| maxBufferLines | 10000 | MAX_BUFFER_LINES |
| logDir | `<cwd>/logs` | LOG_DIR |

---

## 前端详细设计

### 组件层级

```
App (路由)
├── AuthPage (/auth)
│   └── TokenInput (密码框 + 提交按钮)
│
└── ConsolePage (/ ，需认证)
    ├── StatusBar (顶部固定, 44px + safe-area)
    │   ├── StatusIndicator (绿=空闲, 蓝=运行, 橙=等待)
    │   └── ConnectionIndicator (已连接/断开)
    │
    ├── TerminalView (中间, flex-grow)
    │   ├── xterm.js Terminal (disableStdin=true，只读)
    │   └── ScrollToBottom 浮动按钮
    │
    ├── InputBar (底部固定, 56px + safe-area)
    │   ├── TextInput (标准 HTML input)
    │   └── SendButton
    │
    ├── ApprovalCard (条件渲染, 底部弹出半屏)
    │   ├── ToolInfo (工具名 + 描述 + 参数)
    │   ├── ApproveButton (绿色)
    │   └── RejectButton (红色)
    │
    └── ConnectionBanner (条件渲染, 断开时显示)
```

### 状态管理 (Zustand)

```typescript
interface AppState {
  isAuthenticated: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  sessionStatus: 'idle' | 'running' | 'waiting_approval';
  pendingApproval: ApprovalRequest | null;
}
```

终端输出不放 store，由 xterm.js 直接管理。

### xterm.js 配置

- `disableStdin: true` — 只读，用户输入通过 InputBar
- `fontSize: 14`, `fontFamily: 'JetBrains Mono'`
- 深色主题: background `#0d1117`
- `scrollback: 10000`
- WebGL renderer (优先) + Canvas fallback
- FitAddon 自适应容器尺寸

### 移动端适配

- **Safe Area**: `env(safe-area-inset-top/bottom)` 适配 iOS 刘海/底部指示器
- **软键盘**: `visualViewport` API 检测键盘高度，动态调整布局
- **自动滚动**: 新输出时自动滚到底部；手动上滑时暂停，显示"回到最新"按钮
- **触摸目标**: 所有按钮 ≥ 44×44pt

### 自动重连

- 指数退避: 1s, 2s, 4s, 8s, 16s, 最大 30s
- 重连后 server 发送 `history_sync` 恢复全量状态
- 断开时显示 ConnectionBanner + 自动重连动画

---

## 安全设计

### Token 认证

1. 启动时 `crypto.randomBytes(32)` 生成 token
2. 仅在 PC 终端显示一次
3. 手机输入后 `POST /api/auth` 验证
4. 服务端用 `crypto.timingSafeEqual()` 防时序攻击
5. 成功后签发 `Set-Cookie: session_id=<hex>; HttpOnly; SameSite=Strict; Path=/`

### 网络隔离

- 服务仅绑定局域网 IP（非 0.0.0.0）
- 自动检测 `192.168.x.x` 或 `10.x.x.x` 网段
- 无 LAN IP 时 fallback 到 `127.0.0.1`

### 速率限制

- 认证接口: 5 次/分钟/IP
- WS 消息: 100 条/秒/客户端
- 超限返回 429

### CORS

- 仅允许 `http://<lanIp>:<port>` 同源
- `credentials: true` 允许 Cookie

### Hook 安全

- `/api/hook` 仅接受来自 localhost (127.0.0.1) 的请求
- 验证 request body 格式

---

## 核心依赖

### Backend

| 包 | 用途 |
|----|------|
| express | HTTP 服务器 + REST API |
| ws | WebSocket 服务器 |
| node-pty | PTY 伪终端管理 |
| cookie | Cookie 解析 |
| cors | CORS 中间件 |
| pino + pino-pretty | 日志 |

### Frontend

| 包 | 用途 |
|----|------|
| react + react-dom | UI 框架 |
| @xterm/xterm | 终端渲染 |
| @xterm/addon-fit | 终端自适应尺寸 |
| @xterm/addon-webgl | 高性能渲染 |
| zustand | 状态管理 |

### Dev

| 包 | 用途 |
|----|------|
| typescript | 类型系统 |
| vitest | 测试框架 |
| vite + @vitejs/plugin-react | 前端构建 |
| tsx | 后端开发运行 |
| concurrently | 并行启动前后端 |
| @testing-library/react | React 组件测试 |

---

## 实施计划

### Phase 1: 核心基础设施（3-4 天）

1. 项目脚手架 (pnpm workspace, tsconfig, package.json)
2. shared 包: WebSocket 消息类型定义
3. PTY Manager + 测试 (spawn, read/write, resize, exit)
4. Output Buffer + 测试 (环形缓冲区)
5. Terminal Relay (raw mode stdin/stdout 透传)
6. Express server + 静态文件服务
7. Token 生成 + REST 认证端点 + Session Cookie
8. WebSocket server + Cookie 认证

**里程碑**: 开发者可通过代理层正常使用 Claude Code，手机可认证。

### Phase 2: 实时终端流（3-4 天）

1. PTY 输出 → WebSocket 广播
2. 前端: AuthPage
3. 前端: xterm.js TerminalView
4. 前端: useWebSocket hook + 自动重连
5. 前端: 重连后 history_sync 恢复
6. 前端: InputBar + 发送 user_input
7. 前端: StatusBar (先用固定状态)

**里程碑**: 手机可实时查看输出并发送指令。

### Phase 3: 审批功能（2-3 天）

1. Hook Receiver + 测试 (接收 Notification hook HTTP POST)
2. Hook 配置脚本 (setup-hooks.sh)
3. SessionController 集成审批流
4. 前端: ApprovalCard 底部弹出组件
5. 前端: 审批响应 → WS → PTY 写入按键
6. StatusBar 接入实时状态

**里程碑**: 完整审批流程可用。MVP 功能完成。

### Phase 4: 安全加固 + 打磨（2-3 天）

1. 速率限制
2. LAN IP 绑定
3. CORS 配置
4. 输入验证 + 大小限制
5. ConnectionBanner (断开提示)
6. PTY 崩溃处理 (session_ended)
7. 日志文件输出 (access.log, error.log)
8. 边缘场景测试

---

## 验证方案

### 功能验证

1. **PC 终端**: 运行 `pnpm start`，验证 Claude Code 正常使用，输出/输入与直接运行 `claude` 一致
2. **手机认证**: 手机浏览器访问 `http://<lan-ip>:3000`，输入 Token，成功进入控制台
3. **实时输出**: 在 PC 上让 Claude Code 执行任务，手机实时看到输出
4. **远程输入**: 在手机输入指令，PC 终端同步显示
5. **审批流程**: 触发需要审批的操作，手机收到审批卡片，批准后 Claude Code 继续
6. **重连恢复**: 手机断开 WiFi 后重连，验证状态完整恢复
7. **PC 无缝衔接**: 在手机操作后回到 PC，验证终端一切正常

### 性能验证

- WebSocket 消息延迟 < 50ms (局域网)
- 端到端操作延迟 < 200ms
- 代理层内存 < 100MB
- 空闲 CPU < 1%

### 安全验证

- 错误 Token 认证失败，5 次后锁定
- 非 LAN IP 无法访问
- 未认证无法访问 WS 和受保护 API
