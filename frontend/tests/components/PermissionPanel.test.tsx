import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionPanel } from '../../src/components/input/PermissionPanel.js';

describe('PermissionPanel', () => {
  const mockOnAllow = vi.fn();
  const mockOnDeny = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render tool name in title', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'ls' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('Bash')).toBeDefined();
    expect(screen.getByText(/Claude 请求使用/)).toBeDefined();
  });

  it('should render Allow and Deny buttons', () => {
    render(
      <PermissionPanel
        toolName="Read"
        toolInput={{}}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('允许')).toBeDefined();
    expect(screen.getByText('拒绝')).toBeDefined();
  });

  it('should render Always Allow button when permissionSuggestions is provided', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'ls' }}
        permissionSuggestions={[{ type: 'allow', tool: 'Bash' }]}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('始终允许')).toBeDefined();
  });

  it('should not render Always Allow button when permissionSuggestions is undefined', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'ls' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.queryByText('始终允许')).toBeNull();
  });

  it('should call onAllow(false) when Allow button is clicked', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'ls' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    fireEvent.click(screen.getByText('允许'));
    expect(mockOnAllow).toHaveBeenCalledWith(false);
    expect(mockOnAllow).toHaveBeenCalledOnce();
  });

  it('should call onAllow(true) when Always Allow button is clicked', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'ls' }}
        permissionSuggestions={[{ type: 'allow', tool: 'Bash' }]}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    fireEvent.click(screen.getByText('始终允许'));
    expect(mockOnAllow).toHaveBeenCalledWith(true);
    expect(mockOnAllow).toHaveBeenCalledOnce();
  });

  it('should call onDeny when Deny button is clicked', () => {
    render(
      <PermissionPanel
        toolName="Write"
        toolInput={{ file_path: '/test.txt' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    fireEvent.click(screen.getByText('拒绝'));
    expect(mockOnDeny).toHaveBeenCalledOnce();
  });

  it('should show command preview for Bash tool', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: 'rm -rf /tmp/test' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('rm -rf /tmp/test')).toBeDefined();
  });

  it('should show file_path preview for Read tool', () => {
    render(
      <PermissionPanel
        toolName="Read"
        toolInput={{ file_path: '/home/user/test.txt' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('/home/user/test.txt')).toBeDefined();
  });

  it('should show path preview for Write tool', () => {
    render(
      <PermissionPanel
        toolName="Write"
        toolInput={{ path: '/home/user/output.txt' }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByText('/home/user/output.txt')).toBeDefined();
  });

  it('should truncate long input preview', () => {
    const longCommand = 'a'.repeat(300);
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{ command: longCommand }}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    const preview = screen.getByText('a'.repeat(200));
    expect(preview).toBeDefined();
  });

  it('should not show preview when toolInput is empty', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{}}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    // Preview container should not exist
    const panel = screen.getByTestId('permission-panel');
    expect(panel.innerHTML).not.toContain('background: var(--bg-tertiary)');
  });

  it('should have correct test id', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{}}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    expect(screen.getByTestId('permission-panel')).toBeDefined();
  });

  it('should have correct role and aria attributes', () => {
    render(
      <PermissionPanel
        toolName="Bash"
        toolInput={{}}
        onAllow={mockOnAllow}
        onDeny={mockOnDeny}
      />
    );

    const panel = screen.getByRole('dialog');
    expect(panel).toBeDefined();
    expect(panel.getAttribute('aria-labelledby')).toBe('permission-title');
  });
});