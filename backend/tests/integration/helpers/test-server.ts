/**
 * Integration test helper: spins up a real HTTP server + WS + PTY + AuthModule + SessionController.
 * PTY runs `cat` instead of `claude` so stdin echoes to stdout.
 */
import { createServer, Server as HttpServer } from 'node:http';
import express, { Express } from 'express';
import { WebSocket } from 'ws';
import { AuthModule } from '../../../src/auth/auth-middleware.js';
import { PtyManager } from '../../../src/pty/pty-manager.js';
import { WsServer } from '../../../src/ws/ws-server.js';
import { HookReceiver } from '../../../src/hooks/hook-receiver.js';
import { SessionController } from '../../../src/session/session-controller.js';
import { createApiRouter } from '../../../src/api/router.js';
import { PushService } from '../../../src/push/push-service.js';

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
  ptyManager: PtyManager;
  wsServer: WsServer;
  hookReceiver: HookReceiver;
  sessionController: SessionController;
  pushService: PushService;
  baseUrl: string;
  port: number;
}

export interface TestServerOptions {
  rateLimitPerMinute?: number;
  sessionTtlMs?: number;
}

/**
 * Start a fully wired test server (HTTP + WS + PTY with `cat`).
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
    rateLimitPerMinute: options?.rateLimitPerMinute ?? 100, // High limit default; rate-limit tests pass lower values
    cookieName: 'session_id_test',
  });

  const hookReceiver = new HookReceiver();

  let sessionController: SessionController | null = null;
  const pushService = new PushService();

  app.use('/api', createApiRouter(authModule, hookReceiver, () => sessionController, pushService));

  const wsServer = new WsServer(httpServer, authModule);

  const ptyManager = new PtyManager();

  sessionController = new SessionController(ptyManager, wsServer, hookReceiver, 1000);

  // Spawn `cat` as the PTY process — it echoes stdin to stdout
  ptyManager.spawn({
    command: 'cat',
    args: [],
    cwd: '/tmp',
  });

  sessionController.setStatus('running');

  // Suppress PTY output from going to test runner's stdout
  // We do this by overriding process.stdout.write temporarily — but that's global.
  // Instead, we accept that SessionController writes to process.stdout in tests.
  // The logger is already silent in test mode.

  const baseUrl = `http://${host}:${port}`;

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve());
  });

  return {
    app,
    httpServer,
    authModule,
    ptyManager,
    wsServer,
    hookReceiver,
    sessionController: sessionController!,
    pushService,
    baseUrl,
    port,
  };
}

/**
 * Stop and clean up the test server.
 */
export async function stopTestServer(ctx: TestContext): Promise<void> {
  ctx.ptyManager.destroy();
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
  // Extract Set-Cookie header
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No Set-Cookie header in auth response');
  }
  // Return just the cookie key=value part (e.g. "session_id=abc123")
  return setCookie.split(';')[0];
}

interface BufferedWebSocket extends WebSocket {
  /** Messages received before caller attaches listeners. */
  __earlyMessages: Array<{ type: string; [key: string]: unknown }>;
}

/**
 * Open an authenticated WebSocket connection.
 * Captures messages from the moment of connection into `ws.__earlyMessages`
 * so callers don't miss fast server messages like `history_sync`.
 */
export async function openAuthenticatedWs(
  baseUrl: string,
  cookie: string,
): Promise<BufferedWebSocket> {
  const wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';
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
