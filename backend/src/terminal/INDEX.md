<!-- auto-doc: 文件增删时更新 -->
# backend/src/terminal/ - PC 终端 stdin/stdout 中继

- terminal-relay.ts: TerminalRelay 类，设置 stdin raw mode 实现按键直通 PTY，监听 stdout resize 事件同步 PTY 尺寸，退出时恢复终端状态
