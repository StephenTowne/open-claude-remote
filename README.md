# Claude Code Remote

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
- LAN IP change notification with new connection URL
- Smart auto-scroll with a "scroll to bottom" floating button

### Quick Actions
- One-tap keys: Esc, Enter, Tab, arrows, Shift+Tab
- Custom shortcuts (configurable in settings)
- Preset commands (/clear, /compact, /resume, etc.)

### First-time Guide
- Interactive spotlight guide on first visit
- Highlights key UI elements with coach marks
- Auto-skips on subsequent visits

### Multi-Instance
- Run multiple `claude-remote` instances simultaneously
- Browser tab bar for switching — no re-authentication needed
- Auto-switch when an instance goes offline
- Spawn new instances from the web UI ("+" button)
- Copy instance via long-press/right-click tab — pre-fills working directory, settings, and arguments
- `claude-remote attach <port|name>` to take over a web-spawned instance

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

> **Note**: The legacy `dingtalk` field is still supported for backward compatibility. Both formats will be automatically migrated.

**Setup steps:**
1. Open DingTalk group → Group Settings → Smart Group Assistant → Add Robot → Custom
2. For security settings, select "Custom Keywords" and add `Claude` (the message title includes this keyword)
3. Copy the Webhook URL to your config file or paste it in the Web UI settings

**WeChat (Server酱)** — configure Server酱 to receive notifications on WeChat:

```json
{
  "notifications": {
    "wechat_work": {
      "sendkey": "SCTyour-sendkey-here"
    }
  }
}
```

**Setup steps:**
1. Visit [Server酱](https://sct.ftqq.com/) and sign in with WeChat
2. Create a new sendkey (SCT... for standard, sctp... for Turbo)
3. Copy the sendkey to your config file or paste it in the Web UI settings

---

## Usage

```bash
# Start Claude Code
claude-remote

# Pass arguments to Claude
claude-remote chat
claude-remote -- --dangerously-skip-permissions

# Custom options
claude-remote --port 8080
claude-remote --name my-project
claude-remote --token my-secret-token

# Attach to a web-spawned instance
claude-remote attach 3001        # by port
claude-remote attach my-project  # by name

# Headless mode (no local terminal, web UI only)
claude-remote --no-terminal
```

### Stopping

- **Single Ctrl+C** — sent to Claude Code (cancels current task)
- **Double Ctrl+C** (within 500ms) — stops the proxy server

---

## Configuration

Config file: `~/.claude-remote/config.json`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | 3000 | Server port (auto-increments if busy) |
| `host` | string | "0.0.0.0" | Bind address |
| `token` | string \| null | null | Auth token; `null` = auto-generated shared token |
| `claudeCommand` | string | "claude" | Claude CLI path |
| `claudeArgs` | string[] | [] | Extra Claude CLI arguments |
| `claudeCwd` | string \| null | null | Claude working directory; `null` = current dir |
| `sessionTtlMs` | number | 86400000 | Session TTL in ms (default: 24h) |
| `authRateLimit` | number | 20 | Auth rate limit (per minute per IP) |
| `maxBufferLines` | number | 10000 | Output buffer max lines |
| `instanceName` | string \| null | null | Instance name; `null` = working dir name |
| `shortcuts` | array | see below | Quick-input buttons |
| `commands` | array | see below | Custom command buttons |
| `workspaces` | string[] | [] | Allowed working directories for web-spawned instances |
| `settingsDirs` | string[] | ["~/.claude/", "~/.claude-remote/settings/"] | Directories to scan for settings files |
| `notifications` | object | — | Notification channels config (DingTalk, etc.) |

**Priority**: CLI args > config file > defaults

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

> **Note**: Files like `3000.json` (port configs) are automatically excluded from the settings file list.

### Complete Example

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

1. Check your PC firewall allows the port (default: 3000)
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
