import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the keyboard offset in pixels.
 *
 * 检测逻辑：
 * - 使用 visualViewport.offsetTop 作为键盘高度（键盘将 viewport 推上去的距离）
 * - offsetTop 不包含华为输入法工具栏空白区域，避免 InputBar 被推得过高
 * - 同时监听 resize 和 scroll 事件，捕获工具栏变化
 * - 使用防抖避免高频事件导致性能问题
 */
export function useViewport() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateKeyboardHeight = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const viewportHeight = vv.height;
    const windowHeight = window.innerHeight;
    const offsetTop = vv.offsetTop;

    // 使用阈值判断：只有 viewport 明显小于 window 高度时才认为键盘弹出
    // 阈值设为 100px，避免地址栏等 UI 变化的误判
    const THRESHOLD = 100;

    if (windowHeight - viewportHeight > THRESHOLD) {
      // 使用 offsetTop 作为 keyboardHeight
      // offsetTop 是键盘真正将 viewport 推上去的距离，不含工具栏空白
      setKeyboardHeight(offsetTop);
    } else {
      // 键盘收起
      setKeyboardHeight(0);
    }
  }, []);

  // 防抖处理：16ms 约 60fps
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(updateKeyboardHeight, 16);
  }, [updateKeyboardHeight]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 初始化时调用一次（立即执行，不防抖）
    updateKeyboardHeight();

    // 同时监听 resize 和 scroll 事件
    // scroll 事件捕获华为工具栏变化场景
    vv.addEventListener('resize', debouncedUpdate);
    vv.addEventListener('scroll', debouncedUpdate);
    return () => {
      vv.removeEventListener('resize', debouncedUpdate);
      vv.removeEventListener('scroll', debouncedUpdate);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debouncedUpdate, updateKeyboardHeight]);

  return { keyboardHeight };
}
