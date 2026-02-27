import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { writePidFile, removePidFile } from '../../../src/utils/pid-file.js';

describe('pid-file', () => {
  let testDir: string;
  let pidPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `pid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    pidPath = join(testDir, 'app.pid');
  });

  afterEach(() => {
    // Cleanup
    try {
      const { rmSync } = require('node:fs');
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('writePidFile', () => {
    it('writes current PID to file', () => {
      writePidFile(pidPath);

      expect(existsSync(pidPath)).toBe(true);
      expect(readFileSync(pidPath, 'utf-8')).toBe(String(process.pid));
    });

    it('creates parent directories if needed', () => {
      const nestedPath = join(testDir, 'nested', 'deep', 'app.pid');

      writePidFile(nestedPath);

      expect(existsSync(nestedPath)).toBe(true);
      expect(readFileSync(nestedPath, 'utf-8')).toBe(String(process.pid));
    });
  });

  describe('removePidFile', () => {
    it('removes the PID file', () => {
      writePidFile(pidPath);
      expect(existsSync(pidPath)).toBe(true);

      removePidFile(pidPath);
      expect(existsSync(pidPath)).toBe(false);
    });

    it('does not throw when file does not exist', () => {
      expect(() => removePidFile(join(testDir, 'nonexistent.pid'))).not.toThrow();
    });
  });
});
