import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CommandPicker } from '../../src/components/input/CommandPicker.js';
import * as apiClient from '../../src/services/api-client.js';

// Mock API client
vi.mock('../../src/services/api-client.js', () => ({
  getUserConfig: vi.fn(),
}));

describe('CommandPicker', () => {
  const mockOnShortcut = vi.fn();
  const mockOnCommandSelect = vi.fn();

  beforeEach(() => {
    mockOnShortcut.mockClear();
    mockOnCommandSelect.mockClear();
    // 默认返回 null 配置，使用默认值
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: null,
      configPath: '/test/config.json',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('当 visible=false 时不渲染', async () => {
    const { container } = render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        visible={false}
      />
    );
    await act(() => Promise.resolve());
    expect(container.firstChild).toBeNull();
  });

  it('当 visible=true 时渲染', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        visible={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('command-picker')).toBeDefined();
    });
  });

  it('渲染所有快捷键按钮', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Esc')).toBeDefined();
      expect(screen.getByText('Tab')).toBeDefined();
      expect(screen.getByText('S-Tab')).toBeDefined();
      expect(screen.getByText('↑')).toBeDefined();
      expect(screen.getByText('↓')).toBeDefined();
      expect(screen.getByText('←')).toBeDefined();
      expect(screen.getByText('→')).toBeDefined();
      expect(screen.getByText('^C')).toBeDefined();
    });
  });

  it('渲染所有命令按钮', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/help')).toBeDefined();
      expect(screen.getByText('/clear')).toBeDefined();
      expect(screen.getByText('/compact')).toBeDefined();
      expect(screen.getByText('/terminal-setup')).toBeDefined();
      expect(screen.getByText('/review')).toBeDefined();
      expect(screen.getByText('/init')).toBeDefined();
    });
  });

  it('点击快捷键按钮调用 onShortcut', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Esc')).toBeDefined();
    });

    // 点击 Esc
    fireEvent.click(screen.getByText('Esc'));
    expect(mockOnShortcut).toHaveBeenCalledWith('\x1b');

    // 点击 Tab
    fireEvent.click(screen.getByText('Tab'));
    expect(mockOnShortcut).toHaveBeenCalledWith('\t');

    // 点击 ^C (Ctrl+C)
    fireEvent.click(screen.getByText('^C'));
    expect(mockOnShortcut).toHaveBeenCalledWith('\x03');
  });

  it('点击命令按钮调用 onCommandSelect 并添加空格', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/help')).toBeDefined();
    });

    // 点击 /help
    fireEvent.click(screen.getByText('/help'));
    expect(mockOnCommandSelect).toHaveBeenCalledWith('/help ');

    // 点击 /clear
    fireEvent.click(screen.getByText('/clear'));
    expect(mockOnCommandSelect).toHaveBeenCalledWith('/clear ');

    // 点击 /compact
    fireEvent.click(screen.getByText('/compact'));
    expect(mockOnCommandSelect).toHaveBeenCalledWith('/compact ');
  });

  it('快捷键按钮阻止默认的 mousedown 行为', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Esc')).toBeDefined();
    });

    const escButton = screen.getByText('Esc');
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(mouseDownEvent, 'preventDefault');

    fireEvent(escButton, mouseDownEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('使用用户配置时只显示启用的项', async () => {
    // Mock 返回自定义配置
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: {
        shortcuts: [
          { label: 'Esc', data: '\x1b', enabled: true },
          { label: 'Tab', data: '\t', enabled: false },  // 禁用
        ],
        commands: [
          { label: '/help', command: '/help', enabled: true },
          { label: '/clear', command: '/clear', enabled: false },  // 禁用
        ],
      },
      configPath: '/test/config.json',
    });

    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
      />
    );

    await waitFor(() => {
      // Esc 启用，应该显示
      expect(screen.getByText('Esc')).toBeDefined();
      // Tab 禁用，不应该显示
      expect(screen.queryByText('Tab')).toBeNull();
      // /help 启用，应该显示
      expect(screen.getByText('/help')).toBeDefined();
      // /clear 禁用，不应该显示
      expect(screen.queryByText('/clear')).toBeNull();
    });
  });
});