import { useState, useEffect, type ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// 检测用户是否偏好减少动效（渲染时读取，无需响应运行时变化）
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const duration = prefersReducedMotion ? 0 : 300;

/**
 * 通用底部抽屉组件
 * - 滑入/滑出动画（300ms ease-out），尊重 prefers-reduced-motion
 * - 顶部大圆角 + 拖拽手柄
 * - 点击遮罩关闭
 */
export function BottomSheet({ isOpen, onClose, title, children, footer }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 动画状态管理
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
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

  if (!isVisible) return null;

  const transitionStyle = prefersReducedMotion ? 'none' : `transform ${duration}ms ease-out`;
  const overlayTransition = prefersReducedMotion ? 'none' : `background ${duration}ms ease-out`;

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
          maxHeight: '85vh',
          borderRadius: '16px 16px 0 0',
          background: 'var(--bg-secondary)',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
          transition: transitionStyle,
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {/* 拖拽手柄 */}
        <div style={{
          width: 36,
          height: 4,
          background: 'var(--text-secondary)',
          opacity: 0.5,
          borderRadius: 2,
          margin: '12px auto',
          flexShrink: 0,
        }} />

        {/* 头部 */}
        <div style={{
          padding: '0 20px 16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
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