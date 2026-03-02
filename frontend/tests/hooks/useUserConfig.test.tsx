import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useUserConfig, notifyConfigChanged } from '../../src/hooks/useUserConfig.js';
import * as apiClient from '../../src/services/api-client.js';

vi.mock('../../src/services/api-client.js', () => ({
  getUserConfig: vi.fn(),
}));

/** 测试组件：展示 shortcuts 数量 */
function ConfigDisplay({ testId }: { testId: string }) {
  const { shortcuts, commands, isLoading } = useUserConfig();
  if (isLoading) return <div data-testid={`${testId}-loading`}>loading</div>;
  return (
    <div data-testid={testId}>
      <span data-testid={`${testId}-shortcuts`}>{shortcuts.length}</span>
      <span data-testid={`${testId}-commands`}>{commands.length}</span>
    </div>
  );
}

describe('useUserConfig', () => {
  beforeEach(() => {
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: null,
      configPath: '/test/config.json',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初始加载使用默认配置', async () => {
    render(<ConfigDisplay testId="a" />);

    await waitFor(() => {
      expect(screen.getByTestId('a-shortcuts')).toBeDefined();
    });
  });

  it('加载用户配置后显示启用项', async () => {
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: {
        shortcuts: [
          { label: 'Esc', data: '\x1b', enabled: true },
          { label: 'Tab', data: '\t', enabled: false },
        ],
        commands: [
          { label: '/help', command: '/help', enabled: true },
        ],
      },
      configPath: '/test/config.json',
    });

    render(<ConfigDisplay testId="b" />);

    await waitFor(() => {
      // 只有 1 个启用的 shortcut
      expect(screen.getByTestId('b-shortcuts').textContent).toBe('1');
      expect(screen.getByTestId('b-commands').textContent).toBe('1');
    });
  });

  it('notifyConfigChanged 触发所有实例重新加载', async () => {
    // 初始返回 null（使用默认值）
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: null,
      configPath: '/test/config.json',
    });

    // 渲染两个独立的 useUserConfig 消费者
    render(
      <>
        <ConfigDisplay testId="c1" />
        <ConfigDisplay testId="c2" />
      </>
    );

    // 等待初始加载完成
    await waitFor(() => {
      expect(screen.getByTestId('c1-shortcuts')).toBeDefined();
      expect(screen.getByTestId('c2-shortcuts')).toBeDefined();
    });

    const initialCallCount = vi.mocked(apiClient.getUserConfig).mock.calls.length;

    // 修改 mock 返回值，模拟配置已更新
    vi.mocked(apiClient.getUserConfig).mockResolvedValue({
      config: {
        shortcuts: [
          { label: 'Enter', data: '\r', enabled: true },
        ],
        commands: [],
      },
      configPath: '/test/config.json',
    });

    // 触发全局刷新
    act(() => {
      notifyConfigChanged();
    });

    // 两个实例都应该重新加载
    await waitFor(() => {
      expect(screen.getByTestId('c1-shortcuts').textContent).toBe('1');
      expect(screen.getByTestId('c2-shortcuts').textContent).toBe('1');
      expect(screen.getByTestId('c1-commands').textContent).toBe('0');
      expect(screen.getByTestId('c2-commands').textContent).toBe('0');
    });

    // getUserConfig 应该被额外调用了至少 2 次（两个实例各一次）
    expect(vi.mocked(apiClient.getUserConfig).mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
