/**
 * Integration test helper: spins up a real HTTP server + WS + InstanceManager with EchoPty.
 * EchoPtyManager simulates `cat` echo without depending on node-pty (which may fail in CI/sandbox).
 */
import { createServer, Server as HttpServer } from 'node:http';
import { EventEmitter } from 'node:events';
import express, { Express } from 'express';
import { WebSocket } from 'ws';
import { AuthModule } from '../../../src/auth/auth-middleware.js';
import type { PtyManager } from '../../../src/pty/pty-manager.js';
import { WsServer } from '../../../src/ws/ws-server.js';
import { InstanceManager } from '../../../src/instance/instance-manager.js';
import { InstanceSession } from '../../../src/instance/instance-session.js';
import { createApiRouter } from '../../../src/api/router.js';
import { PushService } from '../../../src/push/push-service.js';

/**
 * Simulates a PTY running `cat`: write() echoes data back via 'data' event.
 * Replaces real node-pty to avoid posix_spawnp failures in sandboxed/CI environments.
 */
class EchoPtyManager extends EventEmitter {
  private _cols = 80;
  private _rows = 24;
  private _exited = false;

  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }
  get exited(): boolean { return this._exited; }

  spawn(): void {
    // No-op — echo is handled in write()
  }

  write(data: string): void {
    if (this._exited) return;
    // Simulate PTY echo asynchronously (like real PTY kernel echo)
    setImmediate(() => this.emit('data', data));
  }

  resize(cols: number, rows: number): void {
    if (this._exited) return;
    if (cols === this._cols && rows === this._rows) return;
    this._cols = cols;
    this._rows = rows;
    this.emit('resize', cols, rows);
  }

  destroy(): void {
    if (this._exited) return;
    this._exited = true;
    this.emit('exit', 0);
  }
}

export const TEST_TOKEN = 'integration-test-token-abcdef1234567890';

/** Allocate a random ephemeral port to avoid collisions across parallel test workers. */
function allocatePort(): number {
  // Use random port in range 20000-29999
  return 20_000 + Math.floor(Math.random() * 10_000);
}

export interface TestContext {
  app: Express;
  httpServer: HttpServer;
  authModule: AuthModule;
  ptyManager: EchoPtyManager;
  wsServer: WsServer;
  instanceManager: InstanceManager;
  instanceSession: InstanceSession;
  instanceId: string;
  pushService: PushService;
  baseUrl: string;
  port: number;
}

export interface TestServerOptions {
  rateLimitPerMinute?: number;
  sessionTtlMs?: number;
}

/**
 * Start a fully wired test server (HTTP + WS + InstanceManager with echo PTY).
 * Each call allocates a unique port to allow parallel test files.
 */
export async function startTestServer(options?: TestServerOptions): Promise<TestContext> {
  const port = allocatePort();
  const host = '127.0.0.1';

  const app = express();
  app.use(express.json());
  // Trust proxy so req.ip works correctly for localhost tests
  app.set('trust proxy', true);

  const httpServer = createServer(app);

  const authModule = new AuthModule({
    token: TEST_TOKEN,
    sessionTtlMs: options?.sessionTtlMs ?? 60_000, // 1 minute default for tests
    rateLimitPerMinute: options?.rateLimitPerMinute ?? 100,
    cookieName: 'session_id_test',
  });

  const instanceManager = new InstanceManager();
  const pushService = new PushService('/tmp/test-push-integration');

  // Mount API routes
  app.use('/api', createApiRouter({
    authModule,
    instanceManager,
    pushService,
  }));

  // Setup WS server with instance routing
  const wsServer = new WsServer(httpServer, authModule);
  wsServer.setInstanceManager(instanceManager);

  // Create a test instance with injected echo PTY
  const echoPty = new EchoPtyManager();
  const instanceSession = new InstanceSession({
    instanceId: 'test-instance-id',
    name: 'test-instance',
    cwd: '/tmp/test',
    maxBufferLines: 1000,
    headless: false,
    ptyManager: echoPty as unknown as PtyManager,
  });

  instanceSession.setStatus('running');

  // Register in instance manager
  (instanceManager as any).instances.set('test-instance-id', instanceSession);

  const baseUrl = `http://${host}:${port}`;

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve());
  });

  return {
    app,
    httpServer,
    authModule,
    ptyManager: echoPty,
    wsServer,
    instanceManager,
    instanceSession,
    instanceId: 'test-instance-id',
    pushService,
    baseUrl,
    port,
  };
}

/**
 * Stop and clean up the test server.
 */
export async function stopTestServer(ctx: TestContext): Promise<void> {
  ctx.instanceManager.destroyAll();
  ctx.wsServer.destroy();
  ctx.authModule.destroy();
  await new Promise<void>((resolve) => {
    ctx.httpServer.close(() => resolve());
  });
}

/**
 * Authenticate and return the session cookie string for subsequent requests.
 */
export async function authenticate(baseUrl: string, token: string = TEST_TOKEN): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No Set-Cookie header in auth response');
  }
  return setCookie.split(';')[0];
}

interface BufferedWebSocket extends WebSocket {
  /** Messages received before caller attaches listeners. */
  __earlyMessages: Array<{ type: string; [key: string]: unknown }>;
}

/**
 * Open an authenticated WebSocket connection to a specific instance.
 */
export async function openAuthenticatedWs(
  baseUrl: string,
  cookie: string,
  instanceId: string = 'test-instance-id',
): Promise<BufferedWebSocket> {
  const wsUrl = baseUrl.replace('http://', 'ws://') + `/ws/${instanceId}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: { cookie },
    }) as BufferedWebSocket;

    ws.__earlyMessages = [];

    // Start capturing immediately (before 'open' fires)
    ws.on('message', (raw: Buffer | string) => {
      try {
        ws.__earlyMessages.push(JSON.parse(raw.toString()));
      } catch {
        // ignore non-JSON
      }
    });

    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('WS connect timeout')), 5000);
  });
}

/**
 * Wait for a WS message of the given type. Returns the parsed message.
 * Checks the early message buffer first (for messages arrived before listener attached).
 */
export function waitForMessage<T extends { type: string }>(
  ws: WebSocket | BufferedWebSocket,
  type: string,
  timeoutMs: number = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Check early buffer first
    const buffered = (ws as BufferedWebSocket).__earlyMessages;
    if (buffered) {
      const idx = buffered.findIndex((m) => m.type === type);
      if (idx !== -1) {
        const msg = buffered.splice(idx, 1)[0];
        resolve(msg as T);
        return;
      }
    }

    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for WS message type="${type}"`));
    }, timeoutMs);

    function handler(raw: Buffer | string) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg as T);
      }
    }
    ws.on('message', handler);
  });
}

/**
 * Collect all WS messages received within a time window.
 */
export function collectMessages(ws: WebSocket, durationMs: number): Promise<Array<{ type: string; [key: string]: unknown }>> {
  return new Promise((resolve) => {
    const messages: Array<{ type: string; [key: string]: unknown }> = [];
    function handler(raw: Buffer | string) {
      messages.push(JSON.parse(raw.toString()));
    }
    ws.on('message', handler);
    setTimeout(() => {
      ws.off('message', handler);
      resolve(messages);
    }, durationMs);
  });
}
