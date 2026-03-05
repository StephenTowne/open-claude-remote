<!-- auto-doc: 文件增删时更新 -->
# backend/src/notification/ - 外部通知渠道服务，失败仅日志不抛异常

- dingtalk-service.ts: DingtalkService，钉钉群机器人 Webhook 通知，SSRF 域名白名单 + 超时控制
- notification-manager.ts: NotificationManager，通知渠道启用状态管理器，TTL 缓存 + 动态检查 + 主动刷新
- wechat-work-service.ts: WechatWorkService，Server酱³ 微信通知，API URL 格式 + SSRF 域名白名单
