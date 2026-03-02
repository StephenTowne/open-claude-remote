import { useState, useEffect } from 'react';

const STORAGE_KEY = 'claude_remote_onboarding_done';

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: '欢迎使用 Claude Code Remote',
    description: '这是一个让你用手机远程掌控 PC 终端的工具。Claude Code 运行在你的 PC 上，你可以在任何地方通过手机访问它。',
  },
  {
    title: '终端区域',
    description: '这里会实时显示 Claude Code 的输出内容，就像在 PC 终端里一样。支持 ANSI 颜色渲染和滚动。',
  },
  {
    title: '快捷按键与命令',
    description: '底部区域提供常用快捷键（如 Esc、方向键）和命令。点击即可发送，无需在手机上输入复杂按键。',
  },
  {
    title: '多实例切换',
    description: '如果你同时运行多个 Claude Code 实例，可以通过顶部标签页快速切换。每个实例独立连接和管理。',
  },
];

interface OnboardingGuideProps {
  onComplete?: () => void;
}

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // 检查是否已完成引导
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 16,
          background: 'var(--bg-secondary)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
      >
        {/* 步骤指示器 */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
        }}>
          {STEPS.map((_, index) => (
            <div
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: index === currentStep
                  ? 'var(--status-running)'
                  : index < currentStep
                    ? 'var(--status-idle)'
                    : 'var(--border-color)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* 内容 */}
        <div style={{ padding: '24px 20px' }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 600,
            margin: '0 0 12px 0',
            color: 'var(--text-primary)',
          }}>
            {step.title}
          </h2>
          <p style={{
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
            color: 'var(--text-secondary)',
          }}>
            {step.description}
          </p>
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            跳过
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--status-running)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isLast ? '开始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}