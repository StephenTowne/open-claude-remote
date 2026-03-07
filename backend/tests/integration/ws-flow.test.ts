import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { HistorySyncMessage, TerminalOutputMessage } from '#shared';
import {
  startTestServer,
  stopTestServer,
  authenticate,
  openAuthenticatedWs,
  waitForMessage,
  type TestContext,
} from './helpers/test-server.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('WebSocket Flow', () => {
  let ctx: TestContext;
  let cookie: string;
  const openSockets: WebSocket[] = [];

  beforeAll(async () => {
    ctx = await startTestServer();
    cookie = await authenticate(ctx.baseUrl);
  });

  afterEach(() => {
    for (const ws of openSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    openSockets.length = 0;
  });

  afterAll(async () => {
    await stopTestServer(ctx);
  });

  function trackWs(ws: WebSocket): WebSocket {
    openSockets.push(ws);
    return ws;
  }

  // ─── WS Upgrade Authentication ──────────────────────────────

  describe('upgrade authentication', () => {
    it('should reject WS upgrade without session cookie', async () => {
      const wsUrl = ctx.baseUrl.replace('http://', 'ws://') + `/ws/${ctx.instanceId}`;
      const ws = new WebSocket(wsUrl);
      trackWs(ws);

      await new Promise<void>((resolve, reject) => {
        ws.on('error', () => resolve()); // Expected: connection error
        ws.on('open', () => reject(new Error('Should not have opened')));
        setTimeout(() => resolve(), 2000);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });

    it('should reject WS upgrade with invalid session cookie', async () => {
      const wsUrl = ctx.baseUrl.replace('http://', 'ws://') + `/ws/${ctx.instanceId}`;
      const ws = new WebSocket(wsUrl, {
        headers: { cookie: 'session_id_test=invalid-session-id' },
      });
      trackWs(ws);

      await new Promise<void>((resolve, reject) => {
        ws.on('error', () => resolve());
        ws.on('open', () => reject(new Error('Should not have opened')));
        setTimeout(() => resolve(), 2000);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });

    it('should accept WS upgrade with valid session cookie', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should reject WS upgrade on non-/ws path', async () => {
      const wsUrl = ctx.baseUrl.replace('http://', 'ws://') + '/other-path';
      const ws = new WebSocket(wsUrl, {
        headers: { cookie },
      });
      trackWs(ws);

      await new Promise<void>((resolve) => {
        ws.on('error', () => resolve());
        ws.on('close', () => resolve());
        ws.on('open', () => resolve());
        setTimeout(() => resolve(), 2000);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });

    it('should reject WS upgrade for non-existent instance', async () => {
      const wsUrl = ctx.baseUrl.replace('http://', 'ws://') + '/ws/non-existent-id';
      const ws = new WebSocket(wsUrl, {
        headers: { cookie },
      });
      trackWs(ws);

      await new Promise<void>((resolve) => {
        ws.on('error', () => resolve());
        ws.on('close', () => resolve());
        setTimeout(() => resolve(), 2000);
      });

      expect(ws.readyState).not.toBe(WebSocket.OPEN);
    });
  });

  // ─── History Sync on Connect ────────────────────────────────

  describe('history sync on connect', () => {
    it('should receive history_sync as the first message on connect', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const msg = await waitForMessage<HistorySyncMessage>(ws, 'history_sync');

      expect(msg.type).toBe('history_sync');
      expect(typeof msg.data).toBe('string');
      expect(typeof msg.seq).toBe('number');
      expect(msg.status).toBe('running');
    });

    it('should include buffered content in history_sync after PTY output', async () => {
      ctx.ptyManager.write('hello-ws-test\n');
      await delay(100);

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const msg = await waitForMessage<HistorySyncMessage>(ws, 'history_sync');

      expect(msg.data).toContain('hello-ws-test');
    });
  });

  // ─── User Input → PTY → Terminal Output ─────────────────────

  describe('user input → PTY echo → terminal_output', () => {
    it('should echo user input through PTY back as terminal_output', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      const testInput = `echo-test-${Date.now()}\n`;
      ws.send(JSON.stringify({ type: 'user_input', data: testInput }));

      const output = await waitForMessage<TerminalOutputMessage>(ws, 'terminal_output', 3000);
      expect(output.type).toBe('terminal_output');
      expect(typeof output.data).toBe('string');
      expect(typeof output.seq).toBe('number');
      expect(output.data).toContain('echo-test-');
    });

    it('should broadcast PTY output to multiple connected clients', async () => {
      const ws1 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const ws2 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));

      await Promise.all([
        waitForMessage(ws1, 'history_sync'),
        waitForMessage(ws2, 'history_sync'),
      ]);

      const marker = `broadcast-${Date.now()}`;

      const p1 = waitForMessage<TerminalOutputMessage>(ws1, 'terminal_output', 3000);
      const p2 = waitForMessage<TerminalOutputMessage>(ws2, 'terminal_output', 3000);

      ws1.send(JSON.stringify({ type: 'user_input', data: `${marker}\n` }));

      const [out1, out2] = await Promise.all([p1, p2]);
      expect(out1.data).toContain(marker);
      expect(out2.data).toContain(marker);
    });
  });

  // ─── Heartbeat ──────────────────────────────────────────────

  describe('heartbeat', () => {
    it('should respond to client heartbeat with server heartbeat', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      const clientTs = Date.now();
      ws.send(JSON.stringify({ type: 'heartbeat', timestamp: clientTs }));

      const response = await waitForMessage<{ type: string; timestamp: number }>(ws, 'heartbeat', 2000);
      expect(response.type).toBe('heartbeat');
      expect(typeof response.timestamp).toBe('number');
      expect(response.timestamp).toBeGreaterThanOrEqual(clientTs - 1000);
      expect(response.timestamp).toBeLessThanOrEqual(clientTs + 5000);
    });
  });

  // ─── Reconnection Recovery ──────────────────────────────────

  describe('reconnection recovery', () => {
    it('should restore full buffer on reconnect', async () => {
      const ws1 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws1, 'history_sync');

      const reconnectMarker = `reconnect-${Date.now()}`;
      ws1.send(JSON.stringify({ type: 'user_input', data: `${reconnectMarker}\n` }));
      await waitForMessage<TerminalOutputMessage>(ws1, 'terminal_output', 3000);

      ws1.close();
      await delay(100);

      const ws2 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const history = await waitForMessage<HistorySyncMessage>(ws2, 'history_sync');

      expect(history.data).toContain(reconnectMarker);
      expect(history.status).toBe('running');
    });
  });

  // ─── Connection Management ──────────────────────────────────

  describe('connection management', () => {
    it('should track connected client count', async () => {
      await delay(200);
      const initialCount = ctx.instanceSession.clientCount;

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');
      await delay(50);

      expect(ctx.instanceSession.clientCount).toBe(initialCount + 1);

      ws.close();
      await delay(200);

      expect(ctx.instanceSession.clientCount).toBe(initialCount);
    });
  });
});
