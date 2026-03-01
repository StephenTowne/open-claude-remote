<!-- auto-doc: 文件增删时更新 -->
# frontend/src/components/ - React UI 组件，按功能域子目录组织

## common/
- ConnectionBanner.tsx: WS 断开时顶部警告横幅，connecting 黄色 / disconnected 红色
- IpChangeToast.tsx: IP 变化通知弹窗，显示旧 IP → 新 IP 变化，提供"复制新地址"按钮
- SafeArea.tsx: iOS 安全区域适配容器，paddingTop 使用 env(safe-area-inset-top)

## input/
- CommandPicker.tsx: 命令快捷选择器，两行布局（快捷键行 + 命令行），快捷键直接发送 ANSI 序列，命令点击填入输入框
- InputBar.tsx: 底部固定输入栏，支持空输入直接发送 Enter，也支持文本输入发送，暴露 ref API（setText/focus）
- PermissionPanel.tsx: PermissionRequest Hook 权限审批面板，显示工具名+输入预览，提供允许/始终允许/拒绝三按钮，优先于 QuestionPanel 显示
- QuestionPanel.tsx: PreToolUse Hook 推送的 AskUserQuestion 结构化问答面板，支持单选/多选/Other 自定义输入，替换 InputBar+CommandPicker 显示


## status/
- StatusBar.tsx: 顶部状态栏，左侧 Logo，右侧双指示灯（session idle/running/waiting + WS connected/disconnected）

## instances/
- InstanceTabs.tsx: 多实例 Tab 切换栏，单实例时自动隐藏，显示实例名称+端口，活跃 Tab 高亮底部边框

## terminal/
- TerminalView.tsx: xterm.js 挂载容器，disableStdin 只读模式，外部通过 containerRef 注入
