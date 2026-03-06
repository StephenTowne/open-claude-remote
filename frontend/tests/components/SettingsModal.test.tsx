import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SettingsModal } from '../../src/components/settings/SettingsModal.js';
import * as apiClient from '../../src/services/api-client.js';

vi.mock('../../src/services/api-client.js', () => ({
  getUserConfig: vi.fn(),
  updateUserConfig: vi.fn(),
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: {
        shortcuts: [
          { label: 'Esc', data: '\x1b', enabled: true },
        ],
        commands: [
          { label: '/help', command: '/help', enabled: true },
        ],
      },
      configPath: '/test/config.json',
    });
    vi.mocked(apiClient.updateUserConfig).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('isOpen=false 时不渲染', () => {
    const { container } = render(
      <SettingsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true 时渲染设置标题', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    });
  });

  it('点击遮罩层触发 onClose', async () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    });

    // 点击遮罩层（overlay）
    const overlay = screen.getByRole('heading', { name: 'Settings' })
      .closest('div[style*="position: fixed"]');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('保存后触发 onConfigSaved 回调', async () => {
    const onConfigSaved = vi.fn();
    render(
      <SettingsModal isOpen={true} onClose={vi.fn()} onConfigSaved={onConfigSaved} />
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onConfigSaved).toHaveBeenCalled();
    });
  });

  it('Tab 切换在快捷键和命令之间', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    });

    // 找到 Tab 栏中的"Commands"按钮
    const tabButtons = screen.getAllByRole('button');
    const commandTab = tabButtons.find(btn => btn.textContent === 'Commands');
    expect(commandTab).toBeDefined();

    fireEvent.click(commandTab!);

    // 切换到命令 tab 后应该显示命令列表
    await waitFor(() => {
      expect(screen.getByText('/help')).toBeDefined();
    });
  });

  it('保存失败时显示错误信息', async () => {
    vi.mocked(apiClient.updateUserConfig).mockResolvedValue(false);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Failed to save')).toBeDefined();
    });
  });
});
