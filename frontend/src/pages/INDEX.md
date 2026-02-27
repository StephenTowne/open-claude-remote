<!-- auto-doc: 文件增删时更新 -->
# frontend/src/pages/ - 页面级组件

- AuthPage.tsx: Token 认证页，居中密码输入框 + 提交按钮，useAuth hook 处理登录逻辑与错误展示
- ConsolePage.tsx: 主控制台页，组合 StatusBar + TerminalView + InputBar + ApprovalCard，管理 WS 连接生命周期与消息分发，集成 useViewport 软键盘适配
