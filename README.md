# Claude Code Remote

**手机远程掌控 PC 终端的 Claude Code**

在局域网内通过手机浏览器实时查看终端输出、发送指令、审批工具调用——离开工位也能继续工作。

---

## 快速开始 (3 步)

### 1. 安装

```bash
git clone <repo-url> claude-code-remote
cd claude-code-remote
./install.sh
```

### 2. 启动

```bash
claude-remote
```

### 3. 扫码连接

PC 终端显示 ASCII 二维码 → 手机扫码 → 自动填充 Token → 开始使用

---

## 功能亮点

### 实时终端同步
- PC 终端完整输出实时同步到手机
- 支持 ANSI 颜色渲染
- 10K 行历史记录，重连自动恢复

### 快捷按键栏
- 一键发送 Esc、方向键、Ctrl+C 等
- 自定义快捷键（在设置中配置）
- 预设常用命令（/help, /clear 等）

### 多实例管理
- 不同项目各启一个 claude-remote
- 手机顶部 Tab 切换，无需重新认证
- 实例掉线自动切换到下一个
- **Web 创建实例**：通过 UI 创建新实例（点击 Tab 栏的 "+" 按钮，工作目录限制在 home 目录或 `workspaces` 白名单）
- **PC Attach**：`claude-remote attach <port|name>` 接管 web 创建的实例

### 推送通知
- Claude 等待输入时推送通知到手机
- 后台运行也能收到提醒

### Web UI 设置界面
- 可视化配置快捷键
- 命令管理（自动补足 `/` 前缀）
- 配置即时生效

---

## 常见问题

### 找不到 `claude-remote` 命令？

确保已执行 `pnpm link -g`，或使用 `node backend/dist/cli.js` 直接运行。

### 二维码扫不出来？

1. 确保手机和 PC 在同一局域网
2. 手动访问终端显示的 URL，输入 Token

### 手机无法连接？

1. 检查 PC 防火墙是否放行端口（默认 3000）
2. 检查终端显示的 URL 是否为正确的局域网 IP
3. 如果使用 VPN，可能需要配置 `host` 选项（见下方配置说明）

### 如何配置 Hook（审批通知）？

首次启动后执行：

```bash
./scripts/setup-hooks.sh
```

Hook 配置详情请参见 [ARCHITECTURE.md#routes](./ARCHITECTURE.md#5-routes)。

---

## 基本用法

```bash
# 直接运行（等同于 claude）
claude-remote

# 透传参数
claude-remote chat
claude-remote -- --dangerously-skip-permissions

# 自定义选项
claude-remote --port 8080
claude-remote --name my-project

# 接管 web 创建的实例
claude-remote attach 3001        # 按端口
claude-remote attach my-project  # 按名称
```

### 停止服务

- 单次 Ctrl+C：发送给 Claude Code（取消当前任务）
- **两次 Ctrl+C（间隔 < 500ms）**：停止代理层

停止所有实例：

```bash
pnpm stop
```

---

## 安全

- **Token 认证**：32 字节随机 Token，首次启动生成
- **Session Cookie**：HttpOnly + SameSite=Lax，24 小时有效
- **网络隔离**：仅绑定局域网 IP，无公网暴露
- **速率限制**：认证接口 5 次/分钟/IP
- **Hook 安全**：仅接受 localhost 请求

---

## 配置文件

配置文件位于 `~/.claude-remote/config.json`。项目根目录提供 `config.example.json` 作为模板：

```bash
cp config.example.json ~/.claude-remote/config.json
```

### 完整配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `port` | number | 3000 | 服务监听端口（被占用自动递增） |
| `host` | string | "0.0.0.0" | 绑定地址 |
| `token` | string \| null | null | 认证 Token，`null` 自动生成共享 Token |
| `claudeCommand` | string | "claude" | Claude CLI 命令路径（可用绝对路径） |
| `claudeArgs` | string[] | [] | Claude CLI 额外参数 |
| `claudeCwd` | string \| null | null | Claude 工作目录，`null` 使用当前目录 |
| `sessionTtlMs` | number | 86400000 | Session 有效期（毫秒，默认 24 小时） |
| `authRateLimit` | number | 20 | 认证速率限制（每分钟每 IP 次数） |
| `maxBufferLines` | number | 10000 | 输出缓冲区最大行数 |
| `instanceName` | string \| null | null | 实例名称，`null` 使用工作目录名 |
| `shortcuts` | array | 见下方 | 快捷输入列表 |
| `commands` | array | 见下方 | 自定义命令列表 |
| `workspaces` | string[] | [] | 预设工作目录列表（Web 创建实例的白名单） |

**优先级**：CLI 参数 > 配置文件 > 默认值

### 快捷输入 (shortcuts)

快捷输入显示在终端下方的快捷栏，用于快速发送常用按键或文本：

```json
{
  "shortcuts": [
    { "label": "确认", "data": "y", "enabled": true, "desc": "确认操作" },
    { "label": "取消", "data": "\u001b", "enabled": true, "desc": "取消操作 (ESC)" },
    { "label": "继续", "data": "\r", "enabled": true, "desc": "继续执行 (Enter)" },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true, "desc": "中断当前操作" },
    { "label": "是的", "data": "yes", "enabled": false, "desc": "完整 yes 输入" }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | string | 按钮显示名称 |
| `data` | string | 发送的数据（支持转义字符如 `\u001b` 表示 ESC） |
| `enabled` | boolean | 是否启用 |
| `desc` | string | 描述（可选） |

**常用转义值**：
- `\u001b` - ESC 键
- `\r` - Enter 键
- `\u0003` - Ctrl+C
- `\u0004` - Ctrl+D

### 自定义命令 (commands)

自定义命令显示在快捷栏的命令区域，点击后直接发送到终端：

```json
{
  "commands": [
    { "label": "/help", "command": "/help", "enabled": true, "desc": "帮助说明" },
    { "label": "/clear", "command": "/clear", "enabled": true },
    { "label": "/feature-dev:feature-dev", "command": "/feature-dev:feature-dev", "enabled": false, "desc": "启动feature-dev SKILL" }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | string | 按钮显示名称 |
| `command` | string | 要执行的命令 |
| `enabled` | boolean | 是否启用 |
| `desc` | string | 描述（可选） |

### 工作区白名单 (workspaces)

配置后，通过 Web 创建实例时只能选择这些目录：

```json
{
  "workspaces": [
    "/Users/tom/projects/api",
    "/Users/tom/projects/web",
    "/Users/tom/projects/cli"
  ]
}
```

若未配置，Web 创建实例时只能选择 home 目录下的项目。

### 完整示例

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "token": null,

  "claudeCommand": "claude",
  "claudeArgs": ["--no-telemetry"],
  "claudeCwd": null,

  "sessionTtlMs": 86400000,
  "authRateLimit": 20,
  "maxBufferLines": 10000,
  "instanceName": null,

  "shortcuts": [
    { "label": "确认", "data": "y", "enabled": true },
    { "label": "取消", "data": "\u001b", "enabled": true },
    { "label": "继续", "data": "\r", "enabled": true },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true }
  ],

  "commands": [
    { "label": "Git Status", "command": "git status", "enabled": true },
    { "label": "Git Log", "command": "git log --oneline -10", "enabled": true }
  ],

  "workspaces": [
    "/Users/tom/projects/api",
    "/Users/tom/projects/web"
  ]
}
```

---

## 前置条件

- Node.js >= 20
- pnpm >= 9
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装

---

## 开发者文档

参见 [ARCHITECTURE.md](./ARCHITECTURE.md)，包含：
- 技术栈详情
- 架构分层
- 数据流图
- API 路由
- 部署说明

---

## License

MIT