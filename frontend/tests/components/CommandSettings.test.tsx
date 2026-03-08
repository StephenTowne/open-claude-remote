import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CommandSettings } from '../../src/components/settings/CommandSettings.js';
import type { ConfigurableCommand } from '../../src/config/commands.js';
import type { WithId } from '../../src/components/settings/SettingsModal.js';

// Mock useAppStore
vi.mock('../../src/stores/app-store.js', () => ({
  useAppStore: (selector: (state: { showToast: (msg: string) => void }) => unknown) =>
    selector({ showToast: vi.fn() }),
}));

describe('CommandSettings', () => {
  const mockOnChange = vi.fn();

  const createCommands = (): WithId<ConfigurableCommand>[] => [
    { _id: 'cmd1', label: '/help', command: '/help', enabled: true, autoSend: true },
    { _id: 'cmd2', label: '/clear', command: '/clear', enabled: false, autoSend: true },
    { _id: 'cmd3', label: '/status', command: '/status', enabled: true, autoSend: false },
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('基础渲染', () => {
    it('渲染命令列表', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      expect(screen.getByText('Commands')).toBeDefined();
      expect(screen.getByText('/help')).toBeDefined();
      expect(screen.getByText('/clear')).toBeDefined();
      expect(screen.getByText('/status')).toBeDefined();
    });

    it('空列表显示提示信息', () => {
      render(<CommandSettings commands={[]} onChange={mockOnChange} />);

      expect(screen.getByText('No commands yet. Click the button above to add one.')).toBeDefined();
    });

    it('显示添加按钮', () => {
      render(<CommandSettings commands={[]} onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /add/i })).toBeDefined();
    });
  });

  describe('启用/禁用切换', () => {
    it('enabled -> disabled 后顺序不变（视觉顺序）', () => {
      const commands = createCommands();
      const { rerender } = render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const beforeLabels = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('Edit command '))
        .map((b) => b.textContent);
      expect(beforeLabels).toEqual(['/help', '/clear', '/status']);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands.map((c) => c._id)).toEqual(['cmd1', 'cmd2', 'cmd3']);
      expect(newCommands[0].enabled).toBe(false);

      rerender(<CommandSettings commands={newCommands} onChange={mockOnChange} />);
      const afterLabels = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('Edit command '))
        .map((b) => b.textContent);
      expect(afterLabels).toEqual(['/help', '/clear', '/status']);
    });

    it('disabled -> enabled 后顺序不变（视觉顺序）', () => {
      const commands = createCommands();
      const { rerender } = render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[1]); // /clear: disabled -> enabled

      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands.map((c) => c._id)).toEqual(['cmd1', 'cmd2', 'cmd3']);
      expect(newCommands[1].enabled).toBe(true);

      rerender(<CommandSettings commands={newCommands} onChange={mockOnChange} />);
      const labels = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('Edit command '))
        .map((b) => b.textContent);
      expect(labels).toEqual(['/help', '/clear', '/status']);
    });

    it('排序后再 toggle 不应再次重排', () => {
      let commands = createCommands();
      const { rerender } = render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });
      fireEvent.click(moveToFirstButtons[2]); // /status 移到首位
      commands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(commands.map((c) => c._id)).toEqual(['cmd3', 'cmd1', 'cmd2']);

      mockOnChange.mockClear();
      rerender(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      fireEvent.click(toggles[0]); // toggle 当前首项 /status

      const toggledCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(toggledCommands.map((c) => c._id)).toEqual(['cmd3', 'cmd1', 'cmd2']);

      rerender(<CommandSettings commands={toggledCommands} onChange={mockOnChange} />);
      const labels = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.startsWith('Edit command '))
        .map((b) => b.textContent);
      expect(labels).toEqual(['/status', '/help', '/clear']);
    });
  });

  describe('添加新命令', () => {
    it('点击 Add 按钮在末尾添加新命令', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands).toHaveLength(4);
      // 新命令在末尾
      expect(newCommands[3].label).toBe('/new');
      expect(newCommands[3].command).toBe('/new');
      expect(newCommands[3].enabled).toBe(true);
    });
  });

  describe('删除命令', () => {
    it('点击 Delete 按钮删除对应命令', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons).toHaveLength(3);

      // 删除第一个命令
      fireEvent.click(deleteButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands).toHaveLength(2);
      expect(newCommands[0]._id).toBe('cmd2');
      expect(newCommands[1]._id).toBe('cmd3');
    });
  });

  describe('移到首尾', () => {
    it('点击 Move to first 按钮将命令移到最前', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });
      expect(moveToFirstButtons).toHaveLength(3);

      // 将第三个命令移到最前
      fireEvent.click(moveToFirstButtons[2]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0]._id).toBe('cmd3');
      expect(newCommands[1]._id).toBe('cmd1');
      expect(newCommands[2]._id).toBe('cmd2');
    });

    it('点击 Move to last 按钮将命令移到最后', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const moveToLastButtons = screen.getAllByRole('button', { name: 'Move to last' });
      expect(moveToLastButtons).toHaveLength(3);

      // 将第一个命令移到最后
      fireEvent.click(moveToLastButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0]._id).toBe('cmd2');
      expect(newCommands[1]._id).toBe('cmd3');
      expect(newCommands[2]._id).toBe('cmd1');
    });

    it('第一项点击 Move to first 无变化', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const moveToFirstButtons = screen.getAllByRole('button', { name: 'Move to first' });

      // 第一个命令已经在最前
      fireEvent.click(moveToFirstButtons[0]);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('最后一项点击 Move to last 无变化', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const moveToLastButtons = screen.getAllByRole('button', { name: 'Move to last' });

      // 最后一个命令已经在最后
      fireEvent.click(moveToLastButtons[2]);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('编辑命令', () => {
    it('点击命令标签开始编辑', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const editButton = screen.getByRole('button', { name: 'Edit command /help' });
      fireEvent.click(editButton);

      // 应该显示 textarea
      expect(screen.getByDisplayValue('/help')).toBeDefined();
    });

    it('按 Enter 保存编辑', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const editButton = screen.getByRole('button', { name: 'Edit command /help' });
      fireEvent.click(editButton);

      const textarea = screen.getByDisplayValue('/help');
      fireEvent.change(textarea, { target: { value: '/newcommand' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0].command).toBe('/newcommand');
      expect(newCommands[0].label).toBe('/newcommand');
    });

    it('按 Escape 取消编辑', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const editButton = screen.getByRole('button', { name: 'Edit command /help' });
      fireEvent.click(editButton);

      const textarea = screen.getByDisplayValue('/help');
      fireEvent.change(textarea, { target: { value: '/newcommand' } });
      fireEvent.keyDown(textarea, { key: 'Escape' });

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('操作按钮提示与交互', () => {
    it('所有行内操作按钮都具备 aria-label 与 title 提示', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const assertButtonsHaveLabelAndTitle = (name: string, expectedCount: number) => {
        const buttons = screen.getAllByRole('button', { name });
        expect(buttons).toHaveLength(expectedCount);
        buttons.forEach((button) => {
          expect(button.getAttribute('aria-label')).toBe(name);
          expect(button.getAttribute('title')).toBe(name);
        });
      };

      assertButtonsHaveLabelAndTitle('Auto-send toggle', 3);
      assertButtonsHaveLabelAndTitle('Move to first', 3);
      assertButtonsHaveLabelAndTitle('Move to last', 3);
      assertButtonsHaveLabelAndTitle('Delete', 3);
    });

    it('点击 auto-send 按钮切换状态', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const autoSendButtons = screen.getAllByRole('button', { name: 'Auto-send toggle' });
      expect(autoSendButtons).toHaveLength(3);

      // 第一个命令 autoSend 是 true
      fireEvent.click(autoSendButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0].autoSend).toBe(false);
    });
  });
});
