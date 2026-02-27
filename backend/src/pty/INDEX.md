<!-- auto-doc: 文件增删时更新 -->
# backend/src/pty/ - PTY 伪终端进程管理与输出缓冲

- pty-manager.ts: PtyManager 类，node-pty 封装，spawn/write/resize/destroy + EventEmitter 模式 (data/exit/error)
- output-buffer.ts: OutputBuffer 环形缓冲区，存储原始 ANSI 输出（默认 10K 行），单调递增序列号支持重连增量同步
