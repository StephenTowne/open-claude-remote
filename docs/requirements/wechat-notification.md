# WeChat Notification Channel (Server酱³)

## Requirement Description

Add WeChat notification channel support via Server酱³ integration, allowing users to receive Claude Code notifications on WeChat.

## Acceptance Criteria

- [x] Users can configure Server酱³ API URL in settings
- [x] API URL format: `https://<uid>.push.ft07.com/send/<sendkey>.send`
- [x] Notifications include: title, tool name, message content, and instance URL
- [x] Message format is consistent with DingTalk (Markdown)
- [x] SSRF protection: only allow requests to `push.ft07.com` subdomains
- [x] Each notification channel can be independently enabled/disabled

## Configuration

```json
{
  "notifications": {
    "wechat_work": {
      "apiUrl": "https://<uid>.push.ft07.com/send/<sendkey>.send",
      "enabled": true
    }
  }
}
```

## Implementation Notes

- Service: `backend/src/notification/wechat-work-service.ts`
- Frontend form: `frontend/src/components/settings/WechatWorkConfigForm.tsx`
- Type definitions: `shared/notification-types.ts`