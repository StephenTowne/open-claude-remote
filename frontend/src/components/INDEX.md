<!-- auto-doc: 文件增删时更新 -->
# frontend/src/components/ - React UI 组件，按功能域子目录组织

## common/
- ConnectionBanner.tsx: WS 断开时顶部警告横幅，connecting 黄色 / disconnected 红色
- SafeArea.tsx: iOS 安全区域适配容器，paddingTop 使用 env(safe-area-inset-top)

## input/
- InputBar.tsx: 底部固定输入栏，支持空输入直接发送 Enter，也支持文本输入发送
- VirtualKeyBar.tsx: 移动端虚拟按键条，提供 Esc/Tab/方向键/Ctrl+C 快捷输入

## status/
- StatusBar.tsx: 顶部状态栏，左侧 Logo，右侧双指示灯（session idle/running/waiting + WS connected/disconnected）

## terminal/
- TerminalView.tsx: xterm.js 挂载容器，disableStdin 只读模式，外部通过 containerRef 注入
