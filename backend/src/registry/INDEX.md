<!-- auto-doc: 文件增删时更新 -->
# backend/src/registry/ - 共享配置与 daemon 停止

- shared-token.ts: getOrCreateSharedToken()，优先级 AUTH_TOKEN 环境变量 > ~/.claude-remote/token 文件 > 自动生成并持久化
- stop-instances.ts: `pnpm stop` 入口，委托 daemon-client.stopDaemon() 发送 shutdown 请求
