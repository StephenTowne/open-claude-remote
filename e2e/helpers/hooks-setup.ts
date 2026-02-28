import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const SETTINGS_FILE = resolve(homedir(), '.claude/settings.json');
const BACKUP_FILE = resolve(homedir(), '.claude/settings.json.e2e-backup');

const E2E_HOOK = {
  matcher: 'permission_prompt',
  hooks: [
    {
      type: 'command',
      command: 'curl -s -X POST http://localhost:3000/api/hook -H \'Content-Type: application/json\' -d "$(cat)"',
    },
  ],
};

interface ClaudeSettings {
  hooks?: {
    Notification?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
  };
  [key: string]: unknown;
}

/**
 * Setup the Claude Code notification hook for E2E tests.
 * backs up existing settings and adds the permission_prompt hook.
 */
export function setupE2eHooks(): void {
  const settingsDir = dirname(SETTINGS_FILE);
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  let settings: ClaudeSettings = {};

  // Backup existing settings
  if (existsSync(SETTINGS_FILE)) {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    try {
      settings = JSON.parse(content);
    } catch {
      console.warn('[hooks-setup] Existing settings.json is not valid JSON, will overwrite');
    }
    writeFileSync(BACKUP_FILE, content, 'utf-8');
    console.log('[hooks-setup] Backed up existing settings to', BACKUP_FILE);
  }

  // Check if hook is already configured
  const existingNotification = settings.hooks?.Notification?.find(
    (n) => n.matcher === 'permission_prompt'
  );

  if (existingNotification) {
    // Check if our E2E hook command is already there
    const hasE2eHook = existingNotification.hooks.some(
      (h) => h.command?.includes('/api/hook')
    );
    if (hasE2eHook) {
      console.log('[hooks-setup] E2E hook already configured, skipping');
      return;
    }
    // Add our hook to existing matcher
    existingNotification.hooks.push(E2E_HOOK.hooks[0]);
  } else {
    // Add new Notification entry
    settings.hooks = settings.hooks || {};
    settings.hooks.Notification = settings.hooks.Notification || [];
    settings.hooks.Notification.push(E2E_HOOK);
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  console.log('[hooks-setup] Configured permission_prompt hook for E2E tests');
}

/**
 * Restore original Claude Code settings after E2E tests.
 */
export function restoreE2eHooks(): void {
  if (existsSync(BACKUP_FILE)) {
    const backupContent = readFileSync(BACKUP_FILE, 'utf-8');
    writeFileSync(SETTINGS_FILE, backupContent, 'utf-8');
    console.log('[hooks-setup] Restored original settings from backup');
  } else if (existsSync(SETTINGS_FILE)) {
    // If no backup exists but settings.json does, try to remove our hook
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    try {
      const settings: ClaudeSettings = JSON.parse(content);
      if (settings.hooks?.Notification) {
        settings.hooks.Notification = settings.hooks.Notification
          .map((n) => {
            if (n.matcher === 'permission_prompt') {
              return {
                ...n,
                hooks: n.hooks.filter(
                  (h) => !h.command?.includes('/api/hook')
                ),
              };
            }
            return n;
          })
          .filter((n) => n.hooks.length > 0);

        if (settings.hooks.Notification.length === 0) {
          delete settings.hooks.Notification;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }
      writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
      console.log('[hooks-setup] Removed E2E hook from settings');
    } catch {
      console.warn('[hooks-setup] Could not parse settings.json to remove hook');
    }
  }
}