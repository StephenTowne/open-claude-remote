import { describe, it, expect, vi } from 'vitest';
import { createServer } from 'node:net';

// Mock the logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { findAvailablePort } from '../../../src/registry/port-finder.js';

describe('findAvailablePort', () => {
  it('should return preferred port if available', async () => {
    // Use a high random port that's likely available
    const port = 40000 + Math.floor(Math.random() * 10000);
    const result = await findAvailablePort(port, '127.0.0.1');
    expect(result).toBe(port);
  });

  it('should find next available port when preferred is occupied', async () => {
    // Occupy a port
    const server = createServer();
    const occupiedPort = await new Promise<number>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        } else {
          reject(new Error('Failed to get port'));
        }
      });
    });

    try {
      const result = await findAvailablePort(occupiedPort, '127.0.0.1');
      expect(result).toBeGreaterThan(occupiedPort);
      expect(result).toBeLessThanOrEqual(occupiedPort + 100);
    } finally {
      server.close();
    }
  });

  it('should throw if no port found in range', async () => {
    // Occupy many consecutive ports (we'll test with maxAttempts = 3)
    const servers: ReturnType<typeof createServer>[] = [];
    const basePort = 50000 + Math.floor(Math.random() * 5000);

    for (let i = 0; i < 3; i++) {
      const server = createServer();
      await new Promise<void>((resolve) => {
        server.listen(basePort + i, '127.0.0.1', () => resolve());
      });
      servers.push(server);
    }

    try {
      await expect(findAvailablePort(basePort, '127.0.0.1', 3))
        .rejects.toThrow('No available port found');
    } finally {
      servers.forEach(s => s.close());
    }
  });
});
