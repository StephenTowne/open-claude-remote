import { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WS_HEARTBEAT_INTERVAL_MS, MAX_WS_MESSAGE_SIZE } from '@claude-remote/shared';
import type { ServerMessage } from '@claude-remote/shared';
import { AuthModule } from '../auth/auth-middleware.js';
import { logger } from '../logger/logger.js';

interface ClientInfo {
  ws: WebSocket;
  alive: boolean;
}

/**
 * WebSocket server with session-based auth and heartbeat.
 */
export class WsServer {
  private wss: WebSocketServer;
  private clients: Set<ClientInfo> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandler: ((ws: WebSocket, data: string) => void) | null = null;
  private connectHandler: ((ws: WebSocket) => void) | null = null;

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
  onMessage(handler: (ws: WebSocket, data: string) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set a handler for new client connections.
   */
  onConnect(handler: (ws: WebSocket) => void): void {
    this.connectHandler = handler;
  }

  /**
   * HTTP upgrade → authenticate via cookie, then establish WS.
   */
  private setupUpgrade(): void {
    this.httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
      // Only handle /ws path for WebSocket upgrades
      const pathname = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
      if (pathname !== '/ws') {
        socket.destroy();
        return;
      }

      const cookieHeader = req.headers.cookie ?? '';
      const sessionId = this.authModule.getSessionFromCookieHeader(cookieHeader);

      if (!sessionId || !this.authModule.validateSession(sessionId)) {
        logger.warn({ url: req.url }, 'WS upgrade rejected: invalid session');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });
  }

  /**
   * Handle new WebSocket connections.
   */
  private setupConnection(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientInfo: ClientInfo = { ws, alive: true };
      this.clients.add(clientInfo);
      logger.info({ clientCount: this.clients.size }, 'WebSocket client connected');

      ws.on('pong', () => {
        clientInfo.alive = true;
      });

      ws.on('message', (rawData) => {
        const data = rawData.toString();
        if (this.messageHandler) {
          this.messageHandler(ws, data);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientInfo);
        logger.info({ clientCount: this.clients.size }, 'WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        logger.error({ err }, 'WebSocket client error');
        this.clients.delete(clientInfo);
      });

      // Notify connect handler
      if (this.connectHandler) {
        this.connectHandler(ws);
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
          this.clients.delete(client);
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
