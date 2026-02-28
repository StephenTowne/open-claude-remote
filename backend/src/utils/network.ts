import { networkInterfaces } from 'node:os';
import { logger } from '../logger/logger.js';

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
