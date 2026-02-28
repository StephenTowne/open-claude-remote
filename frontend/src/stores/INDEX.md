<!-- auto-doc: 文件增删时更新 -->
# frontend/src/stores/ - Zustand 全局状态

- app-store.ts: useAppStore，管理 isAuthenticated / connectionStatus / sessionStatus / cachedToken (跨实例认证缓存)
- instance-store.ts: useInstanceStore，管理 instances (InstanceListItem[]) + activeInstanceId，多实例 Tab 切换状态
