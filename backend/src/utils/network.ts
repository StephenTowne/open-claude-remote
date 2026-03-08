import { networkInterfaces } from 'node:os';
import { logger } from '../logger/logger.js';

/**
 * Network interface information with classification
 */
export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  isPrivate: boolean;  // RFC1918
  isVpn: boolean;      // Heuristic based on interface name
  netmask?: string;
  mac?: string;
}

/**
 * VPN interface name patterns (heuristic detection)
 */
const VPN_INTERFACE_PATTERNS = [
  /^utun\d+/,      // macOS TunnelBlick, WireGuard, etc.
  /^ppp\d+/,       // PPP connections
  /^tun\d+/,       // Linux TUN interfaces
  /^tap\d+/,       // Linux TAP interfaces
  /vpn/i,          // Any interface with "vpn" in name
  /wireguard/i,    // WireGuard
  /wg\d+/,         // WireGuard short form
  /zerotier/i,     // ZeroTier
  /tailscale/i,    // Tailscale
]

/**
 * Check if interface name indicates a VPN
 */
export function isVpnInterface(name: string): boolean {
  return VPN_INTERFACE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Parse CIDR notation and return IP as 32-bit integer and mask bits
 */
function parseCidr(cidr: string): { ipInt: number; maskBits: number } | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null;

  const ip = parts[0];
  const bits = parseInt(parts[1], 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return null;

  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) {
    return null;
  }

  const ipInt = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  return { ipInt, maskBits: bits };
}

/**
 * Check if an IP address is within a CIDR range
 */
export function isInCidrRange(ip: string, cidr: string): boolean {
  const cidrParsed = parseCidr(cidr);
  if (!cidrParsed) return false;

  const ipParsed = parseCidr(`${ip}/32`);
  if (!ipParsed) return false;

  const mask = cidrParsed.maskBits === 0 ? 0 : (~0 << (32 - cidrParsed.maskBits)) >>> 0;
  return (cidrParsed.ipInt & mask) === (ipParsed.ipInt & mask);
}

/**
 * Check if an IPv4 address is in a private RFC 1918 range.
 * - 10.0.0.0/8
 * - 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
 * - 192.168.0.0/16
 */
export function isPrivateIp(address: string): boolean {
  if (address.startsWith('10.') || address.startsWith('192.168.')) {
    return true;
  }
  if (address.startsWith('172.')) {
    const secondOctet = parseInt(address.split('.')[1], 10);
    return secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
}

/**
 * Check if an IP address is private with custom range support.
 * Supports RFC1918 ranges plus user-defined CIDR ranges.
 */
export function isPrivateIpWithConfig(address: string, customRanges: string[] = []): boolean {
  // First check RFC1918 ranges
  if (isPrivateIp(address)) {
    return true;
  }

  // Then check custom ranges
  for (const range of customRanges) {
    if (isInCidrRange(address, range)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all network interfaces with detailed information and classification.
 * Returns interfaces sorted by preference: VPN > Private LAN > Public
 */
export function getAllNetworkInterfaces(): NetworkInterface[] {
  const nets = networkInterfaces();
  const results: NetworkInterface[] = [];

  for (const name of Object.keys(nets)) {
    const netList = nets[name];
    if (!netList) continue;

    for (const net of netList) {
      // Skip IPv6 and internal (loopback) interfaces
      if (net.family !== 'IPv4' || net.internal) continue;

      results.push({
        name,
        address: net.address,
        family: 'IPv4',
        internal: net.internal,
        isPrivate: isPrivateIp(net.address),
        isVpn: isVpnInterface(name),
        netmask: net.netmask,
        mac: net.mac,
      });
    }
  }

  // Sort: VPN interfaces first, then private IPs, then others
  results.sort((a, b) => {
    if (a.isVpn && !b.isVpn) return -1;
    if (!a.isVpn && b.isVpn) return 1;
    if (a.isPrivate && !b.isPrivate) return -1;
    if (!a.isPrivate && b.isPrivate) return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Detect the first LAN IP address (RFC 1918 private range).
 * Returns null if no LAN IP found.
 */
export function detectLanIp(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && isPrivateIp(net.address)) {
        logger.info({ ip: net.address, interface: name }, 'Detected LAN IP');
        return net.address;
      }
    }
  }
  logger.warn('No LAN IP detected, falling back to 127.0.0.1');
  return null;
}

/**
 * Detect all non-internal IPv4 addresses across all network interfaces.
 * Used to build the CORS allowlist so requests from any local NIC are accepted.
 */
export function detectAllLocalIps(): string[] {
  const nets = networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

/**
 * Detect the first non-internal IPv4 address.
 * This is more permissive than detectLanIp - it will return any non-loopback IP.
 * Useful for environments with non-RFC1918 internal networks (e.g., corporate networks).
 */
export function detectNonLoopbackIp(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        logger.info({ ip: net.address, interface: name }, 'Detected non-loopback IP');
        return net.address;
      }
    }
  }
  logger.warn('No non-loopback IP detected');
  return null;
}
