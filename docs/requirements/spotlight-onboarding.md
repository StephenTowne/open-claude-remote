# 移动端用户引导优化需求

## 背景

现有的首次使用引导采用纯文本全屏遮罩模式，用户看不到具体 UI 位置，认知负担高。

## 目标

实现 Spotlight + Coach Marks 引导，让用户直接看到功能在哪里。

## 需求

### 核心功能
- 镂空遮罩高亮目标元素
- 气泡提示指向具体 UI 元素
- 绿色边框脉冲动画吸引注意力
- 键盘导航支持（←/→/Esc/Enter）
- 无障碍支持（role="dialog", aria-modal）

### 引导步骤（5 步）
1. 快捷键栏 - 常用按键一键发送
2. 命令按钮行 - 预设命令快速执行
3. 输入框 - 输入命令或消息
4. 设置按钮 - 自定义快捷键和命令
5. "+" 按钮 - 添加新的 Claude Code 实例

### 技术方案
- 使用 `box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75)` 创建镂空效果
- 监听 resize 和 visualViewport 变化重新定位
- 检测 `prefers-reduced-motion` 尊重用户动画偏好
- localStorage 键名：`claude_remote_spotlight_done`

## 文件变更

- 新增：`frontend/src/components/onboarding/SpotlightGuide.tsx`
- 新增：`frontend/src/components/onboarding/useSpotlight.ts`
- 新增：`frontend/src/components/onboarding/spotlight-steps.ts`
- 删除：`frontend/src/components/onboarding/OnboardingGuide.tsx`
- 修改：`frontend/src/components/input/CommandPicker.tsx` (添加 data-testid)
- 修改：`frontend/src/components/input/InputBar.tsx` (添加 data-testid)
- 修改：`frontend/src/pages/ConsolePage.tsx` (替换组件引用)

## 验收标准

- 首次访问自动弹出引导
- 每个步骤正确高亮目标元素
- Skip 可跳过，完成后不再弹出
- 不同屏幕尺寸正确定位