<!-- auto-doc: 文件增删时更新 -->
# backend/src/pty/ - PTY 伪终端进程管理与输出缓冲

- types.ts: IPtyManager 接口定义，write/resize 方法签名 + cols/rows 属性
- fix-pty-permissions.ts: 运行时兜底修复 node-pty spawn-helper 执行权限（pnpm 全局安装可能丢失 +x），仅首次 spawn 时执行一次
- pty-manager.ts: PtyManager 类，node-pty 封装，spawn/write/resize/destroy + EventEmitter 模式 (data/exit/error)
- output-buffer.ts: OutputBuffer 环形缓冲区，存储原始 ANSI 输出（默认 10K 行），单调递增序列号支持重连增量同步
- virtual-pty.ts: VirtualPtyManager 类，实现 IPtyManager，通过 WebSocket 连接远程实例，用于 attach 命令接管控制
