import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createConnection } from 'node:net';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const STATE_FILE = resolve(import.meta.dirname, '../.server-state.json');
const AUTH_TOKEN = 'e2e-test-token-fixed-value-1234567890';
const PORT = 3456;
const HOST = '127.0.0.1';


interface ServerState {
  pid: number;
  url: string;
  token: string;
}

/**
 * Check if a port is in use
 */
function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

/**
 * Get PID of process listening on a port (macOS/Linux)
 */
function getPidOnPort(port: number): number | null {
  try {
    const output = execSync(`lsof -t -i :${port}`, { encoding: 'utf-8' }).trim();
    if (output) {
      return parseInt(output.split('\n')[0], 10);
    }
  } catch {
    // Port not in use or lsof not available
  }
  return null;
}

/**
 * Kill a process and all its children (process tree)
 */
function killProcessTree(pid: number): void {
  try {
    // Try to kill the whole process group using negative PID
    process.kill(-pid, 'SIGKILL');
    console.log(`[e2e-setup] Killed process tree ${pid}`);
  } catch {
    // Process group might not exist, try individual kill
    try {
      process.kill(pid, 'SIGKILL');
      console.log(`[e2e-setup] Killed process ${pid}`);
    } catch {
      // Already dead
    }
  }
}

/**
 * Ensure port is free, kill any process using it
 */
async function ensurePortFree(): Promise<void> {
  const inUse = await isPortInUse(PORT, HOST);
  if (!inUse) {
    return;
  }

  console.log(`[e2e-setup] Port ${PORT} is in use, attempting to free it...`);
  const pid = getPidOnPort(PORT);
  if (pid) {
    killProcessTree(pid);

    // Wait for port to be freed (max 5s)
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!(await isPortInUse(PORT, HOST))) {
        console.log(`[e2e-setup] Port ${PORT} is now free`);
        return;
      }
    }

    throw new Error(`Port ${PORT} still in use after killing process ${pid}`);
  }

  throw new Error(`Port ${PORT} is in use but could not find the process`);
}

function buildProject() {
  console.log('[e2e-setup] Building project...');
  execSync('pnpm build', { cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 120_000 });
  console.log('[e2e-setup] Build complete.');
}

function startServer(): Promise<{ proc: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const serverEntry = join(PROJECT_ROOT, 'backend/dist/index.js');
    if (!existsSync(serverEntry)) {
      reject(new Error(`Server entry not found: ${serverEntry}`));
      return;
    }

    // Create env, explicitly removing CLAUDECODE to allow nested Claude sessions
    const { CLAUDECODE, ...restEnv } = process.env;
    const serverEnv: NodeJS.ProcessEnv = {
      ...restEnv,
      PORT: String(PORT),
      HOST,
      AUTH_TOKEN,
      CLAUDE_COMMAND: 'claude',
      LOG_DIR: join(PROJECT_ROOT, 'logs/e2e'),
    };

    const proc = spawn('node', [serverEntry], {
      cwd: PROJECT_ROOT,
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true, // Create new process group for clean teardown
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
  // 0. Ensure port is free (clean up any leftover processes)
  await ensurePortFree();

  // 1. Build project
  buildProject();

  // 2. Start server
  const { proc, url } = await startServer();

  // 3. Save state for teardown and fixtures
  const state: ServerState = {
    pid: proc.pid!,
    url,
    token: AUTH_TOKEN,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  // 4. Set env vars for test fixtures
  process.env.E2E_SERVER_URL = url;
  process.env.E2E_AUTH_TOKEN = AUTH_TOKEN;

  console.log(`[e2e-setup] Server started at ${url} (PID: ${proc.pid})`);
}
