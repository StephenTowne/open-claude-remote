# WeChat Notification Channel (Server酱)

## Requirement Description

Add WeChat notification channel support via Server酱 integration, allowing users to receive Claude Code notifications on WeChat.

## Acceptance Criteria

- [x] Users can configure Server酱 sendkey in settings
- [x] Support both standard (SCT...) and Turbo (sctp...) sendkey formats
- [x] Notifications include: title, tool name, message content, and instance URL
- [x] Message format is consistent with DingTalk (Markdown)
- [x] SSRF protection: only allow requests to `sctapi.ftqq.com` and `push.ft07.com`
- [x] Each notification channel can be independently enabled/disabled

## Configuration

```json
{
  "notifications": {
    "wechat_work": {
      "sendkey": "SCTxxx",
      "enabled": true
    }
  }
}
```

## Implementation Notes

- Service: `backend/src/notification/wechat-work-service.ts`
- Frontend form: `frontend/src/components/settings/WechatWorkConfigForm.tsx`
- Type definitions: `shared/notification-types.ts`