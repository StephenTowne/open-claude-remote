import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useInstances } from '../../src/hooks/useInstances.js';
import { useInstanceStore } from '../../src/stores/instance-store.js';

vi.mock('../../src/services/instance-api.js', () => ({
  fetchInstances: vi.fn(),
}));

import { fetchInstances } from '../../src/services/instance-api.js';

const mockedFetchInstances = vi.mocked(fetchInstances);

describe('useInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useInstanceStore.setState({
      instances: [],
      activeInstanceId: null,
      currentHostOverride: null,
    });
  });

  it('should fetch instances on mount', async () => {
    mockedFetchInstances.mockResolvedValue([
      {
        instanceId: 'inst-1',
        name: 'Test',
        host: '127.0.0.1',
        port: 3000,
        pid: 12345,
        cwd: '/tmp',
        startedAt: '2026-01-01T00:00:00.000Z',
        isCurrent: true,
      },
    ]);

    renderHook(() => useInstances());

    await waitFor(() => {
      expect(mockedFetchInstances).toHaveBeenCalledTimes(1);
    });
  });

  it('should auto select isCurrent instance on first load', async () => {
    mockedFetchInstances.mockResolvedValue([
      {
        instanceId: 'inst-1',
        name: 'Test',
        host: '127.0.0.1',
        port: 3000,
        pid: 12345,
        cwd: '/tmp',
        startedAt: '2026-01-01T00:00:00.000Z',
        isCurrent: true,
      },
      {
        instanceId: 'inst-2',
        name: 'Other',
        host: '127.0.0.1',
        port: 3001,
        pid: 12346,
        cwd: '/tmp',
        startedAt: '2026-01-01T00:00:00.000Z',
        isCurrent: false,
      },
    ]);

    renderHook(() => useInstances());

    await waitFor(() => {
      expect(useInstanceStore.getState().activeInstanceId).toBe('inst-1');
    });
  });

  it('should NOT auto switch when active instance disappears from list', async () => {
    // 先预设置 store 状态（模拟用户已经切换到 inst-2）
    useInstanceStore.setState({
      instances: [
        {
          instanceId: 'inst-1',
          name: 'Test',
          host: '127.0.0.1',
          port: 3000,
          pid: 12345,
          cwd: '/tmp',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: true,
        },
        {
          instanceId: 'inst-2',
          name: 'Other',
          host: '127.0.0.1',
          port: 3001,
          pid: 12346,
          cwd: '/tmp',
          startedAt: '2026-01-01T00:00:00.000Z',
          isCurrent: false,
        },
      ],
      activeInstanceId: 'inst-2',
    });

    // fetch 返回的实例列表不包含 inst-2（已下线）
    mockedFetchInstances.mockResolvedValue([
      {
        instanceId: 'inst-1',
        name: 'Test',
        host: '127.0.0.1',
        port: 3000,
        pid: 12345,
        cwd: '/tmp',
        startedAt: '2026-01-01T00:00:00.000Z',
        isCurrent: true,
      },
    ]);

    renderHook(() => useInstances());

    // 等待 fetch 完成并更新 store
    await waitFor(() => {
      expect(useInstanceStore.getState().instances).toHaveLength(1);
    });

    // 验证：useInstances 不应该自动切换 activeInstance
    // 这个职责应该由 ConsolePage 统一处理
    expect(useInstanceStore.getState().activeInstanceId).toBe('inst-2');
  });

  it('should update instances list in store when fetch succeeds', async () => {
    const mockInstances = [
      {
        instanceId: 'inst-1',
        name: 'Test',
        host: '127.0.0.1',
        port: 3000,
        pid: 12345,
        cwd: '/tmp',
        startedAt: '2026-01-01T00:00:00.000Z',
        isCurrent: true,
      },
    ];
    mockedFetchInstances.mockResolvedValue(mockInstances);

    renderHook(() => useInstances());

    await waitFor(() => {
      expect(useInstanceStore.getState().instances).toEqual(mockInstances);
    });
  });

  it('should silently handle fetch errors', async () => {
    mockedFetchInstances.mockRejectedValue(new Error('Network error'));

    // 不应该抛出错误
    expect(() => {
      renderHook(() => useInstances());
    }).not.toThrow();

    // 验证错误被静默处理（instances 保持空数组）
    await waitFor(() => {
      expect(useInstanceStore.getState().instances).toEqual([]);
    });
  });

  it('should return current activeInstanceId from store', () => {
    useInstanceStore.setState({ activeInstanceId: 'test-instance' });

    const { result } = renderHook(() => useInstances());

    expect(result.current.activeInstanceId).toBe('test-instance');
  });
});
