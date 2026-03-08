# Claude Code Remote

**Control Claude Code from your mobile browser over LAN.**

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

**Control Claude Code from your mobile browser over LAN.**

View terminal output, send commands, and approve tool calls from your phone — keep working even when you step away from your desktop.

---

## Quick Start

### 1. Install

```bash
# npm
npm install -g @caoruhua/open-claude-remote

# pnpm (recommended)
pnpm add -g @caoruhua/open-claude-remote
```

> **Note for pnpm users**: pnpm v10 may show a warning about "Ignored build scripts: node-pty". This is expected and **does not affect functionality** — the package includes prebuilt binaries that work out of the box. To suppress the warning, run `pnpm approve-builds -g` (optional).

### 2. Run

```bash
claude-remote
```

### 3. Connect

Scan the QR code shown in your terminal with your phone. The auth token is auto-filled — you're ready to go.

> On first run, `claude-remote` will automatically check for and install missing dependencies (pnpm, Claude CLI). Hooks are also configured automatically — no manual setup needed.

---

## Features

### Terminal Sync
- Real-time terminal output streamed to your phone
- Full ANSI color rendering via xterm.js
- 10K-line scrollback buffer, auto-restored on reconnect
- **Multi-network support** — displays all available IPs (WiFi, VPN, Ethernet) on startup
- LAN IP change notification with new connection URL
- Smart auto-scroll with a "scroll to bottom" floating button — respects your scroll position when browsing history

### Multi-Network Access (WiFi + VPN)

Access Claude Code Remote from multiple network interfaces simultaneously:

- **Automatic network detection** — discovers all available IPv4 interfaces on startup
- **VPN support** — detects common VPN interfaces (WireGuard, Tailscale, ZeroTier, PPP, etc.)
- **Custom CIDR ranges** — configure `customPrivateRanges` to add company-specific networks
- **Network change notifications** — WebSocket `network_changed` events notify clients when interfaces change
- **Unified CORS** — all detected IPs are automatically added to the CORS allowlist

Example: When connected to both WiFi (192.168.x.x) and company VPN (30.x.x.x), both addresses are displayed on startup and accessible via the web UI.

### Quick Actions
- One-tap keys: Esc, Enter, Tab, arrows, Shift+Tab
- Custom shortcuts (configurable in settings)
- Preset commands (/clear, /compact, /resume, etc.)

### First-time Guide
- Interactive spotlight guide on first visit
- Highlights key UI elements with coach marks
- Auto-skips on subsequent visits

### Multi-Instance
- Run multiple `claude-remote` instances simultaneously in a single daemon process
- Fixed port 8866 — all instances share same origin, no cross-port auth needed
- Browser tab bar for switching — no re-authentication needed
- Auto-switch when an instance goes offline
- Spawn new instances from the web UI ("+" button)
- Copy instance via long-press/right-click tab — pre-fills working directory, settings, and arguments
- `claude-remote attach <name|id>` to take over a web-spawned instance
- `claude-remote stop` to stop the daemon and all instances

### Window Resize Priority

When multiple clients are connected, window size is controlled by:
**WebApp (mobile) > Attach (PC) > PC Terminal**

| Scenario | Controller | Behavior |
|----------|-----------|----------|
| No client connected | PC Terminal | Normal local usage |
| WebApp only | WebApp | Mobile controls window size |
| Attach only | Attach | PC attach controls size |
| WebApp + Attach | WebApp | Mobile is primary, PC follows |

- Attach resize requests are ignored when WebApp is online
- Attach auto-syncs to WebApp's window size on connect

### Notifications

Get notified when Claude is waiting for input. All notifications include the instance URL so you can quickly reconnect even if the IP changes.

**Web Push** — works even when the browser is in the background or the screen is locked. Just allow notifications when prompted.

**Channel Toggle** — each notification channel has a toggle switch in the settings. Toggle to enable/disable without deleting the configuration. Changes take effect immediately across all running instances.

**DingTalk** — configure a DingTalk bot webhook to receive notifications on your team channel:

```json
{
  "notifications": {
    "dingtalk": {
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=your-token"
    }
  }
}
```

> **Note**: Legacy config files with root-level `dingtalk` field are automatically migrated to `notifications.dingtalk` on first load.

**Setup steps:**
1. Open DingTalk group → Group Settings → Smart Group Assistant → Add Robot → Custom
2. For security settings, select "Custom Keywords" and add `Claude` (the message title includes this keyword)
3. Copy the Webhook URL to your config file or paste it in the Web UI settings

**WeChat (Server酱³)** — configure Server酱³ to receive notifications on WeChat:

```json
{
  "notifications": {
    "wechat_work": {
      "sendKey": "SCTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

**Setup steps:**
1. Visit [Server酱 Sendkey](https://sct.ftqq.com/sendkey) and sign in with WeChat
2. Copy your SendKey (starts with `SCT`)
3. Paste it in your config file or in the Web UI settings

---

## Usage

```bash
# Start Claude Code (starts daemon + first instance)
claude-remote

# Pass arguments to Claude
claude-remote chat
claude-remote -- --dangerously-skip-permissions

# Custom options
claude-remote --name my-project
claude-remote --token my-secret-token

# Attach to an existing instance
claude-remote attach my-project  # by name
claude-remote attach 550e8400     # by instance ID prefix

# List all running instances
claude-remote list

# Show daemon status (PID, port, uptime, instance count, three-version info)
claude-remote status

# Stop the daemon and all instances
claude-remote stop

# Headless mode (no local terminal, web UI only)
claude-remote --no-terminal

# Check version
claude-remote --version

# Update to latest version
claude-remote update
```

### Version Checks

`claude-remote status` displays three versions with actionable advice:

- **Installed** — CLI version on disk
- **Daemon** — version cached by the running daemon (✓ or "outdated")
- **Latest** — newest version on npm (✓ or "new")

On startup, a background npm check runs without blocking. If a newer version exists, a one-line hint is printed to stderr.

After `claude-remote update`, the daemon is automatically restarted if no instances are running. If instances exist, you'll see a reminder to restart manually.

### Stopping

- **Single Ctrl+C** — sent to Claude Code (cancels current task)
- **Double Ctrl+C** (within 500ms) — stops the proxy server

---

## Configuration

Config file: `~/.claude-remote/settings.json` (legacy `config.json` is auto-migrated)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | "0.0.0.0" | Bind address |
| `token` | string \| null | null | Auth token; `null` = auto-generated shared token |
| `claudeCommand` | string | "claude" | Claude CLI path |
| `claudeArgs` | string[] | [] | Extra Claude CLI arguments (merged with CLI args, deduplicated) |
| `claudeCwd` | string \| null | null | Claude working directory; `null` = current dir |
| `sessionTtlMs` | number | 86400000 | Session TTL in ms (default: 24h) |
| `authRateLimit` | number | 20 | Auth rate limit (per minute per IP) |
| `maxBufferLines` | number | 10000 | Output buffer max lines |
| `instanceName` | string \| null | null | Instance name; `null` = working dir name |
| `shortcuts` | array | see below | Quick-input buttons |
| `commands` | array | see below | Custom command buttons |
| `workspaces` | string[] | [] | Allowed working directories for web-spawned instances |
| `settingsDirs` | string[] | ["~/.claude/", "~/.claude-remote/settings/"] | Directories to scan for settings files |
| `notifications` | object | — | Notification channels config (see below) |
| `customPrivateRanges` | string[] | [] | Custom CIDR ranges for CORS allowlist (e.g., `["30.0.0.0/8"]` for VPN networks) |

> **Note**: Port is fixed at 8866. All instances run in a single daemon process.

**Notification channel config:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `webhookUrl` | string | — | DingTalk webhook URL |
| `sendKey` | string | — | Server酱³ SendKey (WeChat) |
| `enabled` | boolean | true | Whether the channel is active |

**Priority**: CLI args > config file > defaults (except `claudeArgs` which is merged)

### Project-level Configuration

Shortcuts and commands are automatically saved per-project when configured through the Web UI with an active instance:

- Configuration is stored in `<project-dir>/.claude-remote/settings.json`
- When opening settings from an instance view, `shortcuts` and `commands` changes are saved to the project directory
- When opening settings without an active instance, changes are saved to the global config (`~/.claude-remote/settings.json`)

This allows each project to have its own set of commands while sharing global settings like notifications.

### Shortcuts

Quick-input buttons displayed below the terminal.

**Default shortcuts:**

| Key | Data | Description |
|-----|------|-------------|
| Esc | `\u001b` | ESC key |
| Enter | `\r` | Enter key |
| Tab | `\t` | Tab key |
| ↑ | `\u001b[A` | Up arrow |
| ↓ | `\u001b[B` | Down arrow |
| ← | `\u001b[D` | Left arrow |
| → | `\u001b[C` | Right arrow |
| S-Tab | `\u001b[Z` | Shift+Tab |
| Ctrl+O | `\u000f` | Ctrl+O |
| Ctrl+E | `\u0005` | Ctrl+E |

**Custom example:**

```json
{
  "shortcuts": [
    { "label": "Yes", "data": "y", "enabled": true, "desc": "Confirm" },
    { "label": "Esc", "data": "\u001b", "enabled": true, "desc": "Cancel (ESC)" },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true, "desc": "Interrupt" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Button display text |
| `data` | string | Data to send (supports escape sequences like `\u001b` for ESC) |
| `enabled` | boolean | Whether the button is active |
| `desc` | string | Description (optional) |

**Common escape values:**
- `\u001b` - ESC
- `\r` - Enter
- `\u0003` - Ctrl+C
- `\u0004` - Ctrl+D

### Commands

Custom command buttons in the shortcut bar.

**Default commands:**

| Command | Description |
|---------|-------------|
| /clear | Clear screen |
| /compact | Compact conversation |
| /resume | Resume session |
| /stats | Statistics |
| /exit | Exit |

**Skills as Commands:**

Skills defined in `~/.claude/skills/*/SKILL.md` or `<project>/.claude/skills/*/SKILL.md` are automatically converted to slash commands. For example, a skill named `finish-task` becomes `/finish-task` in the command bar.

- Skills are scanned on each `/api/config` request
- Project-level skills override global skills with the same name
- User modifications (enabled, autoSend) are preserved across scans

**Custom example:**

```json
{
  "commands": [
    { "label": "/help", "command": "/help", "enabled": true },
    { "label": "Git Status", "command": "git status", "enabled": true, "autoSend": false }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `label` | string | — | Button display text |
| `command` | string | — | Command to execute |
| `enabled` | boolean | — | Whether the button is active |
| `autoSend` | boolean | `true` | `true` = send immediately, `false` = fill input box |

> Commands starting with `/` are Claude Code slash commands. Other commands are executed in the terminal.

### Workspaces

Restrict which directories web-spawned instances can use:

```json
{
  "workspaces": [
    "/home/user/projects/api",
    "/home/user/projects/web"
  ]
}
```

If not configured, web-spawned instances can only select projects from existed claude instances

### Settings Files

When creating instances from the web UI, you can select a custom settings file to pass via `--settings`. Settings files must:

1. Be named with `settings` prefix (e.g., `settings-project-a.json`, `settings.idea.json`)
2. Be valid JSON files ending in `.json`
3. Be located in one of the configured scan directories

**Default scan directories:**
- `~/.claude/` — Claude Code config directory
- `~/.claude-remote/settings/` — Claude Remote custom settings

**Custom directories:**

```json
{
  "settingsDirs": [
    "~/.claude/",
    "~/.claude-remote/settings/",
    "~/my-custom-settings/"
  ]
}
```

**Example settings file** (`~/.claude/settings-project-a.json`):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  },
  "permissions": {
    "allow": ["Bash(git:*)", "Bash(npm:*)"]
  }
}
```

> **Note**: Port-numbered JSON files are automatically excluded from the settings file list.

### Complete Example

```json
{
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
    { "label": "Yes", "data": "y", "enabled": true },
    { "label": "Esc", "data": "\u001b", "enabled": true },
    { "label": "Enter", "data": "\r", "enabled": true },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true }
  ],

  "commands": [
    { "label": "Git Status", "command": "git status", "enabled": true },
    { "label": "Git Log", "command": "git log --oneline -10", "enabled": true }
  ],

  "workspaces": [
    "/home/user/projects/api",
    "/home/user/projects/web"
  ],

  "notifications": {
    "dingtalk": {
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=your-token"
    }
  }
}
```

---

## Security

- **Token auth** — 32-byte random token, generated on first run
- **Session cookie** — HttpOnly + SameSite=Lax, 24-hour TTL
- **Network isolation** — binds to LAN IP only, no public exposure
- **Rate limiting** — 20 auth attempts/min/IP
- **Hook security** — accepts localhost requests only

---

## Troubleshooting

### `node-pty` build failure

Install build tools:

| OS | Command |
|----|---------|
| macOS | `xcode-select --install` |
| Ubuntu/Debian | `sudo apt-get install build-essential python3` |
| Fedora/RHEL | `sudo dnf groupinstall 'Development Tools'` |
| Arch Linux | `sudo pacman -S base-devel python` |

### QR code won't scan?

1. Make sure your phone and PC are on the same network
2. Manually open the URL shown in the terminal and enter the token

### Phone can't connect?

1. Check your PC firewall allows port 8866
2. Verify the URL shows the correct LAN IP
3. If using a VPN, try setting the `host` option explicitly

---

## Prerequisites

- **Node.js** >= 20
- **Claude Code CLI** — [installation guide](https://docs.anthropic.com/en/docs/claude-code)

> `pnpm` and Claude CLI will be auto-installed on first run if missing.

---

## Development

**Source development:**

```bash
# Clone and install
git clone https://github.com/StephenTowne/open-claude-remote.git
cd open-claude-remote
pnpm install

# Development mode (with hot reload)
pnpm dev:cli

# Production mode
pnpm build && pnpm link -g && claude-remote
```

**Project structure:**

- Backend: `backend/src/` (Express + node-pty + WebSocket)
- Frontend: `frontend/src/` (React + xterm.js)
- Shared types: `shared/` (imported via `#shared` alias)
- Tests: `pnpm test` (Vitest)
- Build: `pnpm build` (TypeScript + Vite)

### Stop all instances

```bash
pnpm stop
```

---

## License

MIT

---
---

<a name="中文"></a>
## 中文

**通过局域网在手机浏览器中控制 Claude Code。**

在手机上查看终端输出、发送命令、审批工具调用 — 即使离开桌面也能继续工作。

---

## 快速开始

### 1. 安装

```bash
# npm
npm install -g @caoruhua/open-claude-remote

# pnpm（推荐）
pnpm add -g @caoruhua/open-claude-remote
```

> **pnpm 用户注意**：pnpm v10 可能显示 "Ignored build scripts: node-pty" 警告。这是正常的，**不影响功能** — 包含预编译的二进制文件，开箱即用。要消除警告，运行 `pnpm approve-builds -g`（可选）。

### 2. 运行

```bash
claude-remote
```

### 3. 连接

用手机扫描终端显示的二维码。认证令牌自动填充 — 就可以开始使用了。

> 首次运行时，`claude-remote` 会自动检查并安装缺失的依赖（pnpm、Claude CLI）。Hook 也会自动配置 — 无需手动设置。

---

## 功能特性

### 终端同步
- 实时终端输出推送到手机
- 通过 xterm.js 完整渲染 ANSI 颜色
- 1万行滚动缓冲区，重连时自动恢复
- **多网络支持** — 启动时显示所有可用 IP（WiFi、VPN、以太网）
- 局域网 IP 变更通知，附带新连接地址
- 智能自动滚动，配有"滚动到底部"悬浮按钮 — 浏览历史时尊重你的滚动位置

### 多网络访问（WiFi + VPN）

同时从多个网络接口访问 Claude Code Remote：

- **自动网络检测** — 启动时自动发现所有可用的 IPv4 接口
- **VPN 支持** — 自动识别常见 VPN 接口（WireGuard、Tailscale、ZeroTier、PPP 等）
- **自定义 CIDR 网段** — 配置 `customPrivateRanges` 添加公司特定网络
- **网络变更通知** — WebSocket `network_changed` 事件在接口变化时通知客户端
- **统一 CORS** — 所有检测到的 IP 自动添加到 CORS 白名单

示例：当同时连接 WiFi（192.168.x.x）和公司 VPN（30.x.x.x）时，启动时会显示两个地址，都可以通过 Web UI 访问。

### 快捷操作
- 一键发送：Esc、Enter、Tab、方向键、Shift+Tab
- 自定义快捷键（设置中配置）
- 预设命令（/clear、/compact、/resume 等）

### 新手引导
- 首次访问时显示交互式高亮引导
- 聚焦关键 UI 元素并显示提示标记
- 后续访问自动跳过

### 多实例支持
- 在单个守护进程中同时运行多个 `claude-remote` 实例
- 固定端口 8866 — 所有实例共享同源，无需跨端口认证
- 浏览器标签栏切换 — 无需重新认证
- 实例离线时自动切换
- 从 Web UI 生成新实例（"+" 按钮）
- 长按/右键标签复制实例 — 预填充工作目录、设置和参数
- `claude-remote attach <名称|ID>` 接管 Web 生成的实例
- `claude-remote stop` 停止守护进程和所有实例

### 窗口大小优先级

当多个客户端连接时，窗口大小由以下优先级控制：
**WebApp（手机）> Attach（PC）> PC 终端**

| 场景 | 控制方 | 行为 |
|------|--------|------|
| 无客户端连接 | PC 终端 | 正常本地使用 |
| 仅 WebApp | WebApp | 手机控制窗口大小 |
| 仅 Attach | Attach | PC attach 控制大小 |
| WebApp + Attach | WebApp | 手机优先，PC 跟随 |

- WebApp 在线时，Attach 的调整大小请求被忽略
- Attach 连接时自动同步 WebApp 的窗口大小

### 通知

当 Claude 等待输入时收到通知。所有通知都包含实例 URL，即使 IP 变更也能快速重连。

**Web 推送** — 即使浏览器在后台或屏幕锁定也能工作。只需在提示时允许通知即可。

**渠道开关** — 每个通知渠道在设置中都有开关。切换即可启用/禁用，无需删除配置。更改立即生效于所有运行中的实例。

**钉钉** — 配置钉钉机器人 webhook，在团队群中接收通知：

```json
{
  "notifications": {
    "dingtalk": {
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=your-token"
    }
  }
}
```

> **注意**：旧版配置文件中的根级 `dingtalk` 字段会在首次加载时自动迁移到 `notifications.dingtalk`。

**设置步骤：**
1. 打开钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义
2. 安全设置选择"自定义关键词"，添加 `Claude`（消息标题包含此关键词）
3. 将 Webhook URL 复制到配置文件或粘贴到 Web UI 设置中

**微信（Server酱³）** — 配置 Server酱³ 在微信中接收通知：

```json
{
  "notifications": {
    "wechat_work": {
      "sendKey": "SCTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

**设置步骤：**
1. 访问 [Server酱 Sendkey](https://sct.ftqq.com/sendkey) 并用微信登录
2. 复制你的 SendKey（以 `SCT` 开头）
3. 粘贴到配置文件或 Web UI 设置中

---

## 使用方法

```bash
# 启动 Claude Code（启动守护进程 + 第一个实例）
claude-remote

# 向 Claude 传递参数
claude-remote chat
claude-remote -- --dangerously-skip-permissions

# 自定义选项
claude-remote --name my-project
claude-remote --token my-secret-token

# 附加到现有实例
claude-remote attach my-project  # 按名称
claude-remote attach 550e8400     # 按实例 ID 前缀

# 列出所有运行中的实例
claude-remote list

# 显示守护进程状态（PID、端口、运行时间、实例数、三版本信息）
claude-remote status

# 停止守护进程和所有实例
claude-remote stop

# 无头模式（无本地终端，仅 Web UI）
claude-remote --no-terminal

# 查看版本
claude-remote --version

# 更新到最新版本
claude-remote update
```

### 版本检查

`claude-remote status` 显示三个版本及操作建议：

- **Installed** — 磁盘上的 CLI 版本
- **Daemon** — 运行中 daemon 缓存的版本（✓ 或 "outdated"）
- **Latest** — npm 上的最新版本（✓ 或 "new"）

启动时会后台检查 npm 新版本（不阻塞），如有更新会在 stderr 输出一行提示。

执行 `claude-remote update` 后，如果没有运行中的实例，守护进程会自动重启。如有实例运行，会提示手动重启。

### 停止运行

- **单次 Ctrl+C** — 发送给 Claude Code（取消当前任务）
- **双次 Ctrl+C**（500毫秒内）— 停止代理服务器

---

## 配置

配置文件：`~/.claude-remote/settings.json`（旧版 `config.json` 会自动迁移）

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `host` | string | "0.0.0.0" | 绑定地址 |
| `token` | string \| null | null | 认证令牌；`null` = 自动生成的共享令牌 |
| `claudeCommand` | string | "claude" | Claude CLI 路径 |
| `claudeArgs` | string[] | [] | 额外的 Claude CLI 参数（与 CLI 参数合并，去重） |
| `claudeCwd` | string \| null | null | Claude 工作目录；`null` = 当前目录 |
| `sessionTtlMs` | number | 86400000 | 会话 TTL（毫秒，默认 24 小时） |
| `authRateLimit` | number | 20 | 认证速率限制（每分钟每 IP） |
| `maxBufferLines` | number | 10000 | 输出缓冲区最大行数 |
| `instanceName` | string \| null | null | 实例名称；`null` = 工作目录名 |
| `shortcuts` | array | 见下文 | 快捷输入按钮 |
| `commands` | array | 见下文 | 自定义命令按钮 |
| `workspaces` | string[] | [] | Web 生成实例允许的工作目录 |
| `settingsDirs` | string[] | ["~/.claude/", "~/.claude-remote/settings/"] | 设置文件扫描目录 |
| `notifications` | object | — | 通知渠道配置（见下文） |
| `customPrivateRanges` | string[] | [] | CORS 白名单的自定义 CIDR 网段（如 `["30.0.0.0/8"]` 用于 VPN 网络） |

> **注意**：端口固定为 8866。所有实例运行在单个守护进程中。

**通知渠道配置：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `webhookUrl` | string | — | 钉钉 webhook URL |
| `sendKey` | string | — | Server酱³ SendKey（微信） |
| `enabled` | boolean | true | 渠道是否启用 |

**优先级**：CLI 参数 > 配置文件 > 默认值（`claudeArgs` 除外，它是合并的）

### 项目级配置

通过 Web UI 配置时，快捷键和命令会自动按项目保存：

- 配置存储在 `<项目目录>/.claude-remote/settings.json`
- 从实例视图打开设置时，`shortcuts` 和 `commands` 的变更会保存到项目目录
- 没有活跃实例时打开设置，变更会保存到全局配置（`~/.claude-remote/settings.json`）

这样每个项目可以有自己的一组命令，同时共享通知等全局设置。

### 快捷键

终端下方显示的快捷输入按钮。

**默认快捷键：**

| 按键 | 数据 | 说明 |
|------|------|------|
| Esc | `\u001b` | ESC 键 |
| Enter | `\r` | 回车键 |
| Tab | `\t` | Tab 键 |
| ↑ | `\u001b[A` | 上箭头 |
| ↓ | `\u001b[B` | 下箭头 |
| ← | `\u001b[D` | 左箭头 |
| → | `\u001b[C` | 右箭头 |
| S-Tab | `\u001b[Z` | Shift+Tab |
| Ctrl+O | `\u000f` | Ctrl+O |
| Ctrl+E | `\u0005` | Ctrl+E |

**自定义示例：**

```json
{
  "shortcuts": [
    { "label": "Yes", "data": "y", "enabled": true, "desc": "确认" },
    { "label": "Esc", "data": "\u001b", "enabled": true, "desc": "取消 (ESC)" },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true, "desc": "中断" }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | string | 按钮显示文本 |
| `data` | string | 发送的数据（支持转义序列，如 `\u001b` 表示 ESC） |
| `enabled` | boolean | 按钮是否启用 |
| `desc` | string | 描述（可选） |

**常用转义值：**
- `\u001b` - ESC
- `\r` - 回车
- `\u0003` - Ctrl+C
- `\u0004` - Ctrl+D

### 命令

快捷栏中的自定义命令按钮。

**默认命令：**

| 命令 | 说明 |
|------|------|
| /clear | 清屏 |
| /compact | 压缩对话 |
| /resume | 恢复会话 |
| /stats | 统计信息 |
| /exit | 退出 |

**Skill 自动转换为命令：**

定义在 `~/.claude/skills/*/SKILL.md` 或 `<项目>/.claude/skills/*/SKILL.md` 中的 Skill 会自动转换为斜杠命令。例如，名为 `finish-task` 的 Skill 会变成命令栏中的 `/finish-task`。

- 每次请求 `/api/config` 时扫描 Skill
- 项目级 Skill 覆盖同名的全局 Skill
- 用户的修改（enabled、autoSend）在扫描时保留

**自定义示例：**

```json
{
  "commands": [
    { "label": "/help", "command": "/help", "enabled": true },
    { "label": "Git 状态", "command": "git status", "enabled": true, "autoSend": false }
  ]
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | string | — | 按钮显示文本 |
| `command` | string | — | 要执行的命令 |
| `enabled` | boolean | — | 按钮是否启用 |
| `autoSend` | boolean | `true` | `true` = 立即发送，`false` = 填入输入框 |

> 以 `/` 开头的命令是 Claude Code 斜杠命令。其他命令在终端中执行。

### 工作空间

限制 Web 生成的实例可以使用哪些目录：

```json
{
  "workspaces": [
    "/home/user/projects/api",
    "/home/user/projects/web"
  ]
}
```

如未配置，Web 生成的实例只能从已存在的 claude 实例中选择项目

### 设置文件

从 Web UI 创建实例时，可以选择自定义设置文件通过 `--settings` 传递。设置文件必须：

1. 以 `settings` 为前缀命名（如 `settings-project-a.json`、`settings.idea.json`）
2. 是有效的 `.json` 结尾的 JSON 文件
3. 位于配置的扫描目录中

**默认扫描目录：**
- `~/.claude/` — Claude Code 配置目录
- `~/.claude-remote/settings/` — Claude Remote 自定义设置

**自定义目录：**

```json
{
  "settingsDirs": [
    "~/.claude/",
    "~/.claude-remote/settings/",
    "~/my-custom-settings/"
  ]
}
```

**设置文件示例**（`~/.claude/settings-project-a.json`）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  },
  "permissions": {
    "allow": ["Bash(git:*)", "Bash(npm:*)"]
  }
}
```

> **注意**：带端口号的 JSON 文件会自动从设置文件列表中排除。

### 完整示例

```json
{
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
    { "label": "Yes", "data": "y", "enabled": true },
    { "label": "Esc", "data": "\u001b", "enabled": true },
    { "label": "Enter", "data": "\r", "enabled": true },
    { "label": "Ctrl+C", "data": "\u0003", "enabled": true }
  ],

  "commands": [
    { "label": "Git 状态", "command": "git status", "enabled": true },
    { "label": "Git 日志", "command": "git log --oneline -10", "enabled": true }
  ],

  "workspaces": [
    "/home/user/projects/api",
    "/home/user/projects/web"
  ],

  "notifications": {
    "dingtalk": {
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=your-token"
    }
  }
}
```

---

## 安全性

- **令牌认证** — 32 字节随机令牌，首次运行生成
- **会话 Cookie** — HttpOnly + SameSite=Lax，24 小时 TTL
- **网络隔离** — 仅绑定局域网 IP，无公网暴露
- **速率限制** — 每个 IP 每分钟 20 次认证尝试
- **Hook 安全** — 仅接受 localhost 请求

---

## 故障排除

### `node-pty` 编译失败

安装编译工具：

| 操作系统 | 命令 |
|---------|------|
| macOS | `xcode-select --install` |
| Ubuntu/Debian | `sudo apt-get install build-essential python3` |
| Fedora/RHEL | `sudo dnf groupinstall 'Development Tools'` |
| Arch Linux | `sudo pacman -S base-devel python` |

### 二维码扫不了？

1. 确保手机和 PC 在同一网络
2. 手动打开终端显示的 URL 并输入令牌

### 手机连不上？

1. 检查 PC 防火墙允许端口 8866
2. 验证 URL 显示正确的局域网 IP
3. 如使用 VPN，尝试显式设置 `host` 选项

---

## 前置要求

- **Node.js** >= 20
- **Claude Code CLI** — [安装指南](https://docs.anthropic.com/en/docs/claude-code)

> `pnpm` 和 Claude CLI 会在首次运行时自动安装（如缺失）。

---

## 开发

**源码开发：**

```bash
# 克隆并安装
git clone https://github.com/StephenTowne/open-claude-remote.git
cd open-claude-remote
pnpm install

# 开发模式（热重载）
pnpm dev:cli

# 生产模式
pnpm build && pnpm link -g && claude-remote
```

**项目结构：**

- 后端：`backend/src/`（Express + node-pty + WebSocket）
- 前端：`frontend/src/`（React + xterm.js）
- 共享类型：`shared/`（通过 `#shared` 别名导入）
- 测试：`pnpm test`（Vitest）
- 构建：`pnpm build`（TypeScript + Vite）

### 停止所有实例

```bash
pnpm stop
```

---

## 许可证

MIT