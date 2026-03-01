import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionPanel } from '../../src/components/input/QuestionPanel.js';
import type { Question } from '@claude-remote/shared';

const singleQuestion: Question[] = [
  {
    question: 'Which library should we use?',
    header: 'Library',
    options: [
      { label: 'React', description: 'UI library' },
      { label: 'Vue', description: 'Progressive framework' },
      { label: 'Other' },
    ],
    multiSelect: false,
  },
];

const multiSelectQuestion: Question[] = [
  {
    question: 'Which features do you want?',
    header: 'Features',
    options: [
      { label: 'Auth', description: 'Authentication' },
      { label: 'API', description: 'REST API' },
      { label: 'DB', description: 'Database' },
    ],
    multiSelect: true,
  },
];

describe('QuestionPanel', () => {
  it('should render question header and text', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('Library')).toBeDefined();
    expect(screen.getByText('Which library should we use?')).toBeDefined();
  });

  it('should render option labels and descriptions', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('React')).toBeDefined();
    expect(screen.getByText('UI library')).toBeDefined();
    expect(screen.getByText('Vue')).toBeDefined();
    expect(screen.getByText('Progressive framework')).toBeDefined();
    expect(screen.getByText('Other')).toBeDefined();
  });

  it('should highlight selected option', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={1}
        onSelect={() => {}}
      />,
    );

    const buttons = screen.getAllByRole('button');
    // selectedIndex=1 (Vue) should have highlighted border (JSDOM converts to rgb)
    const highlightColor = buttons[1].style.borderColor;
    expect(highlightColor === '#58a6ff' || highlightColor === 'rgb(88, 166, 255)').toBe(true);
    // Other buttons should not have the highlight
    const normalColor = buttons[0].style.borderColor;
    expect(normalColor === '#58a6ff' || normalColor === 'rgb(88, 166, 255)').toBe(false);
  });

  it('should call onSelect with correct index when option is clicked', () => {
    const onSelect = vi.fn();
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('Vue'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('should show checkmarks on selected options in multiSelect mode', () => {
    render(
      <QuestionPanel
        questions={multiSelectQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        selectedOptions={new Set([0, 2])}
        onSelect={() => {}}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toContain('✓');
    expect(buttons[1].textContent).not.toContain('✓');
    expect(buttons[2].textContent).toContain('✓');
  });

  it('should show text input when Other option is in input mode', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={2}
        otherInput="my text"
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText('输入自定义内容...');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('my text');
  });

  it('should call onOtherInputChange when text input changes', () => {
    const onOtherInputChange = vi.fn();
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={2}
        otherInput=""
        onSelect={() => {}}
        onOtherInputChange={onOtherInputChange}
        onOtherSubmit={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText('输入自定义内容...');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onOtherInputChange).toHaveBeenCalledWith('hello');
  });

  it('should call onOtherSubmit when Enter is pressed in text input', () => {
    const onOtherSubmit = vi.fn();
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={2}
        otherInput="test"
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={onOtherSubmit}
      />,
    );

    const input = screen.getByPlaceholderText('输入自定义内容...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOtherSubmit).toHaveBeenCalledOnce();
  });

  it('should show question progress for multiple questions', () => {
    const twoQuestions: Question[] = [
      { question: 'Q1?', options: [{ label: 'A' }] },
      { question: 'Q2?', options: [{ label: 'B' }] },
    ];

    render(
      <QuestionPanel
        questions={twoQuestions}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('1 / 2')).toBeDefined();
  });

  it('should have data-testid for integration testing', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByTestId('question-panel')).toBeDefined();
  });

  it('should expose accessible group semantics and selection state', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={1}
        onSelect={() => {}}
      />,
    );

    const group = screen.getByRole('group', { name: 'Which library should we use?' });
    expect(group).toBeDefined();

    const reactBtn = screen.getByRole('button', { name: 'React UI library' });
    const vueBtn = screen.getByRole('button', { name: 'Vue Progressive framework' });

    expect(reactBtn.getAttribute('aria-pressed')).toBe('false');
    expect(vueBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('should focus Other input when Other option is active', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={2}
        otherInput="abc"
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText('输入自定义内容...');
    expect(document.activeElement).toBe(input);
  });

  it('should support localized "其他" as Other option', () => {
    const localizedQuestion: Question[] = [
      {
        question: '请选择',
        options: [{ label: 'A' }, { label: '其他' }],
      },
    ];

    render(
      <QuestionPanel
        questions={localizedQuestion}
        currentQuestionIndex={0}
        selectedIndex={1}
        otherInput=""
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should treat "输入文字" as free-text option', () => {
    const freeTextQuestion: Question[] = [
      {
        question: '请选择',
        options: [{ label: 'A' }, { label: '输入文字' }],
      },
    ];

    render(
      <QuestionPanel
        questions={freeTextQuestion}
        currentQuestionIndex={0}
        selectedIndex={1}
        otherInput=""
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should treat "chat about this" as free-text option', () => {
    const chatQuestion: Question[] = [
      {
        question: 'Need more context?',
        options: [{ label: 'Approve' }, { label: 'chat about this' }],
      },
    ];

    render(
      <QuestionPanel
        questions={chatQuestion}
        currentQuestionIndex={0}
        selectedIndex={1}
        otherInput=""
        onSelect={() => {}}
        onOtherInputChange={() => {}}
        onOtherSubmit={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText('输入自定义内容...')).toBeDefined();
  });

  it('should keep normal option without free-text input', () => {
    render(
      <QuestionPanel
        questions={singleQuestion}
        currentQuestionIndex={0}
        selectedIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.queryByPlaceholderText('输入自定义内容...')).toBeNull();
  });
});
