import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const STATE_FILE = resolve(import.meta.dirname, '../.server-state.json');
const AUTH_TOKEN = 'e2e-test-token-fixed-value-1234567890';
const PORT = 3456;
const HOST = '127.0.0.1';

// Claude settings paths
const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
const SETTINGS_BACKUP = join(CLAUDE_DIR, 'settings.json.e2e-backup');

interface ServerState {
  pid: number;
  url: string;
  token: string;
  settingsBackedUp: boolean;
}

function buildProject() {
  console.log('[e2e-setup] Building project...');
  execSync('pnpm build', { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 120_000 });
  console.log('[e2e-setup] Build complete.');
}

function setupClaudeSettings(): boolean {
  let backedUp = false;

  // Ensure ~/.claude directory exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  // Backup existing settings
  if (existsSync(SETTINGS_FILE)) {
    copyFileSync(SETTINGS_FILE, SETTINGS_BACKUP);
    backedUp = true;
    console.log('[e2e-setup] Backed up existing Claude settings.');
  }

  // Write settings with notification hook pointing to our test server
  const settings = existsSync(SETTINGS_FILE)
    ? JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
    : {};

  // Add hook for PreToolUse notifications
  settings.hooks = {
    ...settings.hooks,
    PreToolUse: [
      ...(settings.hooks?.PreToolUse ?? []).filter(
        (h: { type?: string; url?: string }) => h.url !== `http://${HOST}:${PORT}/api/hook`
      ),
      {
        type: 'url',
        url: `http://${HOST}:${PORT}/api/hook`,
      },
    ],
  };

  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  console.log('[e2e-setup] Claude settings configured with hook.');
  return backedUp;
}

function startServer(): Promise<{ proc: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const serverEntry = join(PROJECT_ROOT, 'backend/dist/index.js');
    if (!existsSync(serverEntry)) {
      reject(new Error(`Server entry not found: ${serverEntry}`));
      return;
    }

    const proc = spawn('node', [serverEntry], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOST,
        AUTH_TOKEN,
        CLAUDE_COMMAND: 'claude',
        LOG_DIR: join(PROJECT_ROOT, 'e2e/logs'),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrBuf = '';
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`Server failed to start within 60s. stderr:\n${stderrBuf}`));
    }, 60_000);

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuf += text;
      process.stderr.write(`[server] ${text}`);

      if (text.includes('Claude Code Remote Proxy Started')) {
        clearTimeout(timeout);
        const url = `http://${HOST}:${PORT}`;
        resolve({ proc, url });
      }
    });

    proc.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(`[server:stdout] ${chunk.toString()}`);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Server process error: ${err.message}`));
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(new Error(`Server exited with code ${code}. stderr:\n${stderrBuf}`));
      }
    });
  });
}

export default async function globalSetup() {
  // 1. Build project
  buildProject();

  // 2. Setup Claude settings with hooks
  const settingsBackedUp = setupClaudeSettings();

  // 3. Start server
  const { proc, url } = await startServer();

  // 4. Save state for teardown and fixtures
  const state: ServerState = {
    pid: proc.pid!,
    url,
    token: AUTH_TOKEN,
    settingsBackedUp,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  // 5. Set env vars for test fixtures
  process.env.E2E_SERVER_URL = url;
  process.env.E2E_AUTH_TOKEN = AUTH_TOKEN;

  console.log(`[e2e-setup] Server started at ${url} (PID: ${proc.pid})`);
}
