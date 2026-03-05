# WeChat Notification Channel (Server酱³)

## Requirement Description

Add WeChat notification channel support via Server酱³ integration, allowing users to receive Claude Code notifications on WeChat.

## Acceptance Criteria

- [x] Users can configure Server酱³ SendKey in settings
- [x] SendKey format: starts with `SCT` followed by alphanumeric characters
- [x] API URL is auto-generated: `https://sctapi.ftqq.com/<sendkey>.send`
- [x] Notifications include: title, tool name, message content, and instance URL
- [x] Message format is consistent with DingTalk (Markdown)
- [x] SendKey validation: must match `SCT[a-zA-Z0-9]+` pattern
- [x] Each notification channel can be independently enabled/disabled

## Configuration

```json
{
  "notifications": {
    "wechat_work": {
      "sendKey": "SCTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "enabled": true
    }
  }
}
```

## Implementation Notes

- Service: `backend/src/notification/wechat-work-service.ts`
- Frontend form: `frontend/src/components/settings/WechatWorkConfigForm.tsx`
- Type definitions: `shared/notification-types.ts`