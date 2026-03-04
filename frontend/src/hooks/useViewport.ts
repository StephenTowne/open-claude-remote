import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the visual viewport height and offset.
 *
 * 检测逻辑：
 * - 追踪 visualViewport 的 height 和 offsetTop
 * - 页面可以使用 fixed 定位，绑定在 visualViewport 上，避免键盘遮挡
 * - 同时监听 resize 和 scroll 事件，捕获工具栏变化
 * - 使用较长防抖（150ms）跳过键盘动画中间状态，避免跳动
 */
export function useViewport() {
  // 默认使用 window.innerHeight
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const [offsetTop, setOffsetTop] = useState(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateViewport = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) {
      if (typeof window !== 'undefined') {
        setHeight(window.innerHeight);
      }
      setOffsetTop(0);
      return;
    }

    setHeight(vv.height);
    setOffsetTop(vv.offsetTop);
  }, []);

  // 防抖处理：150ms 跳过键盘动画中间状态
  // 键盘弹起动画通常 100-300ms，150ms 防抖可以跳过大部分中间状态
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(updateViewport, 150);
  }, [updateViewport]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 初始化时立即更新状态（不防抖）
    setHeight(vv.height);
    setOffsetTop(vv.offsetTop);

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
  }, [debouncedUpdate]);

  return { height, offsetTop };
}
