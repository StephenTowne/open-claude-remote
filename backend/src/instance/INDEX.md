<!-- auto-doc: 文件增删时更新 -->
# backend/src/instance/ - 单进程多实例核心管理

- index.ts: 模块导出入口
- types.ts: CreateInstanceOptions 等类型定义
- instance-manager.ts: InstanceManager，Map<instanceId, InstanceSession> 管理所有实例，进程内创建/销毁，broadcastAll 跨实例广播
- instance-session.ts: InstanceSession，单实例协调器，持有 PtyManager + OutputBuffer + HookReceiver + WS clients，PTY→WS 批量化输出 + Hook 状态更新 + resize 仲裁
