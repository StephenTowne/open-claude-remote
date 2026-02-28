<!-- auto-doc: 文件增删时更新 -->
# frontend/src/hooks/ - React 自定义 Hooks，封装 WS/终端/认证/通知逻辑

- useAuth.ts: 封装 POST /api/auth 调用，管理 loading/error 状态，成功后更新 store.isAuthenticated
- usePushNotification.ts: 注册 Service Worker，拉取 VAPID 公钥并订阅 Web Push，自动上报订阅信息到后端
- useTerminal.ts: xterm.js Terminal 生命周期管理，WebGL 渲染 + FitAddon + ResizeObserver 自适应
- useViewport.ts: Visual Viewport API 检测移动端软键盘高度，返回 keyboardHeight 像素值
- useWebSocket.ts: WS 连接管理，指数退避自动重连（1s→30s），onMessage 回调分发 ServerMessage
