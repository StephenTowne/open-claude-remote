import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SettingsFileSelector } from '../../src/components/common/SettingsFileSelector.js';
import type { SettingsFile } from '#shared';

describe('SettingsFileSelector', () => {
  const mockSettingsFiles: SettingsFile[] = [
    {
      filename: 'settings.json',
      displayName: 'Default',
      directory: '~/.claude',
      directoryPath: '/Users/tom/.claude',
    },
    {
      filename: 'settings.work.json',
      displayName: 'Work',
      directory: '~/.claude',
      directoryPath: '/Users/tom/.claude',
    },
    {
      filename: 'custom.json',
      displayName: 'Custom',
      directory: '~/.claude-remote/settings',
      directoryPath: '/Users/tom/.claude-remote/settings',
    },
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
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
          placeholder="选择 Settings 文件..."
        />
      );

      expect(screen.getByText('选择 Settings 文件...')).toBeDefined();
    });

    it('渲染触发器显示选中的 displayName', () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value="settings.work.json"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Work')).toBeDefined();
    });

    it('disabled 状态时触发器不可点击', () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
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
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // 下拉面板应该不存在
      expect(screen.queryByPlaceholderText('搜索 Settings 文件…')).toBeNull();
    });
  });

  describe('下拉面板交互', () => {
    it('点击触发器展开下拉面板', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });
    });

    it('下拉面板包含 "None" 选项和 settings 文件列表', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // None 选项
        expect(screen.getByText('None')).toBeDefined();
        // Settings 文件
        expect(screen.getByText('Default')).toBeDefined();
        expect(screen.getByText('Work')).toBeDefined();
        expect(screen.getByText('Custom')).toBeDefined();
      });
    });

    it('Escape 键关闭下拉面板', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('搜索 Settings 文件…')).toBeNull();
      });
    });
  });

  describe('搜索过滤', () => {
    it('输入关键词过滤 settings 文件列表', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.change(searchInput, { target: { value: 'work' } });

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeDefined();
        expect(screen.queryByText('Default')).toBeNull();
        expect(screen.queryByText('Custom')).toBeNull();
      });
    });

    it('支持按 filename 搜索', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.change(searchInput, { target: { value: 'custom.json' } });

      await waitFor(() => {
        expect(screen.getByText('Custom')).toBeDefined();
        expect(screen.queryByText('Default')).toBeNull();
      });
    });

    it('搜索无结果时显示空状态', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('没有匹配的 Settings 文件')).toBeDefined();
      });
    });
  });

  describe('键盘导航', () => {
    it('向下箭头键高亮下一项', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

      // 第一项 (None) 应该被高亮
      await waitFor(() => {
        const selectedItem = screen.getByText('None').closest('[role="option"]');
        expect(selectedItem?.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('向上箭头键高亮上一项', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          onChange={mockOnChange}
          value=""
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
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
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('settings.json');
      });
    });

    it('向上箭头在第一项时循环到最后一项', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索 Settings 文件…')).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText('搜索 Settings 文件…');
      // 在第一项时按向上，应该跳到最后一项
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });

      const items = screen.getAllByRole('option');
      await waitFor(() => {
        expect(items[items.length - 1].getAttribute('aria-selected')).toBe('true');
      });
    });
  });

  describe('选择回调', () => {
    it('点击选项触发 onChange 并关闭面板', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Custom')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Custom'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('custom.json');
        expect(screen.queryByPlaceholderText('搜索 Settings 文件…')).toBeNull();
      });
    });

    it('点击 "None" 选项触发 onChange 为空字符串', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value="settings.json"
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('None')).toBeDefined();
      });

      fireEvent.click(screen.getByText('None'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });
    });
  });

  describe('信息显示', () => {
    it('下拉列表显示 directory 作为次级文本', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value=""
          onChange={mockOnChange}
        />
      );

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // 检查 Custom 选项的目录路径
        expect(screen.getByText('~/.claude-remote/settings')).toBeDefined();
      });
    });

    it('选中文件后显示对应的 displayName', async () => {
      render(
        <SettingsFileSelector
          settingsFiles={mockSettingsFiles}
          value="custom.json"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Custom')).toBeDefined();
    });
  });
});
