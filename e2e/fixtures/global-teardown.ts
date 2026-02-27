import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const STATE_FILE = resolve(import.meta.dirname, '../.server-state.json');
const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
const SETTINGS_BACKUP = join(CLAUDE_DIR, 'settings.json.e2e-backup');

interface ServerState {
  pid: number;
  url: string;
  token: string;
  settingsBackedUp: boolean;
}

function killProcess(pid: number) {
  try {
    // Send SIGTERM first
    process.kill(pid, 'SIGTERM');
    console.log(`[e2e-teardown] Sent SIGTERM to PID ${pid}`);

    // Give it 3s then force kill
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
        console.log(`[e2e-teardown] Sent SIGKILL to PID ${pid}`);
      } catch {
        // Already dead, that's fine
      }
    }, 3000);
  } catch {
    console.log(`[e2e-teardown] Process ${pid} already exited.`);
  }
}

function restoreClaudeSettings(backedUp: boolean) {
  if (backedUp && existsSync(SETTINGS_BACKUP)) {
    copyFileSync(SETTINGS_BACKUP, SETTINGS_FILE);
    unlinkSync(SETTINGS_BACKUP);
    console.log('[e2e-teardown] Restored Claude settings from backup.');
  } else if (!backedUp && existsSync(SETTINGS_FILE)) {
    // We created settings that didn't exist before — remove the hook we added
    try {
      const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
      if (settings.hooks?.PreToolUse) {
        settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
          (h: { url?: string }) => !h.url?.includes(':3456/api/hook')
        );
        if (settings.hooks.PreToolUse.length === 0) {
          delete settings.hooks.PreToolUse;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }
      writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      console.log('[e2e-teardown] Cleaned hook entries from Claude settings.');
    } catch (err) {
      console.warn('[e2e-teardown] Failed to clean settings:', err);
    }
  }
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

  // 2. Kill server process
  killProcess(state.pid);

  // 3. Restore Claude settings
  restoreClaudeSettings(state.settingsBackedUp);

  // 4. Clean up state file
  try {
    unlinkSync(STATE_FILE);
  } catch {
    // ignore
  }

  console.log('[e2e-teardown] Teardown complete.');
}
