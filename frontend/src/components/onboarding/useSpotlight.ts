import { useState, useEffect, useCallback, useRef } from 'react';
import { SpotlightStep, SPOTLIGHT_STEPS, STORAGE_KEY } from './spotlight-steps';

interface TargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseSpotlightReturn {
  visible: boolean;
  currentStep: number;
  totalSteps: number;
  step: SpotlightStep | null;
  targetRect: TargetRect | null;
  isLoading: boolean;
  handleNext: () => void;
  handlePrev: () => void;
  handleSkip: () => void;
  recalculate: () => void;
}

/**
 * Spotlight 引导 Hook
 * 管理引导状态和目标元素定位
 */
export function useSpotlight(): UseSpotlightReturn {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const resizeTimeoutRef = useRef<number | null>(null);

  const step = SPOTLIGHT_STEPS[currentStep] ?? null;
  const totalSteps = SPOTLIGHT_STEPS.length;

  // 计算目标元素位置（补偿父容器的 transform 偏移）
  const calculateTargetRect = useCallback((stepToCalc: SpotlightStep): TargetRect | null => {
    const element = document.querySelector(stepToCalc.target);
    if (!element) return null;

    const rect = element.getBoundingClientRect();

    // 获取 ConsolePage 容器的 transform 偏移（键盘补偿）
    // ConsolePage 使用 translateY 来适配虚拟键盘，这会改变视觉坐标系
    const consolePage = document.querySelector('[data-testid="console-page"]');
    const style = consolePage ? window.getComputedStyle(consolePage) : null;
    const transform = style?.transform;
    let offsetY = 0;

    if (transform && transform !== 'none') {
      // 解析 matrix(a, b, c, d, tx, ty) 格式
      const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,([^)]+)\)/);
      if (match) {
        offsetY = parseFloat(match[1]);
      }
    }

    return {
      left: rect.left,
      top: rect.top - offsetY, // 补偿向上平移的偏移（offsetY 为负值，减去后等价于相加）
      width: rect.width,
      height: rect.height,
    };
  }, []);

  // 重新计算当前位置
  const recalculate = useCallback(() => {
    if (!step) return;
    const rect = calculateTargetRect(step);
    setTargetRect(rect);
  }, [step, calculateTargetRect]);

  // 初始化：检查是否需要显示引导
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setVisible(true);
    }
  }, []);

  // 当步骤变化时计算目标位置
  useEffect(() => {
    if (!visible || !step) return;

    // 滚动到目标元素
    const element = document.querySelector(step.target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 等待滚动完成后计算位置
    const timer = setTimeout(() => {
      const rect = calculateTargetRect(step);
      if (rect) {
        setTargetRect(rect);
        setIsLoading(false);
      } else {
        // 目标不存在，跳过此步骤
        if (currentStep < totalSteps - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          handleComplete();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [visible, currentStep, step, calculateTargetRect, totalSteps]);

  // 为目标元素添加/移除高亮样式
  useEffect(() => {
    if (!visible || !step) return;

    const element = document.querySelector(step.target) as HTMLElement | null;
    if (!element) return;

    // 保存原始样式
    const originalOutline = element.style.outline;
    const originalOutlineOffset = element.style.outlineOffset;
    const originalPosition = element.style.position;
    const originalZIndex = element.style.zIndex;

    // 添加高亮样式（使用 outline 确保在元素外部显示且不影响布局）
    element.style.outline = '2px solid var(--status-running)';
    element.style.outlineOffset = '2px';
    // 确保元素有定位上下文，以便 z-index 生效
    if (window.getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
    element.style.zIndex = '2001'; // 高于遮罩层 z-index: 2000

    return () => {
      // 恢复原始样式
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
      element.style.position = originalPosition;
      element.style.zIndex = originalZIndex;
    };
  }, [visible, step]);

  // 监听 resize 和 visualViewport 变化
  useEffect(() => {
    if (!visible) return;

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        recalculate();
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // 监听虚拟键盘
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [visible, recalculate]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    setIsLoading(true);
    setTargetRect(null);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      setIsLoading(true);
    } else {
      handleComplete();
    }
  }, [currentStep, totalSteps, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsLoading(true);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  return {
    visible,
    currentStep,
    totalSteps,
    step,
    targetRect,
    isLoading,
    handleNext,
    handlePrev,
    handleSkip,
    recalculate,
  };
}