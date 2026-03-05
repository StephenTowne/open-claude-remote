# Notification Instance URL

## Requirement

Add instance URL to all notification channels (WebSocket, Web Push, DingTalk) so users can quickly reconnect even if the LAN IP changes.

## Background

In local direct-connect mode, IP addresses can change. Users who receive notifications while away from their desktop often forget the IP address and cannot reconnect to the service.

## Acceptance Criteria

- [x] All notification messages include instance URL at the end
- [x] URL format: `http://{IP}:{port}`
- [x] URL updates automatically when IP changes
- [x] Works across all channels: WebSocket, Web Push, DingTalk

## User Impact

**Before:**
```
Approval Required: Bash
Claude requests to execute command: ls -la
```

**After:**
```
Approval Required: Bash
Claude requests to execute command: ls -la

Instance: http://192.168.1.100:3000
```

## Implementation Notes

- `SessionController.setInstanceUrl()` stores the URL
- `SessionController.sendNotificationByChannel()` injects URL into all channel messages
- `index.ts` initializes URL on startup and updates it on IP change via `IpMonitor`