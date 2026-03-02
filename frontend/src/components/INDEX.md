<!-- auto-doc: 文件增删时更新 -->
# frontend/src/components/ - React UI 组件，按功能域子目录组织

## common/
- ConnectionBanner.tsx: WS 断开时顶部警告横幅，connecting 黄色 / disconnected 红色
- IpChangeToast.tsx: IP 变化通知弹窗，显示旧 IP → 新 IP 变化，提供"复制新地址"按钮
- SafeArea.tsx: iOS 安全区域适配容器，paddingTop 使用 env(safe-area-inset-top)

## input/
- CommandPicker.tsx: 命令快捷选择器，两行布局（快捷键行 + 命令行），快捷键直接发送 ANSI 序列，命令点击填入输入框
- InputBar.tsx: 底部固定输入栏，支持空输入直接发送 Enter，也支持文本输入发送，暴露 ref API（setText/focus）


## status/
- StatusBar.tsx: 顶部状态栏，左侧 Logo，右侧双指示灯（session idle/running/waiting + WS connected/disconnected）

## instances/
- InstanceTabs.tsx: 多实例 Tab 切换栏，显示实例名称+端口，右侧"+"按钮打开创建实例对话框
- CreateInstanceModal.tsx: 创建实例对话框，工作目录选择/自定义输入，实例名称/Claude 参数可选

## settings/
- SettingsModal.tsx: 设置模态框，Tab 切换（快捷键/命令），加载/保存用户配置
- ShortcutSettings.tsx: 快捷键设置面板，按键录制转换为 ANSI 序列
- CommandSettings.tsx: 命令设置面板，编辑/删除/重置命令列表
- SortableItemShell.tsx: 可排序列表项外壳，集成拖拽手柄/toggle开关/删除按钮，用于设置项行布局
- useDndSensors.ts: dnd-kit 拖拽传感器配置 hook，PointerSensor + KeyboardSensor，激活约束 8px

## onboarding/
- OnboardingGuide.tsx: 首次使用引导组件，分步展示功能介绍，localStorage 记录完成状态

## terminal/
- TerminalView.tsx: xterm.js 挂载容器，disableStdin 只读模式，外部通过 containerRef 注入
- ScrollButtons.tsx: 终端悬浮滚动按钮（顶部/底部），滚动后显示，淡入淡出动画过渡
