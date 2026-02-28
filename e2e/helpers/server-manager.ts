import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createConnection } from 'node:net';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const AUTH_TOKEN = 'e2e-test-token-fixed-value-1234567890';
const PORT = 3000;
const HOST = '127.0.0.1';

/**
 * Manages a test server instance per spec file.
 * Each spec calls start()/stop() in beforeAll/afterAll for session isolation.
 */
class ServerManager {
  private proc: ChildProcess | null = null;

  get url(): string {
    return `http://${HOST}:${PORT}`;
  }

  get token(): string {
    return AUTH_TOKEN;
  }

  async start(): Promise<void> {
    await this.ensurePortFree();

    const serverEntry = join(PROJECT_ROOT, 'backend/dist/index.js');
    if (!existsSync(serverEntry)) {
      throw new Error(`Server entry not found: ${serverEntry}. Did the build run?`);
    }

    const { CLAUDECODE, ...restEnv } = process.env;
    const serverEnv: NodeJS.ProcessEnv = {
      ...restEnv,
      PORT: String(PORT),
      HOST,
      AUTH_TOKEN,
      AUTH_RATE_LIMIT: '100',
      CLAUDE_COMMAND: 'claude',
      LOG_DIR: join(PROJECT_ROOT, 'logs/e2e'),
    };

    this.proc = spawn('node', [serverEntry], {
      cwd: PROJECT_ROOT,
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    await new Promise<void>((resolve, reject) => {
      let stderrBuf = '';
      const timeout = setTimeout(() => {
        this.proc?.kill();
        reject(new Error(`Server failed to start within 60s. stderr:\n${stderrBuf}`));
      }, 60_000);

      this.proc!.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuf += text;
        process.stderr.write(`[server] ${text}`);

        if (text.includes('Claude Code Remote Proxy Started')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.proc!.stdout?.on('data', (chunk: Buffer) => {
        process.stdout.write(`[server:stdout] ${chunk.toString()}`);
      });

      this.proc!.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Server process error: ${err.message}`));
      });

      this.proc!.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== null && code !== 0) {
          reject(new Error(`Server exited with code ${code}. stderr:\n${stderrBuf}`));
        }
      });
    });

    console.log(`[server-manager] Server started at ${this.url} (PID: ${this.proc.pid})`);
  }

  async stop(): Promise<void> {
    if (!this.proc?.pid) return;

    const pid = this.proc.pid;

    // SIGTERM to process group
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        this.proc = null;
        return;
      }
    }

    // Wait for exit (max 5s)
    for (let i = 0; i < 50; i++) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        console.log(`[server-manager] Server stopped (PID: ${pid})`);
        this.proc = null;
        return;
      }
    }

    // Force kill
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* already dead */
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    this.proc = null;
    console.log(`[server-manager] Server force-killed (PID: ${pid})`);
  }

  private async ensurePortFree(): Promise<void> {
    const inUse = await this.isPortInUse();
    if (!inUse) return;

    console.log(`[server-manager] Port ${PORT} is in use, freeing...`);
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
            /* ignore */
          }
        }
      }
    } catch {
      /* lsof not available or port not found */
    }

    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!(await this.isPortInUse())) {
        console.log(`[server-manager] Port ${PORT} is now free`);
        return;
      }
    }
    throw new Error(`Port ${PORT} still in use after cleanup`);
  }

  private isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ port: PORT, host: HOST }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
  }
}

export const serverManager = new ServerManager();
