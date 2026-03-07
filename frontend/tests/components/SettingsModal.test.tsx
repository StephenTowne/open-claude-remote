import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SettingsModal } from '../../src/components/settings/SettingsModal.js';
import * as apiClient from '../../src/services/api-client.js';

vi.mock('../../src/services/api-client.js', () => ({
  getUserConfig: vi.fn(),
  updateUserConfig: vi.fn(),
  updateNotificationChannelEnabled: vi.fn(),
}));

// Mock useAppStore
vi.mock('../../src/stores/app-store.js', () => ({
  useAppStore: (selector: (state: { showToast: (msg: string) => void }) => unknown) =>
    selector({ showToast: vi.fn() }),
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

  describe('CommandSettings index-safety', () => {
    beforeEach(() => {
      vi.mocked(apiClient.getUserConfig).mockResolvedValue({
        config: {
          shortcuts: [],
          commands: [
            { label: '/alpha', command: '/alpha', enabled: true },
            { label: '/beta', command: '/beta', enabled: true },
            { label: '/gamma', command: '/gamma', enabled: false },
          ],
        },
        configPath: '/test/config.json',
      });
    });

    const switchToCommandsTab = async () => {
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
      });
      const commandTab = screen.getAllByRole('button').find(b => b.textContent === 'Commands');
      expect(commandTab).toBeDefined();
      fireEvent.click(commandTab!);
      await waitFor(() => {
        expect(screen.getByText('/alpha')).toBeDefined();
      });
    };

    it('编辑状态在排序后仍指向正确项', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
      await switchToCommandsTab();

      // 开始编辑 /beta（点击其 label 按钮）
      fireEvent.click(screen.getByText('/beta'));
      expect(screen.getByDisplayValue('/beta')).toBeDefined();

      // 切换 /alpha 为禁用 → sortByEnabled → [/beta(on), /alpha(off), /gamma(off)]
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]); // /alpha 的 toggle

      // 排序后，/alpha 应该显示为按钮（不在编辑状态）
      await waitFor(() => {
        expect(screen.getByText('/alpha')).toBeDefined();
      });
      // /beta 应该仍在编辑状态
      expect(screen.getByDisplayValue('/beta')).toBeDefined();
    });

    it('toggle enabled 后排序不影响其他项状态', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
      await switchToCommandsTab();

      // 初始：/alpha(on), /beta(on), /gamma(off)
      const switches = screen.getAllByRole('switch');
      expect(switches[0].getAttribute('aria-checked')).toBe('true');
      expect(switches[1].getAttribute('aria-checked')).toBe('true');
      expect(switches[2].getAttribute('aria-checked')).toBe('false');

      // 禁用 /alpha
      fireEvent.click(switches[0]);

      // 排序后: [/beta(on), /alpha(off), /gamma(off)]
      await waitFor(() => {
        const newSwitches = screen.getAllByRole('switch');
        expect(newSwitches[0].getAttribute('aria-checked')).toBe('true');  // /beta
        expect(newSwitches[1].getAttribute('aria-checked')).toBe('false'); // /alpha
        expect(newSwitches[2].getAttribute('aria-checked')).toBe('false'); // /gamma
      });
    });

    it('排序后 delete 删除正确项', async () => {
      render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
      await switchToCommandsTab();

      // 禁用 /alpha → sort → [/beta(on), /alpha(off), /gamma(off)]
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]);

      // 排序后，第一个命令应该是 /beta
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button')
          .filter(b => b.getAttribute('aria-label')?.startsWith('Edit command'));
        expect(editButtons[0].textContent).toBe('/beta');
      });

      // 删除第一项（/beta）
      const deleteButtons = screen.getAllByRole('button')
        .filter(b => b.getAttribute('aria-label') === 'Delete');
      fireEvent.click(deleteButtons[0]);

      // /beta 应被删除，/alpha 和 /gamma 仍在
      await waitFor(() => {
        expect(screen.queryByText('/beta')).toBeNull();
        expect(screen.getByText('/alpha')).toBeDefined();
        expect(screen.getByText('/gamma')).toBeDefined();
      });
    });
  });
});
