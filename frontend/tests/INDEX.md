<!-- auto-doc: 文件增删时更新 -->
# frontend/tests/ - Vitest 测试文件

## 根目录
- App.test.tsx: App 组件集成测试，路由渲染 + WebSocket 连接初始化

## components/
- CommandPicker.test.tsx: CommandPicker 组件测试，命令选择/快捷键发送交互
- InputBar.test.tsx: InputBar 组件测试，文本输入/空输入 Enter 发送
- SettingsModal.test.tsx: SettingsModal 组件测试，Tab 切换/保存/错误处理

## hooks/
- usePushNotification.test.tsx: 推送通知 hook 测试，权限请求/通知发送
- useTerminal.test.tsx: Terminal hook 集成测试，xterm.js 初始化/数据流/history 同步
- useUserConfig.test.tsx: 用户配置 hook 测试，配置加载/全局刷新通知
- useViewport.test.tsx: 视口 hook 测试，移动端/桌面端检测结果
- useWebSocket.connection-isolation.test.ts: WebSocket 连接隔离测试，多实例会话独立性

## pages/
- ConsolePage.test.tsx: ConsolePage 页面集成测试，终端渲染/命令输入/多实例切换