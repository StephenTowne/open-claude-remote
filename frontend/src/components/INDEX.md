<!-- auto-doc: 文件增删时更新 -->
# frontend/src/components/ - React UI 组件，按功能域子目录组织

## common/
- ActionSheetSelect.tsx: 通用 ActionSheet 选择器，从底部弹出大面板（70vh）+ 搜索过滤 + 键盘导航，替代下拉面板方案
- BottomSheet.tsx: 通用底部抽屉组件，滑入/滑出动画 + 拖拽手柄 + 点击遮罩关闭
- ConnectionBanner.tsx: WS 断开时顶部警告横幅，connecting 黄色 / disconnected 红色
- IpChangeToast.tsx: IP 变化通知弹窗，显示旧 IP → 新 IP 变化，提供"复制新地址"按钮
- SafeArea.tsx: iOS 安全区域适配容器，paddingTop 使用 env(safe-area-inset-top)
- SegmentedControl.tsx: iOS 风格分段控件，圆角容器 + 内部滑块指示器，支持键盘导航（方向键/Home/End），选项数 ≤4 时使用
- Toggle.tsx: Toggle 开关组件，移动端友好（44px 点击区域），支持无障碍访问（role="switch"）

## input/
- CommandPicker.tsx: 命令快捷选择器，两行布局（快捷键行 + 命令行），快捷键直接发送 ANSI 序列，命令点击填入输入框
- InputBar.tsx: 底部固定输入栏，支持空输入直接发送 Enter，也支持文本输入发送，暴露 ref API（setText/focus）


## status/
- StatusBar.tsx: 顶部状态栏，左侧 Logo，右侧双指示灯（session idle/running/waiting + WS connected/disconnected）

## instances/
- InstanceTabs.tsx: 多实例 Tab 切换栏，显示实例名称+端口，右侧"+"按钮打开创建实例对话框
- CreateInstanceModal.tsx: 创建实例对话框，工作目录选择/自定义输入，实例名称/Claude 参数可选

## settings/
- SettingsModal.tsx: 设置模态框，Tab 切换（快捷键/命令/通知），加载/保存用户配置
- ShortcutSettings.tsx: 快捷键设置面板，按键录制转换为 ANSI 序列
- CommandSettings.tsx: 命令设置面板，编辑/删除/重置命令列表
- NotificationSettings.tsx: 通知设置面板，支持多渠道通知（钉钉/Email/Slack/微信）的开关与配置管理
- NotificationChannelCard.tsx: 通知渠道卡片组件，包含图标、描述、状态指示及折叠/展开动画
- DingtalkConfigForm.tsx: 钉钉通知配置表单，包含 Webhook URL 验证及保存状态提示
- WechatWorkConfigForm.tsx: Server酱³ 微信通知配置表单，API URL 输入 + 正则验证 + 已配置状态提示
- SortableItemShell.tsx: 可排序列表项外壳，集成拖拽手柄/toggle开关/删除按钮，用于设置项行布局
- useDndSensors.ts: dnd-kit 拖拽传感器配置 hook，PointerSensor + KeyboardSensor，激活约束 8px

## onboarding/
- SpotlightContext.tsx: Spotlight Context Provider，封装 useSpotlight 提供全局状态访问，useSpotlightContext 必须在 Provider 内使用
- SpotlightGuide.tsx: Spotlight 引导组件，镂空遮罩 + 气泡提示，支持键盘导航（方向键/Enter/Esc）
- spotlight-steps.ts: Spotlight 引导步骤配置，CSS 选择器定位，包含快捷键/命令/输入框/设置/新建实例 5 个步骤
- useSpotlight.ts: Spotlight 状态管理 Hook，目标元素定位计算，localStorage 记录完成状态

## terminal/
- TerminalView.tsx: xterm.js 挂载容器，disableStdin 只读模式，外部通过 containerRef 注入
