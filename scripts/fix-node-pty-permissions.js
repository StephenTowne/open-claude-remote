/**
 * Fix node-pty spawn-helper missing execute permission.
 *
 * pnpm may strip the execute bit from prebuilt native binaries during install,
 * causing `posix_spawnp failed` at runtime. This script restores +x on all
 * spawn-helper binaries found under the node-pty prebuilds directory.
 */

import { createRequire } from 'node:module';
import { readdirSync, statSync, chmodSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let ptyDir;
try {
  const ptyEntry = require.resolve('node-pty');
  ptyDir = dirname(ptyEntry);
} catch {
  // node-pty not installed (e.g. optional dep), nothing to fix
  process.exit(0);
}

// prebuilds sits next to lib/
const prebuildsDir = join(ptyDir, '..', 'prebuilds');
if (!existsSync(prebuildsDir)) {
  console.log('[fix-node-pty] No prebuilds directory found, skipping');
  process.exit(0);
}

let fixed = 0;

for (const platform of readdirSync(prebuildsDir)) {
  const helperPath = join(prebuildsDir, platform, 'spawn-helper');
  if (!existsSync(helperPath)) continue;

  const st = statSync(helperPath);
  if (!(st.mode & 0o100)) {
    chmodSync(helperPath, st.mode | 0o111);
    fixed++;
    console.log(`[fix-node-pty] chmod +x ${helperPath}`);
  }
}

if (fixed === 0) {
  console.log('[fix-node-pty] spawn-helper permissions OK');
}
