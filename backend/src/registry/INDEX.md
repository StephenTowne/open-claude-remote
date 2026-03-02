<!-- auto-doc: 文件增删时更新 -->
# backend/src/registry/ - 多实例注册表与共享配置管理

- instance-registry.ts: InstanceRegistryManager，操作 ~/.claude-remote/instances.json 实现实例注册/注销/列表，自动清理僵尸进程，原子写入
- instance-spawner.ts: InstanceSpawner 类，spawn 子进程创建 headless 实例，构造函数验证入口脚本存在，返回 pid/cwd/name
- port-finder.ts: findAvailablePort()，从首选端口递增探测可用端口，net.createServer 探测方式
- shared-token.ts: getOrCreateSharedToken()，优先级 AUTH_TOKEN 环境变量 > ~/.claude-remote/token 文件 > 自动生成并持久化
- stop-instances.ts: stopInstances()/stopAllRegisteredInstances()，按注册表逐实例 SIGTERM 停止并在超时后 SIGKILL 兜底，输出汇总结果与失败列表，供 `pnpm stop` 调用
