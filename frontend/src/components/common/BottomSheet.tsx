import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// 拖拽配置常量
const DRAG_CLOSE_THRESHOLD = 100;
const DRAG_CLOSE_VELOCITY = 300;

// 检测用户是否偏好减少动效（渲染时读取，无需响应运行时变化）
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const duration = prefersReducedMotion ? 0 : 300;

/**
 * 通用底部抽屉组件
 * - 滑入/滑出动画（300ms ease-out），尊重 prefers-reduced-motion
 * - 顶部大圆角 + 拖拽手柄
 * - 点击遮罩关闭
 * - 拖拽手柄可拖拽关闭
 */
export function BottomSheet({ isOpen, onClose, title, children, footer }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);

  // 动画状态管理
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setDragY(0);
      if (prefersReducedMotion) {
        // 跳过动画，直接显示
        setIsAnimating(true);
      } else {
        // 双重 rAF 确保浏览器先渲染 translateY(100%) 的初始帧，再过渡到 translateY(0)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsAnimating(true));
        });
      }
    } else if (isVisible) {
      setIsAnimating(false);
      if (prefersReducedMotion) {
        setIsVisible(false);
      } else {
        const timer = setTimeout(() => setIsVisible(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, isVisible]);

  // 拖拽开始
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartYRef.current = clientY;
    dragStartTimeRef.current = Date.now();
    setDragY(0);
  }, []);

  // 拖拽移动
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const deltaY = clientY - dragStartYRef.current;
    if (deltaY > 0) { // 只允许向下拖拽
      setDragY(deltaY);
    }
  }, [isDragging]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const dragDistance = dragY;
    const dragDuration = Date.now() - dragStartTimeRef.current;
    const velocity = dragDuration > 0 ? dragDistance / (dragDuration / 1000) : 0;

    // 如果拖拽距离超过阈值或速度较快，则关闭面板
    if (dragDistance > DRAG_CLOSE_THRESHOLD || (dragDistance > 50 && velocity > DRAG_CLOSE_VELOCITY)) {
      onClose();
    } else if (dragDistance < 5) {
      // 拖拽距离很小（< 5px），视为轻触，关闭面板
      onClose();
    } else {
      // 回弹
      setDragY(0);
    }

    setIsDragging(false);
  }, [isDragging, dragY, onClose]);

  if (!isVisible) return null;

  const transitionStyle = prefersReducedMotion
    ? 'none'
    : (isDragging ? 'none' : `transform ${duration}ms ease-out`);
  const overlayTransition = prefersReducedMotion ? 'none' : `background ${duration}ms ease-out`;

  // 计算面板transform（考虑拖拽位移）
  const sheetTransform = isDragging
    ? `translateY(${dragY}px)`
    : (isAnimating ? 'translateY(0)' : 'translateY(100%)');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isAnimating ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
        transition: overlayTransition,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          // 考虑安全区域
          maxHeight: 'calc(85vh - env(safe-area-inset-bottom, 0px))',
          borderRadius: '16px 16px 0 0',
          background: 'var(--bg-secondary)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: sheetTransform,
          transition: transitionStyle,
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {/* 拖拽手柄 - 透明热区扩大触控面积 */}
        <div
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* 视觉指示条 - 保持原有样式 */}
          <div
            style={{
              width: 36,
              height: 4,
              background: 'var(--text-secondary)',
              opacity: 0.5,
              borderRadius: 2,
            }}
          />
        </div>

        {/* 头部 */}
        <div style={{
          padding: '0 20px 16px 20px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {title}
          </h2>
        </div>

        {/* 内容区 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          padding: '0 16px',
        }}>
          {children}
        </div>

        {/* 底部操作栏 */}
        {footer && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}