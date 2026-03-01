import { useState, useEffect } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the keyboard offset in pixels.
 *
 * 检测逻辑：
 * - visualViewport 高度接近 window.innerHeight 时认为键盘收起（返回 0）
 * - visualViewport 高度明显小于 window.innerHeight 时认为键盘弹出
 */
export function useViewport() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const viewportHeight = vv.height;
      const windowHeight = window.innerHeight;

      // 使用阈值判断：只有 viewport 明显小于 window 高度时才认为键盘弹出
      // 阈值设为 100px，避免地址栏等 UI 变化的误判
      const THRESHOLD = 100;

      if (windowHeight - viewportHeight > THRESHOLD) {
        // 键盘弹出
        setKeyboardHeight(windowHeight - viewportHeight);
      } else {
        // 键盘收起
        setKeyboardHeight(0);
      }
    };

    // 初始化时调用一次
    handleResize();

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  return { keyboardHeight };
}
