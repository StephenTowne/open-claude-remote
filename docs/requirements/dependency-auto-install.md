# 依赖自动检测与交互式安装功能

## Context

**问题**：当前 claude-remote 启动时不检测必要依赖，PTY spawn 失败后才发现缺失，用户体验差。

**完整依赖链**：
```
Node.js (>=20) → pnpm → @anthropic-ai/claude-code
```

**目标**：在 CLI 启动阶段自动检测并**交互式安装**缺失的依赖，用户按 Enter 确认后自动安装，实时显示进度。

## 核心设计决策

| 依赖 | 检测命令 | 安装方式（用户确认后） |
|------|----------|------------------------|
| **Node.js** | `node --version` | macOS: `brew install node@24`<br>Linux: `apt/dnf install nodejs`<br>Windows: `winget install OpenJS.NodeJS.LTS` |
| **pnpm** | `pnpm --version` | `corepack enable && corepack prepare pnpm@latest --activate`<br>降级: `npm install -g pnpm` |
| **claude** | `claude --version` | `pnpm add -g @anthropic-ai/claude-code` |

## 交互流程

```
Checking dependencies...
  ✓ Node.js 22.0.0
  ✗ pnpm not found

┌──────────────────────────────────────────────────────────────────┐
│ pnpm is required but not installed.                              │
│                                                                  │
│ Install method: corepack (Node.js official)                      │
│   corepack enable                                                │
│   corepack prepare pnpm@latest --activate                        │
│                                                                  │
│ Press Enter to install, or Ctrl+C to cancel: _                   │
└──────────────────────────────────────────────────────────────────┘

[Installing pnpm...]
> corepack enable
  ✓ Done
> corepack prepare pnpm@latest --activate
Downloading pnpm...
  ✓ pnpm 9.0.0 installed

All dependencies ready. Starting server...
```

## 特殊情况处理

| 场景 | 处理方式 |
|------|----------|
| 无包管理器（无法自动安装 Node.js） | 提示手动安装，显示官网链接 |
| sudo 权限需求（Linux） | 命令中包含 sudo，终端会提示输入密码 |
| 网络错误 | 显示错误信息，提示检查网络 |
| 安装后 PATH 未更新 | 提示用户重启终端或重新打开 shell |
| CI 环境（无 TTY） | 跳过确认，自动安装 |

## 模块结构

```
backend/src/deps/
├── index.ts          # 入口：ensureDependencies()
├── detector.ts       # 依赖检测
├── installer.ts      # 依赖安装（实时输出）
├── prompt.ts         # 交互式确认
├── platform.ts       # 平台检测 + 安装命令
└── types.ts          # 类型定义 + 依赖配置
```