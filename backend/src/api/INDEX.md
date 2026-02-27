<!-- auto-doc: 文件增删时更新 -->
# backend/src/api/ - Express REST API 路由注册与端点定义

- auth-routes.ts: POST /api/auth 端点，委托 AuthModule.handleAuth 完成 Token 验证 + Session Cookie 签发
- health-routes.ts: GET /api/health 端点，无认证，返回 `{status:"ok"}` 用于存活探测
- hook-routes.ts: POST /api/hook 端点，仅接受 localhost 请求，将 Claude Code Notification hook payload 转交 HookReceiver
- router.ts: createApiRouter() 聚合所有子路由，注入 AuthModule / HookReceiver / SessionController 依赖
- status-routes.ts: GET /api/status 端点，Session 认证保护，返回会话状态 + 待审批 + 客户端数
