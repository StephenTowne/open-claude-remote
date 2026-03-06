import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type {
  StatusUpdateMessage,
} from '#shared';
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

describe('Hook → Notification Flow', () => {
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

  // ─── Hook → Status Update ──────────────────────

  describe('hook triggers status update', () => {
    it('should broadcast status_update to waiting_input after Notification hook POST', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Listen for status_update
      const statusPromise = waitForMessage<StatusUpdateMessage>(ws, 'status_update', 3000);

      // Send Notification hook POST (permission_prompt)
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Notification',
          message: 'Claude needs your permission to use Write',
          notification_type: 'permission_prompt',
        }),
      });

      const status = await statusPromise;
      expect(status.type).toBe('status_update');
      expect(status.status).toBe('waiting_input');
      expect(status.detail).toContain('Write');
    });

    it('should update session status to waiting_input from Notification permission_prompt', async () => {
      ctx.sessionController.setStatus('running');

      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Notification',
          message: 'Claude needs your permission to use Bash',
          notification_type: 'permission_prompt',
        }),
      });

      expect(ctx.sessionController.status).toBe('waiting_input');
    });

    it('should broadcast status_update to multiple clients', async () => {
      ctx.sessionController.setStatus('running');

      const ws1 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const ws2 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await Promise.all([
        waitForMessage(ws1, 'history_sync'),
        waitForMessage(ws2, 'history_sync'),
      ]);

      const p1 = waitForMessage<StatusUpdateMessage>(ws1, 'status_update', 3000);
      const p2 = waitForMessage<StatusUpdateMessage>(ws2, 'status_update', 3000);

      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Notification',
          message: 'broadcast test',
          notification_type: 'permission_prompt',
        }),
      });

      const [s1, s2] = await Promise.all([p1, p2]);
      expect(s1.status).toBe('waiting_input');
      expect(s2.status).toBe('waiting_input');
    });
  });

  // ─── User Input via WS → PTY ────────────────────────────────

  describe('user input writes to PTY', () => {
    it('should write user input to PTY and receive echo', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      const outputPromise = waitForMessage<{ type: string; data: string }>(ws, 'terminal_output', 3000);

      // Send user input (the PTY runs `cat`, which echoes input)
      ws.send(JSON.stringify({ type: 'user_input', data: 'hello-test\n' }));

      const output = await outputPromise;
      expect(output.type).toBe('terminal_output');
      expect(output.data).toContain('hello-test');
    });
  });

  // ─── Status via REST API during waiting_input ────────────────────

  describe('status API reflects waiting_input state', () => {
    it('should show waiting_input status in /api/status after Notification permission_prompt', async () => {
      ctx.sessionController.setStatus('running');

      // Trigger Notification permission_prompt
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Notification',
          message: 'Claude needs your permission to use Edit',
          notification_type: 'permission_prompt',
        }),
      });

      // Check status API
      const statusRes = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie },
      });
      const body = await statusRes.json();
      expect(body.status).toBe('waiting_input');
    });
  });

  // ─── History sync for new connection ───

  describe('new connection receives correct status', () => {
    it('should include waiting_input status in history_sync for new connections', async () => {
      ctx.sessionController.setStatus('running');

      // Trigger notification via Notification event
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Notification',
          message: 'pending sync test',
          notification_type: 'idle_prompt',
        }),
      });

      // New client connects
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const history = await waitForMessage<{ type: string; status: string }>(ws, 'history_sync');

      expect(history.status).toBe('waiting_input');
    });
  });

  // ─── Stop event → task_completed ────────────────────────────────

  describe('Stop event handling', () => {
    it('should resume running status after Stop event when previously waiting_input', async () => {
      ctx.sessionController.setStatus('waiting_input');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Listen for status_update
      const statusPromise = waitForMessage<StatusUpdateMessage>(ws, 'status_update', 3000);

      // Send Stop hook POST
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Stop',
          stop_hook_active: false,
        }),
      });

      const status = await statusPromise;
      expect(status.type).toBe('status_update');
      expect(status.status).toBe('running');
    });

    it('should not change status on Stop when not waiting_input', async () => {
      ctx.sessionController.setStatus('idle');

      // Send Stop hook POST
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'Stop',
          stop_hook_active: false,
        }),
      });

      // Status should remain idle
      expect(ctx.sessionController.status).toBe('idle');
    });
  });
});