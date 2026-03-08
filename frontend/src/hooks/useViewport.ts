import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects software keyboard height on mobile using the Visual Viewport API.
 * Returns the visual viewport offset for smooth keyboard compensation.
 *
 * 检测逻辑：
 * - 追踪 visualViewport 的 offsetTop
 * - 使用 transform: translateY() 实现平滑滚动，避免布局重计算
 * - 仅在检测到输入框被键盘遮挡时启用 visualViewport 补偿
 *
 * 简化策略：
 * - 不再动态修改 height，保持 100dvh 不变
 * - 只返回 offsetTop 和 needsCompensation，供 CSS transform 使用
 *
 * Android 特殊处理：
 * - 在 Android 上禁用 JS 补偿，让浏览器原生滚动处理
 * - 原因：Android 浏览器的原生滚动与 JS transform 会产生双重推动，导致抖动
 * - iOS 仍保留 JS 补偿，因为 iOS 的机制不同
 */
export function useViewport() {
  // offsetTop: visualViewport 距离页面顶部的偏移量（键盘弹出时为正值）
  const [offsetTop, setOffsetTop] = useState(0);
  // needsCompensation: 是否需要进行视口补偿（输入框被键盘遮挡）
  const [needsCompensation, setNeedsCompensation] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 检测是否为 Android 设备
  const isAndroidRef = useRef(false);

  // 初始化时检测设备类型
  useEffect(() => {
    const ua = navigator.userAgent;
    isAndroidRef.current = /android/i.test(ua) && !/windows phone/i.test(ua);
    console.log('[viewport] Device detection:', { isAndroid: isAndroidRef.current, ua });
  }, []);

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
    const occluded = rect.bottom > vv.height + vv.offsetTop - 10;

    // 诊断日志：追踪遮挡检测结果
    console.log('[viewport] checkOcclusion', {
      elementTag: activeElement.tagName,
      rectBottom: Math.round(rect.bottom),
      vvHeight: Math.round(vv.height),
      vvOffsetTop: Math.round(vv.offsetTop),
      threshold: Math.round(vv.height + vv.offsetTop - 10),
      occluded,
      isAndroid: isAndroidRef.current,
    });

    return occluded;
  }, []);

  const updateViewport = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) {
      console.log('[viewport] updateViewport: no visualViewport');
      setOffsetTop(0);
      setNeedsCompensation(false);
      return;
    }

    console.log('[viewport] updateViewport start', {
      vvOffsetTop: Math.round(vv.offsetTop),
      vvHeight: Math.round(vv.height),
      windowInnerHeight: window.innerHeight,
      isAndroid: isAndroidRef.current,
    });

    // Android: 禁用 JS 补偿，让浏览器原生处理
    if (isAndroidRef.current) {
      console.log('[viewport] updateViewport: Android detected, skipping JS compensation');
      setOffsetTop(0);
      setNeedsCompensation(false);
      return;
    }

    // iOS: 使用 JS 补偿
    const occluded = checkOcclusion();
    setNeedsCompensation(occluded);

    if (occluded) {
      console.log('[viewport] updateViewport: iOS setting offsetTop', Math.round(vv.offsetTop));
      setOffsetTop(vv.offsetTop);
    } else {
      console.log('[viewport] updateViewport: iOS clearing offsetTop (not occluded)');
      setOffsetTop(0);
    }
  }, [checkOcclusion]);

  // focusin/focusout 时只检测遮挡状态，不设置 offsetTop
  // 原因：浏览器原生滚动会处理输入框可见性
  // 等待 visualViewport.resize 提供稳定的值后再补偿
  // 这避免了双重补偿（浏览器原生滚动 + JS transform）导致的"跳动"
  const updateViewportImmediate = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    console.log('[viewport] updateViewportImmediate (focusin/focusout)', {
      vvOffsetTop: Math.round(vv.offsetTop),
      vvHeight: Math.round(vv.height),
      activeElement: document.activeElement?.tagName,
      isAndroid: isAndroidRef.current,
    });

    // Android: 禁用 JS 补偿
    if (isAndroidRef.current) {
      console.log('[viewport] updateViewportImmediate: Android detected, skipping');
      setNeedsCompensation(false);
      setOffsetTop(0);
      return;
    }

    const occluded = checkOcclusion();
    setNeedsCompensation(occluded);

    // focusout 时重置为默认值
    if (!occluded) {
      console.log('[viewport] updateViewportImmediate: clearing offsetTop (focusout/not occluded)');
      setOffsetTop(0);
    } else {
      console.log('[viewport] updateViewportImmediate: focusin detected occlusion, waiting for resize');
    }
    // focusin 时不设置 offsetTop，等待 visualViewport.resize
  }, [checkOcclusion]);

  // 防抖处理：用于 visualViewport 变化事件
  // 延迟 150ms 应用补偿，等待浏览器原生滚动动画完成
  // 这避免了与浏览器原生滚动的竞争（假设 A: 双重推动）
  const debouncedUpdate = useCallback(() => {
    console.log('[viewport] debouncedUpdate triggered (visualViewport resize/scroll)');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // 延迟 150ms，等待浏览器原生滚动动画完成后再应用 JS 补偿
    debounceTimerRef.current = setTimeout(updateViewport, 150);
  }, [updateViewport]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 初始化时使用默认值（不防抖），让浏览器原生处理
    // 只有后续检测到遮挡时才启用补偿
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

  return { offsetTop, needsCompensation };
}