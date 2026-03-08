# 双网络模式（WiFi + VPN）无感切换

## 需求描述

支持通过两种（或多种）方式访问 claude-remote，解决 VPN 场景下的 CORS 限制问题。

### 场景

1. **WiFi 场景**：192.168.x.x 局域网直连（手机和电脑在同一 WiFi）
2. **VPN 场景**：30.x.x.x 公司内网访问（手机和电脑都连接公司 VPN）

### 原有限制

- CORS 白名单只支持 RFC1918 私有地址（10.x, 172.16-31.x, 192.168.x）
- 30.x.x.x 被视为公网 IP，不在 CORS 允许范围内
- 启动时只显示一个 IP
- IP 变更时前端需要手动复制新 URL

## 验收标准

### MVP 功能

- [x] 后端同时监听所有网卡，支持多个入口 IP
- [x] CORS 白名单可通过配置扩展，支持任意公司网段
- [x] 启动时显示所有可用 IP 及其接口类型（WiFi/VPN/有线）
- [x] 用户可以选择任意 IP 访问，体验一致

### 增强功能

- [x] `/api/network` 端点返回所有网络接口信息
- [x] 前端接收 WebSocket `network_changed` 消息，实时获知网络变化
- [x] VPN 接口启发式识别（utun, ppp, tun, tap, wireguard, zerotier, tailscale）

## 配置说明

在 `~/.claude-remote/settings.json` 中添加：

```json
{
  "customPrivateRanges": ["30.0.0.0/8", "192.0.2.0/24"]
}
```

支持任意 CIDR 格式网段，自动包含在 CORS 白名单中。

## 技术实现

### Phase 1: 网络工具增强

- 新增 `NetworkInterface` 接口，包含地址、类型、VPN 标识
- `getAllNetworkInterfaces()`: 获取所有网卡并分类
- `isPrivateIpWithConfig()`: 支持自定义网段的私有 IP 检测
- `isInCidrRange()`: CIDR 网段匹配
- `isVpnInterface()`: 基于接口名启发式判断 VPN

### Phase 2: CORS 白名单扩展

- `index.ts` 加载 `customPrivateRanges` 配置
- 增强 `localIpSet` 包含所有本地 IP + 自定义网段的所有 IP
- IP 变更时刷新 CORS 白名单，重新应用自定义网段

### Phase 3: 多 IP 显示与 QR 码

- `banner.ts` 支持多 `urls` 数组
- 显示所有可用地址列表，标注接口类型图标 🌐/📶/🔒/🔌
- 首选 URL 显示大 QR 码
- 新增 `/api/network` 端点

### Phase 4: IP 监控增强

- `IpMonitor` 增强监控所有接口的变化
- 新增 `NetworkChangedMessage` WebSocket 消息类型
- 网络变化时广播给所有客户端

## 相关文件

| 文件 | 变更描述 |
|------|----------|
| `shared/ws-protocol.ts` | 新增 `NetworkChangedMessage` 类型 |
| `backend/src/utils/network.ts` | 扩展网络检测功能，支持分类和自定义网段 |
| `backend/src/config.ts` | 新增 `customPrivateRanges` 配置项 |
| `backend/src/index.ts` | 调整 CORS 白名单，使用增强的网络检测，集成网络变化广播 |
| `backend/src/utils/banner.ts` | 支持多 IP 显示，调整打印格式 |
| `backend/src/api/status-routes.ts` | 新增 `/api/network` 端点 |
| `backend/src/utils/ip-monitor.ts` | 监控所有接口变化，发送新消息类型 |
