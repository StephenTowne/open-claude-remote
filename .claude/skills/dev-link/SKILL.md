---
name: dev-link
description: 将本地项目链接到全局 pnpm，确保 `claude-remote` 命令使用当前项目编译产物。触发词：`dev link`、`本地链接`、`link local`、`开发链接`、`链接到全局`、`link to global`。
---

# Dev Link Skill

将本地项目链接到全局 pnpm，确保开发时 `claude-remote` 命令使用当前项目的编译产物，而不是 npm 发布的版本。

## 使用场景

- 开发调试时，需要测试本地修改后的 CLI 行为
- 全局安装了 `@caoruhua/open-claude-remote` 但想用本地版本
- 修改了后端代码后需要验证 CLI 效果

## 支持的安装方式

脚本自动处理以下两种全局安装：

```bash
# npm 安装
npm install -g @caoruhua/open-claude-remote

# pnpm 安装（推荐）
pnpm add -g @caoruhua/open-claude-remote
```

脚本会检测并移除已有的全局安装，然后链接本地项目。

## 执行步骤

1. **移除已有安装** - 检测并移除 npm/pnpm 全局安装
2. **链接到全局** - 执行 `pnpm link -g`
3. **构建项目** - 执行 `pnpm build`
4. **验证链接状态** - 确认链接成功

## 执行

```bash
bash .claude/skills/dev-link/scripts/dev-link.sh
```

## 后续使用

链接成功后，每次修改代码后只需：

```bash
pnpm build && claude-remote
```

## 恢复 npm 版本

如需恢复使用 npm 发布的版本：

```bash
pnpm unlink -g @caoruhua/open-claude-remote
pnpm add -g @caoruhua/open-claude-remote
```