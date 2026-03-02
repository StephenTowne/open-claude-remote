import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceSelector } from '../../src/components/common/WorkspaceSelector.js';

describe('WorkspaceSelector', () => {
  const mockWorkspaces = [
    '/Users/tom/projects/claude-code-remote',
    '/Users/tom/projects/another-project',
    '/home/user/workspace/test-app',
  ];
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('基础渲染', () => {
    it('渲染触发器显示 placeholder', () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
          placeholder="选择工作目录..."
        />
      );

      expect(screen.getByText('选择工作目录...')).toBeDefined();
    });

    it('渲染触发器显示选中的目录名', () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value="/Users/tom/projects/claude-code-remote"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('claude-code-remote')).toBeDefined();
    });

    it('空工作目录列表时显示空状态', () => {
      render(
        <WorkspaceSelector
          workspaces={[]}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('没有可用的工作目录')).toBeDefined();
    });

    it('disabled 状态时触发器不可点击', () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('button');
      expect(trigger.hasAttribute('disabled')).toBe(true);
    });

    it('disabled 状态时点击触发器不应打开下拉面板', () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // 下拉面板应该不存在
      expect(screen.queryByPlaceholderText('搜索工作目录…')).toBeNull();
    });
  });

  describe('下拉面板交互', () => {
    it('点击触发器展开下拉面板', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });
    });

    it('Escape 键关闭下拉面板', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('搜索工作目录…')).toBeNull();
      });
    });
  });

  describe('搜索过滤', () => {
    it('输入关键词过滤工作目录列表', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      fireEvent.change(searchInput, { target: { value: 'claude' } });

      await waitFor(() => {
        expect(screen.getByText('claude-code-remote')).toBeDefined();
        expect(screen.queryByText('another-project')).toBeNull();
        expect(screen.queryByText('test-app')).toBeNull();
      });
    });

    it('搜索无结果时显示空状态', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('没有匹配的工作目录')).toBeDefined();
      });
    });
  });

  describe('键盘导航', () => {
    it('向下箭头键高亮下一项', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

      // 第一项应该被高亮
      await waitFor(() => {
        const selectedItem = screen.getByText('claude-code-remote').closest('[role="option"]');
        expect(selectedItem?.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('向上箭头键高亮上一项', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      // 先向下移动两次
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      // 再向上移动一次
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      await waitFor(() => {
        const items = screen.getAllByRole('option');
        expect(items[0].getAttribute('aria-selected')).toBe('true');
        expect(items[1].getAttribute('aria-selected')).toBe('false');
      });
    });

    it('Enter 键选择当前高亮项', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('/Users/tom/projects/claude-code-remote');
      });
    });

    it('向上箭头在第一项时循环到最后一项', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      // 在第一项时按向上，应该跳到最后一项
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      const items = screen.getAllByRole('option');
      await waitFor(() => {
        expect(items[items.length - 1].getAttribute('aria-selected')).toBe('true');
      });
    });

    it('向下箭头在最后一项时循环到第一项', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索工作目录…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索工作目录…');
      // 移到最后一项
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' }); // 循环到最后一项
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' }); // 循环到第一项

      const items = screen.getAllByRole('option');
      await waitFor(() => {
        expect(items[0].getAttribute('aria-selected')).toBe('true');
      });
    });
  });

  describe('选择回调', () => {
    it('点击选项触发 onChange 并关闭面板', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('another-project')).toBeDefined();
      });

      fireEvent.click(screen.getByText('another-project'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('/Users/tom/projects/another-project');
        expect(screen.queryByPlaceholderText('搜索工作目录…')).toBeNull();
      });
    });
  });

  describe('智能路径显示', () => {
    it('显示目录名作为主文本', () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value="/Users/tom/projects/claude-code-remote"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('claude-code-remote')).toBeDefined();
    });

    it('下拉列表显示父目录路径作为次级文本', async () => {
      render(
        <WorkspaceSelector
          workspaces={mockWorkspaces}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // 显示父目录路径（.../projects 和 .../workspace）
        const projectsPaths = screen.getAllByText('.../projects');
        expect(projectsPaths.length).toBeGreaterThanOrEqual(1);
        // 第三个目录的父目录是 .../workspace
        expect(screen.getByText('.../workspace')).toBeDefined();
      });
    });
  });
});