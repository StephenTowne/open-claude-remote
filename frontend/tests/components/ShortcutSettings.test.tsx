import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutSettings } from '../../src/components/settings/ShortcutSettings.js';
import type { ConfigurableShortcut } from '../../src/config/commands.js';
import type { WithId } from '../../src/components/settings/SettingsModal.js';

// Mock the useIsMobile hook
vi.mock('../../src/hooks/useIsMobile.js', () => ({
  useIsMobile: vi.fn(),
}));

import { useIsMobile } from '../../src/hooks/useIsMobile.js';

describe('ShortcutSettings', () => {
  const mockOnChange = vi.fn();
  const mockedUseIsMobile = vi.mocked(useIsMobile);

  const createShortcuts = (): WithId<ConfigurableShortcut>[] => [
    { _id: 'sc1', label: 'Esc', data: '\x1b', enabled: true },
    { _id: 'sc2', label: 'Enter', data: '\r', enabled: false },
    { _id: 'sc3', label: 'Ctrl+C', data: '\x03', enabled: true },
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
    mockedUseIsMobile.mockReturnValue(false); // Default to PC
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
    it('enabled -> disabled 后顺序不变（视觉顺序）', () => {
      const shortcuts = createShortcuts();
      const { rerender } = render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const beforeInputs = screen.getAllByPlaceholderText('Press key to capture').map((el) => (el as HTMLInputElement).value);
      expect(beforeInputs).toEqual(['Esc', 'Enter', 'Ctrl+C']);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts.map((s) => s._id)).toEqual(['sc1', 'sc2', 'sc3']);
      expect(newShortcuts[0].enabled).toBe(false);

      rerender(<ShortcutSettings shortcuts={newShortcuts} onChange={mockOnChange} />);
      const afterInputs = screen.getAllByPlaceholderText('Press key to capture').map((el) => (el as HTMLInputElement).value);
      expect(afterInputs).toEqual(['Esc', 'Enter', 'Ctrl+C']);
    });

    it('disabled -> enabled 后顺序不变（视觉顺序）', () => {
      const shortcuts = createShortcuts();
      const { rerender } = render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[1]); // Enter: disabled -> enabled

      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts.map((s) => s._id)).toEqual(['sc1', 'sc2', 'sc3']);
      expect(newShortcuts[1].enabled).toBe(true);

      rerender(<ShortcutSettings shortcuts={newShortcuts} onChange={mockOnChange} />);
      const labels = screen.getAllByPlaceholderText('Press key to capture').map((el) => (el as HTMLInputElement).value);
      expect(labels).toEqual(['Esc', 'Enter', 'Ctrl+C']);
    });

    it('排序后再 toggle 不应再次重排', () => {
      let shortcuts = createShortcuts();
      const { rerender } = render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });
      fireEvent.click(moveToFirstButtons[2]); // Ctrl+C 移到首位
      shortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(shortcuts.map((s) => s._id)).toEqual(['sc3', 'sc1', 'sc2']);

      mockOnChange.mockClear();
      rerender(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[0]); // toggle 当前首项

      const toggledShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(toggledShortcuts.map((s) => s._id)).toEqual(['sc3', 'sc1', 'sc2']);

      rerender(<ShortcutSettings shortcuts={toggledShortcuts} onChange={mockOnChange} />);
      const labels = screen.getAllByPlaceholderText('Press key to capture').map((el) => (el as HTMLInputElement).value);
      expect(labels).toEqual(['Ctrl+C', 'Esc', 'Enter']);
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

  describe('移动端行为', () => {
    it('移动端显示警告提示', () => {
      mockedUseIsMobile.mockReturnValue(true);
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      // 应该显示移动端警告
      expect(screen.getByText(/移动端无法新增快捷键/)).toBeDefined();
    });

    it('移动端禁用 Add 按钮', () => {
      mockedUseIsMobile.mockReturnValue(true);
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton.hasAttribute('disabled')).toBe(true);

      // 点击不应触发 onChange
      fireEvent.click(addButton);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('移动端允许编辑已有快捷键', () => {
      mockedUseIsMobile.mockReturnValue(true);
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      // 移动端已有快捷键应该可以编辑
      const input = screen.getByDisplayValue('Esc');
      expect(input.hasAttribute('disabled')).toBe(false);

      // 点击应开始捕获（虽然提示不显示，但功能正常）
      fireEvent.click(input);

      // 模拟按键应该能修改快捷键
      fireEvent.keyDown(input, { key: 'x', ctrlKey: true });
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts[0].label).toBe('Ctrl+X');
    });

    it('PC端不显示移动端警告', () => {
      mockedUseIsMobile.mockReturnValue(false);
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      // 不应显示移动端警告
      expect(screen.queryByText(/移动端无法新增快捷键/)).toBeNull();
    });

    it('PC端可以新增快捷键', () => {
      mockedUseIsMobile.mockReturnValue(false);
      const shortcuts = createShortcuts();
      render(<ShortcutSettings shortcuts={shortcuts} onChange={mockOnChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton.hasAttribute('disabled')).toBe(false);

      // 点击应触发 onChange 新增快捷键
      fireEvent.click(addButton);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newShortcuts = mockOnChange.mock.calls[0][0] as WithId<ConfigurableShortcut>[];
      expect(newShortcuts).toHaveLength(4);
    });
  });
});
