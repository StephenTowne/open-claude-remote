import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:os before importing the module under test
vi.mock('node:os', () => ({
  networkInterfaces: vi.fn(),
}));

// Mock logger to avoid side effects
vi.mock('../../../src/logger/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { networkInterfaces } from 'node:os';
import { detectAllLocalIps } from '../../../src/utils/network.js';

const mockNetworkInterfaces = vi.mocked(networkInterfaces);

describe('detectAllLocalIps', () => {
  beforeEach(() => {
    mockNetworkInterfaces.mockReset();
  });

  it('返回所有非回环 IPv4 地址', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [
        { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0', mac: '', cidr: null },
      ],
      en0: [
        { address: '192.168.1.100', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: null },
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null },
      ],
      en1: [
        { address: '10.0.0.50', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: null },
      ],
    } as any);

    const ips = detectAllLocalIps();
    expect(ips).toContain('192.168.1.100');
    expect(ips).toContain('10.0.0.50');
    expect(ips).not.toContain('127.0.0.1');
    expect(ips).not.toContain('fe80::1');
    expect(ips).toHaveLength(2);
  });

  it('无非回环 IPv4 时返回空数组', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [
        { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0', mac: '', cidr: null },
      ],
    } as any);

    const ips = detectAllLocalIps();
    expect(ips).toEqual([]);
  });

  it('多网卡多 IPv4 地址全部返回', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [
        { address: '172.16.0.10', family: 'IPv4', internal: false, netmask: '255.255.0.0', mac: '', cidr: null },
      ],
      wlan0: [
        { address: '192.168.0.5', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: null },
      ],
      docker0: [
        { address: '172.17.0.1', family: 'IPv4', internal: false, netmask: '255.255.0.0', mac: '', cidr: null },
      ],
    } as any);

    const ips = detectAllLocalIps();
    expect(ips).toEqual(['172.16.0.10', '192.168.0.5', '172.17.0.1']);
  });

  it('networkInterfaces 返回空对象时返回空数组', () => {
    mockNetworkInterfaces.mockReturnValue({});

    const ips = detectAllLocalIps();
    expect(ips).toEqual([]);
  });
});
