import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NetworkInterface } from '../../../src/utils/network.js';

// Mock network module for getAllNetworkInterfaces
vi.mock('../../../src/utils/network.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/utils/network.js')>();
  return {
    ...original,
    getAllNetworkInterfaces: vi.fn(() => []),
  };
});

import { getAllNetworkInterfaces } from '../../../src/utils/network.js';
import { IpMonitor } from '../../../src/utils/ip-monitor.js';

const mockGetAllNetworkInterfaces = vi.mocked(getAllNetworkInterfaces);

/** Helper to create a mock NetworkInterface */
function makeIface(name: string, address: string, opts: Partial<NetworkInterface> = {}): NetworkInterface {
  return {
    name,
    address,
    family: 'IPv4',
    internal: false,
    isPrivate: address.startsWith('192.168.') || address.startsWith('10.'),
    isVpn: false,
    ...opts,
  };
}

describe('IpMonitor', () => {
  let monitor: IpMonitor;
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockGetIp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCallback = vi.fn();
    mockGetIp = vi.fn();
    mockGetAllNetworkInterfaces.mockReturnValue([]);
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
    vi.useRealTimers();
  });

  describe('基础功能', () => {
    it('启动后不立即触发回调', () => {
      mockGetIp.mockReturnValue('192.168.1.1');
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('停止后不再检测', () => {
      mockGetIp.mockReturnValue('192.168.1.1');
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');
      monitor.stop();

      vi.advanceTimersByTime(60000);

      expect(mockGetIp).not.toHaveBeenCalled();
    });
  });

  describe('稳定性阈值逻辑', () => {
    it('连续 N 次检测到相同新 IP 才触发回调', () => {
      mockGetIp
        .mockReturnValueOnce('192.168.2.1') // 第 1 次检测：新 IP
        .mockReturnValueOnce('192.168.2.1') // 第 2 次检测：相同新 IP（稳定性阈值=2，触发）
        .mockReturnValue('192.168.2.1');

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      // 第 1 次检测：新 IP 但不稳定
      vi.advanceTimersByTime(30000);
      expect(mockCallback).not.toHaveBeenCalled();

      // 第 2 次检测：相同新 IP，达到稳定性阈值
      vi.advanceTimersByTime(30000);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('192.168.2.1', '192.168.1.1');
    });

    it('稳定性阈值为 1 时立即触发', () => {
      mockGetIp.mockReturnValue('192.168.2.1');

      monitor = new IpMonitor(mockCallback, 30000, 1, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('192.168.2.1', '192.168.1.1');
    });

    it('中间 IP 变化时重置稳定性计数', () => {
      mockGetIp
        .mockReturnValueOnce('192.168.2.1') // 第 1 次：新 IP A
        .mockReturnValueOnce('192.168.3.1') // 第 2 次：新 IP B（不同于 A，重置计数）
        .mockReturnValue('192.168.3.1'); // 第 3 次及以后：相同 IP B

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000); // 第 1 次：检测到 2.1，稳定性计数 1
      expect(mockCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // 第 2 次：IP 变为 3.1，重置稳定性计数为 1
      expect(mockCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // 第 3 次：相同 IP 3.1，稳定性计数 2，触发
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('192.168.3.1', '192.168.1.1');
    });
  });

  describe('短暂波动不触发', () => {
    it('单次波动后恢复原 IP 不触发', () => {
      mockGetIp
        .mockReturnValueOnce('192.168.2.1') // 短暂变化
        .mockReturnValue('192.168.1.1'); // 恢复原 IP

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000); // 检测到 2.1
      expect(mockCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // 恢复 1.1
      expect(mockCallback).not.toHaveBeenCalled();

      // 继续检测，保持原 IP
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('连续 2 次波动后恢复原 IP 不触发', () => {
      mockGetIp
        .mockReturnValueOnce('192.168.2.1') // 变化
        .mockReturnValueOnce('192.168.2.1') // 相同变化IP（但还没达到阈值就恢复）
        .mockReturnValue('192.168.1.1'); // 恢复

      monitor = new IpMonitor(mockCallback, 30000, 3, mockGetIp); // 阈值 3
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000); // 变化
      vi.advanceTimersByTime(30000); // 相同变化 IP
      expect(mockCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // 恢复原 IP
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('IP 未变化时不触发', () => {
      mockGetIp.mockReturnValue('192.168.1.1');

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('IP 为 null 时不触发（网络断开）', () => {
      mockGetIp.mockReturnValue(null);

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('再次 start 时重置状态', () => {
      mockGetIp
        .mockReturnValueOnce('192.168.2.1')
        .mockReturnValueOnce('192.168.2.1')
        .mockReturnValue('192.168.1.1');

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.1');

      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // 重启监控，使用新的旧 IP
      mockCallback.mockClear();
      mockGetIp.mockReturnValue('192.168.1.1');
      monitor.start('192.168.2.1'); //现在旧 IP 是 2.1

      vi.advanceTimersByTime(30000);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('网络接口监控 (checkInterfaces)', () => {
    const initialInterfaces = [
      makeIface('en0', '192.168.1.100'),
    ];

    const changedInterfaces = [
      makeIface('en0', '192.168.1.100'),
      makeIface('utun3', '30.0.0.5', { isVpn: true, isPrivate: false }),
    ];

    let mockNetworkCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockNetworkCallback = vi.fn();
      mockGetIp.mockReturnValue('192.168.1.100');
    });

    it('接口未变化时不触发 onNetworkChange', () => {
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);

      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);

      expect(mockNetworkCallback).not.toHaveBeenCalled();
    });

    it('连续 N 次检测到相同新接口列表才触发', () => {
      // start 时读取初始接口
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      // 之后 checkInterfaces 读取到新接口
      mockGetAllNetworkInterfaces.mockReturnValue(changedInterfaces);

      // 第 1 次检测：变化但不稳定
      vi.advanceTimersByTime(30000);
      expect(mockNetworkCallback).not.toHaveBeenCalled();

      // 第 2 次检测：相同变化，达到阈值
      vi.advanceTimersByTime(30000);
      expect(mockNetworkCallback).toHaveBeenCalledTimes(1);
      expect(mockNetworkCallback).toHaveBeenCalledWith(changedInterfaces, '192.168.1.100');
    });

    it('接口波动后恢复原列表不触发', () => {
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      // 第 1 次：接口变化
      mockGetAllNetworkInterfaces.mockReturnValueOnce(changedInterfaces)
        // 第 2 次：恢复原列表
        .mockReturnValue(initialInterfaces);

      vi.advanceTimersByTime(30000); // 变化
      vi.advanceTimersByTime(30000); // 恢复

      expect(mockNetworkCallback).not.toHaveBeenCalled();
    });

    it('接口列表变化中间跳变时重置稳定性计数', () => {
      const anotherInterfaces = [
        makeIface('eth0', '10.0.0.1'),
      ];

      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      // 第 1 次：变为 changedInterfaces
      mockGetAllNetworkInterfaces.mockReturnValueOnce(changedInterfaces)
        // 第 2 次：变为另一组 anotherInterfaces（重置计数）
        .mockReturnValueOnce(anotherInterfaces)
        // 第 3 次：相同 anotherInterfaces（达到阈值）
        .mockReturnValue(anotherInterfaces);

      vi.advanceTimersByTime(30000); // changedInterfaces, count=1
      expect(mockNetworkCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // anotherInterfaces, count 重置为 1
      expect(mockNetworkCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30000); // anotherInterfaces, count=2, 触发
      expect(mockNetworkCallback).toHaveBeenCalledTimes(1);
      expect(mockNetworkCallback).toHaveBeenCalledWith(anotherInterfaces, '192.168.1.100');
    });

    it('未提供 onNetworkChange 时不执行接口检查', () => {
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      // 不传 onNetworkChange
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp);
      monitor.start('192.168.1.100');

      // 记录 start 后的调用次数
      const callsAfterStart = mockGetAllNetworkInterfaces.mock.calls.length;

      mockGetAllNetworkInterfaces.mockReturnValue(changedInterfaces);
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);

      // checkInterfaces 发现没有 onNetworkChange 直接 return，不会再调用 getAllNetworkInterfaces
      expect(mockGetAllNetworkInterfaces.mock.calls.length).toBe(callsAfterStart);
    });

    it('currentInterfaces 返回当前接口列表的拷贝', () => {
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      const result = monitor.currentInterfaces;
      expect(result).toEqual(initialInterfaces);
      // 应该是拷贝，不是同一引用
      expect(result).not.toBe(initialInterfaces);
    });

    it('stop() 后再 start() 应重置接口监控状态', () => {
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      // 第 1 次检测到变化（稳定性计数=1）
      mockGetAllNetworkInterfaces.mockReturnValue(changedInterfaces);
      vi.advanceTimersByTime(30000);
      expect(mockNetworkCallback).not.toHaveBeenCalled();

      // stop 再 start，之前的 pending 状态应被重置
      monitor.stop();
      mockGetAllNetworkInterfaces.mockReturnValue(initialInterfaces);
      monitor.start('192.168.1.100');

      // 接口与 start 时相同，不应触发
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      expect(mockNetworkCallback).not.toHaveBeenCalled();
    });

    it('serializeInterfaces 排序不变性：不同顺序的相同接口不应触发变化', () => {
      const ifacesOrderA = [
        makeIface('en0', '192.168.1.100'),
        makeIface('en1', '192.168.1.101'),
      ];
      const ifacesOrderB = [
        makeIface('en1', '192.168.1.101'),
        makeIface('en0', '192.168.1.100'),
      ];

      mockGetAllNetworkInterfaces.mockReturnValue(ifacesOrderA);
      monitor = new IpMonitor(mockCallback, 30000, 2, mockGetIp, mockNetworkCallback);
      monitor.start('192.168.1.100');

      // 返回相同接口但顺序不同
      mockGetAllNetworkInterfaces.mockReturnValue(ifacesOrderB);
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);
      vi.advanceTimersByTime(30000);

      // 不应触发，因为 serializeInterfaces 会排序后比对
      expect(mockNetworkCallback).not.toHaveBeenCalled();
    });
  });
});