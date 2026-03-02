<!-- auto-doc: 文件增删时更新 -->
# frontend/src/services/ - API 客户端

- api-client.ts: authenticate() / getStatus() / healthCheck()，fetch 封装，credentials: include 携带 Session Cookie，429 状态抛异常
- instance-api.ts: fetchInstances() 获取实例列表 + authenticateToInstance() 跨实例认证 + buildInstanceWsUrl() 构建目标实例 WS URL
- instance-create-api.ts: getInstanceConfig() 获取工作目录列表/默认参数 + createInstance() 创建新实例，支持自动重认证
- token-storage.ts: Token 持久化存储（sessionStorage），saveToken/loadToken/clearToken，用于跨实例认证场景
