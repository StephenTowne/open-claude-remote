import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl, type SegmentedControlOption } from '../../src/components/common/SegmentedControl.js';

describe('SegmentedControl', () => {
  const options: SegmentedControlOption<string>[] = [
    { value: 'a', label: 'Option A', description: 'First option' },
    { value: 'b', label: 'Option B', description: 'Second option' },
    { value: 'c', label: 'Option C' },
  ];

  it('renders all options with correct labels', () => {
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={() => {}}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0].textContent).toContain('Option A');
    expect(radios[1].textContent).toContain('Option B');
    expect(radios[2].textContent).toContain('Option C');
  });

  it('marks the selected option as checked', () => {
    render(
      <SegmentedControl
        options={options}
        value="b"
        onChange={() => {}}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when clicking an option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // Click Option B
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('calls onChange even when clicking the already selected option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]); // Click Option A (already selected)
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('disables all options when disabled prop is true', () => {
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={() => {}}
        disabled
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('disabled');
    });
  });

  it('supports keyboard navigation with ArrowRight', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('supports keyboard navigation with ArrowLeft', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="b"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[1], { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('wraps around with ArrowRight from last option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="c"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[2], { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('wraps around with ArrowLeft from first option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('c');
  });

  it('supports Home key to jump to first option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="c"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[2], { key: 'Home' });
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('supports End key to jump to last option', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.keyDown(radios[0], { key: 'End' });
    expect(handleChange).toHaveBeenCalledWith('c');
  });

  it('renders with aria-label for accessibility', () => {
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={() => {}}
        aria-label="Test control"
      />
    );

    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'Test control');
  });

  it('works with number values', () => {
    const numberOptions: SegmentedControlOption<number>[] = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
      { value: 3, label: 'Three' },
    ];
    const handleChange = vi.fn();

    render(
      <SegmentedControl
        options={numberOptions}
        value={1}
        onChange={handleChange}
        aria-label="Number control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // Click Two
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('renders icons when provided', () => {
    const IconA = () => <span data-testid="icon-a">A</span>;
    const IconB = () => <span data-testid="icon-b">B</span>;

    const optionsWithIcons: SegmentedControlOption<string>[] = [
      { value: 'a', label: 'Option A', icon: <IconA /> },
      { value: 'b', label: 'Option B', icon: <IconB /> },
    ];

    render(
      <SegmentedControl
        options={optionsWithIcons}
        value="a"
        onChange={() => {}}
        aria-label="Test control"
      />
    );

    expect(screen.getByTestId('icon-a')).toBeInTheDocument();
    expect(screen.getByTestId('icon-b')).toBeInTheDocument();
  });

  it('handles empty options gracefully', () => {
    render(
      <SegmentedControl
        options={[]}
        value=""
        onChange={() => {}}
        aria-label="Empty control"
      />
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('does not trigger onChange when disabled and clicked', () => {
    const handleChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="a"
        onChange={handleChange}
        disabled
        aria-label="Test control"
      />
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
