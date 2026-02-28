# Claude Code Remote

在局域网内通过手机浏览器远程监控和控制 PC 上运行的 Claude Code 会话。

## 简介

Claude Code 是强大的 CLI 编程助手，但被绑定在 PC 终端上。离开工位后，任务可能因等待审批而长时间阻塞。

Claude Code Remote 在 PC 和 Claude Code CLI 之间架设代理层：
- 手机浏览器实时查看终端输出
- 远程发送文本指令
- 在手机上查看”等待输入”提示并远程发送按键/文本
- **多实例支持**：不同项目各启一个 claude-remote，手机端 Tab 切换
- 回到 PC 后，终端状态完整保留

> **与官方 `remote-control` 的区别**：Claude Code v2.1.51+ 内置了 remote-control 功能，但它通过 Anthropic API 公网中转。本项目是**纯局域网方案**，数据不出内网。

## 安装

### 前置条件

- Node.js >= 20
- pnpm >= 9
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装并可用

### 一键安装

```bash
git clone <repo-url> claude-code-remote
cd claude-code-remote
./install.sh
```

脚本会自动完成：依赖安装 → 项目构建 → 全局链接 `claude-remote` 命令 → 配置 Claude Code Hook。

### 手动安装

```bash
# 1. 克隆并安装依赖
git clone <repo-url> claude-code-remote
cd claude-code-remote
pnpm install

# 2. 构建
pnpm build

# 3. 全局链接命令
pnpm link -g

# 4. 配置审批 Hook（让手机能收到审批通知）
./scripts/setup-hooks.sh
```

## 使用

### 启动

```bash
# 基本用法（等同于直接运行 claude）
claude-remote

# 透传参数给 claude
claude-remote chat
claude-remote -- --dangerously-skip-permissions

# 自定义代理层选项
claude-remote --port 8080
claude-remote --name my-project   # 自定义实例名称（默认为工作目录名）
claude-remote --help
```

首次启动时终端显示完整 Token：

```
╔══════════════════════════════════════════════════╗
║         Claude Code Remote Proxy Started         ║
╠══════════════════════════════════════════════════╣
║  Instance: my-project                            ║
║  URL:      http://192.168.1.100:3000             ║
║  Token:    a1b2c3d4...e5f6g7h8                   ║
╠══════════════════════════════════════════════════╣
║  Full Token (copy to phone):                     ║
║  a1b2c3d4e5f6g7h8...                             ║
╚══════════════════════════════════════════════════╝
```

后续启动的实例共用相同 Token，不再重复显示：

```
╔══════════════════════════════════════════════════╗
║         Claude Code Remote Proxy Started         ║
╠══════════════════════════════════════════════════╣
║  Instance: api-server                            ║
║  URL:      http://192.168.1.100:3001             ║
║  Token:    (shared, see first instance)          ║
╚══════════════════════════════════════════════════╝
```

### 多实例使用

在不同终端 Tab 中为不同项目启动 claude-remote：

```bash
# Tab 1: ~/projects/app
cd ~/projects/app && claude-remote

# Tab 2: ~/projects/api
cd ~/projects/api && claude-remote --name api
```

- **Token 共享**：所有实例使用同一个 Token（存储在 `~/.claude-remote/token`），只需认证一次
- **端口自动分配**：默认端口 3000 被占用时自动递增（3001, 3002...）
- **实例注册表**：实例信息记录在 `~/.claude-remote/instances.json`，进程退出时自动清理

### 手机连接

1. 确保手机和 PC 在同一局域网
2. 手机浏览器访问任意实例的 URL（如 `http://192.168.1.100:3000`）
3. 输入终端上显示的 Token
4. 进入控制台，开始远程操作
5. **多实例时**：顶部出现 Tab 栏，点击切换不同实例（自动认证，终端内容自动恢复）

> **CLI 模式**：运行 `claude-remote` 时终端保持干净（只有 Claude CLI 交互界面），连接信息写入 `logs/connection.txt`。查看命令：`cat logs/connection.txt`

### 停止服务

PC 终端处于 raw mode，单次 Ctrl+C 会直接发给 Claude Code（用于取消当前任务）。**连按两次 Ctrl+C（间隔 < 500ms）停止整个代理服务**。

## 配置

所有配置通过环境变量设置，或写入 `.env` 文件：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 首选端口（被占用时自动递增）|
| `HOST` | 自动检测 LAN IP | 绑定地址 |
| `AUTH_TOKEN` | 共享 Token | 覆盖共享 Token（设置后所有实例使用此值）|
| `INSTANCE_NAME` | 工作目录名 | 实例名称（等同 `--name`）|
| `CLAUDE_COMMAND` | `claude` | Claude Code CLI 命令路径 |
| `CLAUDE_ARGS` | `[]` | CLI 额外参数（JSON 数组）|

示例 `.env` 文件：

```env
PORT=8080
AUTH_TOKEN=my-secret-token
CLAUDE_ARGS=["--no-telemetry"]
```

## 安全

- **Token 认证**：首次启动时生成 32 字节随机 Token，持久化到 `~/.claude-remote/token`
- **Session Cookie**：HttpOnly + SameSite=Lax，24 小时有效期
- **网络隔离**：服务仅绑定局域网 IP，无 LAN IP 时退回 `127.0.0.1`
- **速率限制**：认证接口 5 次/分钟/IP
- **Hook 安全**：`/api/hook` 仅接受 localhost 请求

---

# 开发者指南

## 工作原理

```
PC Terminal ─── stdin/stdout ───► Proxy Server ─── PTY ───► Claude Code CLI
                                       │
                                  WebSocket
                                       │
                                 手机浏览器
```

`claude-remote` 命令通过 PTY 伪终端启动 Claude Code：
- PC 终端体验与直接运行 `claude` 完全一致（raw mode 透传）
- PTY 输出同时广播到手机 WebSocket 客户端
- “等待输入”提示通过 Claude Code 内置的 [Notification Hook](https://docs.anthropic.com/en/docs/claude-code/hooks) 触发

## 开发命令

```bash
# 启动前后端 dev server（热重载）
pnpm dev

# 后端测试
cd backend && pnpm test -- tests/unit/pty/output-buffer.test.ts

# 前端测试
cd frontend && pnpm test -- tests/components/VirtualKeyBar.test.tsx

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

## E2E 测试

E2E 测试是独立包（不在 pnpm workspace 内）：

```bash
cd e2e && npm install && npx playwright install chromium

cd e2e && npx playwright test                    # 全部运行
cd e2e && npx playwright test tests/01-auth.spec.ts  # 单个文件
cd e2e && npx playwright test --headed           # 可视化运行
cd e2e && npx playwright show-report             # 查看 HTML 报告
```

## 项目结构

```
claude-code-remote/
├── shared/                  # 前后端共享 TypeScript 类型
├── backend/                 # Node.js + Express + ws + node-pty
│   └── src/
│       ├── cli.ts           # CLI 入口
│       ├── index.ts         # 服务入口
│       ├── api/             # REST API 路由
│       ├── auth/            # Token 验证、Session Cookie
│       ├── hooks/           # Claude Code Hook 接收器
│       ├── pty/             # PTY 进程管理
│       ├── registry/        # 多实例注册表、共享 Token、端口分配
│       ├── session/         # SessionController 协调器
│       ├── terminal/        # PC 终端 raw mode 透传
│       └── ws/              # WebSocket 服务端
├── frontend/                # React 19 + Vite + xterm.js
│   └── src/
│       ├── pages/           # AuthPage / ConsolePage
│       ├── components/      # UI 组件
│       ├── hooks/           # React hooks
│       └── stores/          # Zustand 状态管理
└── e2e/                     # Playwright 端到端测试
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js, TypeScript, Express, ws, node-pty, pino |
| 前端 | React 19, Vite, xterm.js, Zustand |
| 测试 | vitest, @testing-library/react, Playwright |
| 包管理 | pnpm workspace |

## License

MIT