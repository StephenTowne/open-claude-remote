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
    it('点击 toggle 切换启用状态，但不改变位置', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');
      expect(toggles[0].getAttribute('aria-checked')).toBe('true');

      // 点击第一个命令的 toggle（/help）
      fireEvent.click(toggles[0]);

      // onChange 被调用，且顺序保持不变
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0]._id).toBe('cmd1');
      expect(newCommands[0].enabled).toBe(false);
      expect(newCommands[1]._id).toBe('cmd2');
      expect(newCommands[2]._id).toBe('cmd3');
    });

    it('禁用后再启用，位置不变', () => {
      let commands = createCommands();
      const { rerender } = render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const toggles = screen.getAllByRole('switch');

      // 禁用 /help
      fireEvent.click(toggles[0]);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      commands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(commands[0].enabled).toBe(false);

      // 使用 rerender 更新 props
      mockOnChange.mockClear();
      rerender(<CommandSettings commands={commands} onChange={mockOnChange} />);

      // 再次启用 /help
      const newToggles = screen.getAllByRole('switch');
      fireEvent.click(newToggles[0]);

      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0]._id).toBe('cmd1');
      expect(newCommands[0].enabled).toBe(true);
      expect(newCommands[1]._id).toBe('cmd2');
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

  describe('auto-send 切换', () => {
    it('点击 auto-send 按钮切换状态', () => {
      const commands = createCommands();
      render(<CommandSettings commands={commands} onChange={mockOnChange} />);

      const autoSendButtons = screen.getAllByRole('button')
        .filter(b => b.getAttribute('aria-label')?.includes('Auto-send'));
      expect(autoSendButtons).toHaveLength(3);

      // 第一个命令 autoSend 是 true
      fireEvent.click(autoSendButtons[0]);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newCommands = mockOnChange.mock.calls[0][0] as WithId<ConfigurableCommand>[];
      expect(newCommands[0].autoSend).toBe(false);
    });
  });
});
