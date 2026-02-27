<!-- auto-doc: 文件增删时更新 -->
# frontend/src/hooks/ - React 自定义 Hooks，封装 WS/终端/认证/审批逻辑

- useApproval.ts: 消费 Zustand pendingApproval 状态，提供 approve()/reject() 发送 WS approval_response
- useAuth.ts: 封装 POST /api/auth 调用，管理 loading/error 状态，成功后更新 store.isAuthenticated
- useTerminal.ts: xterm.js Terminal 生命周期管理，WebGL 渲染 + FitAddon + ResizeObserver 自适应
- useViewport.ts: Visual Viewport API 检测移动端软键盘高度，返回 keyboardHeight 像素值
- useWebSocket.ts: WS 连接管理，指数退避自动重连（1s→30s），onMessage 回调分发 ServerMessage
