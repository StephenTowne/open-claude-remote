import { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WS_HEARTBEAT_INTERVAL_MS, MAX_WS_MESSAGE_SIZE } from '#shared';
import type { ServerMessage } from '#shared';
import { AuthModule } from '../auth/auth-middleware.js';
import { logger } from '../logger/logger.js';

/** 客户端类型：attach（从控端）或 webapp（主控端） */
export type ClientType = 'attach' | 'webapp';

interface ClientInfo {
  ws: WebSocket;
  alive: boolean;
  clientType: ClientType;
}

/**
 * WebSocket server with session-based auth and heartbeat.
 * 支持双重认证：
 * 1. Cookie Session 认证（现有）
 * 2. URL 参数 ?token=xxx 认证（用于 attach 命令）
 */
export class WsServer {
  private wss: WebSocketServer;
  private clients: Set<ClientInfo> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandler: ((ws: WebSocket, data: string, clientType: ClientType) => void) | null = null;
  private connectHandler: ((ws: WebSocket, clientType: ClientType) => void) | null = null;
  private disconnectHandler: ((clientCounts: { attach: number; webapp: number }) => void) | null = null;
  private upgradeClientTypes = new WeakMap<IncomingMessage, ClientType>();

  constructor(
    private httpServer: HttpServer,
    private authModule: AuthModule,
  ) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_SIZE });
    this.setupUpgrade();
    this.setupConnection();
    this.startHeartbeat();
  }

  /**
   * Set a handler for incoming messages from clients.
   */
  onMessage(handler: (ws: WebSocket, data: string, clientType: ClientType) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set a handler for new client connections.
   */
  onConnect(handler: (ws: WebSocket, clientType: ClientType) => void): void {
    this.connectHandler = handler;
  }

  /**
   * Set a handler for client disconnections (after client is removed from set).
   */
  onDisconnect(handler: (clientCounts: { attach: number; webapp: number }) => void): void {
    this.disconnectHandler = handler;
  }

  /**
   * HTTP upgrade → authenticate via cookie or token, then establish WS.
   * 支持两种认证方式：
   * 1. Cookie Session 认证（现有流程）
   * 2. URL 参数 ?token=xxx 认证（用于 attach 命令）
   */
  private setupUpgrade(): void {
    this.httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
      // Only handle /ws path for WebSocket upgrades
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;
      if (pathname !== '/ws') {
        socket.destroy();
        return;
      }

      // 方式 1: 检查 URL 参数中的 token（attach 客户端）
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) {
        if (!this.authModule.verifyToken(tokenParam)) {
          logger.warn({
            url: req.url,
            reason: 'invalid_token_param',
          }, 'WS upgrade rejected: invalid token param');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        // 标记为 attach 客户端（从控端）
        this.upgradeClientTypes.set(req, 'attach');
        logger.info({
          remoteAddress: req.socket.remoteAddress,
          clientType: 'attach',
        }, 'WS upgrade accepted via token param');
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
        return;
      }

      // 方式 2: 检查 Cookie Session（WebApp 客户端）
      const cookieHeader = req.headers.cookie ?? '';
      const sessionId = this.authModule.getSessionFromCookieHeader(cookieHeader);

      const isValid = sessionId ? this.authModule.validateSession(sessionId) : false;
      if (!isValid) {
        logger.warn({
          url: req.url,
          cookieNames: cookieHeader.split(';').map(c => c.trim().split('=')[0]).filter(Boolean),
          sessionCookieName: this.authModule.getCookieName(),
          hasSessionCookie: Boolean(sessionId),
        }, 'WS upgrade rejected: invalid session');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 标记为 WebApp 客户端（主控端）
      this.upgradeClientTypes.set(req, 'webapp');
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });
  }

  /**
   * Handle new WebSocket connections.
   */
  private setupConnection(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // 从 WeakMap 读取客户端类型（由 setupUpgrade 设置）
      const clientType = this.upgradeClientTypes.get(req) ?? 'webapp';
      const clientInfo: ClientInfo = { ws, alive: true, clientType };
      this.clients.add(clientInfo);
      logger.info({ clientCount: this.clients.size, clientType }, 'WebSocket client connected');

      ws.on('pong', () => {
        clientInfo.alive = true;
      });

      ws.on('message', (rawData) => {
        const data = rawData.toString();
        if (this.messageHandler) {
          this.messageHandler(ws, data, clientInfo.clientType);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientInfo);
        const counts = this.getClientCounts();
        logger.info({ clientCount: this.clients.size, ...counts }, 'WebSocket client disconnected');
        if (this.disconnectHandler) {
          this.disconnectHandler(counts);
        }
      });

      ws.on('error', (err) => {
        logger.error({ err, clientType }, 'WebSocket client error');
        this.clients.delete(clientInfo);
        const counts = this.getClientCounts();
        if (this.disconnectHandler) {
          this.disconnectHandler(counts);
        }
      });

      // Notify connect handler with client type
      if (this.connectHandler) {
        this.connectHandler(ws, clientType);
      }
    });
  }

  /**
   * Broadcast a message to all connected clients.
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
   * Send a message to a specific client.
   */
  sendTo(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat pings.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          logger.info('Terminating unresponsive WebSocket client');
          client.ws.terminate();
          // 不手动删除，让 close 事件处理器统一处理删除和 disconnectHandler 调用
          continue;
        }
        client.alive = false;
        client.ws.ping();
      }
    }, WS_HEARTBEAT_INTERVAL_MS);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Get connected client count.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client counts by type.
   */
  getClientCounts(): { attach: number; webapp: number } {
    let attach = 0;
    let webapp = 0;
    for (const client of this.clients) {
      if (client.clientType === 'attach') {
        attach++;
      } else {
        webapp++;
      }
    }
    return { attach, webapp };
  }

  /**
   * Shutdown the WebSocket server.
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients) {
      client.ws.terminate();
    }
    this.clients.clear();
    this.wss.close();
  }
}
