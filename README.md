# Claude Code Remote

在局域网内通过手机浏览器远程监控和控制 PC 上运行的 Claude Code 会话 —— 查看实时输出、发送指令、审批工具调用。

## 解决什么问题

Claude Code 是强大的 CLI 编程助手，但被绑定在 PC 终端上。离开工位后，任务可能因等待审批而长时间阻塞。

Claude Code Remote 在 PC 和 Claude Code CLI 之间架设轻量级 PTY 代理层：
- 手机浏览器实时查看终端输出
- 远程发送文本指令
- 远程审批/拒绝工具调用
- 回到 PC 后，终端状态完整保留

> **与官方 `remote-control` 的区别**：Claude Code v2.1.51+ 内置了 remote-control 功能，但它通过 Anthropic API 公网中转。本项目是**纯局域网方案**，数据不出内网。

## 工作原理

```
PC Terminal ─── stdin/stdout ───► Proxy Server ─── PTY ───► Claude Code CLI
                                       │
                                  WebSocket
                                       │
                                 手机浏览器
```

开发者运行 `claude-remote`（而非直接运行 `claude`），代理层通过 PTY 伪终端启动 Claude Code：

- PC 终端体验与直接运行 `claude` 完全一致（raw mode 透传）
- PTY 输出同时广播到手机 WebSocket 客户端
- 审批通过 Claude Code 内置的 [Notification Hook](https://docs.anthropic.com/en/docs/claude-code/hooks) 触发，代理层推送到手机，用户决策后通过 PTY 写入按键完成

## 快速开始

### 前置条件

- Node.js >= 20
- pnpm >= 9
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装并可用

### 安装

```bash
git clone <repo-url> claude-code-remote
cd claude-code-remote
pnpm install
```

### 配置审批 Hook

为了让手机端收到审批通知，需要配置 Claude Code 的 Notification Hook：

```bash
./scripts/setup-hooks.sh
```

该脚本会在 `~/.claude/settings.json` 中添加：

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

> 如果已有 `settings.json`，脚本会打印配置内容供手动合并。

### 构建

```bash
./scripts/build.sh
```

### 启动

```bash
node backend/dist/index.js
```

启动后终端会显示：

```
╔══════════════════════════════════════════════════╗
║         Claude Code Remote Proxy Started         ║
╠══════════════════════════════════════════════════╣
║  URL:   http://192.168.1.100:3000               ║
║  Token: a1b2c3d4...e5f6g7h8                     ║
╠══════════════════════════════════════════════════╣
║  Full Token (copy to phone):                     ║
║  a1b2c3d4e5f6g7h8...                             ║
╚══════════════════════════════════════════════════╝
```

### 手机连接

1. 确保手机和 PC 在同一局域网
2. 手机浏览器访问显示的 URL（如 `http://192.168.1.100:3000`）
3. 输入终端上显示的 Token
4. 进入控制台，开始远程操作

### 停止服务

PC 终端处于 raw mode，单次 Ctrl+C 会直接发给 Claude Code（用于取消当前任务）。**连按两次 Ctrl+C（间隔 < 500ms）停止整个代理服务**。

## 开发

```bash
# 启动前后端 dev server（热重载）
pnpm dev

# 只运行后端测试
cd backend && pnpm test -- tests/unit/pty/output-buffer.test.ts

# 只运行前端测试
cd frontend && pnpm test -- tests/components/ApprovalCard.test.tsx

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# E2E 测试（Playwright，真实浏览器 + 真实 Claude CLI）
cd e2e && npx playwright test                    # 全部运行
cd e2e && npx playwright test tests/01-auth.spec.ts  # 单个文件
cd e2e && npx playwright test --headed           # 可视化运行
cd e2e && npx playwright test --update-snapshots # 更新截图基线
cd e2e && npx playwright show-report             # 查看 HTML 报告
```

> E2E 测试是独立包（不在 pnpm workspace 内），首次运行需先安装依赖：
> ```bash
> cd e2e && npm install && npx playwright install chromium
> ```

## 项目结构

```
claude-code-remote/
├── shared/                  # 前后端共享 TypeScript 类型
│   └── src/
│       ├── ws-protocol.ts   # WebSocket 消息协议（核心契约）
│       └── constants.ts     # 共享常量
│
├── backend/                 # Node.js + Express + ws + node-pty
│   └── src/
│       ├── index.ts         # 入口：启动服务、组装依赖
│       ├── config.ts        # 配置加载（环境变量 + 默认值）
│       ├── api/             # REST API 路由
│       ├── auth/            # Token 验证、Session Cookie、限流
│       ├── hooks/           # Claude Code Notification Hook 接收器
│       ├── pty/             # PTY 进程管理 + 输出环形缓冲区
│       ├── session/         # SessionController 核心协调器
│       ├── terminal/        # PC 终端 raw mode 透传
│       ├── ws/              # WebSocket 服务端 + 消息路由
│       └── logger/          # pino 日志
│
├── frontend/                # React 19 + Vite + xterm.js
│   └── src/
│       ├── pages/           # AuthPage / ConsolePage
│       ├── components/      # Terminal / InputBar / ApprovalCard / StatusBar
│       ├── hooks/           # useWebSocket / useTerminal / useAuth / useApproval
│       ├── stores/          # Zustand 状态管理
│       └── services/        # REST API 客户端
│
├── e2e/                     # Playwright 浏览器端到端测试（独立包）
│   ├── fixtures/            # 服务器生命周期管理（global-setup/teardown）
│   ├── helpers/             # 选择器、等待工具、截图工具
│   └── tests/               # 6 个测试文件，20 个测试用例
│
└── scripts/
    ├── setup-hooks.sh       # 配置 Claude Code Notification Hook
    ├── dev.sh               # 开发模式启动
    └── build.sh             # 生产构建
```

## 配置项

所有配置通过环境变量设置，或写入 `.env` 文件（参考 `.env.example`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | 自动检测 LAN IP | 绑定地址，自动检测 `192.168.x.x` 或 `10.x.x.x` |
| `CLAUDE_COMMAND` | `claude` | Claude Code CLI 命令路径 |
| `CLAUDE_ARGS` | `[]` | CLI 额外参数（JSON 数组，如 `["--no-telemetry"]`）|
| `CLAUDE_CWD` | `process.cwd()` | Claude Code 工作目录 |
| `AUTH_TOKEN` | 自动生成 | 固定 Token（不设置则每次启动随机生成）|
| `MAX_BUFFER_LINES` | `10000` | 输出缓冲区最大行数（用于断线重连恢复）|

## 安全模型

- **Token 认证**：启动时生成 32 字节随机 Token，`crypto.timingSafeEqual` 防时序攻击
- **Session Cookie**：HttpOnly + SameSite=Strict，24 小时有效期
- **网络隔离**：服务仅绑定局域网 IP（非 `0.0.0.0`），无 LAN IP 时退回 `127.0.0.1`
- **速率限制**：认证接口 5 次/分钟/IP
- **Hook 安全**：`/api/hook` 仅接受 localhost 请求
- **TLS**：MVP 阶段未启用（局域网内风险可控），后续可加 HTTPS

## 技术栈

| 层 | 技术 |
|----|------|
| 后端运行时 | Node.js >= 20, TypeScript, ESM |
| HTTP 服务 | Express 4 |
| WebSocket | ws 8 |
| PTY 管理 | node-pty 1 |
| 日志 | pino 9 |
| 前端框架 | React 19 |
| 构建工具 | Vite 6 |
| 终端渲染 | xterm.js 5 (WebGL) |
| 状态管理 | Zustand 5 |
| 单元/集成测试 | vitest 3, @testing-library/react |
| E2E 测试 | Playwright (Chromium) |
| 包管理 | pnpm workspace monorepo |

## License

MIT
