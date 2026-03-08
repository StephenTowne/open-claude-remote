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
import {
  detectAllLocalIps,
  getAllNetworkInterfaces,
  isVpnInterface,
  isInCidrRange,
  isPrivateIpWithConfig,
  type NetworkInterface,
} from '../../../src/utils/network.js';

const mockNetworkInterfaces = vi.mocked(networkInterfaces);

describe('isVpnInterface', () => {
  it('应识别 macOS VPN 接口 utun', () => {
    expect(isVpnInterface('utun0')).toBe(true);
    expect(isVpnInterface('utun1')).toBe(true);
    expect(isVpnInterface('utun99')).toBe(true);
  });

  it('应识别 PPP 接口', () => {
    expect(isVpnInterface('ppp0')).toBe(true);
    expect(isVpnInterface('ppp1')).toBe(true);
  });

  it('应识别 Linux TUN/TAP 接口', () => {
    expect(isVpnInterface('tun0')).toBe(true);
    expect(isVpnInterface('tap0')).toBe(true);
  });

  it('应识别 WireGuard 接口', () => {
    expect(isVpnInterface('wireguard0')).toBe(true);
    expect(isVpnInterface('wg0')).toBe(true);
  });

  it('应识别包含 vpn 的接口名', () => {
    expect(isVpnInterface('vpn0')).toBe(true);
    expect(isVpnInterface('company-vpn')).toBe(true);
    expect(isVpnInterface('MYVPN')).toBe(true);
  });

  it('应识别 ZeroTier 和 Tailscale', () => {
    expect(isVpnInterface('zerotier0')).toBe(true);
    expect(isVpnInterface('tailscale0')).toBe(true);
  });

  it('不应将普通网卡识别为 VPN', () => {
    expect(isVpnInterface('en0')).toBe(false);
    expect(isVpnInterface('eth0')).toBe(false);
    expect(isVpnInterface('wlan0')).toBe(false);
    expect(isVpnInterface('lo0')).toBe(false);
  });
});

describe('isInCidrRange', () => {
  it('应正确匹配 /8 网段', () => {
    expect(isInCidrRange('30.0.0.1', '30.0.0.0/8')).toBe(true);
    expect(isInCidrRange('30.255.255.255', '30.0.0.0/8')).toBe(true);
    expect(isInCidrRange('31.0.0.1', '30.0.0.0/8')).toBe(false);
  });

  it('应正确匹配 /16 网段', () => {
    expect(isInCidrRange('192.168.1.1', '192.168.0.0/16')).toBe(true);
    expect(isInCidrRange('192.168.255.255', '192.168.0.0/16')).toBe(true);
    expect(isInCidrRange('192.169.1.1', '192.168.0.0/16')).toBe(false);
  });

  it('应正确匹配 /24 网段', () => {
    expect(isInCidrRange('10.0.1.50', '10.0.1.0/24')).toBe(true);
    expect(isInCidrRange('10.0.1.255', '10.0.1.0/24')).toBe(true);
    expect(isInCidrRange('10.0.2.1', '10.0.1.0/24')).toBe(false);
  });

  it('应处理边界情况', () => {
    expect(isInCidrRange('0.0.0.0', '0.0.0.0/0')).toBe(true);
    expect(isInCidrRange('255.255.255.255', '0.0.0.0/0')).toBe(true);
  });

  it('应拒绝无效的 CIDR', () => {
    expect(isInCidrRange('192.168.1.1', 'invalid')).toBe(false);
    expect(isInCidrRange('192.168.1.1', '192.168.1.0')).toBe(false);
    expect(isInCidrRange('invalid', '192.168.1.0/24')).toBe(false);
  });
});

describe('isPrivateIpWithConfig', () => {
  it('应支持 RFC1918 范围（无自定义配置）', () => {
    expect(isPrivateIpWithConfig('10.0.0.1')).toBe(true);
    expect(isPrivateIpWithConfig('192.168.1.1')).toBe(true);
    expect(isPrivateIpWithConfig('172.16.0.1')).toBe(true);
    expect(isPrivateIpWithConfig('8.8.8.8')).toBe(false);
  });

  it('应支持自定义网段', () => {
    const customRanges = ['30.0.0.0/8', '100.64.0.0/10'];
    expect(isPrivateIpWithConfig('30.1.2.3', customRanges)).toBe(true);
    expect(isPrivateIpWithConfig('100.64.1.1', customRanges)).toBe(true);
    expect(isPrivateIpWithConfig('8.8.8.8', customRanges)).toBe(false);
  });

  it('空自定义范围应只返回 RFC1918 结果', () => {
    expect(isPrivateIpWithConfig('10.0.0.1', [])).toBe(true);
    expect(isPrivateIpWithConfig('30.0.0.1', [])).toBe(false);
  });
});

describe('getAllNetworkInterfaces', () => {
  beforeEach(() => {
    mockNetworkInterfaces.mockReset();
  });

  it('应返回所有 IPv4 接口并正确分类', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [
        { address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0', mac: '00:00:00:00:00:00', cidr: null },
      ],
      en0: [
        { address: '192.168.1.100', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: 'aa:bb:cc:dd:ee:ff', cidr: null },
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null },
      ],
      utun3: [
        { address: '30.0.0.5', family: 'IPv4', internal: false, netmask: '255.0.0.0', mac: '', cidr: null },
      ],
      ppp0: [
        { address: '10.10.0.50', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '', cidr: null },
      ],
    } as any);

    const interfaces = getAllNetworkInterfaces();

    // VPN 接口应排在前面
    expect(interfaces[0]?.name).toBe('ppp0');
    expect(interfaces[0]?.isVpn).toBe(true);
    expect(interfaces[1]?.name).toBe('utun3');
    expect(interfaces[1]?.isVpn).toBe(true);

    // 然后是私有 IP
    const en0 = interfaces.find(i => i.name === 'en0');
    expect(en0).toBeDefined();
    expect(en0?.isPrivate).toBe(true);
    expect(en0?.isVpn).toBe(false);

    // 不应包含回环地址
    expect(interfaces.some(i => i.internal)).toBe(false);
  });

  it('应正确识别 VPN 接口并标记 isVpn', () => {
    mockNetworkInterfaces.mockReturnValue({
      utun2: [
        { address: '172.16.0.100', family: 'IPv4', internal: false, netmask: '255.255.0.0', mac: '', cidr: null },
      ],
      wg0: [
        { address: '10.200.0.5', family: 'IPv4', internal: false, netmask: '255.255.0.0', mac: '', cidr: null },
      ],
    } as any);

    const interfaces = getAllNetworkInterfaces();

    expect(interfaces.every(i => i.isVpn)).toBe(true);
  });

  it('应过滤 IPv6 地址', () => {
    mockNetworkInterfaces.mockReturnValue({
      en0: [
        { address: '192.168.1.1', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null },
      ],
    } as any);

    const interfaces = getAllNetworkInterfaces();

    expect(interfaces).toHaveLength(1);
    expect(interfaces[0]?.address).toBe('192.168.1.1');
  });
});

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
