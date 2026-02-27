import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const STATE_FILE = resolve(import.meta.dirname, '../.server-state.json');

interface ServerState {
  pid: number;
  url: string;
  token: string;
}

async function killProcessTree(pid: number): Promise<void> {
  // Check if process exists
  try {
    process.kill(pid, 0);
  } catch {
    console.log(`[e2e-teardown] Process ${pid} already exited.`);
    return;
  }

  // Try to kill the whole process group first (negative PID)
  try {
    process.kill(-pid, 'SIGTERM');
    console.log(`[e2e-teardown] Sent SIGTERM to process tree ${pid}`);
  } catch {
    // Process group might not exist, fallback to single process
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[e2e-teardown] Sent SIGTERM to PID ${pid}`);
    } catch {
      console.log(`[e2e-teardown] Process ${pid} already exited.`);
      return;
    }
  }

  // Wait for process to terminate (poll every 100ms, max 5s)
  const maxWait = 5000;
  const interval = 100;
  let waited = 0;

  while (waited < maxWait) {
    try {
      process.kill(pid, 0);
      // Process still exists, wait more
      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    } catch {
      // Process has terminated
      console.log(`[e2e-teardown] Process ${pid} terminated after ${waited}ms`);
      return;
    }
  }

  // Process still running after 5s, force kill the whole tree
  try {
    process.kill(-pid, 'SIGKILL');
    console.log(`[e2e-teardown] Sent SIGKILL to process tree ${pid}`);
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
      console.log(`[e2e-teardown] Sent SIGKILL to PID ${pid}`);
    } catch {
      // Already dead
    }
  }
  // Wait a bit for SIGKILL to take effect
  await new Promise((r) => setTimeout(r, 500));
}

export default async function globalTeardown() {
  // 1. Read state
  if (!existsSync(STATE_FILE)) {
    console.log('[e2e-teardown] No server state file found, skipping.');
    return;
  }

  let state: ServerState;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    console.warn('[e2e-teardown] Failed to parse server state file.');
    return;
  }

  // 2. Kill server process tree and wait for termination
  await killProcessTree(state.pid);

  // 3. Clean up state file
  try {
    unlinkSync(STATE_FILE);
  } catch {
    // ignore
  }

  console.log('[e2e-teardown] Teardown complete.');
}
