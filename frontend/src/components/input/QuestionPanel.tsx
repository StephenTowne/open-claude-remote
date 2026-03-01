import type { Question } from '@claude-remote/shared';
import { isFreeTextLabel } from '@claude-remote/shared';

export interface QuestionPanelProps {
  questions: Question[];
  currentQuestionIndex: number;
  selectedIndex: number;
  selectedOptions?: Set<number>;
  otherInput?: string;
  onSelect: (index: number) => void;
  onOtherInputChange?: (text: string) => void;
  onOtherSubmit?: () => void;
}

export function QuestionPanel({
  questions,
  currentQuestionIndex,
  selectedIndex,
  selectedOptions,
  otherInput,
  onSelect,
  onOtherInputChange,
  onOtherSubmit,
}: QuestionPanelProps) {
  const q = questions[currentQuestionIndex];
  if (!q) return null;

  const isMultiSelect = q.multiSelect ?? false;
  const isOtherActive = isFreeTextLabel(q.options[selectedIndex]?.label ?? '') && otherInput !== undefined;
  const questionId = `question-text-${currentQuestionIndex}`;

  return (
    <div
      data-testid="question-panel"
      role="group"
      aria-labelledby={questionId}
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 12px',
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      {/* Header + progress */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
      }}>
        {q.header && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#58a6ff',
            background: 'rgba(88, 166, 255, 0.1)',
            padding: '2px 8px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
          }}>
            {q.header}
          </span>
        )}
        {questions.length > 1 && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {currentQuestionIndex + 1} / {questions.length}
          </span>
        )}
      </div>

      {/* Question text */}
      <div
        id={questionId}
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          marginBottom: 4,
        }}
      >
        {q.question}
      </div>

      {/* Options */}
      {q.options.map((option, idx) => {
        const isSelected = idx === selectedIndex;
        const isChecked = isMultiSelect && selectedOptions?.has(idx);

        return (
          <button
            key={`${idx}-${option.label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(idx)}
            aria-pressed={isSelected}
            aria-label={option.description ? `${option.label} ${option.description}` : option.label}
            autoFocus={isSelected && !isOtherActive}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: isSelected
                ? '1px solid #58a6ff'
                : '1px solid var(--border-color)',
              borderColor: isSelected ? '#58a6ff' : 'var(--border-color)',
              background: isSelected
                ? 'rgba(88, 166, 255, 0.12)'
                : 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              transition: 'background 0.1s, border-color 0.1s',
            }}
          >
            <span style={{
              color: isSelected ? '#58a6ff' : 'var(--text-secondary)',
              minWidth: 20,
              fontWeight: isSelected ? 600 : 400,
            }}>
              {isChecked ? '✓' : isSelected ? '❯' : `${idx + 1}.`}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{option.label}</span>
              {option.description && (
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}>
                  {option.description}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* Other text input */}
      {isOtherActive && (
        <input
          type="text"
          className="focus-ring"
          placeholder="输入自定义内容..."
          value={otherInput ?? ''}
          onChange={(e) => onOtherInputChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOtherSubmit?.();
          }}
          autoFocus
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 6,
            border: '1px solid #58a6ff',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
