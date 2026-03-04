import { useEffect, useRef, useCallback } from 'react';
import { useSpotlight } from './useSpotlight';

/**
 * Spotlight 引导组件
 * 使用镂空遮罩 + 气泡提示的方式引导用户
 */
export function SpotlightGuide() {
  const {
    visible,
    currentStep,
    totalSteps,
    step,
    targetRect,
    isLoading,
    handleNext,
    handlePrev,
    handleSkip,
  } = useSpotlight();

  const containerRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        handleNext();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        handlePrev();
        break;
      case 'Escape':
        e.preventDefault();
        handleSkip();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleNext();
        break;
    }
  }, [handleNext, handlePrev, handleSkip]);

  // 焦点管理
  useEffect(() => {
    if (visible) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      // 延迟聚焦，等待渲染完成
      const timer = setTimeout(() => {
        containerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus();
    }
  }, [visible]);

  if (!visible || !step || !targetRect) return null;

  const padding = step.spotlightPadding ?? 4;
  const radius = step.spotlightRadius ?? 12;
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  // 计算镂空区域位置
  const spotlightLeft = targetRect.left - padding;
  const spotlightTop = targetRect.top - padding;
  const spotlightWidth = targetRect.width + padding * 2;
  const spotlightHeight = targetRect.height + padding * 2;

  // 估算气泡高度（标题 + 描述 + 按钮）
  const estimatedTooltipHeight = 140;

  // 智能决定气泡位置：检查是否有足够空间
  const spaceAbove = spotlightTop;
  const spaceBelow = window.innerHeight - (spotlightTop + spotlightHeight);

  // 如果配置说在下方但空间不够，或者配置说在上方但空间不够，则翻转
  let effectivePosition = step.tooltipPosition;
  if (step.tooltipPosition === 'bottom' && spaceBelow < estimatedTooltipHeight && spaceAbove >= estimatedTooltipHeight) {
    effectivePosition = 'top';
  } else if (step.tooltipPosition === 'top' && spaceAbove < estimatedTooltipHeight && spaceBelow >= estimatedTooltipHeight) {
    effectivePosition = 'bottom';
  }

  // 计算气泡位置
  const tooltipTop = effectivePosition === 'bottom'
    ? spotlightTop + spotlightHeight + 12
    : spotlightTop - 12;

  // 确保气泡不会超出视口底部
  const clampedTooltipTop = Math.min(
    tooltipTop,
    window.innerHeight - estimatedTooltipHeight - 16
  );

  // 确保气泡水平方向不超出视口
  const tooltipWidth = 280;
  const tooltipLeft = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, spotlightLeft));

  // 检测是否应该减少动画
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Guide step ${currentStep + 1} of ${totalSteps}: ${step.title}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        cursor: 'pointer',
      }}
      onClick={(e) => {
        // 点击镂空区域或气泡内部不触发关闭
        const target = e.target as HTMLElement;
        if (target.closest('[data-spotlight-tooltip]')) return;
        handleNext();
      }}
    >
      {/* 遮罩层 + 镂空 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // 使用 box-shadow 创建镂空效果
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
          pointerEvents: 'none',
        }}
      />

      {/* 镂空高亮边框 */}
      <div
        style={{
          position: 'absolute',
          left: spotlightLeft,
          top: spotlightTop,
          width: spotlightWidth,
          height: spotlightHeight,
          borderRadius: radius,
          border: '2px solid var(--status-running)',
          pointerEvents: 'none',
          animation: prefersReducedMotion ? 'none' : 'spotlight-pulse 2s ease-in-out infinite',
        }}
      />

      {/* 气泡提示 */}
      <div
        data-spotlight-tooltip
        style={{
          position: 'absolute',
          left: tooltipLeft,
          top: Math.max(16, clampedTooltipTop),
          transform: effectivePosition === 'top' ? 'translateY(-100%)' : 'none',
          maxWidth: tooltipWidth,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'auto',
          animation: prefersReducedMotion ? 'none' : 'spotlight-tooltip-enter 0.3s ease-out',
        }}
      >
        {/* 指向箭头 */}
        <div
          style={{
            position: 'absolute',
            left: Math.max(16, Math.min(tooltipWidth - 28, spotlightLeft + spotlightWidth / 2 - tooltipLeft - 6)),
            [effectivePosition === 'top' ? 'bottom' : 'top']: -6,
            width: 12,
            height: 12,
            background: 'var(--bg-secondary)',
            transform: effectivePosition === 'top' ? 'translateY(50%) rotate(45deg)' : 'translateY(-50%) rotate(45deg)',
          }}
        />

        {/* 内容 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 4,
            color: 'var(--text-primary)',
          }}>
            {step.title}
          </div>
          <div style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}>
            {step.description}
          </div>

          {/* 步骤指示器 + 按钮 */}
          <div style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* 步骤指示点 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: i === currentStep
                      ? 'var(--status-running)'
                      : i < currentStep
                        ? 'var(--status-idle)'
                        : 'var(--border-color)',
                  }}
                />
              ))}
            </div>

            {/* 按钮 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
              {!isFirst && (
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Prev
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--status-running)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
          }
        }
        @keyframes spotlight-tooltip-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}