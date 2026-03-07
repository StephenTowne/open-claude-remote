import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import type { SessionStatus, ServerMessage } from '#shared';
import type { HookNotification, TaskCompletedData, NotificationChannel } from '../hooks/hook-types.js';
import { PtyManager } from '../pty/pty-manager.js';
import { OutputBuffer } from '../pty/output-buffer.js';
import { HookReceiver } from '../hooks/hook-receiver.js';
import { HookEventType } from '../hooks/hook-types.js';
import { logger } from '../logger/logger.js';
import type { TerminalRelay } from '../terminal/terminal-relay.js';
import type { PushService } from '../push/push-service.js';
import type { NotificationManager } from '../notification/notification-manager.js';
import type { NotificationServiceFactory } from '../notification/notification-service-factory.js';

const WS_FLUSH_INTERVAL_MS = 16;
const WS_MAX_CHUNK_BYTES = 32 * 1024;

/** 客户端类型：attach（从控端）或 webapp（主控端） */
export type ClientType = 'attach' | 'webapp';

/** 活跃端来源：local（PC终端）、webapp、attach、null（无活跃端） */
export type ActiveSource = 'local' | 'webapp' | 'attach' | null;

interface ClientInfo {
  ws: WebSocket;
  alive: boolean;
  clientType: ClientType;
}

export interface InstanceSessionOptions {
  instanceId: string;
  name: string;
  cwd: string;
  maxBufferLines: number;
  headless: boolean;
  claudeArgs?: string[];
  /** 可选：注入自定义 PtyManager（用于测试） */
  ptyManager?: PtyManager;
}

/**
 * InstanceSession: 单个 Claude 实例的会话协调器
 * 持有: PtyManager, OutputBuffer, HookReceiver, WS 客户端集合
 * 复用 SessionController 的核心逻辑
 */
export class InstanceSession extends EventEmitter {
  readonly instanceId: string;
  readonly name: string;
  readonly cwd: string;
  readonly headless: boolean;
  readonly claudeArgs: string[];
  readonly startedAt: string;

  readonly ptyManager: PtyManager;
  readonly hookReceiver: HookReceiver;

  private _status: SessionStatus = 'idle';
  private buffer: OutputBuffer;
  private clients: Set<ClientInfo> = new Set();

  private _activeSource: ActiveSource = null;
  private _lastKnownSizes: Map<string, { cols: number; rows: number }> = new Map();
  private _relay: TerminalRelay | null = null;

  private pushService: PushService | null = null;
  private notificationServiceFactory: NotificationServiceFactory | null = null;
  private notificationManager: NotificationManager | null = null;
  private instanceUrl: string | null = null;

  private wsPendingChunks: string[] = [];
  private wsPendingBytes = 0;
  private wsFlushTimer: NodeJS.Timeout | null = null;

  constructor(options: InstanceSessionOptions) {
    super();
    this.instanceId = options.instanceId;
    this.name = options.name;
    this.cwd = options.cwd;
    this.headless = options.headless;
    this.claudeArgs = options.claudeArgs ?? [];
    this.startedAt = new Date().toISOString();

    this.ptyManager = options.ptyManager ?? new PtyManager();
    this.hookReceiver = new HookReceiver();
    this.buffer = new OutputBuffer(options.maxBufferLines);

    this.setupPtyHandlers();
    this.setupHookHandlers();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get clientCount(): number {
    return this.clients.size;
  }

  setStatus(status: SessionStatus): void {
    this._status = status;
    this.broadcast({ type: 'status_update', status });
  }

  setPushService(pushService: PushService): void {
    this.pushService = pushService;
  }

  setNotificationServiceFactory(factory: NotificationServiceFactory): void {
    this.notificationServiceFactory = factory;
  }

  setNotificationManager(manager: NotificationManager): void {
    this.notificationManager = manager;
  }

  setInstanceUrl(url: string): void {
    this.instanceUrl = url;
    logger.info({ instanceId: this.instanceId, instanceUrl: url }, 'Instance URL updated');
  }

  get activeSource(): ActiveSource {
    return this._activeSource;
  }

  /**
   * 注入 TerminalRelay 引用，设初始 activeSource 为 'local'，
   * 监听 local_input / local_resize 事件
   */
  setRelay(relay: TerminalRelay): void {
    this._relay = relay;
    this._activeSource = 'local';

    relay.on('local_input', () => {
      this.onUserInput('local');
    });

    relay.on('local_resize', (cols: number, rows: number) => {
      this._lastKnownSizes.set('local', { cols, rows });
    });

    logger.info({ instanceId: this.instanceId }, 'Relay connected, activeSource set to local');
  }

  /**
   * 切换活跃端 + 同步 size + 控制 relay pause/resume
   * 仅在来源变化时执行切换
   */
  private onUserInput(source: ActiveSource): void {
    if (source === this._activeSource) return;

    const prev = this._activeSource;
    this._activeSource = source;

    if (source === 'local') {
      // resumeResize 内部已同步当前 PC 终端尺寸到 PTY，无需再调 syncActiveSourceSize
      this._relay?.resumeResize();
    } else {
      if (prev === 'local' && this._relay) {
        this._relay.pauseResize();
      }
      this.syncActiveSourceSize(source);
    }

    logger.info({
      instanceId: this.instanceId,
      prev,
      next: source,
    }, 'Active source switched');
  }

  /**
   * 从 lastKnownSizes 取 size 调 ptyManager.resize
   */
  private syncActiveSourceSize(source: ActiveSource): void {
    if (!source) return;
    const size = this._lastKnownSizes.get(source);
    if (size) {
      this.ptyManager.resize(size.cols, size.rows);
    }
  }

  // ─── Client Management ────────────────────────────────────

  /**
   * 注册一个 WS 客户端到此实例
   */
  addClient(ws: WebSocket, clientType: ClientType): void {
    const clientInfo: ClientInfo = { ws, alive: true, clientType };
    this.clients.add(clientInfo);

    logger.info({
      instanceId: this.instanceId,
      clientCount: this.clients.size,
      clientType,
    }, 'Client connected to instance');

    ws.on('pong', () => {
      clientInfo.alive = true;
    });

    ws.on('message', (rawData) => {
      const data = rawData.toString();
      this.handleWsMessage(ws, data, clientType);
    });

    ws.on('close', () => {
      this.handleClientRemoval(clientInfo, 'disconnect');
    });

    ws.on('error', (err) => {
      logger.error({ err, instanceId: this.instanceId, clientType: clientInfo.clientType }, 'Client error');
      this.handleClientRemoval(clientInfo, 'error');
    });

    // 发送历史数据
    this.sendTo(ws, {
      type: 'history_sync',
      data: this.buffer.getFullContent(),
      seq: this.buffer.sequenceNumber,
      status: this._status,
      cols: this.ptyManager.cols,
      rows: this.ptyManager.rows,
    });
  }

  /**
   * 统一处理客户端移除（close / error 共用）
   * 重入保护：若 clientInfo 已被移除则跳过
   */
  private handleClientRemoval(clientInfo: ClientInfo, reason: 'disconnect' | 'error'): void {
    if (!this.clients.has(clientInfo)) return;
    this.clients.delete(clientInfo);

    const { clientType } = clientInfo;

    // 活跃端断开回退逻辑
    if (clientType === this._activeSource) {
      const hasRemaining = [...this.clients].some(c => c.clientType === clientType);
      if (!hasRemaining) {
        const prev = this._activeSource;
        this._activeSource = this._relay ? 'local' : null;
        if (this._relay && this._activeSource === 'local') {
          this._relay.resumeResize();
        }
        // 清理已无在线客户端的 size 记录，避免后续新客户端继承旧值
        this._lastKnownSizes.delete(clientType);
        logger.info({
          instanceId: this.instanceId,
          prev,
          next: this._activeSource,
          reason,
        }, 'Active source fallback on disconnect');
      }
    }

    logger.info({
      instanceId: this.instanceId,
      clientCount: this.clients.size,
      clientType,
      reason,
    }, 'Client removed from instance');
  }

  /**
   * 向所有客户端广播消息
   */
  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * 向特定客户端发送消息
   */
  sendTo(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 获取客户端计数
   */
  getClientCounts(): { attach: number; webapp: number } {
    let attach = 0;
    let webapp = 0;
    for (const client of this.clients) {
      if (client.clientType === 'attach') attach++;
      else webapp++;
    }
    return { attach, webapp };
  }

  /**
   * Ping 所有客户端，终止无响应的
   */
  pingClients(): void {
    for (const client of this.clients) {
      if (!client.alive) {
        logger.info({ instanceId: this.instanceId }, 'Terminating unresponsive client');
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }

  // ─── PTY Handlers ─────────────────────────────────────────

  private setupPtyHandlers(): void {
    this.ptyManager.on('data', (data: string) => {
      // Buffer raw data for reconnection history
      this.buffer.append(data);

      // Broadcast raw PTY output to web clients (batched)
      this.enqueueWsOutput(data);
    });

    this.ptyManager.on('exit', (exitCode: number) => {
      this.flushPendingWsOutput();
      this._status = 'idle';
      this.broadcast({
        type: 'session_ended',
        exitCode,
        reason: exitCode === 0 ? 'Process exited normally' : `Process exited with code ${exitCode}`,
      });

      // Gracefully close all WS connections after sending session_ended.
      // ws.close() queues a close frame AFTER the data frame, ensuring
      // the client receives session_ended before the connection drops.
      for (const client of this.clients) {
        client.ws.close(1000, 'PTY exited');
      }

      logger.info({ instanceId: this.instanceId, exitCode }, 'PTY exited');

      // Emit exit event so InstanceManager can auto-remove
      this.emit('exit', exitCode);
    });

    this.ptyManager.on('error', (err: Error) => {
      logger.error({ instanceId: this.instanceId, err }, 'PTY error');
      this.broadcast({
        type: 'error',
        code: 'pty_error',
        message: err.message,
      });
    });

    this.ptyManager.on('resize', (cols: number, rows: number) => {
      this.broadcast({ type: 'terminal_resize', cols, rows });
    });
  }

  private enqueueWsOutput(data: string): void {
    this.wsPendingChunks.push(data);
    this.wsPendingBytes += Buffer.byteLength(data, 'utf8');

    // 当累积数据达到最大块大小时立即刷新
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

    if (this.wsPendingChunks.length === 0) return;

    const output = this.wsPendingChunks.join('');
    this.wsPendingChunks = [];
    this.wsPendingBytes = 0;

    this.broadcast({
      type: 'terminal_output',
      data: output,
      seq: this.buffer.sequenceNumber,
    });
  }

  // ─── WS Message Handler ───────────────────────────────────

  private handleWsMessage(ws: WebSocket, data: string, clientType: ClientType): void {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'user_input':
          if (typeof msg.data === 'string') {
            this.onUserInput(clientType);
            this.ptyManager.write(msg.data);
          }
          break;
        case 'resize':
          if (typeof msg.cols === 'number' && typeof msg.rows === 'number') {
            // 始终记录来源的最新 size
            this._lastKnownSizes.set(clientType, { cols: msg.cols, rows: msg.rows });
            // 仅活跃端（或无活跃端时任何来源）的 resize 应用到 PTY
            if (this._activeSource === null || clientType === this._activeSource) {
              this.ptyManager.resize(msg.cols, msg.rows);
            }
          }
          break;
        case 'heartbeat':
          // Reply with server heartbeat
          this.sendTo(ws, { type: 'heartbeat', timestamp: Date.now() });
          break;
        default:
          logger.warn({ instanceId: this.instanceId, type: msg.type }, 'Unknown WS message type');
      }
    } catch (err) {
      logger.warn({ instanceId: this.instanceId, err }, 'Failed to parse WS message');
    }
  }

  // ─── Hook Handlers ────────────────────────────────────────

  private setupHookHandlers(): void {
    this.hookReceiver.on('notification', (notification: HookNotification) => {
      this._status = 'waiting_input';

      for (const channel of notification.channels) {
        this.sendNotificationByChannel(channel, notification);
      }

      logger.info({
        instanceId: this.instanceId,
        eventType: notification.eventType,
        tool: notification.tool,
        channels: notification.channels,
      }, 'Hook notification processed');
    });

    this.hookReceiver.on('task_completed', (_data: TaskCompletedData) => {
      if (this._status === 'waiting_input') {
        this._status = 'running';
        this.broadcast({
          type: 'status_update',
          status: 'running',
          detail: 'Task resumed',
        });
      }
    });
  }

  private sendNotificationByChannel(channel: NotificationChannel, notification: HookNotification): void {
    if (channel !== 'websocket' && channel !== 'push') {
      if (this.notificationManager && !this.notificationManager.isEnabled(channel)) return;
    }

    const urlHint = this.instanceUrl ? `\n\nInstance: ${this.instanceUrl}` : '';

    switch (channel) {
      case 'websocket':
        this.broadcast({
          type: 'status_update',
          status: 'waiting_input',
          detail: notification.message + urlHint,
        });
        break;

      case 'push':
        if (this.pushService) {
          this.pushService
            .notifyAll({
              title: notification.title,
              body: notification.message + urlHint,
              tag: `claude-${notification.eventType}`,
              renotify: true,
            })
            .catch((err) => {
              logger.error({ err, channel: 'push' }, 'Failed to send push notification');
            });
        }
        break;

      case 'dingtalk':
        if (this.notificationServiceFactory) {
          const service = this.notificationServiceFactory.getDingtalkService();
          if (service) {
            const body = notification.detail
              ? `${notification.message}\n${notification.detail}${urlHint}`
              : notification.message + urlHint;
            service.sendNotification(notification.title, notification.tool, body).catch((err) => {
              logger.error({ err, channel: 'dingtalk' }, 'Failed to send dingtalk notification');
            });
          }
        }
        break;

      case 'wechat_work':
        if (this.notificationServiceFactory) {
          const service = this.notificationServiceFactory.getWechatWorkService();
          if (service) {
            const body = notification.detail
              ? `${notification.message}\n${notification.detail}${urlHint}`
              : notification.message + urlHint;
            service.sendNotification(notification.title, notification.tool, body).catch((err) => {
              logger.error({ err, channel: 'wechat_work' }, 'Failed to send WeChat notification');
            });
          }
        }
        break;
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  /**
   * 销毁实例：终止 PTY，断开所有客户端
   */
  destroy(): void {
    if (this.wsFlushTimer) {
      clearTimeout(this.wsFlushTimer);
      this.wsFlushTimer = null;
    }

    // 终止所有客户端连接
    for (const client of this.clients) {
      client.ws.terminate();
    }
    this.clients.clear();

    // 销毁 PTY
    this.ptyManager.destroy();

    logger.info({ instanceId: this.instanceId }, 'Instance session destroyed');
  }
}
