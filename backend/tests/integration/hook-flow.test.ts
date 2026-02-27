import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type {
  ApprovalRequestMessage,
  StatusUpdateMessage,
  TerminalOutputMessage,
} from '@claude-remote/shared';
import {
  startTestServer,
  stopTestServer,
  authenticate,
  openAuthenticatedWs,
  waitForMessage,
  collectMessages,
  type TestContext,
} from './helpers/test-server.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Hook → Approval Flow', () => {
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

  // ─── Hook → Approval Request Broadcast ──────────────────────

  describe('hook triggers approval request', () => {
    it('should broadcast approval_request to connected WS client after hook POST', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Listen for approval_request
      const approvalPromise = waitForMessage<ApprovalRequestMessage>(ws, 'approval_request', 3000);

      // Send hook POST
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Claude wants to execute: rm -rf /tmp/test',
          tool_name: 'Bash',
          tool_input: { command: 'rm -rf /tmp/test' },
        }),
      });
      expect(hookRes.status).toBe(200);
      const hookBody = await hookRes.json();

      // Verify approval_request message received
      const approval = await approvalPromise;
      expect(approval.type).toBe('approval_request');
      expect(approval.approval.id).toBe(hookBody.approvalId);
      expect(approval.approval.tool).toBe('Bash');
      expect(approval.approval.description).toBe('Claude wants to execute: rm -rf /tmp/test');
      expect(approval.approval.params).toEqual({ command: 'rm -rf /tmp/test' });
    });

    it('should also broadcast status_update to waiting_approval', async () => {
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Listen for status_update
      const statusPromise = waitForMessage<StatusUpdateMessage>(ws, 'status_update', 3000);

      // Send hook POST
      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', tool_name: 'Write' }),
      });

      const status = await statusPromise;
      expect(status.type).toBe('status_update');
      expect(status.status).toBe('waiting_approval');
      expect(status.detail).toContain('Write');
    });

    it('should update session status to waiting_approval', async () => {
      // Ensure status is running first
      ctx.sessionController.setStatus('running');

      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test', tool_name: 'Bash' }),
      });

      expect(ctx.sessionController.status).toBe('waiting_approval');
      expect(ctx.sessionController.pendingApproval).not.toBeNull();
      expect(ctx.sessionController.pendingApproval!.tool).toBe('Bash');
    });

    it('should broadcast approval_request to multiple clients', async () => {
      ctx.sessionController.setStatus('running');

      const ws1 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const ws2 = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await Promise.all([
        waitForMessage(ws1, 'history_sync'),
        waitForMessage(ws2, 'history_sync'),
      ]);

      const p1 = waitForMessage<ApprovalRequestMessage>(ws1, 'approval_request', 3000);
      const p2 = waitForMessage<ApprovalRequestMessage>(ws2, 'approval_request', 3000);

      await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'broadcast test', tool_name: 'Read' }),
      });

      const [a1, a2] = await Promise.all([p1, p2]);
      expect(a1.approval.id).toBe(a2.approval.id);
      expect(a1.approval.tool).toBe('Read');
    });
  });

  // ─── Approval Response → PTY ────────────────────────────────

  describe('approval response writes to PTY', () => {
    it('should write "y" to PTY when approved', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Trigger approval request
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'approve test', tool_name: 'Bash' }),
      });
      const { approvalId } = await hookRes.json();
      await waitForMessage<ApprovalRequestMessage>(ws, 'approval_request');

      // Listen for terminal_output (PTY echo of 'y')
      const outputPromise = waitForMessage<TerminalOutputMessage>(ws, 'terminal_output', 3000);

      // Send approval
      ws.send(JSON.stringify({ type: 'approval_response', id: approvalId, approved: true }));

      // Should receive 'y' echoed from PTY (cat echoes stdin)
      const output = await outputPromise;
      expect(output.data).toContain('y');
    });

    it('should write ESC to PTY when rejected', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Trigger approval request
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'reject test', tool_name: 'Bash' }),
      });
      const { approvalId } = await hookRes.json();
      await waitForMessage<ApprovalRequestMessage>(ws, 'approval_request');

      // Send rejection
      ws.send(JSON.stringify({ type: 'approval_response', id: approvalId, approved: false }));

      // ESC (\x1b) is a control character, cat may or may not echo it visibly.
      // But the key behavior is: status should change back to running
      await delay(100);
      expect(ctx.sessionController.status).toBe('running');
      expect(ctx.sessionController.pendingApproval).toBeNull();
    });

    it('should broadcast status_update back to running after approval', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Trigger approval
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'status test', tool_name: 'Write' }),
      });
      const { approvalId } = await hookRes.json();

      // Drain the waiting_approval status_update and approval_request
      await waitForMessage<StatusUpdateMessage>(ws, 'status_update');
      await waitForMessage<ApprovalRequestMessage>(ws, 'approval_request');

      // Listen for the "running" status update after approval
      const statusPromise = waitForMessage<StatusUpdateMessage>(ws, 'status_update', 3000);

      // Approve
      ws.send(JSON.stringify({ type: 'approval_response', id: approvalId, approved: true }));

      const status = await statusPromise;
      expect(status.status).toBe('running');
    });

    it('should ignore approval response for unknown/stale request ID', async () => {
      ctx.sessionController.setStatus('running');

      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      await waitForMessage(ws, 'history_sync');

      // Send approval for a non-existent ID
      ws.send(JSON.stringify({ type: 'approval_response', id: 'nonexistent-id', approved: true }));

      // Should not crash, status should remain running
      await delay(100);
      expect(ctx.sessionController.status).toBe('running');
    });
  });

  // ─── Status via REST API during approval ────────────────────

  describe('status API reflects approval state', () => {
    it('should show waiting_approval status and pending approval in /api/status', async () => {
      ctx.sessionController.setStatus('running');

      // Trigger approval
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'status api test', tool_name: 'Edit' }),
      });
      const { approvalId } = await hookRes.json();

      // Check status API
      const statusRes = await fetch(`${ctx.baseUrl}/api/status`, {
        headers: { cookie },
      });
      const body = await statusRes.json();
      expect(body.status).toBe('waiting_approval');
      expect(body.pendingApproval).toBeTruthy();
      expect(body.pendingApproval.id).toBe(approvalId);
      expect(body.pendingApproval.tool).toBe('Edit');
    });
  });

  // ─── New client receives pending approval in history_sync ───

  describe('new connection receives pending approval', () => {
    it('should include pendingApproval in history_sync for new connections', async () => {
      ctx.sessionController.setStatus('running');

      // Trigger approval (no WS client connected to consume it)
      const hookRes = await fetch(`${ctx.baseUrl}/api/hook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'pending sync test', tool_name: 'Bash' }),
      });
      const { approvalId } = await hookRes.json();

      // New client connects
      const ws = trackWs(await openAuthenticatedWs(ctx.baseUrl, cookie));
      const history = await waitForMessage<{ type: string; pendingApproval?: { id: string; tool: string } }>(ws, 'history_sync');

      expect(history.pendingApproval).toBeTruthy();
      expect(history.pendingApproval!.id).toBe(approvalId);
      expect(history.pendingApproval!.tool).toBe('Bash');
    });
  });
});
