import { WebSocket } from 'ws';
import type { SessionStatus, Question } from '@claude-remote/shared';
import { PtyManager } from '../pty/pty-manager.js';
import { OutputBuffer } from '../pty/output-buffer.js';
import { WsServer } from '../ws/ws-server.js';
import { HookReceiver, type HookNotification, type PermissionRequestEvent } from '../hooks/hook-receiver.js';
import { handleWsMessage } from '../ws/ws-handler.js';
import { logger } from '../logger/logger.js';
import type { PushService } from '../push/push-service.js';

const WS_FLUSH_INTERVAL_MS = 16;
const WS_MAX_CHUNK_BYTES = 32 * 1024;
const WS_HIGH_WATERMARK_BYTES = 256 * 1024;

/**
 * Core coordinator: wires PTY ↔ WebSocket ↔ Terminal ↔ Hooks.
 */
export class SessionController {
  private _status: SessionStatus = 'idle';
  private buffer: OutputBuffer;
  private pushService: PushService | null = null;

  private wsPendingChunks: string[] = [];
  private wsPendingBytes = 0;
  private wsFlushTimer: NodeJS.Timeout | null = null;

  private ptyInputBytesTotal = 0;
  private wsFlushCount = 0;
  private wsFlushBytesTotal = 0;
  private wsMaxPendingBytes = 0;
  private wsBackpressureEvents = 0;

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
      // Write to PC terminal
      process.stdout.write(data);

      this.ptyInputBytesTotal += Buffer.byteLength(data, 'utf8');

      // Buffer raw data for reconnection history
      this.buffer.append(data);

      // Broadcast raw PTY output to web clients (batched)
      // xterm.js handles all ANSI sequences natively including alternate screen
      this.enqueueWsOutput(data);
    });

    this.ptyManager.on('exit', (exitCode: number) => {
      this.flushPendingWsOutput();
      this._status = 'idle';
      this.wsServer.broadcast({
        type: 'session_ended',
        exitCode,
        reason: exitCode === 0 ? 'Process exited normally' : `Process exited with code ${exitCode}`,
      });
      logger.info({
        exitCode,
        ptyInputBytesTotal: this.ptyInputBytesTotal,
        wsFlushCount: this.wsFlushCount,
        wsFlushBytesTotal: this.wsFlushBytesTotal,
        wsMaxPendingBytes: this.wsMaxPendingBytes,
        wsBackpressureEvents: this.wsBackpressureEvents,
      }, 'Claude Code session ended');
    });

    this.ptyManager.on('error', (err: Error) => {
      logger.error({ err }, 'PTY error');
      this.wsServer.broadcast({
        type: 'error',
        code: 'pty_error',
        message: err.message,
      });
    });

    // Broadcast PTY resize to web clients
    this.ptyManager.on('resize', (cols: number, rows: number) => {
      logger.debug({ cols, rows }, 'PTY resize event, broadcasting to web clients');
      this.wsServer.broadcast({
        type: 'terminal_resize',
        cols,
        rows,
      });
    });
  }

  private enqueueWsOutput(data: string): void {
    this.wsPendingChunks.push(data);
    this.wsPendingBytes += Buffer.byteLength(data, 'utf8');
    this.wsMaxPendingBytes = Math.max(this.wsMaxPendingBytes, this.wsPendingBytes);

    if (this.wsPendingBytes >= WS_HIGH_WATERMARK_BYTES) {
      this.wsBackpressureEvents += 1;
      this.flushPendingWsOutput();
      return;
    }

    if (this.wsPendingBytes >= WS_MAX_CHUNK_BYTES) {
      this.flushPendingWsOutput();
      return;
    }

    if (!this.wsFlushTimer) {
      this.wsFlushTimer = setTimeout(() => {
        this.wsFlushTimer = null;
        this.flushPendingWsOutput();
      }, WS_FLUSH_INTERVAL_MS);
    }
  }

  private flushPendingWsOutput(): void {
    if (this.wsFlushTimer) {
      clearTimeout(this.wsFlushTimer);
      this.wsFlushTimer = null;
    }

    if (this.wsPendingChunks.length === 0) {
      return;
    }

    const output = this.wsPendingChunks.join('');
    const flushBytes = this.wsPendingBytes;
    this.wsPendingChunks = [];
    this.wsPendingBytes = 0;

    this.wsFlushCount += 1;
    this.wsFlushBytesTotal += flushBytes;

    this.wsServer.broadcast({
      type: 'terminal_output',
      data: output,
      seq: this.buffer.sequenceNumber,
    });

    logger.debug({
      flushBytes,
      wsFlushCount: this.wsFlushCount,
      wsPendingBytes: this.wsPendingBytes,
      wsMaxPendingBytes: this.wsMaxPendingBytes,
      wsBackpressureEvents: this.wsBackpressureEvents,
    }, 'Flushed batched terminal output');
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
        onResize: (cols: number, rows: number) => {
          logger.info({ cols, rows }, 'Resize request from web client, applying to PTY');
          this.ptyManager.resize(cols, rows);
        },
        onPermissionDecision: (requestId: string, decision) => {
          logger.info({ requestId, behavior: decision.behavior }, 'Permission decision received from WS client');
          this.hookReceiver.submitDecision(requestId, decision);
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
        cols: this.ptyManager.cols,
        rows: this.ptyManager.rows,
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

    this.hookReceiver.on('ask_question', (data: { sessionId?: string; questions: Question[] }) => {
      this._status = 'waiting_input';
      this.wsServer.broadcast({ type: 'ask_question', questions: data.questions });

      if (this.pushService) {
        this.pushService.notifyAll({
          title: 'Claude Code 需要回答',
          body: data.questions[0]?.question ?? 'Claude 提出了问题',
          tag: 'claude-question',
          renotify: true,
        }).catch((err) => {
          logger.error({ err, sessionId: data.sessionId }, 'Push notification failed');
        });
      }

      logger.info({
        sessionId: data.sessionId,
        questionCount: data.questions.length,
        firstQuestion: data.questions[0]?.question,
      }, 'AskUserQuestion broadcast');
    });

    this.hookReceiver.on('permission_request', (event: PermissionRequestEvent) => {
      this._status = 'waiting_input';

      this.wsServer.broadcast({
        type: 'permission_request',
        requestId: event.requestId,
        toolName: event.toolName,
        toolInput: event.toolInput,
        permissionSuggestions: event.permissionSuggestions,
      });

      if (this.pushService) {
        this.pushService.notifyAll({
          title: 'Claude Code 权限请求',
          body: `请求使用 ${event.toolName}`,
          tag: 'claude-permission',
          renotify: true,
        }).catch((err) => {
          logger.error({ err, requestId: event.requestId }, 'Push notification failed');
        });
      }

      logger.info({
        requestId: event.requestId,
        toolName: event.toolName,
      }, 'PermissionRequest broadcast');
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
