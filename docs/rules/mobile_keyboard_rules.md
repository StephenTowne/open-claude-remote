# Mobile Soft Keyboard Rules

移动端软键盘适配规则。所有涉及移动端输入、键盘交互的开发必须遵循。

## 核心方案

**不同平台使用不同策略：**

| 平台 | 策略 | 原因 |
|------|------|------|
| **Android** | 浏览器原生滚动 | Android 浏览器会自动滚动确保输入框可见，JS transform 补偿会产生"双重推动"导致抖动 |
| **iOS** | `visualViewport` + `transform: translateY` | iOS 键盘弹起不会改变 window.innerHeight，需要 JS 补偿 |

```
iOS 流程:
键盘弹出 → visualViewport.offsetTop > 0
         → 检测输入框是否被遮挡（checkOcclusion）
         → 整页 transform: translateY(-offsetTop)
         → 键盘收起时 transform: none

Android 流程:
键盘弹出 → 浏览器自动处理 → 不应用 JS 补偿
```

关键代码：`ConsolePage.tsx` 的根容器
```tsx
height: '100dvh',  // 固定高度，永远不变
transform: needsCompensation ? `translateY(-${offsetTop}px)` : 'none',
transition: 'transform 0.25s ease-out',
willChange: needsCompensation ? 'transform' : 'auto',
```

---

## ✅ 必须做的事

### 1. input/textarea 的 font-size >= 16px

防止 iOS Safari 在 focus 时自动缩放页面。

```css
/* global.css */
input { font-size: 16px; }
```

```tsx
/* InputBar.tsx textarea */
style={{ fontSize: 16 }}
```

### 2. 用 `useViewport()` hook 检测键盘状态

```tsx
import { useViewport } from '../hooks/useViewport.js';

const { offsetTop, needsCompensation } = useViewport();
const isKeyboardOpen = needsCompensation && offsetTop > 0;
```

- `needsCompensation`: 输入框是否被键盘遮挡
- `offsetTop`: `visualViewport.offsetTop`，键盘弹出时为正值

### 3. 用 `transform` 补偿，不用 `top` / `height`

- `transform: translateY()` 不触发布局重计算，性能好
- 只在 `needsCompensation=true` 时启用 `willChange: 'transform'`（GPU 加速按需开启）

### 4. 按钮防键盘弹出：三重 blur 防护

不希望触发键盘的按钮（如 CommandPicker），必须在三个时机 blur：

```tsx
// 1. touchstart / mousedown：最早时机 blur
function handleButtonTouchStart() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

// 2. onClick：阻止默认 + 再次 blur
e.preventDefault();
if (document.activeElement instanceof HTMLElement) {
  document.activeElement.blur();
}

// 3. 异步保险：rAF + setTimeout
requestAnimationFrame(ensureBlur);
setTimeout(ensureBlur, 0);
```

同时按钮需要 `onMouseDown` 中 `e.preventDefault()` 阻止焦点转移。

### 5. xterm.js textarea 禁用 pointer-events

防止点击终端区域触发移动端软键盘：

```css
/* global.css */
.xterm-helper-textarea {
  pointer-events: none;
  user-select: none;
}
```

### 6. 键盘弹出时移除 safe-area padding

避免华为等设备在键盘弹出后底部出现多余空白：

```tsx
// InputBar.tsx
paddingBottom: isKeyboardOpen ? '8px' : 'calc(8px + var(--safe-bottom))',
transition: 'padding-bottom 0.25s ease-out',
```

---

## ❌ 禁止做的事

### 1. 不用 `window.innerHeight` 判断键盘

`window.innerHeight` 在不同浏览器、不同模式下行为不一致，不可靠。必须用 `visualViewport` API。

### 2. 不改容器 `height` 适配键盘

改 height 会触发整页布局重计算，导致闪烁和抖动。保持 `100dvh` 固定，只用 `transform` 偏移。

### 3. 不在 `focusin` 时立即设 `offsetTop`

浏览器有原生滚动机制处理输入框可见性。如果在 `focusin` 时立即设置 `offsetTop`，会与原生滚动双重补偿，导致页面"跳动"。

正确做法：`focusin` 时只检测遮挡状态（`setNeedsCompensation`），等 `visualViewport.resize` 事件提供稳定值后再设 `offsetTop`。

### 4. 不在 Android 上使用 JS 补偿

Android 浏览器有完善的原生滚动机制，会自动确保输入框可见。如果再叠加 JS transform 补偿，会产生"双重推动"：
1. 浏览器原生把页面向上推
2. JS 再把页面向上推
结果：页面跳动抖动，用户体验差。

正确做法：在 `useViewport.ts` 中检测 Android 设备，如果是 Android 则不应用 JS 补偿。

### 5. 不用 `position: fixed` + `bottom` 定位输入栏

在键盘弹出时 `bottom` 的参考系会变化，导致定位错误。用 flex 布局 + transform 整体偏移。

---

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `frontend/src/hooks/useViewport.ts` | 软键盘检测核心：visualViewport 监听 + 遮挡检测 |
| `frontend/src/pages/ConsolePage.tsx` | transform 补偿方案：整页 translateY 偏移 |
| `frontend/src/components/input/InputBar.tsx` | 输入栏：font-size 16px + safe-area padding |
| `frontend/src/components/input/CommandPicker.tsx` | 三重 blur 防护：防按钮触发键盘 |
| `frontend/src/styles/global.css` | xterm textarea 禁用 + iOS 缩放防护 |
