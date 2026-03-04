import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the visual viewport height and offset.
 *
 * 检测逻辑：
 * - 追踪 visualViewport 的 height 和 offsetTop
 * - 页面可以使用 fixed 定位，绑定在 visualViewport 上，避免键盘遮挡
 * - 同时监听 resize 和 scroll 事件，捕获工具栏变化
 *
 * 混合布局策略：
 * - 默认使用浏览器原生行为（CSS dvh），避免抖动
 * - 仅在检测到输入框被键盘遮挡时启用 visualViewport 补偿
 */
export function useViewport() {
  // 默认使用 window.innerHeight
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const [offsetTop, setOffsetTop] = useState(0);
  const [needsCompensation, setNeedsCompensation] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 检测输入框是否被软键盘遮挡
   * 当输入框底部超出 visualViewport 可视区域时返回 true
   */
  const checkOcclusion = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
      return false;
    }

    const vv = window.visualViewport;
    if (!vv) return false;

    const rect = (activeElement as HTMLElement).getBoundingClientRect();
    // 输入框底部超出 visualViewport 底部 → 被遮挡
    // 预留 10px 容差避免边缘情况
    return rect.bottom > vv.height + vv.offsetTop - 10;
  }, []);

  const updateViewport = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) {
      if (typeof window !== 'undefined') {
        setHeight(window.innerHeight);
      }
      setOffsetTop(0);
      setNeedsCompensation(false);
      return;
    }

    // 检测是否需要补偿
    const occluded = checkOcclusion();
    setNeedsCompensation(occluded);

    if (occluded) {
      // 只有被遮挡时才使用 visualViewport 值
      setHeight(vv.height);
      setOffsetTop(vv.offsetTop);
    } else {
      // 否则使用默认值，让浏览器原生处理
      setHeight(window.innerHeight);
      setOffsetTop(0);
    }
  }, [checkOcclusion]);

  // 立即更新（无防抖），用于 focus 事件
  const updateViewportImmediate = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 立即检测并更新（不等待键盘动画完成）
    const occluded = checkOcclusion();
    setNeedsCompensation(occluded);

    if (occluded) {
      setHeight(vv.height);
      setOffsetTop(vv.offsetTop);
    } else {
      // focusout 时重置为默认值，保持 hook 状态自洽
      setHeight(window.innerHeight);
      setOffsetTop(0);
    }
  }, [checkOcclusion]);

  // 防抖处理：用于 visualViewport 变化事件
  // 键盘弹起动画通常 100-300ms，使用较短防抖避免明显延迟
  const debouncedUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(updateViewport, 50);
  }, [updateViewport]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 初始化时使用默认值（不防抖），让浏览器原生处理
    // 只有后续检测到遮挡时才启用补偿
    setHeight(window.innerHeight);
    setOffsetTop(0);

    // 同时监听 resize 和 scroll 事件
    // scroll 事件捕获华为工具栏变化场景
    vv.addEventListener('resize', debouncedUpdate);
    vv.addEventListener('scroll', debouncedUpdate);

    // 监听 focus 事件，立即检测遮挡
    // 使用 capture 阶段确保在键盘弹出前捕获
    document.addEventListener('focusin', updateViewportImmediate, true);
    document.addEventListener('focusout', updateViewportImmediate, true);

    return () => {
      vv.removeEventListener('resize', debouncedUpdate);
      vv.removeEventListener('scroll', debouncedUpdate);
      document.removeEventListener('focusin', updateViewportImmediate, true);
      document.removeEventListener('focusout', updateViewportImmediate, true);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debouncedUpdate, updateViewportImmediate]);

  return { height, offsetTop, needsCompensation };
}
