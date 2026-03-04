# ADR-001: PTY + Hooks 审批方案

## 状态
已接受

## 背景
Claude Code Remote 需要在手机端远程审批 Claude Code 的工具调用。需要选择可靠的审批识别和响应机制。

## 决策
采用 PTY 伪终端 + Notification Hooks 方案：
- **PTY 伪终端**: 代理层通过 node-pty 启动 Claude Code，完整掌控 stdin/stdout
- **Hooks 通知**: 利用 Claude Code 内置的 Notification hook (matcher: permission_prompt) 在审批到达时通知代理层
- **PTY 审批**: 通过 PTY 写入按键 ('y' 或 Escape) 完成审批响应

## 理由
1. PTY 保留 PC 终端的原始 CLI 体验
2. Notification hooks 是 Claude Code 官方支持的扩展机制，可靠性高
3. 通过 PTY stdin 写入按键是最简单直接的审批方式
4. 无需修改 Claude Code 本身

## 后果
- 需要用户配置 Claude Code hooks (`~/.claude/settings.json`)
- 审批依赖 PTY 按键写入，需确保时序正确
- Hook 通知通过 HTTP POST 传递，仅限 localhost 安全
