<!-- auto-doc: 文件增删时更新 -->
# backend/src/daemon/ - CLI 与 Daemon 通信

- daemon-client.ts: isDaemonRunning() 健康检查 + stopDaemon() 关闭请求 + createInstance() 创建实例 + listInstances() 列表 + getSharedToken() 获取 WS 认证 Token，通过 cookie-based API 与 daemon 通信
