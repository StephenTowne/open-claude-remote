<!-- auto-doc: 文件增删时更新 -->
# backend/src/daemon/ - CLI 与 Daemon 通信

- daemon-client.ts: isDaemonRunning() 健康检查 + stopDaemon() 关闭请求 + createInstance() 创建实例 + listInstances() 列表 + getSharedToken() 获取 WS 认证 Token，通过 cookie-based API 与 daemon 通信
- daemon-entry.ts: Daemon 子进程入口点，由 daemon-launcher fork 启动，以 daemonMode 运行 startServer，通过 IPC 向父进程发送 ready/error 信号后断开通道
- daemon-launcher.ts: launchDaemon() 使用 child_process.fork() 以 detached 模式启动 daemon-entry，等待 IPC ready 消息（15s 超时），成功后 unref 子进程让 CLI 独立退出
