<!-- auto-doc: 文件增删时更新 -->
# backend/src/registry/ - 多实例注册表与共享配置管理

- instance-registry.ts: InstanceRegistryManager，操作 ~/.claude-remote/instances.json 实现实例注册/注销/列表，自动清理僵尸进程，原子写入
- port-finder.ts: findAvailablePort()，从首选端口递增探测可用端口，net.createServer 探测方式
- shared-token.ts: getOrCreateSharedToken()，优先级 AUTH_TOKEN 环境变量 > ~/.claude-remote/token 文件 > 自动生成并持久化
