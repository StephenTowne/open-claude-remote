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

配置文件位于 `~/.claude-remote/config.json`，支持以下字段：

```json
{
  "port": 3000,           // 服务端口（被占用自动递增）
  "host": "0.0.0.0",      // 绑定地址
  "token": "your-token",  // 固定 Token（默认自动生成共享 Token）
  "instanceName": "api",  // 实例名称（默认工作目录名）
  "claudeCommand": "claude",  // Claude CLI 命令路径
  "claudeCwd": "/path/to/project",  // Claude 工作目录
  "claudeArgs": ["--no-telemetry"],  // Claude CLI 额外参数
  "maxBufferLines": 10000,  // 输出缓冲区行数
  "workspaces": [          // 预设工作目录列表（用于 Web 创建实例，也作为允许路径白名单）
    "/Users/you/projects/api",
    "/Users/you/projects/web"
  ],
  "defaultClaudeArgs": ["--model", "claude-sonnet-4-6"]  // 默认 Claude 参数
}
```

**优先级**：CLI 参数 > 配置文件 > 默认值

**示例**：使用固定 Token

```json
{
  "token": "my-secret-token-123"
}
```

配置文件首次启动时会自动创建，包含自动生成的 Token。

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