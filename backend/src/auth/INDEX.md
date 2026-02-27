<!-- auto-doc: 文件增删时更新 -->
# backend/src/auth/ - Token 认证、Session 管理与速率限制

- auth-middleware.ts: AuthModule 类，timingSafeEqual Token 验证 + Session Cookie 签发/校验 + Express requireAuth 中间件
- rate-limiter.ts: RateLimiter 类，内存滑动窗口限流（默认 5次/分钟/IP），自动过期清理
- token-generator.ts: generateToken() / generateSessionId()，基于 crypto.randomBytes 的安全随机 hex 生成
