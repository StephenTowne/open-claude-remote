import { useState, useEffect } from 'react';

const STORAGE_KEY = 'claude_remote_onboarding_done';

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Claude Code Remote',
    description: 'This tool lets you remotely control your PC terminal from your phone. Claude Code runs on your PC, and you can access it from anywhere on your phone. Full ANSI color rendering support for a complete terminal experience.',
  },
  {
    title: 'Terminal Display',
    description: 'This area shows Claude Code output in real-time, just like on your PC terminal. Use the ↑↓ buttons in the top right to quickly scroll to the top or bottom. Supports 10,000 lines of scrollback history.',
  },
  {
    title: 'Command Input',
    description: 'Enter commands or messages in the bottom input box and press Enter to send. Claude will continue working based on your input.',
  },
  {
    title: 'Shortcut Bar',
    description: 'The bottom bar provides common shortcuts: Esc to cancel, Enter to continue, Tab for completion, arrow keys for navigation, Ctrl+C to interrupt. Just tap to send - no need to type complex key combinations on your phone.',
  },
  {
    title: 'Command Buttons',
    description: 'Preset commands appear on the right side of the shortcut bar. Tap to send directly (e.g., /clear to clear screen). Some commands fill the input box first for editing before sending, making it easy to customize parameters.',
  },
  {
    title: 'Status Indicator & Tool Approval',
    description: 'The top status bar shows the current session state: Idle, Running, or Waiting Input. When Claude needs to use a sensitive tool, the status turns yellow. Type y to approve or press Esc to deny.',
  },
  {
    title: 'Multi-Instance, Settings & Notifications',
    description: 'Switch between multiple instances using the top tabs. Click the ⚙️ button to customize shortcuts and commands. Enable notification permissions to receive alerts when Claude is waiting for input. If your PC LAN IP changes, you\'ll be notified of the new address.',
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
            Skip
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
                Previous
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
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}