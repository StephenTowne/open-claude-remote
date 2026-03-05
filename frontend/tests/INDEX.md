<!-- auto-doc: 文件增删时更新 -->
# frontend/tests/ - Vitest 测试文件

## 根目录
- App.test.tsx: App 组件集成测试，路由渲染 + WebSocket 连接初始化

## components/
- ActionSheetSelect.test.tsx: ActionSheetSelect 组件测试，选项渲染/选择回调/键盘导航
- CommandPicker.test.tsx: CommandPicker 组件测试，命令选择/快捷键发送交互
- InputBar.test.tsx: InputBar 组件测试，文本输入/空输入 Enter 发送
- ScrollToBottomButton.test.tsx: ScrollToBottomButton 组件测试，可见性切换/点击回调
- SegmentedControl.test.tsx: SegmentedControl 组件测试，选项渲染/选中状态/键盘导航
- SettingsModal.test.tsx: SettingsModal 组件测试，Tab 切换/保存/错误处理
- Toggle.test.tsx: Toggle 组件测试，开关状态切换/无障碍属性验证

## components/common/
- BottomSheet.test.tsx: BottomSheet 组件测试，打开/关闭动画 + 点击遮罩关闭

## components/onboarding/
- SpotlightContext.test.tsx: Spotlight Context 测试，Provider 外调用抛错 + 状态暴露验证
- useSpotlight.test.ts: useSpotlight hook 测试，步骤导航/元素定位/DOM 隔离环境模拟

## hooks/
- useInstances.test.ts: useInstances hook 测试，实例列表加载/isCurrent 自动选中/状态同步
- usePushNotification.test.tsx: 推送通知 hook 测试，权限请求/通知发送
- useTerminal.test.tsx: Terminal hook 集成测试，xterm.js 初始化/数据流/history 同步
- useUserConfig.test.tsx: 用户配置 hook 测试，配置加载/全局刷新通知
- useViewport.test.tsx: 视口 hook 测试，移动端/桌面端检测结果
- useWebSocket.connection-isolation.test.ts: WebSocket 连接隔离测试，多实例会话独立性

## pages/
- AuthPage.test.tsx: AuthPage 页面测试，Token 输入/登录验证/错误处理
- ConsolePage.test.tsx: ConsolePage 页面集成测试，终端渲染/命令输入/多实例切换