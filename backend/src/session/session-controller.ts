import { WebSocket } from 'ws';
import type { ApprovalRequest, SessionStatus } from '@claude-remote/shared';
import { PtyManager } from '../pty/pty-manager.js';
import { OutputBuffer } from '../pty/output-buffer.js';
import { WsServer } from '../ws/ws-server.js';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { handleWsMessage } from '../ws/ws-handler.js';
import { logger } from '../logger/logger.js';

/**
 * Core coordinator: wires PTY ↔ WebSocket ↔ Terminal ↔ Hooks.
 */
export class SessionController {
  private _status: SessionStatus = 'idle';
  private _pendingApproval: ApprovalRequest | null = null;
  private buffer: OutputBuffer;

  constructor(
    private ptyManager: PtyManager,
    private wsServer: WsServer,
    private hookReceiver: HookReceiver,
    maxBufferLines: number,
  ) {
    this.buffer = new OutputBuffer(maxBufferLines);
    this.setupPtyHandlers();
    this.setupWsHandlers();
    this.setupHookHandlers();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get pendingApproval(): ApprovalRequest | null {
    return this._pendingApproval;
  }

  get connectedClients(): number {
    return this.wsServer.clientCount;
  }

  /**
   * Wire PTY output → buffer + WS broadcast + process.stdout
   */
  private setupPtyHandlers(): void {
    this.ptyManager.on('data', (data: string) => {
      // Buffer for reconnection
      this.buffer.append(data);

      // Write to PC terminal
      process.stdout.write(data);

      // Broadcast to mobile clients
      this.wsServer.broadcast({
        type: 'terminal_output',
        data,
        seq: this.buffer.sequenceNumber,
      });
    });

    this.ptyManager.on('exit', (exitCode: number) => {
      this._status = 'idle';
      this.wsServer.broadcast({
        type: 'session_ended',
        exitCode,
        reason: exitCode === 0 ? 'Process exited normally' : `Process exited with code ${exitCode}`,
      });
      logger.info({ exitCode }, 'Claude Code session ended');
    });

    this.ptyManager.on('error', (err: Error) => {
      logger.error({ err }, 'PTY error');
      this.wsServer.broadcast({
        type: 'error',
        code: 'pty_error',
        message: err.message,
      });
    });
  }

  /**
   * Wire WS messages → PTY / approval responses
   */
  private setupWsHandlers(): void {
    this.wsServer.onMessage((ws: WebSocket, data: string) => {
      handleWsMessage(ws, data, {
        onUserInput: (input: string) => {
          logger.debug({ length: input.length }, 'User input from mobile');
          this.ptyManager.write(input);
        },
        onApprovalResponse: (id: string, approved: boolean) => {
          this.handleApprovalResponse(id, approved);
        },
        onResize: (_cols: number, _rows: number) => {
          // PTY size follows PC terminal, ignore mobile resize
          logger.debug('Mobile resize ignored (PTY follows PC terminal)');
        },
      });
    });

    // Send history sync on new connection
    this.wsServer.onConnect((ws: WebSocket) => {
      this.wsServer.sendTo(ws, {
        type: 'history_sync',
        data: this.buffer.getFullContent(),
        seq: this.buffer.sequenceNumber,
        status: this._status,
        pendingApproval: this._pendingApproval ?? undefined,
      });
    });
  }

  /**
   * Wire Hook notifications → approval requests → WS broadcast
   */
  private setupHookHandlers(): void {
    this.hookReceiver.on('approval', (approval: ApprovalRequest) => {
      this._pendingApproval = approval;
      this._status = 'waiting_approval';

      this.wsServer.broadcast({
        type: 'status_update',
        status: 'waiting_approval',
        detail: `Waiting for approval: ${approval.tool}`,
      });

      this.wsServer.broadcast({
        type: 'approval_request',
        approval,
      });

      logger.info({ approvalId: approval.id, tool: approval.tool }, 'Approval request broadcast to clients');
    });
  }

  /**
   * Handle approval response from mobile client.
   */
  private handleApprovalResponse(id: string, approved: boolean): void {
    if (!this._pendingApproval || this._pendingApproval.id !== id) {
      logger.warn({ id }, 'Approval response for unknown/stale request');
      return;
    }

    logger.info({ id, approved }, 'Processing approval response');

    if (approved) {
      // Write 'y' to PTY to approve
      this.ptyManager.write('y');
    } else {
      // Write Escape to reject
      this.ptyManager.write('\x1b');
    }

    this._pendingApproval = null;
    this._status = 'running';

    this.wsServer.broadcast({
      type: 'status_update',
      status: 'running',
      detail: approved ? 'Approved' : 'Rejected',
    });
  }

  /**
   * Update session status.
   */
  setStatus(status: SessionStatus): void {
    this._status = status;
    this.wsServer.broadcast({ type: 'status_update', status });
  }
}
