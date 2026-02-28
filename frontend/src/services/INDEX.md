<!-- auto-doc: 文件增删时更新 -->
# frontend/src/services/ - API 客户端

- api-client.ts: authenticate() / getStatus() / healthCheck()，fetch 封装，credentials: include 携带 Session Cookie，429 状态抛异常
- instance-api.ts: fetchInstances() 获取实例列表 + authenticateToInstance() 跨实例认证 + buildInstanceWsUrl() 构建目标实例 WS URL
