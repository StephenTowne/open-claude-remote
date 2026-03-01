import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IpMonitor } from '../../../src/utils/ip-monitor.js';

describe('IpMonitor', () => {
  let monitor: IpMonitor;
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockGetIp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCallback = vi.fn();
    mockGetIp = vi.fn();
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
});