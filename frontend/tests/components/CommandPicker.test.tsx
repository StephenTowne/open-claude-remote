import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { CommandPicker } from '../../src/components/input/CommandPicker.js';
import * as apiClient from '../../src/services/api-client.js';

// Mock API client
vi.mock('../../src/services/api-client.js', () => ({
  getUserConfig: vi.fn(),
}));

describe('CommandPicker', () => {
  const mockOnShortcut = vi.fn();
  const mockOnCommandSelect = vi.fn();
  const mockOnCommandSend = vi.fn();

  beforeEach(() => {
    mockOnShortcut.mockClear();
    mockOnCommandSelect.mockClear();
    mockOnCommandSend.mockClear();
    // 默认返回 null 配置，使用默认值
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: null,
      configPath: '/test/config.json',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('当 visible=false 时不渲染', async () => {
    const { container } = render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
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
        onCommandSend={mockOnCommandSend}
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
        onCommandSend={mockOnCommandSend}
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
    });
  });

  it('渲染所有命令按钮', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
      />
    );

    await waitFor(() => {
      // 使用新的默认命令列表
      expect(screen.getByText('/clear')).toBeDefined();
      expect(screen.getByText('/compact')).toBeDefined();
      expect(screen.getByText('/resume')).toBeDefined();
      expect(screen.getByText('/stats')).toBeDefined();
      expect(screen.getByText('/exit')).toBeDefined();
      expect(screen.getByText('/rename')).toBeDefined();
    });
  });

  it('点击快捷键按钮调用 onShortcut', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
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

    // 点击 S-Tab (Shift+Tab)
    fireEvent.click(screen.getByText('S-Tab'));
    expect(mockOnShortcut).toHaveBeenCalledWith('\x1b[Z');
  });

  it('点击命令按钮默认调用 onCommandSend（autoSend=true）', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/clear')).toBeDefined();
    });

    // 点击 /clear - 默认 autoSend=true，应该调用 onCommandSend
    fireEvent.click(screen.getByText('/clear'));
    expect(mockOnCommandSend).toHaveBeenCalledWith('/clear');

    // 点击 /compact
    fireEvent.click(screen.getByText('/compact'));
    expect(mockOnCommandSend).toHaveBeenCalledWith('/compact');
  });

  it('快捷键按钮阻止默认的 mousedown 行为', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
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

  it('点击按钮时调用 blur 移除焦点', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Esc')).toBeDefined();
    });

    // 模拟一个活跃的焦点元素
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    // 点击 Esc 按钮
    fireEvent.click(screen.getByText('Esc'));

    // 立即 blur 应该已被调用
    expect(document.activeElement).not.toBe(input);

    // 清理
    document.body.removeChild(input);
  });

  it('touchstart 时立即调用 blur', async () => {
    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Esc')).toBeDefined();
    });

    // 模拟一个活跃的焦点元素
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    // 触发 touchstart
    fireEvent.touchStart(screen.getByText('Esc'));

    // touchstart 后 blur 应该已被调用
    expect(document.activeElement).not.toBe(input);

    // 清理
    document.body.removeChild(input);
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
        onCommandSend={mockOnCommandSend}
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

  it('autoSend=false 时点击命令调用 onCommandSelect 并添加空格', async () => {
    // Mock 返回自定义配置，包含 autoSend=false
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: {
        shortcuts: [],
        commands: [
          { label: '/help', command: '/help', enabled: true, autoSend: false },
          { label: '/clear', command: '/clear', enabled: true, autoSend: true },
        ],
      },
      configPath: '/test/config.json',
    });

    render(
      <CommandPicker
        onShortcut={mockOnShortcut}
        onCommandSelect={mockOnCommandSelect}
        onCommandSend={mockOnCommandSend}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/help')).toBeDefined();
    });

    // /help 的 autoSend=false，应该调用 onCommandSelect
    fireEvent.click(screen.getByText('/help'));
    expect(mockOnCommandSelect).toHaveBeenCalledWith('/help ');
    expect(mockOnCommandSend).not.toHaveBeenCalled();

    // /clear 的 autoSend=true，应该调用 onCommandSend
    fireEvent.click(screen.getByText('/clear'));
    expect(mockOnCommandSend).toHaveBeenCalledWith('/clear');
  });
});