import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { restoreE2eHooks } from '../helpers/hooks-setup.js';

const PORT = 13000;
const HOST = '127.0.0.1';

function isPortInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port: PORT, host: HOST }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

/**
 * Safety-net teardown: restore hooks and kill any leftover server process on PORT.
 */
export default async function globalTeardown() {
  // Restore original Claude Code settings
  restoreE2eHooks();

  if (!(await isPortInUse())) {
    console.log('[e2e-teardown] Port is free, nothing to clean up.');
    return;
  }

  console.log(`[e2e-teardown] Port ${PORT} still in use, cleaning up...`);
  try {
    const output = execSync(`lsof -t -i :${PORT}`, { encoding: 'utf-8' }).trim();
    if (output) {
      const pid = parseInt(output.split('\n')[0], 10);
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          /* already dead */
        }
      }
      console.log(`[e2e-teardown] Killed leftover process ${pid}`);
    }
  } catch {
    /* lsof not available */
  }

  console.log('[e2e-teardown] Teardown complete.');
}
