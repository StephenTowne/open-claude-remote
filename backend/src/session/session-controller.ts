import { WebSocket } from 'ws';
import type { SessionStatus } from '@claude-remote/shared';
import { PtyManager } from '../pty/pty-manager.js';
import { OutputBuffer } from '../pty/output-buffer.js';
import { WsServer, type ClientType } from '../ws/ws-server.js';
import { HookReceiver, type HookNotification } from '../hooks/hook-receiver.js';
import { handleWsMessage } from '../ws/ws-handler.js';
import { logger } from '../logger/logger.js';
import type { PushService } from '../push/push-service.js';
import type { TerminalRelay } from '../terminal/terminal-relay.js';
import type { DingtalkService } from '../notification/dingtalk-service.js';

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
  private dingtalkService: DingtalkService | null = null;

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
    private terminalRelay?: TerminalRelay,
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
   * Inject DingtalkService for hook-triggered notifications.
   */
  setDingtalkService(dingtalkService: DingtalkService): void {
    this.dingtalkService = dingtalkService;
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
    this.wsServer.onMessage((ws: WebSocket, data: string, clientType: ClientType) => {
      handleWsMessage(ws, data, {
        onUserInput: (input: string) => {
          logger.debug({ length: input.length }, 'User input from client');
          this.ptyManager.write(input);
        },
        onResize: (cols: number, rows: number) => {
          // webapp 在线时忽略 attach 的 resize（webapp 是主控端）
          if (clientType === 'attach') {
            const counts = this.wsServer.getClientCounts();
            if (counts.webapp > 0) {
              logger.debug({ cols, rows }, 'Ignoring attach resize, webapp is master');
              return;
            }
          }
          logger.info({ cols, rows, clientType, currentPtyCols: this.ptyManager.cols, currentPtyRows: this.ptyManager.rows }, 'Resize request from client, applying to PTY');
          this.ptyManager.resize(cols, rows);
          logger.info({ ptyCols: this.ptyManager.cols, ptyRows: this.ptyManager.rows }, 'PTY resize after client request');
        },
      });
    });

    // 处理客户端连接：区分主控端（webapp）和从控端（attach）
    this.wsServer.onConnect((ws: WebSocket, clientType: ClientType) => {
      if (clientType === 'attach') {
        // attach 客户端连接：作为从控端
        // 暂停 PC 端 resize，attach 将跟随 webapp 的尺寸
        if (this.terminalRelay) {
          this.terminalRelay.pauseResize();
        }
        logger.info('attach client connected (slave mode)');
      } else {
        // WebApp 客户端连接：作为主控端
        // 暂停 PC 端 resize，让 webapp 接管尺寸控制
        const counts = this.wsServer.getClientCounts();
        if (this.terminalRelay && counts.attach === 0 && counts.webapp === 1) {
          this.terminalRelay.pauseResize();
          logger.info('First WebApp client connected, PC resize paused');
        }
        logger.info('WebApp client connected (master mode)');
      }

      // 发送历史数据
      this.wsServer.sendTo(ws, {
        type: 'history_sync',
        data: this.buffer.getFullContent(),
        seq: this.buffer.sequenceNumber,
        status: this._status,
        cols: this.ptyManager.cols,
        rows: this.ptyManager.rows,
      });
    });

    // 处理客户端断开：根据剩余客户端类型决定是否恢复 PC 端 resize
    this.wsServer.onDisconnect((clientCounts: { attach: number; webapp: number }) => {
      const { attach, webapp } = clientCounts;

      if (attach === 0 && webapp === 0) {
        // 所有客户端断开：恢复 PC 端 resize
        if (this.terminalRelay) {
          this.terminalRelay.resumeResize();
          logger.info('All clients disconnected, PC resize resumed');
        }
      } else if (attach === 0 && webapp > 0) {
        // attach 断开，但 WebApp 还在：
        // 不恢复 PC 端 resize（WebApp 继续控制尺寸）
        logger.info({ webappCount: webapp }, 'attach disconnected, WebApp still connected');
      } else if (attach > 0 && webapp === 0) {
        // WebApp 全部断开，attach 仍在：
        // 广播当前 PTY 尺寸，触发 attach 客户端的 scheduleResizeSync 恢复自身尺寸
        this.wsServer.broadcast({
          type: 'terminal_resize',
          cols: this.ptyManager.cols,
          rows: this.ptyManager.rows,
        });
        logger.info('All WebApps disconnected, broadcast PTY size to trigger attach re-sync');
      }
      // attach 还在且 webapp 也在：保持当前状态
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

      // Send dingtalk notification if service is available
      if (this.dingtalkService) {
        this.dingtalkService.sendNotification(
          'Claude Code 需要输入',
          notification.tool,
          notification.message
        ).catch((err) => {
          logger.error({ err }, 'Failed to send dingtalk notification');
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
