import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalCard } from '../../src/components/approval/ApprovalCard.js';

describe('ApprovalCard', () => {
  const mockApproval = {
    id: 'test-123',
    tool: 'Bash',
    description: 'Execute: ls -la /tmp',
    params: { command: 'ls -la /tmp' },
  };

  it('should render tool name and description', () => {
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Bash')).toBeDefined();
    expect(screen.getByText('Execute: ls -la /tmp')).toBeDefined();
  });

  it('should call onApprove when approve button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={onApprove}
        onReject={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('should call onReject when reject button is clicked', () => {
    const onReject = vi.fn();
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={() => {}}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('should display parameters when provided', () => {
    render(
      <ApprovalCard
        approval={mockApproval}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Parameters')).toBeDefined();
  });

  it('should not display parameters section when not provided', () => {
    const noParamsApproval = { ...mockApproval, params: undefined };
    render(
      <ApprovalCard
        approval={noParamsApproval}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.queryByText('Parameters')).toBeNull();
  });
});
