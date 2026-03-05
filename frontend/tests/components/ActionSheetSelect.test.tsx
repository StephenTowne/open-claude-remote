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

    it('点击触发器后显示选项列表', async () => {
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
        expect(screen.getByText('Project B')).toBeDefined();
        expect(screen.getByText('Test App')).toBeDefined();
      });
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

      // 面板应该不存在（没有选项列表）
      expect(screen.queryByText('Project A')).toBeNull();
    });
  });

  describe('面板交互', () => {
    it('点击触发器展开面板', async () => {
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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      // 点击遮罩（overlay）- 找到固定定位的父容器
      const overlay = document.querySelector('[style*="position: fixed"][style*="z-index: 1100"]') as HTMLElement;
      expect(overlay).toBeDefined();
      fireEvent.click(overlay);

      // 等待动画完成（300ms）
      await waitFor(() => {
        expect(screen.queryByText('Project A')).toBeNull();
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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      // Escape 键需要绑定到能接收键盘事件的元素上
      const listbox = screen.getByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'Escape' });

      // 等待动画完成（300ms）
      await waitFor(() => {
        expect(screen.queryByText('Project A')).toBeNull();
      }, { timeout: 500 });
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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      const listbox = screen.getByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });

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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      const listbox = screen.getByRole('listbox');
      // 先向下移动三次：-1 -> 0 -> 1 -> 2
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      // 再向上移动一次：2 -> 1
      fireEvent.keyDown(listbox, { key: 'ArrowUp' });

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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      const listbox = screen.getByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      fireEvent.keyDown(listbox, { key: 'Enter' });

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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      const listbox = screen.getByRole('listbox');
      // 在第一项时按向上，应该跳到最后一项
      fireEvent.keyDown(listbox, { key: 'ArrowUp' });

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
        expect(screen.getByText('Project A')).toBeDefined();
      });

      const listbox = screen.getByRole('listbox');
      // 移到最后一项
      fireEvent.keyDown(listbox, { key: 'ArrowUp' }); // 循环到最后一项
      fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // 循环到第一项

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
        expect(screen.queryByText('Project A')).toBeNull();
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
    it('显示选项的 label 和 description（单行格式）', async () => {
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
      });

      // description 应该作为 label 的一部分显示在括号中
      const optionLabel = screen.getByText('Project A').closest('span');
      expect(optionLabel?.textContent).toContain('/projects/a');
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

  describe('拖拽手柄交互', () => {
    it('拖拽手柄向下超过阈值关闭面板', async () => {
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
      });

      // 找到拖拽手柄
      const handle = document.querySelector('[data-testid="drag-handle"]') as HTMLElement;
      expect(handle).toBeDefined();

      // 模拟触摸拖拽：开始 -> 移动（超过100px）-> 结束
      fireEvent.touchStart(handle, { touches: [{ clientY: 300, identifier: 0 }] });
      fireEvent.touchMove(handle, { touches: [{ clientY: 410, identifier: 0 }] });
      fireEvent.touchEnd(handle);

      // 等待面板关闭
      await waitFor(() => {
        expect(screen.queryByText('Project A')).toBeNull();
      }, { timeout: 500 });
    });

    it('拖拽距离不足时面板回弹不关闭', async () => {
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
      });

      const handle = document.querySelector('[data-testid="drag-handle"]') as HTMLElement;
      expect(handle).toBeDefined();

      // 模拟小距离拖拽（不足100px，不应关闭）
      fireEvent.touchStart(handle, { touches: [{ clientY: 300, identifier: 0 }] });
      fireEvent.touchMove(handle, { touches: [{ clientY: 350, identifier: 0 }] });
      fireEvent.touchEnd(handle);

      // 面板仍然打开
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.queryByText('Project A')).toBeDefined();
    });

    it('支持鼠标拖拽关闭', async () => {
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
      });

      const handle = document.querySelector('[data-testid="drag-handle"]') as HTMLElement;
      expect(handle).toBeDefined();

      // 模拟鼠标拖拽
      fireEvent.mouseDown(handle, { clientY: 300 });
      fireEvent.mouseMove(handle, { clientY: 420 });
      fireEvent.mouseUp(handle);

      // 等待面板关闭
      await waitFor(() => {
        expect(screen.queryByText('Project A')).toBeNull();
      }, { timeout: 500 });
    });

    it('拖拽过程中应用transform位移', async () => {
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
      });

      const handle = document.querySelector('[data-testid="drag-handle"]') as HTMLElement;
      expect(handle).toBeDefined();

      // 找到面板容器
      const sheet = document.querySelector('[data-testid="action-sheet-panel"]') as HTMLElement;
      expect(sheet).toBeDefined();

      // 开始拖拽
      fireEvent.touchStart(handle, { touches: [{ clientY: 300, identifier: 0 }] });

      // 移动50px
      fireEvent.touchMove(handle, { touches: [{ clientY: 350, identifier: 0 }] });

      // 检查是否应用了transform
      await waitFor(() => {
        expect(sheet.style.transform).toContain('translateY(50px)');
      });
    });
  });
});
