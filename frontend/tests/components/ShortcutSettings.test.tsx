import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutSettings } from '../../src/components/settings/ShortcutSettings.js';
import type { ConfigurableShortcut } from '../../src/config/commands.js';
import type { WithId } from '../../src/components/settings/SettingsModal.js';

describe('ShortcutSettings', () => {
  const mockOnChange = vi.fn();

  const createShortcuts = (): WithId<ConfigurableShortcut>[] => [
    { _id: 'sc1', label: 'Esc', data: '\x1b', enabled: true },
    { _id: 'sc2', label: 'Enter', data: '\r', enabled: false },
    { _id: 'sc3', label: 'Ctrl+C', data: '\x03', enabled: true },
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('基础渲染', () => {
    it('渲染快捷键列表', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      expect(screen.getByText('Shortcuts')).toBeDefined();
      expect(screen.getByDisplayValue('Esc')).toBeDefined();
      expect(screen.getByDisplayValue('Enter')).toBeDefined();
      expect(screen.getByDisplayValue('Ctrl+C')).toBeDefined();
    });

    it('空列表显示提示信息', () => {
      render(<ShortcutSettings shortcuts={[]} onChange={mockOnChange} />);

      expect(screen.getByText('No shortcuts yet. Click the button above to add one.')).toBeDefined();
    });

    it('显示添加按钮', () => {
      render(<ShortcutSettings shortcuts={[]} onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /add/i })).toBeDefined();
    });
  });

  describe('启用/禁用切换', () => {
    it('点击 toggle 切换启用状态，但不改变位置', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      expect(toggles[0].getAttribute('aria-checked')).toBe('true');

      // 点击第一个快捷键的 toggle（Esc）
      fireEvent.click(toggles[0]);

      // onChange 被调用，且顺序保持不变
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0]._id).toBe('sc1');
      expect(newShortcuts[0].enabled).toBe(false);
      expect(newShortcuts[1]._id).toBe('sc2');
      expect(newShortcuts[2]._id).toBe('sc3');
    });

    it('禁用后再启用，位置不变', () => {
      let shortcuts = createShortcuts();
      const { rerender } = render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');

      // 禁用 Esc
      fireEvent.click(toggles[0]);
      shortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(shortcuts[0].enabled).toBe(false);

      // 使用 rerender 更新 props
      mockOnChange.mockClear();
      rerender(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      // 再次启用 Esc
      const newToggles = screen.getAllByRole('switch');
      fireEvent.click(newToggles[0]);

      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0]._id).toBe('sc1');
      expect(newShortcuts[0].enabled).toBe(true);
      expect(newShortcuts[1]._id).toBe('sc2');
    });
  });

  describe('添加新快捷键', () => {
    it('点击 Add 按钮在末尾添加新快捷键', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts).toHaveLength(4);
      // 新快捷键在末尾
      expect(newShortcuts[3].label).toBe('New');
      expect(newShortcuts[3].data).toBe('');
      expect(newShortcuts[3].enabled).toBe(true);
    });

    it('添加新快捷键后自动开始捕获', () => {
      let shortcuts = createShortcuts();
      const { rerender } = render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      // onChange 被调用后，组件应该使用新的 shortcuts 渲染
      shortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      mockOnChange.mockClear();

      rerender(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      // 最后一项应该是捕获状态（高亮边框）
      const inputs = screen.getAllByPlaceholderText('Press key to capture');
      expect(inputs).toHaveLength(4);
    });
  });

  describe('删除快捷键', () => {
    it('点击 Delete 按钮删除对应快捷键', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons).toHaveLength(3);

      // 删除第一个快捷键
      fireEvent.click(deleteButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts).toHaveLength(2);
      expect(newShortcuts[0]._id).toBe('sc2');
      expect(newShortcuts[1]._id).toBe('sc3');
    });
  });

  describe('移到首尾', () => {
    it('点击 Move to first 按钮将快捷键移到最前', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });
      expect(moveToFirstButtons).toHaveLength(3);

      // 将第三个快捷键移到最前
      fireEvent.click(moveToFirstButtons[2]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0]._id).toBe('sc3');
      expect(newShortcuts[1]._id).toBe('sc1');
      expect(newShortcuts[2]._id).toBe('sc2');
    });

    it('点击 Move to last 按钮将快捷键移到最后', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const moveToLastButtons = screen.getAllByRole('button', { name: 'Move to last' });
      expect(moveToLastButtons).toHaveLength(3);

      // 将第一个快捷键移到最后
      fireEvent.click(moveToLastButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0]._id).toBe('sc2');
      expect(newShortcuts[1]._id).toBe('sc3');
      expect(newShortcuts[2]._id).toBe('sc1');
    });

    it('第一项点击 Move to first 无变化', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });

      // 第一个快捷键已经在最前
      fireEvent.click(moveToFirstButtons[0]);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('最后一项点击 Move to last 无变化', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const moveToLastButtons = screen.getAllByRole('button', { name: 'Move to last' });

      // 最后一个快捷键已经在最后
      fireEvent.click(moveToLastButtons[2]);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('按键捕获', () => {
    it('点击输入框开始捕获', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('Esc');
      fireEvent.click(input);

      // 应该显示捕获提示
      expect(screen.getByText('Press a key to capture…')).toBeDefined();
    });

    it('捕获 Ctrl+字母键', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('Esc');
      fireEvent.click(input);

      // 模拟按下 Ctrl+X
      fireEvent.keyDown(input, { key: 'x', ctrlKey: true });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0].label).toBe('Ctrl+X');
      expect(newShortcuts[0].data).toBe('\x18'); // ASCII 24
    });

    it('捕获方向键', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('Esc');
      fireEvent.click(input);

      // 模拟按下 ArrowUp
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0].label).toBe('↑');
      expect(newShortcuts[0].data).toBe('\x1b[A'); // ESC [ A
    });

    it('捕获普通字母键', () => {
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('Esc');
      fireEvent.click(input);

      // 模拟按下字母 'a'
      fireEvent.keyDown(input, { key: 'a' });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0].label).toBe('A');
      expect(newShortcuts[0].data).toBe('a');
    });
  });
});
