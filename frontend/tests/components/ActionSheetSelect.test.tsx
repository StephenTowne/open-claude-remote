import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ActionSheetSelect, type ActionSheetOption } from '../../src/components/common/ActionSheetSelect.js';

describe('ActionSheetSelect', () => {
  interface TestItem {
    id: string;
    name: string;
    path: string;
  }

  const mockOptions: ActionSheetOption<TestItem>[] = [
    { value: { id: '1', name: 'Project A', path: '/projects/a' }, label: 'Project A', description: '/projects/a' },
    { value: { id: '2', name: 'Project B', path: '/projects/b' }, label: 'Project B', description: '/projects/b' },
    { value: { id: '3', name: 'Test App', path: '/home/test' }, label: 'Test App', description: '/home/test' },
  ];
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('基础渲染', () => {
    it('渲染触发器显示 placeholder', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          placeholder="Select an option..."
        />
      );

      expect(screen.getByText('Select an option...')).toBeDefined();
    });

    it('移动端打开面板不自动聚焦搜索框（显示点击搜索占位符）', async () => {
      // 模拟触屏设备
      Object.defineProperty(window, 'ontouchstart', {
        value: {},
        writable: true,
        configurable: true,
      });

      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          searchPlaceholder="Search items..."
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // 应该显示搜索占位符文本，而不是真正的输入框
        expect(screen.getByText('Search items...')).toBeDefined();
      });

      // 不应该直接显示输入框（避免键盘弹出）
      expect(screen.queryByPlaceholderText('Search items...')).toBeNull();

      // 清理
      delete (window as { ontouchstart?: unknown }).ontouchstart;
    });

    it('桌面端打开面板自动聚焦搜索框', async () => {
      // 确保不是触屏设备
      delete (window as { ontouchstart?: unknown }).ontouchstart;

      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          searchPlaceholder="Search items..."
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // 桌面端应该直接显示输入框（带有聚焦）
        expect(screen.getByPlaceholderText('Search items...')).toBeDefined();
      });
    });

    it('点击搜索占位符后切换到输入框', async () => {
      // 模拟触屏设备
      Object.defineProperty(window, 'ontouchstart', {
        value: {},
        writable: true,
        configurable: true,
      });

      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          searchPlaceholder="Tap to search..."
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Tap to search...')).toBeDefined();
      });

      // 点击占位符区域
      fireEvent.click(screen.getByText('Tap to search...'));

      await waitFor(() => {
        // 应该切换为输入框
        expect(screen.getByPlaceholderText('Tap to search...')).toBeDefined();
      });

      // 清理
      delete (window as { ontouchstart?: unknown }).ontouchstart;
    });

    it('渲染触发器显示选中项的 label', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={mockOptions[0].value}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Project A')).toBeDefined();
    });

    it('空选项列表时显示空状态', () => {
      render(
        <ActionSheetSelect
          options={[]}
          value={null}
          onChange={mockOnChange}
          emptyMessage="No items available"
        />
      );

      expect(screen.getByText('No items available')).toBeDefined();
    });

    it('disabled 状态时触发器不可点击', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('button');
      expect(trigger.hasAttribute('disabled')).toBe(true);
    });

    it('disabled 状态时点击触发器不应打开面板', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // 面板应该不存在
      expect(screen.queryByPlaceholderText('Search…')).toBeNull();
    });
  });

  describe('面板交互', () => {
    it('点击触发器展开面板', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          searchPlaceholder="Search items..."
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search items...')).toBeDefined();
      });
    });

    it('点击遮罩关闭面板', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      // 点击遮罩（overlay）- 找到固定定位的父容器
      const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1100"]') as HTMLElement;
      expect(overlay).toBeDefined();
      fireEvent.click(overlay);

      // 等待动画完成（300ms）
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search…')).toBeNull();
      }, { timeout: 500 });
    });

    it('Escape 键关闭面板', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      // 等待动画完成（300ms）
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search…')).toBeNull();
      }, { timeout: 500 });
    });
  });

  describe('搜索过滤', () => {
    it('输入关键词过滤选项列表', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.change(searchInput, { target: { value: 'project' } });

      await waitFor(() => {
        expect(screen.getByText('Project A')).toBeDefined();
        expect(screen.getByText('Project B')).toBeDefined();
        expect(screen.queryByText('Test App')).toBeNull();
      });
    });

    it('搜索无结果时显示空状态', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          emptyMessage="No matches"
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No matches')).toBeDefined();
      });
    });

    it('支持搜索 description', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.change(searchInput, { target: { value: '/home' } });

      await waitFor(() => {
        expect(screen.getByText('Test App')).toBeDefined();
        expect(screen.queryByText('Project A')).toBeNull();
      });
    });
  });

  describe('键盘导航', () => {
    it('向下箭头键高亮下一项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

      await waitFor(() => {
        const selectedItem = screen.getByText('Project A').closest('[role="option"]');
        expect(selectedItem?.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('向上箭头键高亮上一项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      // 先向下移动三次：-1 -> 0 -> 1 -> 2
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      // 再向上移动一次：2 -> 1
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      await waitFor(() => {
        const items = screen.getAllByRole('option');
        // items[1] 应该被高亮
        expect(items[1].getAttribute('aria-selected')).toBe('true');
        expect(items[2].getAttribute('aria-selected')).toBe('false');
      });
    });

    it('Enter 键选择当前高亮项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(mockOptions[0].value);
      });
    });

    it('向上箭头在第一项时循环到最后一项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
      // 在第一项时按向上，应该跳到最后一项
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      const items = screen.getAllByRole('option');
      await waitFor(() => {
        expect(items[items.length - 1].getAttribute('aria-selected')).toBe('true');
      });
    });

    it('向下箭头在最后一项时循环到第一项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('Search…');
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
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Project B')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Project B'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(mockOptions[1].value);
        expect(screen.queryByPlaceholderText('Search…')).toBeNull();
      });
    });
  });

  describe('自定义显示', () => {
    it('使用 getDisplayLabel 自定义触发器显示', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={mockOptions[0].value}
          onChange={mockOnChange}
          getDisplayLabel={(val) => val ? `Custom: ${val.name}` : 'None'}
        />
      );

      expect(screen.getByText('Custom: Project A')).toBeDefined();
    });

    it('使用 triggerIcon 显示自定义图标', () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
          triggerIcon={<span data-testid="custom-icon">📁</span>}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeDefined();
    });
  });

  describe('选项显示', () => {
    it('显示选项的 label 和 description', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={null}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Project A')).toBeDefined();
        expect(screen.getByText('/projects/a')).toBeDefined();
      });
    });

    it('高亮选中项', async () => {
      render(
        <ActionSheetSelect
          options={mockOptions}
          value={mockOptions[1].value}
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        const items = screen.getAllByRole('option');
        // 第二项应该有选中样式
        expect(items[1].style.background).toContain('rgba(88, 166, 255, 0.08)');
      });
    });
  });
});