import { WebSocket } from 'ws';
import type { SessionStatus } from '@claude-remote/shared';
import { PtyManager } from '../pty/pty-manager.js';
import { OutputBuffer } from '../pty/output-buffer.js';
import { WsServer } from '../ws/ws-server.js';
import { HookReceiver, type HookNotification } from '../hooks/hook-receiver.js';
import { handleWsMessage } from '../ws/ws-handler.js';
import { logger } from '../logger/logger.js';
import type { PushService } from '../push/push-service.js';

/**
 * Core coordinator: wires PTY ↔ WebSocket ↔ Terminal ↔ Hooks.
 */
export class SessionController {
  private _status: SessionStatus = 'idle';
  private buffer: OutputBuffer;
  private pushService: PushService | null = null;

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

  get connectedClients(): number {
    return this.wsServer.clientCount;
  }

  /**
   * Inject PushService for hook-triggered notifications.
   */
  setPushService(pushService: PushService): void {
    this.pushService = pushService;
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
   * Wire WS messages → PTY input
   */
  private setupWsHandlers(): void {
    this.wsServer.onMessage((ws: WebSocket, data: string) => {
      handleWsMessage(ws, data, {
        onUserInput: (input: string) => {
          logger.debug({ length: input.length }, 'User input from mobile');
          this.ptyManager.write(input);
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
      });
    });
  }

  /**
   * Wire Hook notifications → status update + Push notification
   */
  private setupHookHandlers(): void {
    this.hookReceiver.on('notification', (notification: HookNotification) => {
      this._status = 'waiting_input';

      this.wsServer.broadcast({
        type: 'status_update',
        status: 'waiting_input',
        detail: `Waiting for input: ${notification.tool}`,
      });

      // Send push notification if service is available
      if (this.pushService) {
        this.pushService.notifyAll({
          title: 'Claude Code 需要输入',
          body: notification.message,
          tag: 'claude-input',
          renotify: true,
        }).catch((err) => {
          logger.error({ err }, 'Failed to send push notification');
        });
      }

      logger.info({ tool: notification.tool }, 'Hook notification processed, status set to waiting_input');
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
