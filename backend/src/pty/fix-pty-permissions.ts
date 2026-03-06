/**
 * Runtime fix for node-pty spawn-helper missing execute permission.
 *
 * pnpm global install may skip postinstall scripts, leaving spawn-helper
 * without +x. This module provides a runtime fallback that checks and
 * fixes permissions before the first PTY spawn.
 */

import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { logger } from '../logger/logger.js';

let checked = false;

export function ensureSpawnHelperPermissions(): void {
  if (checked) return;
  checked = true;

  let ptyDir: string;
  try {
    const req = createRequire(import.meta.url);
    const ptyEntry = req.resolve('node-pty');
    ptyDir = dirname(ptyEntry);
  } catch {
    // node-pty not resolvable — nothing to fix
    return;
  }

  const prebuildsDir = join(ptyDir, '..', 'prebuilds');
  if (!existsSync(prebuildsDir)) {
    return;
  }

  for (const platform of readdirSync(prebuildsDir)) {
    const helperPath = join(prebuildsDir, platform, 'spawn-helper');
    if (!existsSync(helperPath)) continue;

    const st = statSync(helperPath);
    if (!(st.mode & 0o100)) {
      chmodSync(helperPath, st.mode | 0o111);
      logger.info({ path: helperPath }, 'Fixed spawn-helper: chmod +x');
    }
  }
}
