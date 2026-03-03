import { useState, useEffect } from 'react';

const STORAGE_KEY = 'claude_remote_onboarding_done';

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: '欢迎使用 Claude Code Remote',
    description: '这是一个让你用手机远程掌控 PC 终端的工具。Claude Code 运行在你的 PC 上，你可以在任何地方通过手机访问它。支持 ANSI 颜色渲染，保持完整的终端体验。',
  },
  {
    title: '终端显示区',
    description: '这里实时显示 Claude Code 的输出内容，就像在 PC 终端里一样。右上角的 ↑↓ 按钮可以快速滚动到顶部或底部，支持 10,000 行历史记录回滚。',
  },
  {
    title: '命令输入框',
    description: '在底部输入框中输入命令或消息，按 Enter 发送。Claude 会根据你的输入继续工作。',
  },
  {
    title: '快捷按键栏',
    description: '底部横栏提供常用快捷键：Esc 取消操作、Enter 继续执行、Tab 补全、方向键移动、Ctrl+C 中断。点击即可发送，无需在手机键盘上输入复杂按键组合。',
  },
  {
    title: '命令按钮',
    description: '快捷栏右侧显示预设命令，点击可直接发送（如 /clear 清屏）。部分命令会先填入输入框供你编辑后再发送，方便自定义参数。',
  },
  {
    title: '状态指示器与工具审批',
    description: '顶部状态栏显示当前会话状态：Idle（空闲）、Running（执行中）、Waiting Input（等待审批）。当 Claude 需要使用敏感工具时，状态变黄，输入 y 确认或按 Esc 拒绝。',
  },
  {
    title: '多实例、设置与通知',
    description: '运行多个实例时通过顶部标签页切换。点击 ⚙️ 按钮自定义快捷键和命令。开启通知权限后，Claude 等待输入时会收到本地通知。若 PC 局域网 IP 变化，会自动提示新地址。',
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