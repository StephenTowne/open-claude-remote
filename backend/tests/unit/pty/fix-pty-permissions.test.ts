import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  chmodSync: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/logger/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock node:module's createRequire
vi.mock('node:module', () => ({
  createRequire: vi.fn(),
}));

import { existsSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { logger } from '../../../src/logger/logger.js';

// Must import after mocks
const importModule = async () => {
  // Reset module registry so the module-level flag resets
  vi.resetModules();
  // Re-apply mocks after resetModules
  vi.doMock('node:fs', () => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    chmodSync: vi.fn(),
  }));
  vi.doMock('../../../src/logger/logger.js', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('node:module', () => ({
    createRequire: vi.fn(),
  }));
  return import('../../../src/pty/fix-pty-permissions.js');
};

describe('ensureSpawnHelperPermissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fix spawn-helper missing execute permission', async () => {
    const mod = await importModule();
    const { existsSync, readdirSync, statSync, chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const { logger } = await import('../../../src/logger/logger.js');

    const mockRequire = { resolve: vi.fn().mockReturnValue('/fake/node_modules/node-pty/lib/index.js') };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['darwin-x64' as any]);
    vi.mocked(statSync).mockReturnValue({ mode: 0o644 } as any);

    mod.ensureSpawnHelperPermissions();

    expect(chmodSync).toHaveBeenCalledWith(
      expect.stringContaining('spawn-helper'),
      0o755,
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('spawn-helper') }),
      expect.stringContaining('chmod'),
    );
  });

  it('should skip when spawn-helper already has execute permission', async () => {
    const mod = await importModule();
    const { existsSync, readdirSync, statSync, chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');

    const mockRequire = { resolve: vi.fn().mockReturnValue('/fake/node_modules/node-pty/lib/index.js') };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['darwin-x64' as any]);
    vi.mocked(statSync).mockReturnValue({ mode: 0o755 } as any);

    mod.ensureSpawnHelperPermissions();

    expect(chmodSync).not.toHaveBeenCalled();
  });

  it('should silently skip when node-pty is not installed', async () => {
    const mod = await importModule();
    const { chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const { logger } = await import('../../../src/logger/logger.js');

    const mockRequire = { resolve: vi.fn().mockImplementation(() => { throw new Error('Cannot find module'); }) };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);

    mod.ensureSpawnHelperPermissions();

    expect(chmodSync).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should silently skip when prebuilds directory does not exist', async () => {
    const mod = await importModule();
    const { existsSync, chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');

    const mockRequire = { resolve: vi.fn().mockReturnValue('/fake/node_modules/node-pty/lib/index.js') };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);
    vi.mocked(existsSync).mockReturnValue(false);

    mod.ensureSpawnHelperPermissions();

    expect(chmodSync).not.toHaveBeenCalled();
  });

  it('should handle multiple platform directories', async () => {
    const mod = await importModule();
    const { existsSync, readdirSync, statSync, chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');

    const mockRequire = { resolve: vi.fn().mockReturnValue('/fake/node_modules/node-pty/lib/index.js') };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);
    vi.mocked(existsSync).mockImplementation((p: any) => {
      // prebuilds dir exists, and both spawn-helper files exist
      return true;
    });
    vi.mocked(readdirSync).mockReturnValue(['darwin-x64', 'linux-x64'] as any);
    vi.mocked(statSync).mockReturnValue({ mode: 0o644 } as any);

    mod.ensureSpawnHelperPermissions();

    expect(chmodSync).toHaveBeenCalledTimes(2);
  });

  it('should only run once across multiple calls', async () => {
    const mod = await importModule();
    const { existsSync, readdirSync, statSync, chmodSync } = await import('node:fs');
    const { createRequire } = await import('node:module');

    const mockRequire = { resolve: vi.fn().mockReturnValue('/fake/node_modules/node-pty/lib/index.js') };
    vi.mocked(createRequire).mockReturnValue(mockRequire as any);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['darwin-x64' as any]);
    vi.mocked(statSync).mockReturnValue({ mode: 0o644 } as any);

    mod.ensureSpawnHelperPermissions();
    mod.ensureSpawnHelperPermissions();
    mod.ensureSpawnHelperPermissions();

    // chmodSync should only be called once (from the first invocation)
    expect(chmodSync).toHaveBeenCalledTimes(1);
  });
});
